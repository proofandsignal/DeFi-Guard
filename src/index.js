import { evaluatePosition } from './core/guard.js';
import { detectAlertChange } from './core/change.js';
import { validateDeliveryTarget } from './core/delivery-policy.js';
import { runScheduledMonitoring } from './monitor.js';
import {
  createWatchlist,
  listWatchlists,
  getWatchlist,
  addPosition,
  getPosition,
  listPositions,
  latestSnapshot,
  saveSnapshot,
  saveAlertEvent,
  listAlertEvents,
  createDeliveryDestination,
  listDeliveryDestinations
} from './store.js';

const VERSION = '0.3.0';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(new Response(null, { status:204 }));

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({
        ok:true,
        service:'defi-guard',
        version:VERSION,
        persistence:Boolean(env?.DB),
        snapshotProvider:Boolean(env?.SNAPSHOT_PROVIDER_URL),
        emailDelivery:Boolean(env?.RESEND_API_KEY && env?.ALERT_EMAIL_FROM)
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/meta') {
      return json({
        service:'DeFi Guard',
        version:VERSION,
        mode:'read-only',
        architecture:'Cron -> Enabled Positions -> Snapshot Provider -> Guard Engine -> Change Detection -> Delivery Policy -> Email/Webhook',
        alertStates:['OK','WATCH','WARNING','CRITICAL','VERIFY'],
        deliveryChannels:['email','webhook'],
        schedule:'every 5 minutes',
        persistence:'Cloudflare D1 via env.DB',
        execution:false,
        custody:false
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/evaluate') {
      const payload = await readJson(request);
      if (payload.error) return payload.error;
      return json(evaluatePosition(payload.value));
    }

    if (url.pathname === '/api/v1/watchlists') {
      if (!env?.DB) return dbMissing();
      const ownerKey = await ownerHash(request);
      if (!ownerKey) return json({ error:'owner_key_required' }, { status:401 });

      if (request.method === 'GET') {
        const rows=await listWatchlists(env.DB,ownerKey);
        return json({ data:rows.map(publicWatchlist) });
      }

      if (request.method === 'POST') {
        const payload=await readJson(request);
        if(payload.error) return payload.error;
        const label=String(payload.value?.label || '').trim();
        if(!label) return json({ error:'label_required' }, { status:400 });
        const now=new Date().toISOString();
        const watchlist=await createWatchlist(env.DB,{
          id:crypto.randomUUID(),ownerKey,label:label.slice(0,120),now
        });
        return json(publicWatchlist(watchlist),{status:201});
      }
    }

    const watchlistMatch=url.pathname.match(/^\/api\/v1\/watchlists\/([^/]+)\/positions$/);
    if(watchlistMatch){
      if (!env?.DB) return dbMissing();
      const ownerKey=await ownerHash(request);
      if(!ownerKey) return json({error:'owner_key_required'},{status:401});
      const watchlistId=decodeURIComponent(watchlistMatch[1]);
      const watchlist=await getWatchlist(env.DB,watchlistId);
      if(!watchlist || watchlist.ownerKey!==ownerKey) return json({error:'watchlist_not_found'},{status:404});

      if(request.method==='GET'){
        return json({data:await listPositions(env.DB,watchlistId)});
      }

      if(request.method==='POST'){
        const payload=await readJson(request);
        if(payload.error) return payload.error;
        const body=payload.value || {};
        const protocol=String(body.protocol || '').trim();
        const chain=String(body.chain || '').trim();
        const asset=String(body.asset || '').trim().toUpperCase();
        if(!protocol || !chain || !asset){
          return json({error:'protocol_chain_asset_required'},{status:400});
        }
        const now=new Date().toISOString();
        const position=await addPosition(env.DB,{
          id:crypto.randomUUID(),
          watchlistId,
          externalPositionId:nullableString(body.externalPositionId),
          walletAddress:nullableString(body.walletAddress),
          protocol:protocol.slice(0,80),
          chain:chain.slice(0,80),
          asset:asset.slice(0,40),
          now
        });
        return json(position,{status:201});
      }
    }

    const destinationMatch=url.pathname.match(/^\/api\/v1\/watchlists\/([^/]+)\/destinations$/);
    if(destinationMatch){
      if (!env?.DB) return dbMissing();
      const ownerKey=await ownerHash(request);
      if(!ownerKey) return json({error:'owner_key_required'},{status:401});
      const watchlistId=decodeURIComponent(destinationMatch[1]);
      const watchlist=await getWatchlist(env.DB,watchlistId);
      if(!watchlist || watchlist.ownerKey!==ownerKey) return json({error:'watchlist_not_found'},{status:404});

      if(request.method==='GET'){
        const rows=await listDeliveryDestinations(env.DB,watchlistId);
        return json({data:rows.map(publicDestination)});
      }

      if(request.method==='POST'){
        const payload=await readJson(request);
        if(payload.error) return payload.error;
        const body=payload.value || {};
        const channel=String(body.channel || '').trim().toLowerCase();
        const validated=validateDeliveryTarget(channel,body.target);
        if(!validated.ok) return json({error:validated.error},{status:400});
        const now=new Date().toISOString();
        const destination=await createDeliveryDestination(env.DB,{
          id:crypto.randomUUID(),
          watchlistId,
          channel,
          target:validated.value,
          now
        });
        return json(publicDestination(destination),{status:201});
      }
    }

    const snapshotMatch=url.pathname.match(/^\/api\/v1\/positions\/([^/]+)\/snapshots$/);
    if(snapshotMatch && request.method==='POST'){
      if (!env?.DB) return dbMissing();
      const ownerKey=await ownerHash(request);
      if(!ownerKey) return json({error:'owner_key_required'},{status:401});
      const positionId=decodeURIComponent(snapshotMatch[1]);
      const position=await ownedPosition(env.DB,positionId,ownerKey);
      if(!position) return json({error:'position_not_found'},{status:404});

      const payload=await readJson(request);
      if(payload.error) return payload.error;
      const body={
        ...(payload.value || {}),
        positionId,
        protocol:position.protocol,
        chain:position.chain,
        asset:position.asset
      };

      const evaluation=evaluatePosition(body);
      const previous=await latestSnapshot(env.DB,positionId);
      const change=detectAlertChange(previous?.alertState || null,evaluation.alertState);
      const now=new Date().toISOString();
      const snapshotId=crypto.randomUUID();
      const snapshot=await saveSnapshot(env.DB,{
        id:snapshotId,
        positionId,
        observedAt:body.updatedAt || now,
        payload:body,
        evaluation,
        createdAt:now
      });

      let event=null;
      if(change.changed){
        event=await saveAlertEvent(env.DB,{
          id:crypto.randomUUID(),
          positionId,
          snapshotId,
          previousState:change.previousState,
          currentState:change.currentState,
          eventType:change.eventType,
          severityRank:change.severityRank,
          reasons:evaluation.reasons,
          createdAt:now
        });
      }

      return json({snapshot,change,event},{status:201});
    }

    const eventsMatch=url.pathname.match(/^\/api\/v1\/positions\/([^/]+)\/events$/);
    if(eventsMatch && request.method==='GET'){
      if (!env?.DB) return dbMissing();
      const ownerKey=await ownerHash(request);
      if(!ownerKey) return json({error:'owner_key_required'},{status:401});
      const positionId=decodeURIComponent(eventsMatch[1]);
      const position=await ownedPosition(env.DB,positionId,ownerKey);
      if(!position) return json({error:'position_not_found'},{status:404});
      return json({data:await listAlertEvents(env.DB,positionId,url.searchParams.get('limit'))});
    }

    return json({ error:'not_found' }, { status:404 });
  },

  async scheduled(controller, env, ctx) {
    const scheduledAt=new Date(controller?.scheduledTime || Date.now()).toISOString();
    const task=runScheduledMonitoring(env,scheduledAt)
      .then(result=>console.log(JSON.stringify({type:'defi_guard_monitor_run',...result})))
      .catch(error=>{
        console.error(JSON.stringify({
          type:'defi_guard_monitor_failure',
          scheduledAt,
          error:String(error?.message || error)
        }));
        throw error;
      });
    ctx.waitUntil(task);
  }
};

async function ownedPosition(db,positionId,ownerKey){
  const position=await getPosition(db,positionId);
  if(!position) return null;
  const watchlist=await getWatchlist(db,position.watchlistId);
  if(!watchlist || watchlist.ownerKey!==ownerKey) return null;
  return position;
}

async function ownerHash(request){
  const value=request.headers.get('X-Guard-Owner-Key');
  const normalized=value ? value.trim() : '';
  if(normalized.length < 16) return null;
  const bytes=new TextEncoder().encode(normalized.slice(0,500));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

function publicWatchlist(watchlist){
  const {ownerKey,...rest}=watchlist;
  return rest;
}

function publicDestination(destination){
  const target=String(destination.target || '');
  let targetHint=target;
  if(destination.channel==='email'){
    const [local,domain]=target.split('@');
    targetHint=domain ? `${String(local || '').slice(0,2)}***@${domain}` : '***';
  }else if(destination.channel==='webhook'){
    try{
      const u=new URL(target);
      targetHint=`${u.origin}/…`;
    }catch{
      targetHint='https://…';
    }
  }
  const {target:_,...rest}=destination;
  return {...rest,targetHint};
}

function nullableString(value){
  if(value==null) return null;
  const text=String(value).trim();
  return text ? text.slice(0,200) : null;
}

async function readJson(request){
  try{
    return {value:await request.json()};
  }catch{
    return {error:json({error:'invalid_json'},{status:400})};
  }
}

function dbMissing(){
  return json({
    error:'d1_not_configured',
    message:'Bind a Cloudflare D1 database as env.DB and apply migrations before using persistence endpoints.'
  },{status:503});
}

function json(body,init={}){
  const headers=new Headers(init.headers || {});
  headers.set('content-type','application/json; charset=utf-8');
  return cors(new Response(JSON.stringify(body),{...init,headers}));
}

function cors(response){
  const headers=new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin','*');
  headers.set('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key,X-Guard-Owner-Key');
  headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers
  });
}
