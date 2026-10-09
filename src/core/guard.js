const MAX_SNAPSHOT_AGE_MS = 10 * 60 * 1000;

const VALID_DATA_STATES = new Set(['SUFFICIENT','PARTIAL','UNKNOWN','STALE','INVALID']);
const VALID_DECISIONS = new Set(['PASS','REVIEW','VERIFY','BLOCK']);

function n(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function upper(v) {
  return v == null ? null : String(v).trim().toUpperCase();
}

function reason(code, severity, message) {
  return { code, severity, message };
}

export function evaluatePosition(raw, nowMs = Date.now()) {
  const snapshot = normalizeSnapshot(raw);
  const reasons = [];
  let verificationRequired = false;

  if (!snapshot.protocol || !snapshot.chain || !snapshot.asset) {
    verificationRequired = true;
    reasons.push(reason('IDENTITY_INCOMPLETE','VERIFY','Protocol, chain or asset identity is incomplete.'));
  }

  if (!snapshot.dataState || !VALID_DATA_STATES.has(snapshot.dataState)) {
    verificationRequired = true;
    reasons.push(reason('DATA_STATE_UNKNOWN','VERIFY','Data quality state is missing or unsupported.'));
  } else if (snapshot.dataState !== 'SUFFICIENT') {
    verificationRequired = true;
    reasons.push(reason('DATA_NOT_SUFFICIENT','VERIFY',`Data state is ${snapshot.dataState}; verify before relying on the snapshot.`));
  }

  const updatedAtMs = Date.parse(snapshot.updatedAt || '');
  const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, nowMs - updatedAtMs) : null;
  if (ageMs == null || ageMs > MAX_SNAPSHOT_AGE_MS) {
    verificationRequired = true;
    reasons.push(reason('SNAPSHOT_STALE_OR_UNKNOWN','VERIFY','Snapshot timestamp is missing or older than the v0.1 freshness window.'));
  }

  if (snapshot.marketDecision && !VALID_DECISIONS.has(snapshot.marketDecision)) {
    verificationRequired = true;
    reasons.push(reason('MARKET_DECISION_UNKNOWN','VERIFY','Upstream market decision is unsupported.'));
  }
  if (snapshot.securityState && !VALID_DECISIONS.has(snapshot.securityState)) {
    verificationRequired = true;
    reasons.push(reason('SECURITY_STATE_UNKNOWN','VERIFY','Upstream security state is unsupported.'));
  }

  if (snapshot.marketDecision === 'BLOCK') {
    reasons.push(reason('MARKET_BLOCK','CRITICAL','Upstream market intelligence reports BLOCK.'));
  } else if (snapshot.marketDecision === 'VERIFY') {
    verificationRequired = true;
    reasons.push(reason('MARKET_VERIFY','VERIFY','Upstream market intelligence requires verification.'));
  } else if (snapshot.marketDecision === 'REVIEW') {
    reasons.push(reason('MARKET_REVIEW','WATCH','Upstream market intelligence requires review.'));
  }

  if (snapshot.securityState === 'BLOCK') {
    reasons.push(reason('SECURITY_BLOCK','CRITICAL','Upstream security intelligence reports BLOCK.'));
  } else if (snapshot.securityState === 'VERIFY') {
    verificationRequired = true;
    reasons.push(reason('SECURITY_VERIFY','VERIFY','Security evidence is incomplete.'));
  } else if (snapshot.securityState === 'REVIEW') {
    reasons.push(reason('SECURITY_REVIEW','WATCH','Security intelligence requires review.'));
  }

  const hasDebt = (snapshot.debtValueUsd ?? 0) > 0;
  if (hasDebt && snapshot.healthFactor == null) {
    verificationRequired = true;
    reasons.push(reason('HEALTH_FACTOR_MISSING','VERIFY','Debt is present but Health Factor is missing.'));
  }

  if (snapshot.healthFactor != null) {
    if (snapshot.healthFactor <= 1.05) {
      reasons.push(reason('HF_CRITICAL','CRITICAL',`Health Factor is ${snapshot.healthFactor.toFixed(3)}.`));
    } else if (snapshot.healthFactor <= 1.20) {
      reasons.push(reason('HF_WARNING','WARNING',`Health Factor is ${snapshot.healthFactor.toFixed(3)}.`));
    } else if (snapshot.healthFactor <= 1.50) {
      reasons.push(reason('HF_WATCH','WATCH',`Health Factor is ${snapshot.healthFactor.toFixed(3)}.`));
    }
  }

  if (snapshot.ltvPct != null && snapshot.liquidationThresholdPct != null) {
    const bufferPct = snapshot.liquidationThresholdPct - snapshot.ltvPct;
    if (bufferPct <= 2) {
      reasons.push(reason('LIQUIDATION_BUFFER_CRITICAL','CRITICAL',`Liquidation buffer is only ${bufferPct.toFixed(2)} percentage points.`));
    } else if (bufferPct <= 5) {
      reasons.push(reason('LIQUIDATION_BUFFER_WARNING','WARNING',`Liquidation buffer is ${bufferPct.toFixed(2)} percentage points.`));
    } else if (bufferPct <= 10) {
      reasons.push(reason('LIQUIDATION_BUFFER_WATCH','WATCH',`Liquidation buffer is ${bufferPct.toFixed(2)} percentage points.`));
    }
  }

  const alertState = finalState(reasons, verificationRequired);
  const dataAgeSec = ageMs == null ? null : Math.round(ageMs / 1000);

  return {
    version: '0.1.0',
    evaluatedAt: new Date(nowMs).toISOString(),
    alertState,
    verificationRequired,
    positionId: snapshot.positionId,
    protocol: snapshot.protocol,
    chain: snapshot.chain,
    asset: snapshot.asset,
    healthFactor: snapshot.healthFactor,
    collateralValueUsd: snapshot.collateralValueUsd,
    debtValueUsd: snapshot.debtValueUsd,
    ltvPct: snapshot.ltvPct,
    liquidationThresholdPct: snapshot.liquidationThresholdPct,
    marketDecision: snapshot.marketDecision,
    securityState: snapshot.securityState,
    dataState: snapshot.dataState,
    dataAgeSec,
    reasons
  };
}

function finalState(reasons, verificationRequired) {
  if (reasons.some(x => x.severity === 'CRITICAL')) return 'CRITICAL';
  if (verificationRequired) return 'VERIFY';
  if (reasons.some(x => x.severity === 'WARNING')) return 'WARNING';
  if (reasons.some(x => x.severity === 'WATCH')) return 'WATCH';
  return 'OK';
}

export function normalizeSnapshot(raw = {}) {
  return {
    positionId: raw.positionId == null ? null : String(raw.positionId),
    protocol: raw.protocol == null ? null : String(raw.protocol),
    chain: raw.chain == null ? null : String(raw.chain),
    asset: raw.asset == null ? null : String(raw.asset).toUpperCase(),
    healthFactor: n(raw.healthFactor),
    collateralValueUsd: n(raw.collateralValueUsd),
    debtValueUsd: n(raw.debtValueUsd),
    ltvPct: n(raw.ltvPct),
    liquidationThresholdPct: n(raw.liquidationThresholdPct),
    marketDecision: upper(raw.marketDecision),
    securityState: upper(raw.securityState),
    dataState: upper(raw.dataState),
    updatedAt: raw.updatedAt == null ? null : String(raw.updatedAt)
  };
}
