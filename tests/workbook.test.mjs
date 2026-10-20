import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sheetRow,stationRows,stationExport,csvParse,challengeFamily,stationProposal,proposalBody} from '../assets/core.js';
import {parseProposal,applyProposal} from '../scripts/station-updates.mjs';

const sample=JSON.parse(await readFile(new URL('./fixtures/workbook-samples.json',import.meta.url),'utf8'));
test('the spreadsheet examples reproduce grids and AU16 distance/bearing',()=>{
  for(const row of sample.rows){
    const actual=sheetRow(stationRows([row])[0],sample.reference);
    assert.equal(actual.grid_6.toUpperCase(),row.grid_6.toUpperCase());assert.equal(actual.grid_4,row.grid_4);
    assert.ok(Math.abs(actual.distance_km-row.distance_km)<=1,row.callsign);
    assert.ok(Math.abs((actual.bearing_deg-row.bearing_deg+180)%360-180)<=1,row.callsign);
  }
});
test('distance and bearing follow the selected reference rather than fixed AU16 values',()=>{
  const row=sample.rows.find(s=>s.callsign==='AU1'),other=sample.rows.find(s=>s.callsign==='NZ1');
  const fromAU16=sheetRow(row,sample.reference),fromNZ=sheetRow(row,other);
  assert.notEqual(fromAU16.distance_km,fromNZ.distance_km);assert.equal(fromNZ.reference_callsign,'NZ1');
  assert.equal(sheetRow(row,row).distance_km,0);assert.equal(sheetRow(row,row).bearing_deg,0);
  assert.equal(sheetRow(row).distance_km,null);
});
test('workbook challenge groups survive imports, edits and reviewed publication',()=>{
  for(const [group,family] of [['SSB','SSB'],['2GNS1','2G'],['2GNS2','2G'],['3GNS1','3G'],['','Unassigned']]){
    const [row]=stationRows([{...sample.rows[0],challenge_group:group}]);assert.equal(row.challenge_group,group);assert.equal(challengeFamily(row),family);
  }
  const [previous]=stationRows([sample.rows[0]]),proposal=stationProposal({...previous,challenge_group:'2GNS2'},previous);
  const next=applyProposal({stations:[previous]},parseProposal(proposalBody(proposal)),{number:9});
  assert.equal(next.stations[0].challenge_group,'2GNS2');assert.equal(next.stations[0].prefix,previous.prefix);
});
test('exports contain the useful spreadsheet columns and current reference',()=>{
  const rows=stationRows(sample.rows),csv=csvParse(stationExport(rows,'csv',sample.reference).text);
  for(const key of ['callsign','prefix','challenge_group','lat','lon','grid_6','grid_4','distance_km','bearing_deg','reference_callsign'])assert.ok(Object.hasOwn(csv[0],key),key);
  assert.equal(csv[0].reference_callsign,'AU16');assert.ok(csv[0].challenge_group);
  assert.ok(stationExport(rows,'kml',sample.reference).text.includes('<Data name="challenge_group">'));
  const geo=JSON.parse(stationExport(rows,'geojson',sample.reference).text);assert.ok(geo.features[0].properties.grid_6);
});
