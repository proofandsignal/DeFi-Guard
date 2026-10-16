export function normalizeMaxDeliveryAttempts(value, fallback = 3) {
  const parsed=Number.parseInt(String(value ?? ''),10);
  if(!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed,10);
}

export function retryDecision(failedAttempts, maxAttempts = 3) {
  const failed=Math.max(0,Number.parseInt(String(failedAttempts ?? 0),10) || 0);
  const max=normalizeMaxDeliveryAttempts(maxAttempts,3);
  return {
    failedAttempts:failed,
    maxAttempts:max,
    nextAttempt:failed + 1,
    retry:failed > 0 && failed < max
  };
}

export function deliveryKey(eventId, destinationId) {
  const event=String(eventId || '').trim();
  const destination=String(destinationId || '').trim();
  if(!event || !destination) return null;
  return `${event}-${destination}`;
}
