export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method!=='POST' || url.pathname!=='/hook'){
      return new Response('not_found',{status:404});
    }

    const eventId=String(request.headers.get('x-defi-guard-event-id') || '').trim();
    if(!eventId){
      return new Response('event_id_required',{status:400});
    }

    let body;
    try{
      body=await request.json();
    }catch{
      return new Response('invalid_json',{status:400});
    }

    if(body?.service!=='DeFi Guard'){
      return new Response('service_invalid',{status:400});
    }
    if(String(body?.event?.id || '')!==eventId){
      return new Response('event_id_mismatch',{status:400});
    }
    if(!body?.change?.eventType){
      return new Response('event_type_required',{status:400});
    }

    if(url.searchParams.get('fail-first')==='1'){
      const attempt=Number(request.headers.get('x-defi-guard-delivery-attempt') || 0);
      const deliveryKey=String(request.headers.get('x-defi-guard-delivery-key') || '').trim();
      if(!deliveryKey){
        return new Response('delivery_key_required',{status:400});
      }
      if(attempt===1){
        return new Response('controlled_first_attempt_failure',{status:503});
      }
    }

    return new Response(null,{
      status:204,
      headers:{'x-request-id':`sink-${eventId}`}
    });
  }
};
