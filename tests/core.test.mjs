import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {distance,bearing,greatCircle,sunElevation,sunPosition,solarEvents,darkPolygon,csvParse,csvExport,fileRows,stationRows,channelRows,permission,contactRow,isWorked,stationExport,antennaDimensions} from '../assets/core.js';

const sydney={lat:-33.8688,lon:151.2093},trentham={lat:-41.1435,lon:175.0358};
const home={...sydney,callsign:'AU1',country:'Australia',zone:'Australia/Sydney'};
const channel={channel_id:'TEST',dial_mhz:13.953,centre_mhz:13.9545,mode:'USB',country:'Australia',authorised:true,authority:'Test authority',valid_from:'2026-10-01',valid_to:'2026-10-22'};

test('great-circle geometry uses signed NZ coordinates and reciprocal distances',()=>{
  assert.ok(distance(sydney,trentham)>2200&&distance(sydney,trentham)<2300);
  assert.ok(Math.abs(distance(sydney,trentham)-distance(trentham,sydney))<1e-8);
  assert.ok(bearing(sydney,trentham)>115&&bearing(sydney,trentham)<120);
  assert.equal(distance(sydney,sydney),0);assert.equal(bearing(sydney,sydney),null);
});
test('short and long path endpoints agree and avoid dateline jumps',()=>{
  for(const long of [false,true]){
    const points=greatCircle(trentham,{lat:47.6062,lon:-122.3321},long);
    assert.ok(Math.abs(points.at(-1)[0]-47.6062)<1e-6);
    assert.ok(Math.abs(((points.at(-1)[1]+122.3321+540)%360)-180)<1e-6);
    for(let i=1;i<points.length;i++)assert.ok(Math.abs(points[i][1]-points[i-1][1])<=180);
  }
});
test('solar geometry puts the sun overhead at the subsolar point',()=>{
  for(const date of ['2026-03-20T12:00Z','2026-06-21T00:00Z','2026-12-21T12:00Z']){
    const at=new Date(date),p=sunPosition(at);
    assert.ok(Math.abs(sunElevation(p,at)-90)<.00001);
    assert.ok(sunElevation({lat:-p.lat,lon:p.lon+180},at)<-89.999);
  }
});
test('greyline contours retain their solar elevation including equinox and poles',()=>{
  for(const date of ['2026-03-20T12:00Z','2026-06-21T00:00Z','2026-12-21T12:00Z'])for(const threshold of [0,-12]){
    const at=new Date(date),poly=darkPolygon(at,threshold);
    assert.ok(poly.length>=181);
    for(const [lat,lon] of poly.slice(0,181))assert.ok(Math.abs(sunElevation({lat,lon},at)-threshold)<.00001);
  }
});
test('solar events are UTC dated and polar no-crossing is explicit',()=>{
  const day='2026-10-20',events=solarEvents(trentham,day);
  assert.equal(events.sunrise.length,1);assert.equal(events.sunset.length,1);
  assert.ok([...events.sunrise,...events.sunset,...events.dawn,...events.dusk].every(t=>t.startsWith(day)&&t.endsWith('Z')));
  const polar=solarEvents({lat:89,lon:0},'2026-06-21');assert.equal(polar.sunrise.length,0);assert.equal(polar.sunset.length,0);
});
test('CSV handles BOM, quoted commas, newlines, escaped quotes and CRLF',()=>{
  const input='\uFEFFcallsign,name,lat,lon\r\nAU1,"Team, \"\"One\"\"\nfield",-33,151\r\n';
  const rows=csvParse(input);assert.equal(rows[0].name,'Team, "One"\nfield');
  assert.equal(stationRows(rows)[0].lat,-33);
  assert.equal(csvParse('callsign\tlat\tlon\nNZ1\t-41\t175')[0].lon,'175');
});
test('malformed CSV, duplicate headings and duplicate callsigns reject the full import',()=>{
  assert.throws(()=>csvParse('a,b\n"oops,1'),/Unclosed/);
  assert.throws(()=>csvParse('a,a\n1,2'),/unique/);
  assert.throws(()=>csvParse('a,b\n1,2,3'),/expected/);
  assert.throws(()=>stationRows([{callsign:'AU1',lat:-33,lon:151},{callsign:'AU1',lat:-30,lon:150}]),/Duplicate/);
});
test('missing and invalid coordinates never silently become 0,0',()=>{
  for(const lat of ['',null,undefined,'NaN',Infinity,91])assert.throws(()=>stationRows([{callsign:'AU1',lat,lon:151}]));
  assert.throws(()=>stationRows([{callsign:'<img onerror=alert(1)>',lat:1,lon:2}]));
  assert.equal(stationRows([{callsign:'CA1',lat:0,lon:0}])[0].lat,0);
});
test('GeoJSON uses longitude first and round-trips across export formats',()=>{
  const rows=stationRows([{callsign:'NZ1',country:'New Zealand',lat:-41.1435,lon:175.0358,name:'NZ & One'}]);
  const geo=stationExport(rows,'geojson');const parsed=JSON.parse(geo.text);
  assert.deepEqual(parsed.features[0].geometry.coordinates,[175.0358,-41.1435]);
  assert.equal(stationRows(fileRows(geo.text,'roster.geojson'))[0].lat,-41.1435);
  const kml=stationExport(rows,'kml').text;assert.ok(kml.includes('175.0358,-41.1435,0'));
  rows[0].country='NZ & <Other>';assert.ok(stationExport(rows,'kml').text.includes('NZ &amp; &lt;Other&gt;'));
  assert.equal(stationRows(csvParse(stationExport(rows,'csv').text))[0].lat,-41.1435);
});
test('CSV exports neutralise formulas while preserving signed numeric coordinates',()=>{
  const text=csvExport([{name:'=HYPERLINK("bad")',lat:-41.1435,notes:'\t+SUM(1,1)'}],['name','lat','notes']);
  const row=csvParse(text)[0];assert.ok(row.name.startsWith("'="));assert.equal(row.lat,'-41.1435');assert.ok(row.notes.startsWith("'\t+"));
});
test('dial values remain exact; an assignment alone cannot create a dial',()=>{
  const [row]=channelRows([channel]);assert.equal(row.dial_mhz,13.953);assert.equal(row.centre_mhz,13.9545);
  assert.throws(()=>channelRows([{channel_id:'A',centre_mhz:17.515,mode:'USB'}]),/Explicit dial/);
  assert.equal(channelRows([{...channel,dial_khz:17513.6,dial_mhz:undefined}])[0].dial_mhz,17.5136);
});
test('Australian approval requires reference, correct country/station and valid date',()=>{
  const [c]=channelRows([channel]),at=new Date('2026-10-20T00:00Z');
  assert.equal(permission(c,home,at).allowed,true);
  for(const override of [{authority:''},{country:'Canada'},{local_callsign:'AU2'},{authorised:false},{valid_to:'2026-10-19'},{valid_from:'2026-10-21'}])assert.equal(permission({...c,...override},home,at).allowed,false);
  assert.equal(permission(c,null,at).allowed,false);
  assert.equal(permission(c,{...home,country:'New Zealand'},at).allowed,false);
});
test('receive-only and planned checks cannot become confirmed contacts',()=>{
  for(const result of ['rx_only','nothing_heard','unreadable','planned'])assert.equal(isWorked({result}),false);
  assert.equal(isWorked({result:'two_way_voice'}),true);assert.equal(isWorked({result:'two_way_data'}),true);
  const c=contactRow({utc:'2026-10-20T00:00Z',callsign:'ca1',dial_mhz:13.953,result:'rx_only'});
  assert.equal(c.callsign,'CA1');assert.equal(c.power_w,null);assert.equal(c.readability,null);
  assert.throws(()=>contactRow({...c,utc:'nonsense'}));assert.throws(()=>contactRow({...c,result:'invented'}));
});
test('inverted V length and geometry match 16.0341 MHz in feet',()=>{
  const d=antennaDimensions(16.0341,90),ft=3.280839895;
  assert.ok(Math.abs(d.leg_m*ft-14.6)<.05);assert.ok(Math.abs(d.total_m*ft-29.2)<.05);
  assert.ok(Math.abs(d.height_m*ft-10.3)<.05);assert.ok(Math.abs(d.span_m*ft-20.6)<.1);
  assert.throws(()=>antennaDimensions(0,90));assert.throws(()=>antennaDimensions(16,0));
});
test('published roster has only approved map fields and no private console artifacts',async()=>{
  const raw=JSON.parse(await readFile(new URL('../data/stations.json',import.meta.url),'utf8'));
  const rows=stationRows(raw.stations);assert.ok(rows.length>0&&rows.length<=2000);
  const allowed=['callsign','prefix','challenge_group','name','country','lat','lon','location_source','place'];
  for(const row of raw.stations)assert.ok(Object.keys(row).every(key=>allowed.includes(key)));
  assert.ok(!/slack_user|slack_team|access.key|cookie|token|recording|10\.100\.5\./i.test(JSON.stringify(raw)));
  assert.equal(new Set(rows.map(s=>s.callsign)).size,rows.length);
});
