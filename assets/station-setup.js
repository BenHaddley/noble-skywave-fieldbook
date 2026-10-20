import {callsign,coordinate} from './core.js?v=station-setup-1';
import tzlookup from './vendor/tz-lookup.js';

export function stationSetup(station){
  const lat=coordinate(station.lat,90,'station latitude'),lon=coordinate(station.lon,180,'station longitude');
  let zone=tzlookup(lat,lon);
  // Older browsers may not recognise recently introduced IANA names.
  try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{zone='UTC';}
  return {callsign:callsign(station.callsign),country:station.country==='Unspecified'?'':String(station.country??''),lat,lon,zone};
}

export function findSetupStation(rows,value){
  const call=String(value??'').trim().toUpperCase();
  return rows.find(station=>station.callsign===call)??null;
}
