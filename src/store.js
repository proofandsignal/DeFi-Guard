function requireDb(db) {
  if (!db) throw new Error('d1_not_configured');
}

function row(result) {
  return result?.results?.[0] || null;
}

export async function createWatchlist(db, { id, ownerKey, label, now }) {
  requireDb(db);
  await db.prepare(
    'INSERT INTO watchlists (id, owner_key, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, ownerKey, label, now, now).run();
  return { id, ownerKey, label, createdAt:now, updatedAt:now };
}

export async function listWatchlists(db, ownerKey) {
  requireDb(db);
  const out=await db.prepare(
    'SELECT id, owner_key, label, created_at, updated_at FROM watchlists WHERE owner_key = ? ORDER BY created_at DESC'
  ).bind(ownerKey).all();
  return (out.results || []).map(x=>({
    id:x.id,
    ownerKey:x.owner_key,
    label:x.label,
    createdAt:x.created_at,
    updatedAt:x.updated_at
  }));
}

export async function getWatchlist(db, id) {
  requireDb(db);
  const out=await db.prepare(
    'SELECT id, owner_key, label, created_at, updated_at FROM watchlists WHERE id = ? LIMIT 1'
  ).bind(id).all();
  const x=row(out);
  return x ? {
    id:x.id,
    ownerKey:x.owner_key,
    label:x.label,
    createdAt:x.created_at,
    updatedAt:x.updated_at
  } : null;
}

export async function addPosition(db, p) {
  requireDb(db);
  await db.prepare(
    `INSERT INTO positions
      (id, watchlist_id, external_position_id, wallet_address, protocol, chain, asset, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(
    p.id,p.watchlistId,p.externalPositionId,p.walletAddress,
    p.protocol,p.chain,p.asset,p.now,p.now
  ).run();

  return {
    id:p.id,
    watchlistId:p.watchlistId,
    externalPositionId:p.externalPositionId,
    walletAddress:p.walletAddress,
    protocol:p.protocol,
    chain:p.chain,
    asset:p.asset,
    enabled:true,
    createdAt:p.now,
    updatedAt:p.now
  };
}

export async function getPosition(db, id) {
  requireDb(db);
  const out=await db.prepare(
    `SELECT id, watchlist_id, external_position_id, wallet_address, protocol, chain, asset, enabled, created_at, updated_at
     FROM positions WHERE id = ? LIMIT 1`
  ).bind(id).all();
  const x=row(out);
  return x ? {
    id:x.id,
    watchlistId:x.watchlist_id,
    externalPositionId:x.external_position_id,
    walletAddress:x.wallet_address,
    protocol:x.protocol,
    chain:x.chain,
    asset:x.asset,
    enabled:Boolean(x.enabled),
    createdAt:x.created_at,
    updatedAt:x.updated_at
  } : null;
}

export async function listPositions(db, watchlistId) {
  requireDb(db);
  const out=await db.prepare(
    `SELECT id, watchlist_id, external_position_id, wallet_address, protocol, chain, asset, enabled, created_at, updated_at
     FROM positions WHERE watchlist_id = ? ORDER BY created_at DESC`
  ).bind(watchlistId).all();
  return (out.results || []).map(x=>({
    id:x.id,
    watchlistId:x.watchlist_id,
    externalPositionId:x.external_position_id,
    walletAddress:x.wallet_address,
    protocol:x.protocol,
    chain:x.chain,
    asset:x.asset,
    enabled:Boolean(x.enabled),
    createdAt:x.created_at,
    updatedAt:x.updated_at
  }));
}

export async function latestSnapshot(db, positionId) {
  requireDb(db);
  const out=await db.prepare(
    `SELECT id, position_id, observed_at, alert_state, verification_required, health_factor,
            market_decision, security_state, payload_json, evaluation_json, created_at
     FROM snapshots WHERE position_id = ? ORDER BY observed_at DESC LIMIT 1`
  ).bind(positionId).all();
  const x=row(out);
  return x ? {
    id:x.id,
    positionId:x.position_id,
    observedAt:x.observed_at,
    alertState:x.alert_state,
    verificationRequired:Boolean(x.verification_required),
    healthFactor:x.health_factor,
    marketDecision:x.market_decision,
    securityState:x.security_state,
    payload:JSON.parse(x.payload_json),
    evaluation:JSON.parse(x.evaluation_json),
    createdAt:x.created_at
  } : null;
}

export async function saveSnapshot(db, s) {
  requireDb(db);
  await db.prepare(
    `INSERT INTO snapshots
      (id, position_id, observed_at, alert_state, verification_required, health_factor,
       market_decision, security_state, payload_json, evaluation_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    s.id,s.positionId,s.observedAt,s.evaluation.alertState,
    s.evaluation.verificationRequired ? 1 : 0,
    s.evaluation.healthFactor,s.evaluation.marketDecision,s.evaluation.securityState,
    JSON.stringify(s.payload),JSON.stringify(s.evaluation),s.createdAt
  ).run();

  return {
    id:s.id,
    positionId:s.positionId,
    observedAt:s.observedAt,
    alertState:s.evaluation.alertState,
    evaluation:s.evaluation
  };
}

export async function saveAlertEvent(db, e) {
  requireDb(db);
  await db.prepare(
    `INSERT INTO alert_events
      (id, position_id, snapshot_id, previous_state, current_state, event_type, severity_rank, reasons_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    e.id,e.positionId,e.snapshotId,e.previousState,e.currentState,
    e.eventType,e.severityRank,JSON.stringify(e.reasons || []),e.createdAt
  ).run();

  return e;
}

export async function listAlertEvents(db, positionId, limit = 50) {
  requireDb(db);
  const safeLimit=Math.max(1,Math.min(200,Number(limit)||50));
  const out=await db.prepare(
    `SELECT id, position_id, snapshot_id, previous_state, current_state, event_type, severity_rank, reasons_json, created_at
     FROM alert_events WHERE position_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(positionId,safeLimit).all();
  return (out.results || []).map(x=>({
    id:x.id,
    positionId:x.position_id,
    snapshotId:x.snapshot_id,
    previousState:x.previous_state,
    currentState:x.current_state,
    eventType:x.event_type,
    severityRank:x.severity_rank,
    reasons:JSON.parse(x.reasons_json),
    createdAt:x.created_at
  }));
}
