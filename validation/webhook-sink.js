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

    return new Response(null,{
      status:204,
      headers:{'x-request-id':`sink-${eventId}`}
    });
  }
};
