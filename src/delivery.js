import { alertSubject, alertText, validateDeliveryTarget } from './core/delivery-policy.js';

export async function deliverAlert(destination, context, env) {
  const channel=String(destination?.channel || '').toLowerCase();
  const validation=validateDeliveryTarget(channel,destination?.target);
  if(!validation.ok){
    return {ok:false,providerMessageId:null,error:validation.error};
  }
  destination={...destination,target:validation.value};

  if(channel==='webhook') return deliverWebhook(destination,context,env);
  if(channel==='email') return deliverEmail(destination,context,env);

  return {
    ok:false,
    providerMessageId:null,
    error:'unsupported_delivery_channel'
  };
}

async function deliverWebhook(destination,context,env){
  const headers={
    'content-type':'application/json',
    'user-agent':'DeFi-Guard/0.3',
    'x-defi-guard-event-id':String(context.event?.id || '')
  };
  if(env?.WEBHOOK_BEARER_TOKEN){
    headers.authorization=`Bearer ${env.WEBHOOK_BEARER_TOKEN}`;
  }

  try{
    const response=await fetchWithTimeout(destination.target,{
      method:'POST',
      redirect:'manual',
      headers,
      body:JSON.stringify({
        service:'DeFi Guard',
        version:'0.3.0',
        event:context.event,
        change:context.change,
        position:publicPosition(context.position),
        evaluation:context.evaluation
      })
    },10_000);

    const body=await safeText(response);
    return {
      ok:response.ok,
      providerMessageId:response.headers.get('x-request-id'),
      error:response.ok ? null : `webhook_http_${response.status}:${body.slice(0,300)}`
    };
  }catch(error){
    return {ok:false,providerMessageId:null,error:`webhook_error:${error.message}`};
  }
}

async function deliverEmail(destination,context,env){
  if(!env?.RESEND_API_KEY) {
    return {ok:false,providerMessageId:null,error:'resend_api_key_missing'};
  }
  if(!env?.ALERT_EMAIL_FROM) {
    return {ok:false,providerMessageId:null,error:'alert_email_from_missing'};
  }

  const subject=alertSubject(context);
  const text=alertText(context);

  try{
    const response=await fetchWithTimeout('https://api.resend.com/emails',{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'authorization':`Bearer ${env.RESEND_API_KEY}`
      },
      body:JSON.stringify({
        from:env.ALERT_EMAIL_FROM,
        to:[destination.target],
        subject,
        text,
        tags:[
          {name:'product',value:'defi-guard'},
          {name:'event_type',value:safeTag(context.change?.eventType || 'unknown')}
        ]
      })
    },10_000);

    const payload=await safeJson(response);
    return {
      ok:response.ok,
      providerMessageId:payload?.id || null,
      error:response.ok ? null : `resend_http_${response.status}:${JSON.stringify(payload).slice(0,300)}`
    };
  }catch(error){
    return {ok:false,providerMessageId:null,error:`resend_error:${error.message}`};
  }
}

function publicPosition(position){
  return {
    id:position?.id || null,
    protocol:position?.protocol || null,
    chain:position?.chain || null,
    asset:position?.asset || null,
    externalPositionId:position?.externalPositionId || null
  };
}

function safeTag(value){
  return String(value).toLowerCase().replace(/[^a-z0-9_-]/g,'-').slice(0,256) || 'unknown';
}

async function fetchWithTimeout(url,init,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetch(url,{...init,signal:controller.signal});
  }finally{
    clearTimeout(timer);
  }
}

async function safeJson(response){
  try{return await response.json();}catch{return {raw:await safeText(response)};}
}

async function safeText(response){
  try{return await response.text();}catch{return '';}
}
