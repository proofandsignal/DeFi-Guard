export async function fetchPositionSnapshot(position, env) {
  const url=String(env?.SNAPSHOT_PROVIDER_URL || '').trim();
  if(!url) throw new Error('snapshot_provider_url_missing');

  const headers={
    'content-type':'application/json',
    'accept':'application/json'
  };
  if(env?.SNAPSHOT_PROVIDER_TOKEN){
    headers.authorization=`Bearer ${env.SNAPSHOT_PROVIDER_TOKEN}`;
  }

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10_000);

  try{
    const response=await fetch(url,{
      method:'POST',
      headers,
      signal:controller.signal,
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
  }finally{
    clearTimeout(timer);
  }
}
