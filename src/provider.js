const PROVIDER_KINDS = new Set(['generic-post','defi-risk-monitor']);

export function snapshotProviderKind(env) {
  const raw=String(env?.SNAPSHOT_PROVIDER_KIND || 'generic-post').trim().toLowerCase();
  if(!PROVIDER_KINDS.has(raw)) throw new Error(`snapshot_provider_kind_unsupported:${raw}`);
  return raw;
}

export async function fetchPositionSnapshot(position, env) {
  const kind=snapshotProviderKind(env);
  if(kind==='defi-risk-monitor') {
    return fetchRiskMonitorSnapshot(position,env);
  }
  return fetchGenericSnapshot(position,env);
}

async function fetchGenericSnapshot(position, env) {
  const url=String(env?.SNAPSHOT_PROVIDER_URL || '').trim();
  if(!url) throw new Error('snapshot_provider_url_missing');

  const headers={
    'content-type':'application/json',
    'accept':'application/json'
  };
  if(env?.SNAPSHOT_PROVIDER_TOKEN){
    headers.authorization=`Bearer ${env.SNAPSHOT_PROVIDER_TOKEN}`;
  }

  const response=await fetchWithTimeout(url,{
    method:'POST',
    headers,
    body:JSON.stringify({
      positionId:position.id,
      externalPositionId:position.externalPositionId,
      walletAddress:position.walletAddress,
      protocol:position.protocol,
      chain:position.chain,
      asset:position.asset
    })
  });

  if(!response.ok){
    const body=await response.text().catch(()=>'');
    throw new Error(`snapshot_provider_http_${response.status}:${body.slice(0,300)}`);
  }

  const payload=await response.json();
  if(!payload || typeof payload!=='object' || Array.isArray(payload)){
    throw new Error('snapshot_provider_invalid_payload');
  }

  return {
    ...payload,
    positionId:position.id,
    protocol:position.protocol,
    chain:position.chain,
    asset:position.asset,
    updatedAt:payload.updatedAt || new Date().toISOString()
  };
}

async function fetchRiskMonitorSnapshot(position, env) {
  const base=String(env?.SNAPSHOT_PROVIDER_URL || '').trim();
  if(!base) throw new Error('snapshot_provider_url_missing');

  const wallet=String(position?.walletAddress || '').trim();
  if(!/^0x[a-fA-F0-9]{40}$/.test(wallet)){
    throw new Error('risk_monitor_wallet_address_required');
  }

  const protocol=String(position?.protocol || '').trim().toLowerCase();
  if(!['aave','aave-v3','aave_v3'].includes(protocol)){
    throw new Error('risk_monitor_protocol_unsupported');
  }

  const chain=String(position?.chain || '').trim().toLowerCase();
  if(!['ethereum','ethereum-mainnet','mainnet','1'].includes(chain)){
    throw new Error('risk_monitor_chain_unsupported');
  }

  const url=buildRiskMonitorUrl(base,wallet);
  const headers={'accept':'application/json'};
  if(env?.SNAPSHOT_PROVIDER_TOKEN){
    headers.authorization=`Bearer ${env.SNAPSHOT_PROVIDER_TOKEN}`;
  }

  const response=await fetchWithTimeout(url,{method:'GET',headers});
  if(!response.ok){
    const body=await response.text().catch(()=>'');
    throw new Error(`risk_monitor_http_${response.status}:${body.slice(0,300)}`);
  }

  const payload=await response.json();
  return normalizeRiskMonitorPayload(payload,position);
}

export function normalizeRiskMonitorPayload(payload, position) {
  if(!payload || typeof payload!=='object' || Array.isArray(payload)){
    throw new Error('risk_monitor_invalid_payload');
  }

  const snapshot=payload.snapshot;
  if(!snapshot || typeof snapshot!=='object' || Array.isArray(snapshot)){
    throw new Error('risk_monitor_snapshot_missing');
  }

  const collateral=finiteNonNegative(snapshot.totalCollateralBase,'totalCollateralBase');
  const debt=finiteNonNegative(snapshot.totalDebtBase,'totalDebtBase');
  const threshold=finiteRatio(snapshot.currentLiquidationThreshold,'currentLiquidationThreshold');
  const healthFactor=nullableFiniteNonNegative(snapshot.healthFactor,'healthFactor');
  const observedAt=String(snapshot.observedAt || '').trim();

  if(!Number.isFinite(Date.parse(observedAt))){
    throw new Error('risk_monitor_observed_at_invalid');
  }
  if(debt>0 && healthFactor==null){
    throw new Error('risk_monitor_health_factor_missing_with_debt');
  }

  const currentLtvPct=collateral>0 ? (debt/collateral)*100 : null;
  const liquidationThresholdPct=threshold*100;

  return {
    positionId:position.id,
    protocol:position.protocol,
    chain:position.chain,
    asset:position.asset,
    healthFactor,
    collateralValueUsd:collateral,
    debtValueUsd:debt,
    ltvPct:currentLtvPct,
    liquidationThresholdPct,
    marketDecision:null,
    securityState:null,
    dataState:'SUFFICIENT',
    updatedAt:observedAt,
    source:{
      service:'defi-risk-monitor',
      wallet:String(snapshot.wallet || position.walletAddress || '').toLowerCase(),
      chainId:Number(snapshot.chainId || 1),
      poolAddress:snapshot.poolAddress || null,
      upstreamRiskState:payload.risk?.state || null,
      upstreamUniformCollateralDropToLiquidationPct:
        numberOrNull(payload.risk?.uniformCollateralDropToLiquidationPct)
    }
  };
}

function buildRiskMonitorUrl(base,wallet){
  let url;
  try{
    url=new URL(base);
  }catch{
    throw new Error('snapshot_provider_url_invalid');
  }
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))){
    throw new Error('snapshot_provider_url_must_be_https');
  }
  url.pathname=url.pathname.replace(/\/$/,'')+`/api/v1/aave/account/${encodeURIComponent(wallet)}`;
  url.search='';
  url.hash='';
  return url.toString();
}

function finiteNonNegative(value,name){
  const n=Number(value);
  if(!Number.isFinite(n) || n<0) throw new Error(`risk_monitor_${name}_invalid`);
  return n;
}

function nullableFiniteNonNegative(value,name){
  if(value==null) return null;
  return finiteNonNegative(value,name);
}

function finiteRatio(value,name){
  const n=Number(value);
  if(!Number.isFinite(n) || n<0 || n>1) throw new Error(`risk_monitor_${name}_invalid`);
  return n;
}

function numberOrNull(value){
  if(value==null) return null;
  const n=Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchWithTimeout(url,init){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10_000);
  try{
    return await fetch(url,{...init,signal:controller.signal});
  }finally{
    clearTimeout(timer);
  }
}
