import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stationSetup,findSetupStation} from '../assets/station-setup.js';

const {stations}=JSON.parse(await readFile(new URL('../data/stations.json',import.meta.url),'utf8'));
// Fixed geographic examples keep future reviewed roster corrections publishable.
const examples=[
  {callsign:'NZ1',country:'New Zealand',lat:-41.1435,lon:175.0358},
  {callsign:'NZ2',country:'New Zealand',lat:-40.555198,lon:175.641177},
  {callsign:'AU16',country:'Australia',lat:-19.319023,lon:146.790159},
  {callsign:'US70',country:'United States',lat:48.500976,lon:-122.898152},
  {callsign:'CA88',country:'Canada',lat:49.271891,lon:-123.141679}
];
test('station setup fills the current NZ1 location and NZ time zone from an exact callsign',()=>{
  const match=findSetupStation(examples,' nz1 '),home=stationSetup(match);
  assert.deepEqual(home,{callsign:'NZ1',country:'New Zealand',lat:-41.1435,lon:175.0358,zone:'Pacific/Auckland'});
  const corrected=[{...match,lat:-41.15,lon:175.01}];
  assert.equal(stationSetup(findSetupStation(corrected,'NZ1')).lat,-41.15);
  assert.equal(findSetupStation(examples,'NZ'),null);
  assert.equal(findSetupStation(examples,'NZ1 unknown'),null);
  assert.equal(findSetupStation(examples,''),null);
});
test('time zone follows station coordinates rather than a fixed Australian default',()=>{
  for(const [call,zone] of [['AU16','Australia/Brisbane'],['US70','America/Los_Angeles'],['CA88','America/Vancouver'],['NZ2','Pacific/Auckland']])assert.equal(stationSetup(findSetupStation(examples,call)).zone,zone,call);
  const local={...findSetupStation(examples,'NZ1'),lat:-43.95,lon:-176.55};
  assert.equal(stationSetup(local).zone,'Pacific/Chatham');
  assert.equal(stationSetup({...local,country:'Unspecified'}).country,'');
});
test('every registered station produces a supported display zone without changing the roster',()=>{
  const before=JSON.stringify(stations);
  for(const station of stations){const home=stationSetup(station);assert.doesNotThrow(()=>new Intl.DateTimeFormat('en',{timeZone:home.zone}));assert.equal(home.lat,station.lat);assert.equal(home.lon,station.lon);}
  assert.equal(JSON.stringify(stations),before);
});
