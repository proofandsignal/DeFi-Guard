const RANK = {
  OK: 0,
  WATCH: 1,
  WARNING: 2,
  CRITICAL: 3,
  VERIFY: 2
};

export function severityRank(state) {
  return RANK[String(state || '').toUpperCase()] ?? -1;
}

export function detectAlertChange(previousState, currentState) {
  const prev = previousState ? String(previousState).toUpperCase() : null;
  const curr = String(currentState || '').toUpperCase();
  const currRank = severityRank(curr);

  if (currRank < 0) {
    return {
      changed: false,
      eventType: 'INVALID_STATE',
      previousState: prev,
      currentState: curr,
      severityRank: currRank
    };
  }

  if (prev == null) {
    return {
      changed: curr !== 'OK',
      eventType: curr === 'OK' ? 'INITIAL_OK' : 'INITIAL_ALERT',
      previousState: null,
      currentState: curr,
      severityRank: currRank
    };
  }

  if (prev === curr) {
    return {
      changed: false,
      eventType: 'UNCHANGED',
      previousState: prev,
      currentState: curr,
      severityRank: currRank
    };
  }

  if (curr === 'VERIFY') {
    return {
      changed: true,
      eventType: 'VERIFICATION_REQUIRED',
      previousState: prev,
      currentState: curr,
      severityRank: currRank
    };
  }

  if (prev === 'VERIFY') {
    return {
      changed: true,
      eventType: 'VERIFICATION_RESOLVED',
      previousState: prev,
      currentState: curr,
      severityRank: currRank
    };
  }

  const prevRank = severityRank(prev);
  return {
    changed: true,
    eventType: currRank > prevRank ? 'RISK_ESCALATED' : 'RISK_IMPROVED',
    previousState: prev,
    currentState: curr,
    severityRank: currRank
  };
}
