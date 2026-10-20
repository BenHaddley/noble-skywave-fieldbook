import {escapeHtml as esc,callsign,coordinate,distance,bearing,greatCircle,darkPolygon,sunElevation,solarEvents,stationRows,channelRows,permission,fileRows,csvExport,stationExport,contactRow,isWorked,RESULT_LABELS,antennaDimensions,EARTH_KM} from './core.js?v=station-sheet-4';
import {locator,locatorPosition,upsertStation,stationProposal,proposalBody,sheetRow,challengeFamily} from './core.js?v=station-sheet-4';

const $=selector=>document.querySelector(selector), $$=selector=>[...document.querySelectorAll(selector)];
const KEY='skywave-fieldbook-v1', L=window.L;
const CHANNEL_HEADERS=['channel_id','dial_mhz','centre_mhz','mode','max_power_w','country','authorised','authority','local_callsign','phase','valid_from','valid_to'];
const LOG_HEADERS=['utc','local_callsign','local_lat','local_lon','callsign','dial_mhz','mode','antenna','power_w','readability','strength','result','distance_km','notes'];
let state={home:null,stations:null,stationOrigins:{},reference_callsign:'AU16',channels:[],contacts:[],rosterInfo:null}, publicRoster=null, selected=null, activeTab='map', noticeTimer, filePurpose=null;
let pickingStation=false,editingSharedOriginal=null,stationView='map',tableSort={field:'callsign',order:1};
const GROUP_COLOURS={SSB:'#226ba4','2G':'#b77220','3G':'#7652a0',Unassigned:'#778386'};
let weather=null, weatherBusy=false, skyTime=new Date();
function validateHome(home){
  if(!home)return null;
  new Intl.DateTimeFormat('en',{timeZone:home.zone}).format(new Date());
  return {callsign:callsign(home.callsign),country:String(home.country||'Australia').slice(0,60),lat:coordinate(home.lat,90,'home latitude'),lon:coordinate(home.lon,180,'home longitude'),zone:home.zone};
}
function validateState(raw){
  if(!raw||typeof raw!=='object')throw new Error('Invalid fieldbook backup');
  const home=validateHome(raw.home);
  if(!Array.isArray(raw.contacts)||raw.contacts.length>10000)throw new Error('Invalid contact list; maximum 10,000 entries');
  const stationOrigins=Object.fromEntries(Object.entries(raw.stationOrigins??{}).map(([key,value])=>[callsign(key),callsign(value)]));
  return {home,reference_callsign:raw.reference_callsign==='@home'?'@home':callsign(raw.reference_callsign??'AU16'),stations:raw.stations==null?null:stationRows(raw.stations),stationOrigins,channels:channelRows(raw.channels??[],home?.country),contacts:raw.contacts.map(contactRow),rosterInfo:raw.rosterInfo&&typeof raw.rosterInfo==='object'?{label:String(raw.rosterInfo.label??'Imported roster').slice(0,200),updated_at:String(raw.rosterInfo.updated_at??'').slice(0,40)}:null};
}
try{const saved=localStorage.getItem(KEY);if(saved)state=validateState(JSON.parse(saved));}catch{notice('Saved data could not be read. Restore a fieldbook backup if you have one.',true);}
function notice(message,error=false){
  const node=$('#notice');node.textContent=message;node.classList.toggle('error',error);node.hidden=false;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.hidden=true,error?12000:6000);
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{notice('Browser storage is unavailable or full. Export a backup before leaving this page.',true);return false;}}
function fmtNumber(n){return Math.round(n).toLocaleString('en-AU');}
function fmtFreq(n){return Number(n).toFixed(4).replace(/0$/,'');}
function utcLabel(value,seconds=false){return new Date(value).toISOString().slice(0,seconds?19:16).replace('T',' ')+'Z';}
function localLabel(value){return new Intl.DateTimeFormat('en-AU',{timeZone:state.home?.zone??'Australia/Sydney',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(value));}
function flag(country){const codes={'Australia':'AU','New Zealand':'NZ','Canada':'CA','United States':'US','United Kingdom':'GB','Latvia':'LV','Lithuania':'LT','Estonia':'EE','Germany':'DE','France':'FR','Italy':'IT','Poland':'PL','Czechia':'CZ','Romania':'RO','Netherlands':'NL','Norway':'NO','Sweden':'SE','Finland':'FI','Denmark':'DK','Belgium':'BE','Spain':'ES','Portugal':'PT','Ireland':'IE','Japan':'JP','South Korea':'KR','Singapore':'SG','South Africa':'ZA','Brazil':'BR','Chile':'CL','Argentina':'AR'};return Object.hasOwn(codes,country)?[...codes[country]].map(c=>String.fromCodePoint(c.charCodeAt(0)+127397)).join(''):'◉';}
function stations(){
  const shared=new Map((publicRoster?.stations??[]).map(s=>[s.callsign,s]));
  return (state.stations??publicRoster?.stations??[]).map(s=>{
    const current=shared.get(state.stationOrigins[s.callsign]??s.callsign);
    return {...s,...(!Object.hasOwn(s,'challenge_group')&&current?.challenge_group!=null?{challenge_group:current.challenge_group}:{})};
  });
}
function referenceStation(){return state.reference_callsign==='@home'?state.home:stations().find(s=>s.callsign===state.reference_callsign)??null;}
function worked(call){return state.contacts.some(c=>c.callsign===call&&isWorked(c)&&(!state.home||c.local_callsign===state.home.callsign));}
function filteredStations(){
  const query=$('#station-search').value.trim().toLowerCase(),country=$('#country-filter').value,prefix=$('#prefix-filter').value,group=$('#group-filter').value,unworked=$('#unworked-filter').checked;
  const rows=stations().filter(s=>(!query||`${s.callsign} ${s.prefix} ${s.challenge_group??''} ${s.country} ${s.name} ${s.place??''} ${locator(s)} ${s.lat.toFixed(5)} ${s.lon.toFixed(5)}`.toLowerCase().includes(query))&&(!country||s.country===country)&&(!prefix||s.prefix===prefix)&&(!group||s.challenge_group===group)&&(!unworked||!worked(s.callsign)));
  const sort=$('#sort-stations').value,reference=referenceStation();
  rows.sort((a,b)=>reference&&sort!=='callsign'?(distance(reference,a)-distance(reference,b))*(sort==='longest'?-1:1):a.callsign.localeCompare(b.callsign,undefined,{numeric:true}));
  return rows;
}
function updateCountryFilter(){
  for(const [id,field,label] of [['country-filter','country','Every country'],['prefix-filter','prefix','All prefixes'],['group-filter','challenge_group','All challenge groups']]){
    const node=$('#'+id),previous=node.value;
    node.innerHTML=`<option value="">${label}</option>`+[...new Set(stations().map(s=>s[field]).filter(Boolean))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if([...node.options].some(o=>o.value===previous))node.value=previous;
  }
  $('#station-countries').innerHTML=[...new Set(['Australia','New Zealand',...stations().map(s=>s.country)])].sort().map(c=>`<option value="${esc(c)}"></option>`).join('');
  $('#reference-stations').innerHTML=stations().map(s=>`<option value="${esc(s.callsign)}">${esc(s.challenge_group??'')}</option>`).join('');
}
function renderReference(){
  const reference=referenceStation();
  $('#reference-station').value=state.reference_callsign==='@home'?state.home?.callsign??'':state.reference_callsign;
  $('#reference-coordinates').textContent=reference?`${reference.lat.toFixed(5)}, ${reference.lon.toFixed(5)} · ${locator(reference)}`:'Choose a station from the current roster';
  $('#home-label').textContent=reference?`Reference ${reference.callsign} · ${locator(reference)}`:'Select a reference station for distance & bearing';
  $('#reference-home').disabled=!state.home;
}
function renderRoster(){
  updateCountryFilter();renderStations();
  $('#roster-count').textContent=`${stations().length.toLocaleString()} stations · grids, groups & paths`;
  const info=state.rosterInfo??publicRoster;
  $('#roster-date').textContent=state.stations?`${info?.label??'Imported roster'} · saved on this device`:`Station sheet + reviewed updates · ${info?.updated_at?utcLabel(info.updated_at):''}`;
}
function renderStations(){
  const rows=filteredStations(),reference=referenceStation();
  $('#filtered-count').textContent=`${rows.length} OF ${stations().length} STATIONS`;
  $('#side-result-count').textContent=String(rows.length);$('#station-list').classList.toggle('station-list--short',rows.length<3);renderReference();
  $('#station-list').innerHTML=rows.length?rows.map(s=>{const r=sheetRow(s,reference);return `<button class="station-row ${selected?.callsign===s.callsign?'selected':''}" data-station="${esc(s.callsign)}"><span class="station-main"><strong>${esc(s.callsign)}</strong> <span class="group-chip group-${challengeFamily(s)}">${esc(s.challenge_group||'Unassigned')}</span>${s.callsign===state.home?.callsign?'<span class="home-tag">HOME</span>':''}<small>${esc(s.prefix)} · ${r.grid_6} / ${r.grid_4}${worked(s.callsign)?' · ✓ worked':''}</small><small class="station-location">${s.place?esc(s.place)+' · ':''}${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</small></span><span class="station-distance">${r.distance_km==null?'—':fmtNumber(r.distance_km)+' km'}<small>${r.bearing_deg==null?'—':r.bearing_deg+'° true'}</small></span></button>`;}).join(''):'<p class="empty-cell">No stations match. Try another callsign, prefix, group or grid.</p>';
  $('#map-group-legend').innerHTML=['SSB','2G','3G'].map(f=>`<span class="group-legend-item"><i style="background:${GROUP_COLOURS[f]}"></i>${f} <b>${rows.filter(s=>challengeFamily(s)===f).length}</b></span>`).join('')+'<span>Colour = challenge family · filled = logged two-way contact · shading = night</span>';
  renderSheetDetail();renderStationTable(rows,reference);drawStations(rows);
}
function renderSheetDetail(){
  const node=$('#station-sheet-detail');node.hidden=!selected;if(!selected)return;
  const ref=referenceStation(),r=sheetRow(selected,ref);
  node.innerHTML=`<div class="sheet-detail-heading"><div><span class="eyebrow">SELECTED STATION</span><h2>${esc(r.callsign)}</h2></div><button id="sidebar-clear" class="text-button">Close ×</button></div><div class="sheet-values">${[['Prefix',r.prefix],['Challenge group',r.challenge_group||'Not supplied'],['Latitude',r.lat.toFixed(5)],['Longitude',r.lon.toFixed(5)],['Grid (6-char)',r.grid_6],['Grid (4-char)',r.grid_4],['Distance from '+(ref?.callsign??'reference'),r.distance_km==null?'—':fmtNumber(r.distance_km)+' km'],['Bearing from '+(ref?.callsign??'reference'),r.bearing_deg==null?'—':r.bearing_deg+'° true']].map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</div>${r.place?`<p>${esc(r.place)}</p>`:''}<div class="inline"><button id="sidebar-edit" class="text-button">Edit this station ↗</button><button id="sidebar-plan" class="text-button">Plan radio check ↗</button></div>`;
  $('#sidebar-clear').onclick=()=>{selected=null;pathLayer.clearLayers();renderStations();$('#circuit').innerHTML='<p>Select a station for contact planning.</p>';history.replaceState(null,'',location.pathname+location.search);};
  $('#sidebar-edit').onclick=()=>openStationEditor(selected);
  $('#sidebar-plan').onclick=()=>{$('#contact-planning').open=true;renderCircuit();$('#contact-planning').scrollIntoView({behavior:'smooth'});};
}
function renderStationTable(rows,reference){
  const values=rows.map(s=>sheetRow(s,reference)),field=tableSort.field;
  values.sort((a,b)=>{const x=a[field],y=b[field];if(x==null||y==null)return x==null?(y==null?0:1):-1;return (typeof x==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}))*tableSort.order;});
  $('#station-table-body').innerHTML=values.length?values.map(r=>`<tr class="${selected?.callsign===r.callsign?'selected':''}"><td><button class="table-station" data-table-station="${esc(r.callsign)}">${esc(r.callsign)}</button></td><td>${esc(r.prefix)}</td><td><span class="group-chip group-${challengeFamily(r)}">${esc(r.challenge_group||'Unassigned')}</span></td><td class="mono">${r.lat.toFixed(5)}</td><td class="mono">${r.lon.toFixed(5)}</td><td class="mono">${r.grid_6}</td><td class="mono">${r.grid_4}</td><td class="mono">${r.distance_km==null?'—':fmtNumber(r.distance_km)}</td><td class="mono">${r.bearing_deg==null?'—':r.bearing_deg+'°'}</td><td>${esc(r.place||'')} <button class="text-button" data-table-edit="${esc(r.callsign)}">Edit</button></td></tr>`).join(''):'<tr><td colspan="10" class="empty-cell">No stations match these filters.</td></tr>';
  $$('[data-sheet-sort]').forEach(button=>{const active=button.dataset.sheetSort===field;button.closest('th').setAttribute('aria-sort',active?(tableSort.order===1?'ascending':'descending'):'none');button.querySelector('.sort-indicator').textContent=active?(tableSort.order===1?'↑':'↓'):'';});
}
function setStationView(view){
  stationView=view;$('#station-map-view').hidden=view!=='map';$('#station-table-view').hidden=view!=='table';
  $('#station-map-button').setAttribute('aria-pressed',String(view==='map'));$('#station-table-button').setAttribute('aria-pressed',String(view==='table'));
  if(view==='map')map.invalidateSize();
}
const map=L.map('station-map',{worldCopyJump:true,minZoom:1.5,zoomSnap:.25,scrollWheelZoom:false}).setView([-12,145],2);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
let tileWarned=false;tiles.on('tileerror',()=>{if(!tileWarned){tileWarned=true;notice('Map tiles are unavailable. Station search, coordinates, logs and exports still work.',true);}});
const sky=L.layerGroup().addTo(map), markerLayer=L.layerGroup().addTo(map), pathLayer=L.layerGroup().addTo(map), homeLayer=L.layerGroup().addTo(map);
function drawStations(rows){
  markerLayer.clearLayers();const zoom=map.getZoom();
  for(const s of rows){
    for(const shift of [-360,0,360]){
      const picked=selected?.callsign===s.callsign;
      const marker=L.circleMarker([s.lat,s.lon+shift],{radius:picked?8:5,weight:picked?3:1.5,color:picked?'#122f36':GROUP_COLOURS[challengeFamily(s)],fillColor:worked(s.callsign)?GROUP_COLOURS[challengeFamily(s)]:'#fff',fillOpacity:worked(s.callsign)?1:.65}).addTo(markerLayer);
      marker.bindTooltip(`<b>${esc(s.callsign)}</b> · ${esc(s.challenge_group||'Unassigned')}<br>${locator(s)}`,{permanent:zoom>=5||picked,direction:'top',className:'station-tooltip'});
      marker.on('click',event=>{L.DomEvent.stopPropagation(event);selectStation(s.callsign);});
    }
  }
}
function drawHome(){
  homeLayer.clearLayers();const reference=referenceStation();if(!reference)return;
  for(const shift of [-360,0,360])L.circleMarker([reference.lat,reference.lon+shift],{radius:7,color:'#102b32',weight:2,fillColor:'#c7e86f',fillOpacity:1}).addTo(homeLayer).bindTooltip(esc(reference.callsign)+' · distance reference',{permanent:true,direction:'bottom'});
}
function drawSky(){
  sky.clearLayers();skyTime=new Date(Date.now()+Number($('#time-offset').value)*3600000);
  $('#map-time').textContent=utcLabel(skyTime);$('#map-time-local').textContent=localLabel(skyTime);
  for(const shift of [-360,0,360]){
    for(const [threshold,opacity] of [[0,.14],[-12,.18]])L.polygon(darkPolygon(skyTime,threshold).map(([lat,lon])=>[lat,lon+shift]),{stroke:false,fillColor:'#102b32',fillOpacity:opacity,interactive:false}).addTo(sky);
  }
}
function drawPath(){
  pathLayer.clearLayers();const reference=referenceStation();if(!selected||!reference)return;
  const arc=greatCircle(reference,selected), longArc=greatCircle(reference,selected,true);
  for(const shift of [-360,0,360]){
    L.polyline(arc.map(([lat,lon])=>[lat,lon+shift]),{color:'#143d3e',weight:2.5,dashArray:'7 5',interactive:false}).addTo(pathLayer);
    L.polyline(longArc.map(([lat,lon])=>[lat,lon+shift]),{color:'#577e81',weight:1,opacity:.45,dashArray:'3 8',interactive:false}).addTo(pathLayer);
  }
}
map.on('zoomend',()=>drawStations(filteredStations()));
new ResizeObserver(()=>{
  map.invalidateSize();
  const reference=referenceStation();if(selected&&reference&&stationView==='map')map.fitBounds(L.latLngBounds(greatCircle(reference,selected)),{padding:[35,35],maxZoom:5});
}).observe($('#station-map'));
function selectStation(call,focus=true){
  selected=stations().find(s=>s.callsign===call)??null;
  if(!selected)return;history.replaceState(null,'','#station='+encodeURIComponent(call));
  renderStations();renderCircuit();drawPath();
  const reference=referenceStation();if(focus&&reference){const path=greatCircle(reference,selected);map.fitBounds(L.latLngBounds(path),{padding:[35,35],maxZoom:5});}
  else if(focus)map.panTo([selected.lat,selected.lon]);
}
function renderHome(){
  $('#home-button').textContent=state.home?`${state.home.callsign} · Station settings ↗`:'Set your station ↗';
  renderReference();
  drawHome();drawPath();tick();renderStations();renderCircuit();renderChannels();
}
function sunState(point){const e=sunElevation(point,skyTime);return e>0?'Daylight':e>-6?'Civil twilight':e>-12?'Nautical twilight':e>-18?'Astronomical twilight':'Night';}
function eventCell(values){return values.length?values.map(v=>new Date(v).toISOString().slice(11,16)+'Z').join(' / '):'No crossing';}
function solarPlot(home,remote){
  const start=new Date(skyTime.toISOString().slice(0,10)+'T00:00Z');
  const path=point=>Array.from({length:97},(_,i)=>{const e=sunElevation(point,new Date(start.getTime()+i*900000));return `${i===0?'M':'L'}${(30+i/96*430).toFixed(1)} ${(60-e/2).toFixed(1)}`;}).join(' ');
  return `<svg class="solar-strip" viewBox="0 0 480 120" role="img" aria-label="Solar elevation through the UTC day: solid home, dotted remote"><rect x="30" y="60" width="430" height="45" fill="#eef2f0"/><line x1="30" y1="60" x2="460" y2="60" stroke="#c6d2cd"/><path d="${path(home)}" stroke="#08776c" stroke-width="2" fill="none"/><path d="${path(remote)}" stroke="#102b32" stroke-width="2" stroke-dasharray="4 3" fill="none"/>${[0,6,12,18,24].map(h=>`<text x="${30+h/24*430}" y="117" text-anchor="middle" fill="#647477">${String(h).padStart(2,'0')}Z</text>`).join('')}</svg>`;
}
function renderCircuit(){
  if(!selected)return;
  const last=state.contacts.filter(c=>c.callsign===selected.callsign&&c.local_callsign===state.home?.callsign).sort((a,b)=>b.utc.localeCompare(a.utc));
  const home=state.home, dist=home?distance(home,selected):null, bearingFrom=home?bearing(home,selected):null;
  let solar='';
  if(home){
    const day=skyTime.toISOString().slice(0,10),a=solarEvents(home,day),b=solarEvents(selected,day);
    solar=`<div class="circuit-bottom"><div><h3>Sun &amp; twilight · ${esc(day)} UTC</h3><table class="solar-table"><thead><tr><th></th><th>${esc(home.callsign)}</th><th>${esc(selected.callsign)}</th></tr></thead><tbody>${[['dawn','Civil dawn'],['sunrise','Sunrise'],['sunset','Sunset'],['dusk','Civil dusk']].map(([key,label])=>`<tr><td>${label}</td><td>${eventCell(a[key])}</td><td>${eventCell(b[key])}</td></tr>`).join('')}</tbody></table><p>Approximate solar geometry; terrain is not included. Events fall within the displayed UTC date.</p></div><div><h3>24-hour solar elevation</h3>${solarPlot(home,selected)}<p>Solid teal = home · dotted dark = remote · shading = sun below horizon.</p><h3>Previous results on this path</h3>${last.length?last.slice(0,3).map(c=>`<p><b>${esc(utcLabel(c.utc))}</b> · ${fmtFreq(c.dial_mhz)} ${esc(c.mode)} · ${esc(c.antenna||'antenna unreported')} · ${esc(RESULT_LABELS[c.result])}${c.readability?' · R'+c.readability:''}</p>`).join(''):'<p>No checks logged yet. Save the time, channel and antenna after your first attempt.</p>'}</div></div>`;
  }
  $('#circuit').innerHTML=`<div class="circuit-head"><div><span class="eyebrow">${home?esc(home.callsign)+' → ':''}${esc(selected.country).toUpperCase()}</span><h2>${flag(selected.country)} ${esc(selected.callsign)}</h2><p>${selected.place?esc(selected.place)+' · ':''}${selected.lat.toFixed(4)}, ${selected.lon.toFixed(4)} · ${locator(selected)} · ${esc(selected.location_source)}</p></div><div class="inline"><button class="button button-light" id="selected-edit">Edit station</button><button class="text-button" id="selected-as-home">Use as my station</button><button class="text-button" id="selected-link">Copy station link</button><button class="button button-light" id="selected-log">Log check</button><button class="button button-dark" id="selected-sked">Agree a check ↗</button></div></div>${home?`<div class="metrics"><div class="metric"><b>${fmtNumber(dist)} km</b><span>Short path · great-circle distance</span></div><div class="metric"><b>${bearingFrom==null?'—':Math.round(bearingFrom)+'°'} / ${bearingFrom==null?'—':Math.round((bearingFrom+180)%360)+'°'}</b><span>Short / long path · initial true bearings</span></div><div class="metric"><b>${fmtNumber(2*Math.PI*EARTH_KM-dist)} km</b><span>Long path · not a predicted usable path</span></div><div class="metric"><b>${sunState(home)} / ${sunState(selected)}</b><span>Home / remote at ${skyTime.toISOString().slice(11,16)}Z</span></div></div>${solar}`:'<p>Set your station above to calculate distance, true bearings, daylight and twilight for both ends.</p>'}`;
  $('#selected-edit').onclick=()=>openStationEditor(selected);
  $('#selected-as-home').onclick=()=>openHome(selected);
  $('#selected-link').onclick=()=>copy(location.href);
  $('#selected-log').onclick=()=>openContact(selected.callsign);
  $('#selected-sked').onclick=()=>openSked();
}
function goTab(tab){
  activeTab=tab;$$('[data-page]').forEach(page=>page.hidden=page.dataset.page!==tab);
  $$('[data-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.tab===tab)));
  if(tab==='map')setTimeout(()=>map.invalidateSize(),0);
  if(tab==='log')renderLog();if(tab==='channels')renderChannels();
}
function openHome(station=null){
  const form=$('#home-form'),home=station??state.home;
  form.elements.callsign.value=home?.callsign??'';form.elements.country.value=home?.country&&home.country!=='Unspecified'?home.country:'Australia';
  form.elements.lat.value=home?.lat??'';form.elements.lon.value=home?.lon??'';form.elements.zone.value=state.home?.zone??'Australia/Sydney';
  $('#home-dialog').showModal();
}
function editorError(message=''){
  $('#station-editor-error').textContent=message;$('#station-editor-error').hidden=!message;
}
function openStationEditor(station=null){
  if(pickingStation)endPick();
  const form=$('#station-form');form.reset();editorError();
  editingSharedOriginal=station?publicRoster?.stations.find(s=>s.callsign===(state.stationOrigins[station.callsign]??station.callsign))??null:null;
  $('#station-editor-title').textContent=station?'Edit station':'Add station';
  const group=station?.challenge_group??'';if(![...form.elements.challenge_group.options].some(o=>o.value===group))form.elements.challenge_group.add(new Option(group,group));
  for(const key of ['callsign','name','country','place','lat','lon','challenge_group'])form.elements[key].value=station?.[key]??(key==='country'?state.home?.country??'Australia':'');
  form.elements.original_callsign.value=station?.callsign??'';
  form.elements.locator.value=station?locator(station):'';
  $('#station-dialog').showModal();
}
function stationDraft(){
  const raw=Object.fromEntries(new FormData($('#station-form')));
  return stationRows([{...raw,name:raw.name.trim()||raw.callsign,location_source:'Operator-reported location; not independently verified'}])[0];
}
function saveStationDraft(station){
  const form=$('#station-form'),original=form.elements.original_callsign.value||null;
  const rows=upsertStation(stations(),station,original),origins={...state.stationOrigins};
  if(original)delete origins[original];if(editingSharedOriginal)origins[station.callsign]=editingSharedOriginal.callsign;
  const previous=state;
  state={...state,stations:rows,stationOrigins:origins,rosterInfo:{label:'Edited station roster',updated_at:new Date().toISOString()}};
  if(!persist()){state=previous;return false;}
  $('#station-search').value=station.callsign;$('#country-filter').value='';$('#unworked-filter').checked=false;$('#prefix-filter').value='';$('#group-filter').value='';setStationView('map');
  renderRoster();selectStation(station.callsign);renderLog();return true;
}
$('#station-form').onsubmit=event=>{
  event.preventDefault();editorError();
  try{if(saveStationDraft(stationDraft())){$('#station-dialog').close();notice('Station saved on this device. Use Submit shared update to request a change for everyone.');}}
  catch(error){editorError(error.message);}
};
$('#station-submit-shared').onclick=()=>{
  const form=$('#station-form');editorError();if(!form.reportValidity())return;
  if(!form.elements.public_consent.checked){editorError('Confirm that you intend these details to be public before opening a shared request.');return;}
  if(!publicRoster){editorError('The shared roster is unavailable. Retry once it loads before submitting a shared update.');return;}
  try{
    const station=stationDraft(),known=editingSharedOriginal??publicRoster.stations.find(s=>s.callsign===station.callsign)??null;
    const proposal=stationProposal(station,known),url=new URL('https://github.com/BenHaddley/noble-skywave-fieldbook/issues/new');
    url.search=new URLSearchParams({template:'station-update.md',title:`Station ${proposal.action}: ${known&&known.callsign!==station.callsign?known.callsign+' → ':''}${station.callsign}`,labels:'station-update',body:proposalBody(proposal)}).toString();
    if(!saveStationDraft(station))return;
    window.open(url.href,'_blank','noopener,noreferrer');$('#station-dialog').close();
    notice('Saved on this device. Finish submitting the GitHub request; a maintainer will review it before publishing.');
  }catch(error){editorError(error.message);}
};
$('#station-from-locator').onclick=()=>{
  editorError();try{const point=locatorPosition($('#station-form').elements.locator.value);for(const key of ['lat','lon'])$('#station-form').elements[key].value=point[key].toFixed(6);}
  catch(error){editorError(error.message);}
};
$('#station-pick-map').onclick=()=>{
  pickingStation=true;$('#station-dialog').close();goTab('map');$('#station-pick-banner').hidden=false;
  $('#station-map').style.cursor='crosshair';$('#station-pick-banner').scrollIntoView({behavior:'smooth',block:'start'});
};
function endPick(){pickingStation=false;$('#station-pick-banner').hidden=true;$('#station-map').style.cursor='';}
$('#cancel-pick').onclick=()=>{endPick();$('#station-dialog').showModal();};
map.on('click',event=>{
  if(!pickingStation)return;const point=event.latlng.wrap(),form=$('#station-form');
  form.elements.lat.value=point.lat.toFixed(6);form.elements.lon.value=point.lng.toFixed(6);
  form.elements.locator.value=locator({lat:point.lat,lon:point.lng});endPick();$('#station-dialog').showModal();
});
$('#add-station').onclick=()=>openStationEditor();
$('#home-form').onsubmit=event=>{
  event.preventDefault();try{const home=validateHome(Object.fromEntries(new FormData(event.currentTarget)));state.home=home;persist();$('#home-dialog').close();renderHome();notice('Home station saved on this device.');}catch(error){notice(error.message,true);}
};
function filteredChannels(){
  const q=$('#channel-search').value.trim().toLowerCase(),phase=$('#phase-filter').value.toLowerCase();
  return state.channels.filter(c=>(!q||`${c.channel_id} ${c.dial_mhz} ${c.centre_mhz??''} ${c.authority}`.toLowerCase().includes(q))&&(!phase||c.phase.toLowerCase().includes(phase))&&(!$('#authorised-filter').checked||permission(c,state.home).allowed)).sort((a,b)=>a.dial_mhz-b.dial_mhz);
}
function renderChannels(){
  const rows=filteredChannels();
  $('#channel-list').innerHTML=rows.length?rows.map(c=>{const p=permission(c,state.home);return `<tr><td><b>${esc(c.channel_id)}</b></td><td class="mono">${fmtFreq(c.dial_mhz)}</td><td>${c.centre_mhz==null?'—':fmtFreq(c.centre_mhz)}</td><td>${esc(c.mode)}<small>${c.max_power_w==null?'Power limit unreported':fmtNumber(c.max_power_w)+' W maximum'}</small></td><td><span class="pill ${p.allowed?'':'pill--warning'}">${esc(p.label)}</span><small>${esc(c.country)}${c.local_callsign?' · '+esc(c.local_callsign):''}${c.valid_to?' · until '+esc(c.valid_to):''}</small></td><td>${esc(c.authority||'No authority reference')}<small>${esc(c.phase||'Phase unreported')}</small></td><td><button data-plan-channel="${esc(c.channel_id)}" class="text-button">Plan check ↗</button></td></tr>`;}).join(''):`<tr><td colspan="7" class="empty-cell">${state.channels.length?'No channels match these filters.':'Import your issued channel list. The template shows the required fields; permission remains unconfirmed without an authority reference.'}</td></tr>`;
}
function openContact(call='',channel=null){
  const form=$('#contact-form');form.reset();
  form.elements.callsign.value=call||selected?.callsign||'';form.elements.utc.value=new Date().toISOString().slice(0,19);
  if(channel){form.elements.dial_mhz.value=channel.dial_mhz;if([...form.elements.mode.options].some(x=>x.value===channel.mode))form.elements.mode.value=channel.mode;}
  $('#contact-dialog').showModal();
}
$('#contact-form').onsubmit=event=>{
  event.preventDefault();try{
    const input=Object.fromEntries(new FormData(event.currentTarget));input.utc+='Z';
    const peer=stations().find(s=>s.callsign===input.callsign.trim().toUpperCase());
    const row=contactRow({...input,local_callsign:state.home?.callsign,local_lat:state.home?.lat,local_lon:state.home?.lon,distance_km:state.home&&peer?distance(state.home,peer):null});
    if(state.contacts.length>=10000)throw new Error('Export your log before adding more than 10,000 entries');
    state.contacts.unshift(row);persist();$('#contact-dialog').close();renderLog();renderStations();renderCircuit();notice('Check saved to your local contact log.');
  }catch(error){notice(error.message,true);}
};
function renderLog(){
  $('#log-badge').textContent=String(state.contacts.length);
  const completed=state.contacts.filter(isWorked), countries=new Set(completed.map(c=>stations().find(s=>s.callsign===c.callsign)?.country).filter(Boolean));
  const longest=Math.max(0,...completed.map(c=>c.distance_km??0));
  $('#log-summary').innerHTML=[[state.contacts.length,'Checks & plans'],[new Set(completed.map(c=>c.callsign)).size,'Stations worked · two-way'],[countries.size,'Countries worked'],[fmtNumber(longest)+' km','Longest logged two-way path']].map(([value,label])=>`<div><b>${value}</b><span>${label}</span></div>`).join('');
  const q=$('#log-search').value.trim().toLowerCase();
  const rows=state.contacts.filter(c=>`${c.callsign} ${c.dial_mhz} ${c.antenna} ${c.mode} ${c.notes}`.toLowerCase().includes(q)).sort((a,b)=>b.utc.localeCompare(a.utc));
  $('#contact-list').innerHTML=rows.length?rows.map(c=>`<tr><td>${esc(utcLabel(c.utc))}<small>${esc(localLabel(c.utc))}</small></td><td><b>${esc(c.callsign)}</b><small>${c.distance_km==null?'Distance not recorded':fmtNumber(c.distance_km)+' km'}</small></td><td class="mono">${fmtFreq(c.dial_mhz)}<small>${esc(c.mode)}</small></td><td>${esc(c.antenna||'Unreported')}<small>${c.power_w==null?'Power unreported':c.power_w+' W'}</small></td><td>${c.readability?'R'+c.readability:'Unreported'}<small>${esc(c.strength)}</small></td><td><span class="pill ${isWorked(c)?'':'pill--muted'}">${esc(RESULT_LABELS[c.result])}</span></td><td class="notes-cell">${esc(c.notes)}</td><td><button class="delete-button" data-delete-contact="${esc(c.id)}" aria-label="Delete contact with ${esc(c.callsign)}">Delete</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty-cell">No checks logged here yet. Add the actual result after listening or completing a contact.</td></tr>';
}
function openSked(channel=null){
  if(!selected){notice('Select the other station on the map first.');goTab('map');return;}
  if(!state.home){openHome();notice('Set your callsign and location first.');return;}
  const form=$('#sked-form');form.reset();
  form.elements.utc.value=new Date(Math.ceil((Date.now()+120000)/60000)*60000).toISOString().slice(0,16);
  if(channel){form.elements.dial_mhz.value=channel.dial_mhz;form.elements.mode.value=channel.mode;}
  $('#sked-message').value='';$('#sked-dialog').showModal();
}
$('#sked-form').onsubmit=event=>{
  event.preventDefault();const form=event.currentTarget,utc=new Date(form.elements.utc.value+'Z');
  if(!Number.isFinite(utc.getTime())||utc.getTime()<Date.now()-60000){notice('Choose a future UTC time for the check.',true);return;}
  const dial=Number(form.elements.dial_mhz.value),mode=form.elements.mode.value,rx=form.elements.rx_only.checked;
  const matching=state.channels.filter(c=>Math.abs(c.dial_mhz-dial)<.00001&&c.mode===mode&&permission(c,state.home,utc).allowed);
  if(!matching.length)notice('This dial and mode are not in your imported approval list. Check the issued authority before agreeing.',true);
  $('#sked-message').value=`${selected.callsign}, ${state.home.callsign} here in ${state.home.country}. Can we try ${fmtFreq(dial)} MHz ${mode} on the radio dial at ${utc.toISOString().slice(11,16)}Z on ${utc.toISOString().slice(0,10)}? ${rx?"We're receive-only for this check. Please call "+state.home.callsign+" with your callsign and a count for about 30 seconds; I'll report what I copy here.":"Let's exchange callsigns and a short count, then confirm the result here."}`;
};
async function copy(text){try{await navigator.clipboard.writeText(text);notice('Copied to clipboard.');}catch{notice('Clipboard unavailable. Select and copy the text manually.',true);}}
function download(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function backup(){download('skywave-fieldbook-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({version:1,...state,stations:state.stations??stations(),rosterInfo:state.rosterInfo??{label:'Shared registration snapshot',updated_at:publicRoster?.updated_at}},null,2),'application/json');}
function exportStations(format){const rows=filteredStations();if(!rows.length){notice('No matching stations to export.');return;}const data=stationExport(rows,format,referenceStation());download(`skywave-stations-${rows.length}.${format}`,data.text,data.type);notice(`${rows.length} station positions exported.`);}
function chooseFile(purpose){filePurpose=purpose;$('#file-input').value='';$('#file-input').click();}
$('#file-input').onchange=async event=>{
  const file=event.target.files[0],purpose=filePurpose;if(!file)return;
  try{
    if(file.size>5_000_000)throw new Error('Use a file smaller than 5 MB');
    const text=await file.text();
    if(purpose==='backup'){
      const restored=validateState(JSON.parse(text));
      if(!confirm('Replace this device’s fieldbook with the selected backup? Export a backup first if you want to keep the current data.'))return;
      state=restored;selected=null;$('#circuit').innerHTML='<p>Select a station to plan a circuit.</p>';
    }else{
      const rows=fileRows(text,file.name);
      if(purpose==='stations'){
        const imported=stationRows(rows);
        if(!imported.length)throw new Error('No station positions found');
        state.stations=imported;state.stationOrigins={};state.rosterInfo={label:file.name,updated_at:new Date().toISOString()};selected=null;
        $('#circuit').innerHTML='<p>Select a station from the imported roster.</p>';
      }else state.channels=channelRows(rows,state.home?.country??'Australia');
    }
    persist();renderRoster();renderHome();renderLog();notice(`${purpose==='backup'?'Fieldbook restored':purpose==='stations'?'Station roster imported':'Channel book imported'} on this device.`);
  }catch(error){notice(error.message,true);}
};
function renderAntenna(){
  const result=$('#antenna-result');try{
    const d=antennaDimensions(Number($('#antenna-freq').value),Number($('#antenna-angle').value)),unit=$('#antenna-units').value,f=unit==='ft'?3.280839895:1;
    const display=x=>(x*f).toFixed(1)+' '+unit,base=145;
    // Uniform scale preserves the physical apex angle; cap the figure width and height together.
    const scale=Math.min(120/d.height_m,205/(d.span_m/2)),h=d.height_m*scale,w=d.span_m/2*scale;
    result.innerHTML=`<svg class="antenna-svg" viewBox="0 0 480 180" role="img" aria-label="Inverted V with two equal insulated wire legs"><path d="M25 ${base}H455 M240 ${base-h}V${base}" stroke="#a1afa7" stroke-width="1.5" fill="none"/><path d="M${240-w} ${base}L240 ${base-h}L${240+w} ${base}" stroke="#102b32" stroke-width="2.5" fill="none"/><circle cx="240" cy="${base-h}" r="4" fill="#08776c"/><rect x="${236-w}" y="${base-3}" width="8" height="6" fill="white" stroke="#102b32"/><rect x="${236+w}" y="${base-3}" width="8" height="6" fill="white" stroke="#102b32"/><text x="${235-w/2}" y="${base-h/2-12}" text-anchor="middle" fill="#102b32" font-size="12">${display(d.leg_m)}</text><text x="${245+w/2}" y="${base-h/2-12}" text-anchor="middle" fill="#102b32" font-size="12">${display(d.leg_m)}</text><text x="240" y="174" text-anchor="middle" fill="#647477" font-size="10">Insulated ends · centre feedpoint · schematic to scale</text></svg><div class="antenna-values"><div><b>${display(d.total_m)}</b><span>Total starting wire</span></div><div><b>${display(d.height_m)}</b><span>Apex above ends</span></div><div><b>${display(d.span_m)}</b><span>End-to-end span</span></div></div>`;
  }catch(error){result.innerHTML=`<p class="muted">${esc(error.message)}</p>`;}
}
function parseTime(value){if(!value)return NaN;return Date.parse(/[Zz]$|[+-]\d\d:\d\d$/.test(value)?value:value+'Z');}
async function refreshWeather(){
  if(weatherBusy)return;weatherBusy=true;$('#weather-refresh').disabled=true;
  const feeds={kp:'products/noaa-planetary-k-index.json',flux:'json/f107_cm_flux.json',scales:'products/noaa-scales.json'};
  const entries=await Promise.allSettled(Object.entries(feeds).map(async([key,path])=>{
    const response=await fetch('https://services.swpc.noaa.gov/'+path,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('NOAA '+response.status);
    const raw=await response.json();let result;
    if(key==='kp'){
      const rows=Array.isArray(raw[0])?raw.slice(1).map(row=>Object.fromEntries(raw[0].map((k,i)=>[k,row[i]]))):raw;
      const row=rows.filter(r=>Number.isFinite(Number(r.Kp??r.kp))&&Number(r.Kp??r.kp)>=0&&Number(r.Kp??r.kp)<=9).sort((a,b)=>parseTime(b.time_tag)-parseTime(a.time_tag))[0];
      result={value:Number(row.Kp??row.kp),at:row.time_tag};
    }else if(key==='flux'){
      const row=raw.filter(r=>r.frequency===2800&&r.flux>0&&r.flux<1000).sort((a,b)=>parseTime(b.time_tag)-parseTime(a.time_tag))[0];result={value:row.flux,at:row.time_tag};
    }else{const row=raw['0'];result={value:Object.fromEntries(['R','S','G'].map(k=>[k,{scale:Number(row[k].Scale),text:String(row[k].Text)}])),at:row.DateStamp+'T'+row.TimeStamp};if(Object.values(result.value).some(v=>!Number.isInteger(v.scale)||v.scale<0||v.scale>5))throw new Error('Invalid NOAA scales');}
    if(!Number.isFinite(parseTime(result.at)))throw new Error('Invalid NOAA observation time');
    return [key,result];
  }));
  const fresh={...(weather??{})};let failures=0;
  for(const result of entries){if(result.status==='fulfilled')fresh[result.value[0]]=result.value[1];else failures++;}
  weather=fresh;weather.refreshFailed=failures>0;
  try{localStorage.setItem(KEY+'-weather',JSON.stringify(weather));}catch{}
  renderWeather();weatherBusy=false;$('#weather-refresh').disabled=false;
}
function renderWeather(){
  if(!weather){$('#weather-data').innerHTML='<p class="muted">No NOAA observations available. Open the source link below.</p>';return;}
  const stale=(row,hours)=>!row||!Number.isFinite(parseTime(row.at))||Date.now()-parseTime(row.at)>hours*3600000||parseTime(row.at)>Date.now()+600000;
  const kp=weather.kp,flux=weather.flux,scales=weather.scales;
  $('#weather-data').innerHTML=`<div class="weather-stats"><div class="weather-stat"><b>${kp?esc(kp.value):'—'}</b><span>Kp · ${stale(kp,6)?'stale / unavailable':'current'}</span></div><div class="weather-stat"><b>${flux?esc(flux.value):'—'}</b><span>Solar flux sfu · ${stale(flux,48)?'stale / unavailable':'current'}</span></div></div><div class="weather-status">${scales?.value?Object.entries(scales.value).map(([key,v])=>`<span class="pill ${v.scale>0||stale(scales,3)?'pill--warning':''}" title="${esc(v.text)}">${key}${esc(v.scale)}${stale(scales,3)?' · stale':''}</span>`).join(''):'<span class="pill pill--muted">Scales unavailable</span>'}</div><p class="muted">${kp?'Kp observed '+esc(utcLabel(parseTime(kp.at)))+'<br>':''}${flux?'Flux observed '+esc(utcLabel(parseTime(flux.at)))+'<br>':''}${scales?'R/S/G observed '+esc(utcLabel(parseTime(scales.at)))+'<br>':''}${weather.refreshFailed?'Refresh incomplete; last available observations shown. ':''}These values do not establish a usable frequency for your path.</p>`;
}
function tick(){const now=new Date();$('#utc-clock').textContent=now.toISOString().slice(11,19)+'Z';$('#local-clock').textContent=localLabel(now);}

$('#home-button').onclick=()=>openHome();
$$('[data-tab]').forEach(button=>button.onclick=()=>goTab(button.dataset.tab));
$$('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
$('#station-list').onclick=event=>{const button=event.target.closest('[data-station]');if(button)selectStation(button.dataset.station);};
$('#station-map-button').onclick=()=>setStationView('map');$('#station-table-button').onclick=()=>setStationView('table');
$('#reference-station').onchange=()=>{
  const value=$('#reference-station').value.trim().toUpperCase();
  if(!stations().some(s=>s.callsign===value)){notice('Choose a callsign from this roster, or use your saved station.',true);renderReference();return;}
  state.reference_callsign=value;persist();renderStations();drawHome();drawPath();
};
$('#reference-home').onclick=()=>{if(!state.home)return;state.reference_callsign='@home';persist();renderStations();drawHome();drawPath();};
$$('[data-sheet-sort]').forEach(button=>button.onclick=()=>{const field=button.dataset.sheetSort;tableSort={field,order:tableSort.field===field?-tableSort.order:1};renderStationTable(filteredStations(),referenceStation());});
$('#station-table-body').onclick=event=>{
  const edit=event.target.closest('[data-table-edit]'),pick=event.target.closest('[data-table-station]');
  if(edit)openStationEditor(stations().find(s=>s.callsign===edit.dataset.tableEdit));
  if(pick){setStationView('map');selectStation(pick.dataset.tableStation);}
};
for(const id of ['station-search','country-filter','prefix-filter','group-filter','unworked-filter','sort-stations'])$('#'+id).addEventListener(id==='station-search'?'input':'change',renderStations);
$('#fit-stations').onclick=()=>{const rows=filteredStations();if(rows.length)map.fitBounds(L.latLngBounds(rows.map(s=>[s.lat,s.lon])),{padding:[25,25],maxZoom:7});};
$('#time-offset').oninput=()=>{drawSky();renderCircuit();};$('#time-live').onclick=()=>{$('#time-offset').value=0;drawSky();renderCircuit();};
$('#import-stations').onclick=()=>chooseFile('stations');$('#import-channels').onclick=()=>chooseFile('channels');$('#restore-backup').onclick=()=>chooseFile('backup');
$('#restore-roster').onclick=()=>{if(!publicRoster){notice('Shared roster is still unavailable; try refreshing the page.',true);return;}state.stations=null;state.stationOrigins={};state.rosterInfo=null;persist();selected=null;pathLayer.clearLayers();$('#circuit').innerHTML='<p>Select a station to plan a circuit.</p>';renderRoster();notice('Shared registration snapshot restored.');};
$$('[data-export]').forEach(button=>button.onclick=()=>exportStations(button.dataset.export));
$('#backup').onclick=backup;$('#backup-tools').onclick=backup;$('#print').onclick=()=>window.print();
$('#add-contact').onclick=()=>openContact();$('#log-search').oninput=renderLog;
$('#contact-list').onclick=event=>{const button=event.target.closest('[data-delete-contact]');if(button&&confirm('Delete this contact from this device?')){state.contacts=state.contacts.filter(c=>c.id!==button.dataset.deleteContact);persist();renderLog();renderStations();renderCircuit();}};
$('#export-log').onclick=()=>download('skywave-contact-log.csv',csvExport(state.contacts,LOG_HEADERS),'text/csv;charset=utf-8');
for(const id of ['channel-search','phase-filter','authorised-filter'])$('#'+id).addEventListener(id==='channel-search'?'input':'change',renderChannels);
$('#channel-template').onclick=()=>download('skywave-channel-template.csv',csvExport([],CHANNEL_HEADERS),'text/csv;charset=utf-8');
$('#channel-export').onclick=()=>download('skywave-channels.csv',csvExport(filteredChannels(),CHANNEL_HEADERS),'text/csv;charset=utf-8');
$('#channel-list').onclick=event=>{const button=event.target.closest('[data-plan-channel]');if(button){const channel=state.channels.find(c=>c.channel_id===button.dataset.planChannel);openSked(channel);}};
$('#copy-sked').onclick=()=>{const text=$('#sked-message').value;if(text)copy(text);else notice('Prepare a message first.');};
$('#copy-circuit').onclick=()=>{if(!state.home||!selected){notice('Set your home station and select the far end on the map first.');goTab('map');return;}copy(`${state.home.callsign}: ${state.home.lat}, ${state.home.lon}\n${selected.callsign}: ${selected.lat}, ${selected.lon}\nShort path ${fmtNumber(distance(state.home,selected))} km; initial bearing ${bearing(state.home,selected)?.toFixed(1)??'ambiguous'}° true.\nPositions are reported; confirm with the operators.`);};
for(const id of ['antenna-freq','antenna-angle','antenna-units'])$('#'+id).addEventListener('input',renderAntenna);
$('#weather-refresh').onclick=refreshWeather;
async function initialise(){
  renderLog();renderHome();drawSky();renderAntenna();
  try{weather=JSON.parse(localStorage.getItem(KEY+'-weather')??'null');renderWeather();}catch{}
  void refreshWeather();
  try{
    const response=await fetch('./data/stations.json',{cache:'no-cache'});if(!response.ok)throw new Error('Roster download failed');
    const raw=await response.json();publicRoster={...raw,stations:stationRows(raw.stations)};
    renderRoster();renderHome();
    const call=new URLSearchParams(location.hash.slice(1)).get('station');if(call)selectStation(call,false);
  }catch(error){renderRoster();notice('Shared roster unavailable. Import a station CSV / GeoJSON or retry later.',true);}
}
setInterval(tick,1000);setInterval(()=>{drawSky();if(activeTab==='map')renderCircuit();if(activeTab==='channels')renderChannels();if(weather)renderWeather();},60000);setInterval(refreshWeather,300000);
window.addEventListener('hashchange',()=>{const call=new URLSearchParams(location.hash.slice(1)).get('station');if(call)selectStation(call,false);});
void initialise();
