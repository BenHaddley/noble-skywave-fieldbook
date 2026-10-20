// Only a maintainer's publish-station label can apply a shared station request.
// Issue content is parsed as bounded data. It is never evaluated or used as shell code.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {stationRows,upsertStation} from '../assets/core.js';

const fields=new Set(['callsign','name','country','place','lat','lon','location_source']);
const canonical=station=>JSON.stringify(Object.entries(stationRows([station])[0]).sort(([a],[b])=>a.localeCompare(b)));
function checkedStation(station){
  if(!station||typeof station!=='object'||Array.isArray(station)||Object.keys(station).some(k=>!fields.has(k)))throw new Error('Station requests contain map fields only');
  return stationRows([station])[0];
}
export function parseProposal(body){
  if(typeof body!=='string'||body.length>10000)throw new Error('Invalid or oversized station request');
  const blocks=[...body.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if(blocks.length!==1)throw new Error('A request must contain one JSON station proposal');
  const data=JSON.parse(blocks[0][1]);
  if(!data||typeof data!=='object'||Array.isArray(data)||data.version!==1||!['add','update'].includes(data.action))throw new Error('Unsupported station request format');
  const allowed=new Set(['version','action','original_callsign','previous_station','station']);
  if(Object.keys(data).some(k=>!allowed.has(k)))throw new Error('Unexpected request fields');
  const station=checkedStation(data.station);
  if(data.action==='update'){
    const previous=checkedStation(data.previous_station);
    if(data.original_callsign!==previous.callsign)throw new Error('Original callsign does not match the previous station');
    return {...data,station,previous_station:previous};
  }
  if(data.original_callsign!=null||data.previous_station!=null)throw new Error('New stations cannot replace an existing callsign');
  return {...data,station};
}
export function applyProposal(roster,proposal,{number,now=new Date().toISOString()}={}){
  const current=stationRows(roster.stations);
  const previous=proposal.action==='update'?current.find(s=>s.callsign===proposal.original_callsign):null;
  if(proposal.action==='update'&&(!previous||canonical(previous)!==canonical(proposal.previous_station)))throw new Error('This request is stale: the shared station changed. Submit a new request from the current roster.');
  if(previous&&canonical(previous)===canonical(proposal.station))throw new Error('This request does not change the station');
  const station={...proposal.station,location_source:`Operator-reported update via GitHub #${number}; not independently verified`};
  const updated=upsertStation(current,station,previous?.callsign??null);
  return {...roster,updated_at:now,note:'Shared roster: registered positions and reviewed operator updates. Not live presence; confirm locations with the teams.',stations:updated.sort((a,b)=>a.callsign.localeCompare(b.callsign,undefined,{numeric:true}))};
}
export async function authorisedEvent(event,api){
  if(event.action!=='labeled'||event.label?.name!=='publish-station'||event.issue?.pull_request||!Number.isSafeInteger(event.issue?.number)||event.issue.number<1)throw new Error('Only labelled station issues can be published');
  const sender=event.sender?.login;
  if(!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(sender??''))throw new Error('Invalid approving account');
  const access=await api(`collaborators/${sender}/permission`);
  if(!['admin','maintain','write'].includes(access.permission))throw new Error('A repository maintainer must approve publication');
  const issue=await api(`issues/${event.issue.number}`);
  if(issue.state!=='open'||issue.body!==event.issue.body||!issue.labels.some(l=>l.name==='publish-station'))throw new Error('The approved request changed, closed, or lost its approval label');
  return parseProposal(event.issue.body);
}
async function main(){
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const repo=process.env.GITHUB_REPOSITORY,token=process.env.GH_TOKEN;
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo??'')||!token)throw new Error('GitHub workflow credentials and repository are required');
  const api=async(path,method='GET',body)=>{
    const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});
    if(!r.ok)throw new Error(`GitHub request failed (${r.status})`);
    return r.status===204?null:r.json();
  };
  if(process.argv.includes('--complete')){
    // A user can edit a request while a deployment runs; never close their new text.
    const current=await api(`issues/${event.issue.number}`);
    if(current.body===event.issue.body)await api(`issues/${event.issue.number}`,'PATCH',{state:'closed',state_reason:'completed'});
    return;
  }
  const proposal=await authorisedEvent(event,api);
  const file=new URL('../data/stations.json',import.meta.url),roster=JSON.parse(await readFile(file,'utf8'));
  const updated=applyProposal(roster,proposal,{number:event.issue.number});
  await writeFile(file,JSON.stringify(updated,null,2)+'\n');
  console.log(`Validated reviewed station ${proposal.action}: ${proposal.station.callsign}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
