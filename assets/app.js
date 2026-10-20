import {escapeHtml as esc,callsign,coordinate,distance,greatCircle,darkPolygon,stationRows,fileRows,stationExport} from './core.js?v=map-only-1';
import {locator,locatorPosition,upsertStation,stationProposal,proposalBody,sheetRow,challengeFamily} from './core.js?v=map-only-1';
import {stationSetup,findSetupStation} from './station-setup.js?v=map-only-1';

const $=selector=>document.querySelector(selector), $$=selector=>[...document.querySelectorAll(selector)];
const KEY='skywave-fieldbook-v1', L=window.L;
const DEVICE_ZONE=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
let state={home:null,stations:null,stationOrigins:{},reference_callsign:'AU16',rosterInfo:null}, legacyData={}, publicRoster=null, selected=null, noticeTimer;
let pickingStation=false,editingSharedOriginal=null,stationView='map',tableSort={field:'callsign',order:1};
let homeLookupCall=null,homeAutofillValues=null,homeManualFields=new Set();
const GROUP_COLOURS={SSB:'#226ba4','2G':'#b77220','3G':'#7652a0',Unassigned:'#778386'};
let skyTime=new Date();
function validateHome(home){
  if(!home)return null;
  new Intl.DateTimeFormat('en',{timeZone:home.zone}).format(new Date());
  return {callsign:callsign(home.callsign),country:String(home.country||'Australia').slice(0,60),lat:coordinate(home.lat,90,'home latitude'),lon:coordinate(home.lon,180,'home longitude'),zone:home.zone};
}
function validateState(raw){
  if(!raw||typeof raw!=='object')throw new Error('Invalid saved map settings');
  const home=validateHome(raw.home);
  const stationOrigins=Object.fromEntries(Object.entries(raw.stationOrigins??{}).map(([key,value])=>[callsign(key),callsign(value)]));
  return {home,reference_callsign:raw.reference_callsign==='@home'?'@home':callsign(raw.reference_callsign??'AU16'),stations:raw.stations==null?null:stationRows(raw.stations),stationOrigins,rosterInfo:raw.rosterInfo&&typeof raw.rosterInfo==='object'?{label:String(raw.rosterInfo.label??'Imported roster').slice(0,200),updated_at:String(raw.rosterInfo.updated_at??'').slice(0,40)}:null};
}
try{const saved=JSON.parse(localStorage.getItem(KEY)??'null');if(saved){state=validateState(saved);legacyData=Object.fromEntries(['channels','contacts'].filter(key=>Object.hasOwn(saved,key)).map(key=>[key,saved[key]]));}}catch{notice('Saved map settings could not be read. You can still use the shared roster.',true);}
function notice(message,error=false){
  const node=$('#notice');node.textContent=message;node.classList.toggle('error',error);node.hidden=false;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.hidden=true,error?12000:6000);
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({...legacyData,...state}));return true;}catch{notice('Browser storage is unavailable or full. Changes could not be saved on this device.',true);return false;}}
function fmtNumber(n){return Math.round(n).toLocaleString('en-AU');}
function utcLabel(value,seconds=false){return new Date(value).toISOString().slice(0,seconds?19:16).replace('T',' ')+'Z';}
function localLabel(value){return new Intl.DateTimeFormat('en-AU',{timeZone:state.home?.zone??DEVICE_ZONE,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(value));}
function stations(){
  const shared=new Map((publicRoster?.stations??[]).map(s=>[s.callsign,s]));
  return (state.stations??publicRoster?.stations??[]).map(s=>{
    const current=shared.get(state.stationOrigins[s.callsign]??s.callsign);
    return {...s,...(!Object.hasOwn(s,'challenge_group')&&current?.challenge_group!=null?{challenge_group:current.challenge_group}:{})};
  });
}
function referenceStation(){return state.reference_callsign==='@home'?state.home:stations().find(s=>s.callsign===state.reference_callsign)??null;}
function filteredStations(){
  const query=$('#station-search').value.trim().toLowerCase(),country=$('#country-filter').value,prefix=$('#prefix-filter').value,group=$('#group-filter').value;
  const rows=stations().filter(s=>(!query||`${s.callsign} ${s.prefix} ${s.challenge_group??''} ${s.country} ${s.name} ${s.place??''} ${locator(s)} ${s.lat.toFixed(5)} ${s.lon.toFixed(5)}`.toLowerCase().includes(query))&&(!country||s.country===country)&&(!prefix||s.prefix===prefix)&&(!group||s.challenge_group===group));
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
  $('#home-stations').innerHTML=stations().map(s=>`<option value="${esc(s.callsign)}">${esc(s.country)} · ${esc(s.place||locator(s))}</option>`).join('');
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
  $('#station-list').innerHTML=rows.length?rows.map(s=>{const r=sheetRow(s,reference);return `<button class="station-row ${selected?.callsign===s.callsign?'selected':''}" data-station="${esc(s.callsign)}"><span class="station-main"><strong>${esc(s.callsign)}</strong> <span class="group-chip group-${challengeFamily(s)}">${esc(s.challenge_group||'Unassigned')}</span>${s.callsign===state.home?.callsign?'<span class="home-tag">HOME</span>':''}<small>${esc(s.prefix)} · ${r.grid_6} / ${r.grid_4}</small><small class="station-location">${s.place?esc(s.place)+' · ':''}${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</small></span><span class="station-distance">${r.distance_km==null?'—':fmtNumber(r.distance_km)+' km'}<small>${r.bearing_deg==null?'—':r.bearing_deg+'° true'}</small></span></button>`;}).join(''):'<p class="empty-cell">No stations match. Try another callsign, prefix, group or grid.</p>';
  $('#map-group-legend').innerHTML=['SSB','2G','3G'].map(f=>`<span class="group-legend-item"><i style="background:${GROUP_COLOURS[f]}"></i>${f} <b>${rows.filter(s=>challengeFamily(s)===f).length}</b></span>`).join('')+'<span>Colour = registered challenge group · shading = night</span>';
  renderSheetDetail();renderStationTable(rows,reference);drawStations(rows);
}
function renderSheetDetail(){
  const node=$('#station-sheet-detail');node.hidden=!selected;if(!selected)return;
  const ref=referenceStation(),r=sheetRow(selected,ref);
  node.innerHTML=`<div class="sheet-detail-heading"><div><span class="eyebrow">SELECTED STATION</span><h2>${esc(r.callsign)}</h2></div><button id="sidebar-clear" class="text-button">Close ×</button></div><div class="sheet-values">${[['Prefix',r.prefix],['Challenge group',r.challenge_group||'Not supplied'],['Latitude',r.lat.toFixed(5)],['Longitude',r.lon.toFixed(5)],['Grid (6-char)',r.grid_6],['Grid (4-char)',r.grid_4],['Distance from '+(ref?.callsign??'reference'),r.distance_km==null?'—':fmtNumber(r.distance_km)+' km'],['Bearing from '+(ref?.callsign??'reference'),r.bearing_deg==null?'—':r.bearing_deg+'° true']].map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</div><p>${esc(r.country)}${r.place?' · '+esc(r.place):''}${r.name&&r.name!==r.callsign?'<br>'+esc(r.name):''}</p><div class="inline"><button id="sidebar-edit" class="text-button">Edit this station ↗</button><button id="sidebar-copy" class="text-button">Copy station link</button></div>`;
  $('#sidebar-clear').onclick=()=>{selected=null;pathLayer.clearLayers();renderStations();history.replaceState(null,'',location.pathname+location.search);};
  $('#sidebar-edit').onclick=()=>openStationEditor(selected);
  const useHome=document.createElement('button');useHome.id='sidebar-as-home';useHome.type='button';useHome.className='text-button';useHome.textContent='Use as my station';useHome.onclick=()=>openHome(selected);node.querySelector('.inline').append(useHome);
  $('#sidebar-copy').onclick=()=>copy(location.href);
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
let tileWarned=false;tiles.on('tileerror',()=>{if(!tileWarned){tileWarned=true;notice('Map tiles are unavailable. Station search, coordinates and exports still work.',true);}});
const sky=L.layerGroup().addTo(map), markerLayer=L.layerGroup().addTo(map), pathLayer=L.layerGroup().addTo(map), homeLayer=L.layerGroup().addTo(map);
function drawStations(rows){
  markerLayer.clearLayers();const zoom=map.getZoom();
  for(const s of rows){
    for(const shift of [-360,0,360]){
      const picked=selected?.callsign===s.callsign;
      const marker=L.circleMarker([s.lat,s.lon+shift],{radius:picked?8:5,weight:picked?3:1.5,color:picked?'#122f36':GROUP_COLOURS[challengeFamily(s)],fillColor:picked?GROUP_COLOURS[challengeFamily(s)]:'#fff',fillOpacity:picked?1:.65}).addTo(markerLayer);
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
  renderStations();drawPath();
  const reference=referenceStation();if(focus&&reference){const path=greatCircle(reference,selected);map.fitBounds(L.latLngBounds(path),{padding:[35,35],maxZoom:5});}
  else if(focus)map.panTo([selected.lat,selected.lon]);
}
function renderHome(){
  $('#home-button').textContent=state.home?`${state.home.callsign} · Station settings ↗`:'Set your station ↗';
  renderReference();
  drawHome();drawPath();drawSky();tick();renderStations();
}
function openHome(station=null){
  const form=$('#home-form'),home=station?stationSetup(station):state.home;
  form.reset();homeManualFields=new Set();
  for(const field of ['callsign','country','lat','lon'])form.elements[field].value=home?.[field]??'';
  setHomeZone(home?.zone??DEVICE_ZONE);
  homeLookupCall=home?.callsign??null;homeAutofillValues=home?homeValues():null;
  $('#home-match-status').textContent=station?homeMatchLabel(station):home?'Your saved station details. You can edit any field, or enter another registered callsign.':'Enter your registered callsign to fill country, coordinates and time zone.';
  $('#home-dialog').showModal();
}
function homeValues(){return Object.fromEntries(['country','lat','lon','zone'].map(key=>[key,$('#home-form').elements[key].value]));}
function setHomeZone(zone){
  const select=$('#home-form').elements.zone;
  if(![...select.options].some(option=>option.value===zone))select.add(new Option(zone,zone));
  select.value=zone;
}
function homeMatchLabel(station){return `Filled from ${station.callsign}${station.place?' · '+station.place:''} · ${locator(station)}. Check the details below; every field is editable.`;}
function fillHomeFromCall(preserveEntered=false){
  const form=$('#home-form'),call=form.elements.callsign.value.trim().toUpperCase();
  if(call===homeLookupCall)return;
  const match=findSetupStation(stations(),call);
  if(match){
    const home=stationSetup(match);
    for(const key of ['country','lat','lon','zone']){
      if(preserveEntered&&homeManualFields.has(key))continue;
      if(key==='zone')setHomeZone(home.zone);else form.elements[key].value=home[key];
    }
    homeLookupCall=call;homeAutofillValues=homeValues();
    $('#home-match-status').textContent=homeMatchLabel(match);
  }else{
    // A different, unknown callsign must not keep another station's auto-filled position.
    if(homeAutofillValues)for(const [key,value] of Object.entries(homeAutofillValues))if(form.elements[key].value===value){if(key==='zone')setHomeZone(DEVICE_ZONE);else form.elements[key].value='';}
    homeLookupCall=null;homeAutofillValues=null;
    $('#home-match-status').textContent=call?'No exact roster match. Choose a suggested callsign, or enter your details manually.':'Enter your registered callsign to fill country, coordinates and time zone.';
  }
}
for(const zone of Intl.supportedValuesOf?.('timeZone')??[])if(![...$('#home-form').elements.zone.options].some(option=>option.value===zone))$('#home-form').elements.zone.add(new Option(zone,zone));
$('#home-form').elements.callsign.addEventListener('input',()=>fillHomeFromCall());
$('#home-form').elements.callsign.addEventListener('change',()=>fillHomeFromCall());
for(const field of ['country','lat','lon','zone'])$('#home-form').elements[field].addEventListener('input',()=>homeManualFields.add(field));
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
  $('#station-search').value=station.callsign;$('#country-filter').value='';$('#prefix-filter').value='';$('#group-filter').value='';setStationView('map');
  renderRoster();selectStation(station.callsign);return true;
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
  pickingStation=true;$('#station-dialog').close();setStationView('map');$('#station-pick-banner').hidden=false;
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
async function copy(text){try{await navigator.clipboard.writeText(text);notice('Copied to clipboard.');}catch{notice('Clipboard unavailable. Select and copy the text manually.',true);}}
function download(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function exportStations(format){const rows=filteredStations();if(!rows.length){notice('No matching stations to export.');return;}const data=stationExport(rows,format,referenceStation());download(`skywave-stations-${rows.length}.${format}`,data.text,data.type);notice(`${rows.length} station positions exported.`);}
$('#import-stations').onclick=()=>{$('#file-input').value='';$('#file-input').click();};
$('#file-input').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>5_000_000)throw new Error('Use a file smaller than 5 MB');
    const imported=stationRows(fileRows(await file.text(),file.name));
    if(!imported.length)throw new Error('No station positions found');
    const next={...state,stations:imported,stationOrigins:{},rosterInfo:{label:file.name,updated_at:new Date().toISOString()}},previous=state;
    state=next;if(!persist()){state=previous;return;}
    selected=null;pathLayer.clearLayers();history.replaceState(null,'',location.pathname+location.search);
    renderRoster();renderHome();notice('Station roster imported on this device.');
  }catch(error){notice(error.message,true);}
};
function tick(){const now=new Date();$('#utc-clock').textContent=now.toISOString().slice(11,19)+'Z';$('#local-clock').textContent=localLabel(now);}

$('#home-button').onclick=()=>openHome();
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
for(const id of ['station-search','country-filter','prefix-filter','group-filter','sort-stations'])$('#'+id).addEventListener(id==='station-search'?'input':'change',renderStations);
$('#fit-stations').onclick=()=>{const rows=filteredStations();if(rows.length)map.fitBounds(L.latLngBounds(rows.map(s=>[s.lat,s.lon])),{padding:[25,25],maxZoom:7});};
$('#time-offset').oninput=drawSky;$('#time-live').onclick=()=>{$('#time-offset').value=0;drawSky();};
$('#restore-roster').onclick=()=>{if(!publicRoster){notice('Shared roster is still unavailable; try refreshing the page.',true);return;}state.stations=null;state.stationOrigins={};state.rosterInfo=null;persist();selected=null;pathLayer.clearLayers();renderRoster();notice('Shared registration snapshot restored.');};
$$('[data-export]').forEach(button=>button.onclick=()=>exportStations(button.dataset.export));
async function initialise(){
  renderHome();
  try{
    const response=await fetch('./data/stations.json',{cache:'no-cache'});if(!response.ok)throw new Error('Roster download failed');
    const raw=await response.json();publicRoster={...raw,stations:stationRows(raw.stations)};
    renderRoster();renderHome();
    if($('#home-dialog').open)fillHomeFromCall(true);
    const call=new URLSearchParams(location.hash.slice(1)).get('station');if(call)selectStation(call,false);
  }catch(error){renderRoster();notice('Shared roster unavailable. Import a station CSV / GeoJSON or retry later.',true);}
}
setInterval(tick,1000);setInterval(drawSky,60000);
window.addEventListener('hashchange',()=>{const call=new URLSearchParams(location.hash.slice(1)).get('station');if(call)selectStation(call,false);});
void initialise();
