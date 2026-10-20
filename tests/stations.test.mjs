import test from 'node:test';
import assert from 'node:assert/strict';
import {stationRows,locator,locatorPosition,distance,upsertStation,stationProposal,proposalBody,stationExport} from '../assets/core.js';
import {parseProposal,applyProposal,authorisedEvent} from '../scripts/station-updates.mjs';

const station=stationRows([{callsign:'AU1',name:'Test team',country:'Australia',place:'Sydney',lat:-33.8688,lon:151.2093,location_source:'Reported'}])[0];
const roster={stations:[station],updated_at:'2026-10-20T00:00:00Z'};
test('editor adds, changes position and renames without duplicating stations',()=>{
  const added=upsertStation([station],{...station,callsign:'AU2'});assert.equal(added.length,2);
  const edited=upsertStation(added,{...station,callsign:'AU3',lat:-34.1},'AU1');
  assert.equal(edited.length,2);assert.ok(!edited.some(s=>s.callsign==='AU1'));assert.equal(edited.find(s=>s.callsign==='AU3').lat,-34.1);
  assert.throws(()=>upsertStation(added,{...station,callsign:'AU2'},'AU1'),/already exists/);
  assert.throws(()=>upsertStation(added,station),/already exists/);
  assert.throws(()=>upsertStation(added,station,'AU99'),/no longer/);
  assert.equal(station.callsign,'AU1');
});
test('locator conversion handles NZ, Australia and geographic edges',()=>{
  const nz={lat:-41.1435,lon:175.0358};assert.equal(locator(nz),'RE78mu');
  for(const p of [nz,station,{lat:90,lon:180},{lat:-90,lon:-180}]){
    const grid=locator(p),centre=locatorPosition(grid);assert.ok(distance(p,centre)<6);
    assert.equal(locator(centre),grid);
  }
  assert.ok(distance(locatorPosition('RE78'),nz)<100);
  assert.throws(()=>locatorPosition('ZZ99xx'));assert.throws(()=>locatorPosition('RE78m'));
});
test('place names survive CSV, GeoJSON and proposal validation',()=>{
  assert.ok(stationExport([station],'csv').text.includes('Sydney'));
  assert.equal(JSON.parse(stationExport([station],'geojson').text).features[0].properties.place,'Sydney');
  assert.equal(parseProposal(proposalBody(stationProposal({...station,place:'New place'},station))).station.place,'New place');
});
test('a shared add/update preserves unrelated data and records request provenance',()=>{
  const add=stationProposal({...station,callsign:'AU2'});
  const next=applyProposal(roster,parseProposal(proposalBody(add)),{number:12,now:'2026-10-20T01:00:00Z'});
  assert.equal(next.stations.length,2);assert.ok(next.stations.find(s=>s.callsign==='AU2').location_source.includes('#12'));
  const update=stationProposal({...station,callsign:'AU3',lat:-34.1},station);
  const changed=applyProposal(roster,parseProposal(proposalBody(update)),{number:13});
  assert.equal(changed.stations.length,1);assert.equal(changed.stations[0].callsign,'AU3');
  assert.equal(roster.stations[0].lat,station.lat);
});
test('stale, duplicate and malformed public updates cannot overwrite the roster',()=>{
  assert.throws(()=>applyProposal(roster,stationProposal(station),{number:1}),/already exists/);
  const request=stationProposal({...station,lat:-34},station);
  assert.throws(()=>applyProposal({...roster,stations:[{...station,lat:-35}]},request,{number:2}),/stale/);
  assert.throws(()=>parseProposal(proposalBody({...request,station:{...station,lat:999}})));
  assert.throws(()=>parseProposal(proposalBody({...request,station:{...station,token:'secret'}})),/map fields/);
  assert.throws(()=>parseProposal('```json\n{}\n```\n```json\n{}\n```'),/one JSON/);
  assert.throws(()=>parseProposal('x'.repeat(10001)),/oversized/);
});
test('approval checks the labeller permission and the exact current request',async()=>{
  const body=proposalBody(stationProposal({...station,lat:-34},station));
  const event={action:'labeled',label:{name:'publish-station'},sender:{login:'Maintainer'},issue:{number:1,body}};
  const api=async path=>path.startsWith('collaborators/')?{permission:'write'}:{state:'open',body,labels:[{name:'publish-station'}]};
  assert.equal((await authorisedEvent(event,api)).station.lat,-34);
  await assert.rejects(()=>authorisedEvent(event,async path=>path.startsWith('collaborators/')?{permission:'read'}:api(path)),/maintainer/);
  await assert.rejects(()=>authorisedEvent(event,async path=>path.startsWith('collaborators/')?{permission:'admin'}:{state:'open',body:'edited',labels:[{name:'publish-station'}]}),/changed/);
  await assert.rejects(()=>authorisedEvent({...event,label:{name:'station-update'}},api),/labelled/);
});
