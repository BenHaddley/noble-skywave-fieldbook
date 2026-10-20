// Pure calculations and import/export rules, shared with the test suite.
export const EARTH_KM = 6371.009;
const rad = Math.PI / 180;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const xml = escapeHtml;
export function coordinate(value, limit, label) {
  if (value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) throw new Error(`Invalid ${label}; use signed decimal degrees`);
  return Number(value);
}
export function callsign(value) {
  const call = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 /_-]{0,31}$/.test(call)) throw new Error('Callsign must contain 1–32 letters, numbers, spaces, /, _ or -');
  return call;
}
export function distance(a, b) {
  const dlat = (b.lat-a.lat)*rad, dlon = (b.lon-a.lon)*rad;
  const h = Math.sin(dlat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return EARTH_KM * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function bearing(a, b) {
  const y = Math.sin((b.lon-a.lon)*rad)*Math.cos(b.lat*rad);
  const x = Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lon-a.lon)*rad);
  return Math.hypot(x,y) < 1e-12 ? null : (Math.atan2(y,x)/rad+360)%360;
}
export function greatCircle(a, b, long = false) {
  let delta = distance(a,b)/EARTH_KM, theta = (bearing(a,b) ?? 0)*rad;
  if (delta < 1e-9) return [[a.lat,a.lon],[b.lat,b.lon]];
  if (long) { delta=2*Math.PI-delta; theta+=Math.PI; }
  let previous=a.lon;
  return Array.from({length:129}, (_,i)=>{
    const d=delta*i/128, p=a.lat*rad, l=a.lon*rad;
    const lat=Math.asin(Math.max(-1,Math.min(1,Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(theta))));
    let lon=(l+Math.atan2(Math.sin(theta)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(lat)))/rad;
    lon+=360*Math.round((previous-lon)/360); previous=lon;
    return [lat/rad,lon];
  });
}
export function sunPosition(at) {
  const days=at.getTime()/86400000-10957.5, mean=(280.46+.9856474*days)%360;
  const anomaly=((357.528+.9856003*days)%360)*rad;
  const ecliptic=(mean+1.915*Math.sin(anomaly)+.02*Math.sin(2*anomaly))*rad;
  const obliquity=(23.439-.0000004*days)*rad;
  const dec=Math.asin(Math.sin(obliquity)*Math.sin(ecliptic));
  const ra=Math.atan2(Math.cos(obliquity)*Math.sin(ecliptic),Math.cos(ecliptic));
  const sidereal=((18.697374558+24.06570982441908*days)%24)*15;
  return {lat:dec/rad,lon:((ra/rad-sidereal+540)%360+360)%360-180};
}
export function sunElevation(point, at) {
  const sun=sunPosition(at), p=point.lat*rad, d=sun.lat*rad;
  return Math.asin(Math.max(-1,Math.min(1,Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos((point.lon-sun.lon)*rad))))/rad;
}
export function darkPolygon(at, threshold=0) {
  // A spherical cap around the anti-solar point. Unlike pole-closure alone,
  // this also handles deep-night caps that contain neither pole at equinox.
  const sun=sunPosition(at),p=-sun.lat*rad,l=(sun.lon+180)*rad,d=(90+threshold)*rad,out=[];
  let previous=l/rad;
  for(let i=0;i<=180;i++){
    const theta=i*2*rad;
    const lat=Math.asin(Math.max(-1,Math.min(1,Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(theta))));
    let lon=(l+Math.atan2(Math.sin(theta)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(lat)))/rad;
    lon+=360*Math.round((previous-lon)/360);previous=lon;out.push([lat/rad,lon]);
  }
  if(Math.abs(out.at(-1)[1]-out[0][1])>180){
    const pole=p>0?90:-90;out.push([pole,out.at(-1)[1]],[pole,out[0][1]]);
  }
  return out;
}
export function solarEvents(point, day) {
  const start=new Date(`${day}T00:00:00Z`), events={sunrise:[],sunset:[],dawn:[],dusk:[]};
  let previous=sunElevation(point,start);
  for(let minute=1;minute<=1440;minute++){
    const at=new Date(start.getTime()+minute*60000), current=sunElevation(point,at);
    for(const [threshold,rise,set] of [[-.833,'sunrise','sunset'],[-6,'dawn','dusk']]){
      if((previous<threshold && current>=threshold)||(previous>=threshold&&current<threshold)){
        const time=new Date(at.getTime()-60000+60000*(threshold-previous)/(current-previous));
        events[current>previous?rise:set].push(time.toISOString());
      }
    }
    previous=current;
  }
  return events;
}
export function csvParse(text) {
  text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/,1)[0];
  const delimiter=first.includes('\t')?'\t':first.includes(';')&&!first.includes(',')?';':',';
  const rows=[];let row=[], cell='', quoted=false, closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'&&cell===''){quoted=true;continue;}
    if(c===delimiter){row.push(cell);cell='';closed=false;continue;}
    if(c==='\n'||c==='\r'){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';closed=false;continue;
    }
    if(closed&&!/\s/.test(c))throw new Error('Unexpected text after a quoted CSV field');
    cell+=c;
  }
  if(quoted)throw new Error('Unclosed quote in CSV');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  if(!rows.length)throw new Error('The file is empty');
  const headers=rows.shift().map(x=>x.trim().toLowerCase().replace(/[ -]+/g,'_'));
  if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw new Error('CSV headers must be unique and non-empty');
  return rows.map((values,i)=>{
    if(values.length!==headers.length)throw new Error(`CSV row ${i+2} has ${values.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((h,j)=>[h,values[j]]));
  });
}
export function csvExport(rows, headers) {
  const safe=value=>{
    let s=String(value??'');
    if(/^[\s]*[=+@]/.test(s)||/^\s*-/.test(s)&&!/^\s*-\d+(\.\d+)?\s*$/.test(s))s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+[headers,...rows.map(r=>headers.map(h=>r[h]??''))].map(r=>r.map(safe).join(',')).join('\r\n')+'\r\n';
}
export function fileRows(text, name) {
  if(/\.(json|geojson)$/i.test(name)){
    const value=JSON.parse(text);
    if(value.type==='FeatureCollection')return value.features.map(f=>{
      if(f.geometry?.type!=='Point')throw new Error('Only GeoJSON Point stations can be imported');
      return {...f.properties,lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]};
    });
    const rows=Array.isArray(value)?value:value.stations??value.channels;
    if(!Array.isArray(rows))throw new Error('JSON must contain a stations/channels array');
    return rows;
  }
  return csvParse(text);
}
export function stationRows(rows) {
  if(!Array.isArray(rows)||rows.length>2000)throw new Error('Import up to 2,000 stations at once');
  const seen=new Set();
  return rows.map((r,i)=>{
    const call=callsign(r.callsign??r.call_sign??r.team);
    if(seen.has(call))throw new Error(`Duplicate callsign ${call}`);seen.add(call);
    return {callsign:call,prefix:call.match(/^[A-Z]+/)?.[0]??'Other',
      ...(r.challenge_group!=null?{challenge_group:String(r.challenge_group).trim().toUpperCase().slice(0,32)}:{}),
      name:String(r.name??call).slice(0,120),country:String(r.country??'Unspecified').slice(0,60),
      lat:coordinate(r.lat??r.latitude,90,`latitude on row ${i+1}`),lon:coordinate(r.lon??r.lng??r.longitude,180,`longitude on row ${i+1}`),
      location_source:String(r.location_source??'Imported position; not verified').slice(0,150),
      ...(r.place?{place:String(r.place).trim().slice(0,120)}:{})};
  });
}
export function locator(point) {
  let x=Math.min(359.999999999,Math.max(0,point.lon+180)),y=Math.min(179.999999999,Math.max(0,point.lat+90));
  const a=Math.floor(x/20),b=Math.floor(y/10);x-=a*20;y-=b*10;
  const c=Math.floor(x/2),d=Math.floor(y);x-=c*2;y-=d;
  return String.fromCharCode(65+a,65+b)+c+d+String.fromCharCode(97+Math.floor(x*12),97+Math.floor(y*24));
}
export function locatorPosition(value) {
  const grid=String(value).trim().toUpperCase();
  if(!/^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/.test(grid))throw new Error('Use a 4, 6 or 8 character Maidenhead locator, such as RE88mu');
  let lon=(grid.charCodeAt(0)-65)*20-180+Number(grid[2])*2,lat=(grid.charCodeAt(1)-65)*10-90+Number(grid[3]);
  let width=2,height=1;
  if(grid.length>=6){width/=24;height/=24;lon+=(grid.charCodeAt(4)-65)*width;lat+=(grid.charCodeAt(5)-65)*height;}
  if(grid.length===8){width/=10;height/=10;lon+=Number(grid[6])*width;lat+=Number(grid[7])*height;}
  return {lat:lat+height/2,lon:lon+width/2};
}
export function upsertStation(rows,input,original=null) {
  const [station]=stationRows([input]),existing=stationRows(rows);
  if(original&&!existing.some(s=>s.callsign===original))throw new Error('The station being edited is no longer in this roster');
  if(existing.some(s=>s.callsign===station.callsign&&s.callsign!==original))throw new Error('That callsign already exists. Select it and choose Edit station.');
  return stationRows(original?existing.map(s=>s.callsign===original?station:s):[...existing,station]);
}
export function stationProposal(station,previous=null) {
  return {version:1,action:previous?'update':'add',original_callsign:previous?.callsign??null,
    previous_station:previous?stationRows([previous])[0]:null,station:stationRows([station])[0]};
}
export function challengeFamily(station){
  const group=station.challenge_group??'';
  return group==='SSB'?'SSB':group.startsWith('2G')?'2G':group.startsWith('3G')?'3G':'Unassigned';
}
export function sheetRow(station,reference=null){
  const grid=locator(station),deg=reference?bearing(reference,station):null;
  return {...station,grid_6:grid,grid_4:grid.slice(0,4),reference_callsign:reference?.callsign??'',
    distance_km:reference?Math.round(distance(reference,station)):null,
    bearing_deg:reference?(deg==null?0:Math.round(deg)%360):null};
}
export function proposalBody(proposal) {
  return 'Station details submitted through Skywave Fieldbook. I intend these details to be public.\n\n'
    +'Please review the callsign and location before publishing.\n\n```json\n'+JSON.stringify(proposal,null,2)+'\n```\n';
}
const optionalNumber=(value,label,min,max)=>{
  if(value==null||String(value).trim()==='')return null;
  const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`Invalid ${label}`);return n;
};
export function dateOnly(value,label){
  if(!value)return '';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00Z').toISOString().slice(0,10)!==value)throw new Error(`Invalid ${label}`);
  return value;
}
export function channelRows(rows, country='Australia') {
  if(!Array.isArray(rows)||rows.length>2000)throw new Error('Import up to 2,000 channels');
  const seen=new Set();
  return rows.map((r,i)=>{
    const id=String(r.channel_id??r.channel??'').trim().slice(0,40);
    if(!id)throw new Error(`Channel ID missing on row ${i+1}`);
    if(seen.has(id))throw new Error(`Duplicate channel ${id}`);seen.add(id);
    const dial=optionalNumber(r.dial_mhz??(r.dial_khz==null?null:Number(r.dial_khz)/1000),'explicit dial MHz',1.5,60);
    if(dial==null)throw new Error(`Explicit dial_mhz required for ${id}; no automatic offset is applied`);
    const mode=String(r.mode??'').toUpperCase().trim();
    if(!['USB','LSB','CW','AM','FM','2G ALE','3G ALE','110B','ARQ','XDL','AMD'].includes(mode))throw new Error(`Invalid or missing mode for ${id}`);
    return {channel_id:id,dial_mhz:dial,centre_mhz:optionalNumber(r.centre_mhz??r.assignment_mhz,'assignment MHz',1.5,60),mode,
      max_power_w:optionalNumber(r.max_power_w,'power limit',1,100000),country:String(r.country??country).trim().slice(0,60),
      authorised:['true','yes','allowed','1'].includes(String(r.authorised??r.authorized??'').trim().toLowerCase()),
      authority:String(r.authority??r.authority_reference??'').trim().slice(0,300),
      local_callsign:r.local_callsign?callsign(r.local_callsign):'',phase:String(r.phase??'').slice(0,120),
      valid_from:dateOnly(r.valid_from,'valid_from'),valid_to:dateOnly(r.valid_to,'valid_to')};
  });
}
export function permission(channel,home,at=new Date()) {
  if(!channel.authorised)return {allowed:false,label:'Not approved'};
  if(!channel.authority)return {allowed:false,label:'Authority needed'};
  if(!home)return {allowed:false,label:'Set your station'};
  if(channel.country.toLowerCase()!==home.country.toLowerCase())return {allowed:false,label:'Different country'};
  if(channel.local_callsign&&channel.local_callsign!==home.callsign)return {allowed:false,label:'Different station'};
  const day=at.toISOString().slice(0,10);
  if(channel.valid_from&&day<channel.valid_from)return {allowed:false,label:'Not yet valid'};
  if(channel.valid_to&&day>channel.valid_to)return {allowed:false,label:'Expired'};
  return {allowed:true,label:'Imported approval'};
}
export const RESULT_LABELS={rx_only:'RX check',two_way_voice:'Two-way voice',two_way_data:'Two-way data',nothing_heard:'Nothing heard',unreadable:'Unreadable',planned:'Planned'};
export const isWorked=contact=>['two_way_voice','two_way_data'].includes(contact.result);
export function contactRow(row) {
  const utc=new Date(row.utc);if(!Number.isFinite(utc.getTime()))throw new Error('Invalid UTC date and time');
  if(!Object.hasOwn(RESULT_LABELS,row.result))throw new Error('Choose a contact result');
  return {id:String(row.id??globalThis.crypto.randomUUID()).slice(0,80),callsign:callsign(row.callsign),utc:utc.toISOString(),
    local_callsign:row.local_callsign?callsign(row.local_callsign):'',
    local_lat:row.local_lat==null?null:coordinate(row.local_lat,90,'logged home latitude'),
    local_lon:row.local_lon==null?null:coordinate(row.local_lon,180,'logged home longitude'),
    dial_mhz:optionalNumber(row.dial_mhz,'dial MHz',1.5,60)??(()=>{throw new Error('Dial frequency is required');})(),mode:String(row.mode??'USB').slice(0,30),
    antenna:String(row.antenna??'').slice(0,100),power_w:optionalNumber(row.power_w,'power',0,10000),
    readability:optionalNumber(row.readability,'readability',1,5),strength:String(row.strength??'').slice(0,80),result:row.result,
    notes:String(row.notes??'').slice(0,2000),distance_km:optionalNumber(row.distance_km,'distance',0,40050)};
}
export function stationExport(rows,format,reference=null) {
  const clean=rows.map(s=>sheetRow({callsign:s.callsign,prefix:s.prefix??s.callsign.match(/^[A-Z]+/)?.[0]??'Other',challenge_group:s.challenge_group??'',name:s.name,country:s.country,place:s.place??'',lat:s.lat,lon:s.lon,location_source:s.location_source},reference));
  if(format==='csv')return {type:'text/csv;charset=utf-8',text:csvExport(clean,['callsign','prefix','challenge_group','lat','lon','grid_6','grid_4','distance_km','bearing_deg','reference_callsign','name','country','place','location_source'])};
  if(format==='geojson')return {type:'application/geo+json',text:JSON.stringify({type:'FeatureCollection',features:clean.map(({lat,lon,...properties})=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties}))},null,2)};
  if(format==='kml')return {type:'application/vnd.google-earth.kml+xml',text:'<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Noble Skywave stations</name>'+clean.map(s=>`<Placemark><name>${xml(s.callsign)}</name><description>${xml(s.country+' · '+s.location_source)}</description><ExtendedData>${['prefix','challenge_group','grid_6','grid_4','reference_callsign','distance_km','bearing_deg','place'].map(key=>`<Data name="${key}"><value>${xml(s[key]??'')}</value></Data>`).join('')}</ExtendedData><Point><coordinates>${s.lon},${s.lat},0</coordinates></Point></Placemark>`).join('')+'</Document></kml>'};
  throw new Error('Unknown export format');
}
export function antennaDimensions(freq,angle) {
  if(!Number.isFinite(freq)||freq<2||freq>30||!Number.isFinite(angle)||angle<60||angle>150)throw new Error('Use 2–30 MHz and an apex angle of 60–150°');
  const total_m=142.65/freq,leg_m=total_m/2;
  return {total_m,leg_m,height_m:leg_m*Math.cos(angle*rad/2),span_m:2*leg_m*Math.sin(angle*rad/2)};
}
