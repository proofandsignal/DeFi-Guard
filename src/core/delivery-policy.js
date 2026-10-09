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
