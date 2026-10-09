const DELIVERABLE_EVENTS = new Set([
  'INITIAL_ALERT',
  'RISK_ESCALATED',
  'RISK_IMPROVED',
  'VERIFICATION_REQUIRED',
  'VERIFICATION_RESOLVED'
]);

export function shouldDeliver(change) {
  if (!change || change.changed !== true) return false;
  return DELIVERABLE_EVENTS.has(String(change.eventType || '').toUpperCase());
}

export function alertSubject({ change, evaluation, position }) {
  const state=String(evaluation?.alertState || 'UNKNOWN').toUpperCase();
  const protocol=position?.protocol || evaluation?.protocol || 'DeFi';
  const asset=position?.asset || evaluation?.asset || 'position';
  return `DeFi Guard: ${state} — ${protocol} ${asset}`;
}

export function alertText({ change, evaluation, position }) {
  const lines=[
    'DeFi Guard risk change detected.',
    '',
    `Position: ${position?.protocol || evaluation?.protocol || 'Unknown'} / ${position?.chain || evaluation?.chain || 'Unknown'} / ${position?.asset || evaluation?.asset || 'Unknown'}`,
    `Event: ${change?.eventType || 'UNKNOWN'}`,
    `Previous state: ${change?.previousState || 'NONE'}`,
    `Current state: ${evaluation?.alertState || change?.currentState || 'UNKNOWN'}`
  ];

  if (evaluation?.healthFactor != null) {
    lines.push(`Health Factor: ${Number(evaluation.healthFactor).toFixed(3)}`);
  }

  const reasons=Array.isArray(evaluation?.reasons) ? evaluation.reasons : [];
  if(reasons.length){
    lines.push('', 'Reasons:');
    for(const r of reasons.slice(0,8)){
      lines.push(`- ${r.code}: ${r.message}`);
    }
  }

  lines.push('', 'Read-only monitoring alert. No transaction was executed.');
  return lines.join('\n');
}


export function validateDeliveryTarget(channel, target) {
  const kind=String(channel || '').toLowerCase();
  const value=String(target || '').trim();

  if(kind==='email'){
    if(value.length>254) return {ok:false,error:'email_too_long'};
    const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return ok ? {ok:true,value} : {ok:false,error:'invalid_email'};
  }

  if(kind==='webhook'){
    let url;
    try{url=new URL(value);}catch{return {ok:false,error:'invalid_webhook_url'};}
    if(url.protocol!=='https:') return {ok:false,error:'webhook_https_required'};
    if(url.username || url.password) return {ok:false,error:'webhook_url_credentials_forbidden'};
    const host=url.hostname.toLowerCase();
    if(host==='localhost' || host.endsWith('.localhost')) return {ok:false,error:'webhook_localhost_forbidden'};
    if(/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
      return {ok:false,error:'webhook_ip_literal_forbidden'};
    }
    return {ok:true,value:url.toString()};
  }

  return {ok:false,error:'unsupported_delivery_channel'};
}
