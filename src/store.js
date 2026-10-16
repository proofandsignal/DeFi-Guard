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


export async function listEnabledPositions(db, limit = 100) {
  requireDb(db);
  const safeLimit=Math.max(1,Math.min(500,Number(limit)||100));
  const out=await db.prepare(
    `SELECT id, watchlist_id, external_position_id, wallet_address, protocol, chain, asset,
            enabled, created_at, updated_at, last_checked_at, last_error
     FROM positions WHERE enabled = 1 ORDER BY COALESCE(last_checked_at, created_at) ASC LIMIT ?`
  ).bind(safeLimit).all();
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
    updatedAt:x.updated_at,
    lastCheckedAt:x.last_checked_at,
    lastError:x.last_error
  }));
}

export async function updatePositionCheck(db, positionId, { checkedAt, error = null }) {
  requireDb(db);
  await db.prepare(
    'UPDATE positions SET last_checked_at = ?, last_error = ?, updated_at = ? WHERE id = ?'
  ).bind(checkedAt,error,checkedAt,positionId).run();
}

export async function createDeliveryDestination(db, d) {
  requireDb(db);
  await db.prepare(
    `INSERT INTO delivery_destinations
      (id, watchlist_id, channel, target, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).bind(d.id,d.watchlistId,d.channel,d.target,d.now,d.now).run();
  return {
    id:d.id,
    watchlistId:d.watchlistId,
    channel:d.channel,
    target:d.target,
    enabled:true,
    createdAt:d.now,
    updatedAt:d.now
  };
}

export async function listDeliveryDestinations(db, watchlistId) {
  requireDb(db);
  const out=await db.prepare(
    `SELECT id, watchlist_id, channel, target, enabled, created_at, updated_at
     FROM delivery_destinations
     WHERE watchlist_id = ? AND enabled = 1
     ORDER BY created_at ASC`
  ).bind(watchlistId).all();
  return (out.results || []).map(x=>({
    id:x.id,
    watchlistId:x.watchlist_id,
    channel:x.channel,
    target:x.target,
    enabled:Boolean(x.enabled),
    createdAt:x.created_at,
    updatedAt:x.updated_at
  }));
}

export async function createMonitorRun(db, run) {
  requireDb(db);
  await db.prepare(
    `INSERT INTO monitor_runs
      (id, scheduled_at, started_at, completed_at, status, positions_total, positions_checked,
       events_created, deliveries_attempted, deliveries_succeeded, error_count, errors_json)
     VALUES (?, ?, ?, NULL, 'RUNNING', ?, 0, 0, 0, 0, 0, '[]')`
  ).bind(run.id,run.scheduledAt,run.startedAt,run.positionsTotal).run();
  return run;
}

export async function completeMonitorRun(db, run) {
  requireDb(db);
  await db.prepare(
    `UPDATE monitor_runs
     SET completed_at = ?, status = ?, positions_checked = ?, events_created = ?,
         deliveries_attempted = ?, deliveries_succeeded = ?, error_count = ?, errors_json = ?
     WHERE id = ?`
  ).bind(
    run.completedAt,run.status,run.positionsChecked,run.eventsCreated,
    run.deliveriesAttempted,run.deliveriesSucceeded,run.errorCount,
    JSON.stringify(run.errors || []),run.id
  ).run();
  return run;
}

export async function saveDeliveryAttempt(db, d) {
  requireDb(db);
  await db.prepare(
    `INSERT INTO deliveries
      (id, event_id, destination_id, channel, target, status, provider_message_id, error, attempted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    d.id,d.eventId,d.destinationId,d.channel,d.target,d.status,
    d.providerMessageId,d.error,d.attemptedAt
  ).run();
  return d;
}


export async function listDeliveriesForPosition(db, positionId, limit = 50) {
  requireDb(db);
  const safeLimit=Math.max(1,Math.min(200,Number(limit)||50));
  const out=await db.prepare(
    `SELECT d.id, d.event_id, d.destination_id, d.channel, d.target, d.status,
            d.provider_message_id, d.error, d.attempted_at,
            e.event_type, e.previous_state, e.current_state
     FROM deliveries d
     JOIN alert_events e ON e.id = d.event_id
     WHERE e.position_id = ?
     ORDER BY d.attempted_at DESC
     LIMIT ?`
  ).bind(positionId,safeLimit).all();

  return (out.results || []).map(x=>({
    id:x.id,
    eventId:x.event_id,
    destinationId:x.destination_id,
    channel:x.channel,
    target:x.target,
    status:x.status,
    providerMessageId:x.provider_message_id,
    error:x.error,
    attemptedAt:x.attempted_at,
    eventType:x.event_type,
    previousState:x.previous_state,
    currentState:x.current_state
  }));
}


export async function listRetryableDeliveries(db, { limit = 50, maxAttempts = 3 } = {}) {
  requireDb(db);
  const safeLimit=Math.max(1,Math.min(200,Number(limit)||50));
  const safeMaxAttempts=Math.max(1,Math.min(10,Number(maxAttempts)||3));

  const out=await db.prepare(
    `SELECT
       e.id AS event_id,
       e.position_id,
       e.snapshot_id,
       e.previous_state,
       e.current_state,
       e.event_type,
       e.severity_rank,
       e.reasons_json,
       e.created_at AS event_created_at,
       s.observed_at,
       s.alert_state,
       s.health_factor,
       s.evaluation_json,
       s.created_at AS snapshot_created_at,
       p.watchlist_id,
       p.external_position_id,
       p.wallet_address,
       p.protocol,
       p.chain,
       p.asset,
       dd.id AS destination_id,
       dd.channel,
       dd.target,
       COUNT(f.id) AS failed_attempts,
       MAX(f.attempted_at) AS last_attempted_at
     FROM deliveries f
     JOIN alert_events e ON e.id = f.event_id
     JOIN snapshots s ON s.id = e.snapshot_id
     JOIN positions p ON p.id = e.position_id
     JOIN delivery_destinations dd ON dd.id = f.destination_id AND dd.enabled = 1
     WHERE f.status = 'FAILED'
       AND NOT EXISTS (
         SELECT 1
         FROM deliveries sent
         WHERE sent.event_id = f.event_id
           AND sent.destination_id = f.destination_id
           AND sent.status = 'SENT'
       )
     GROUP BY
       e.id, e.position_id, e.snapshot_id, e.previous_state, e.current_state,
       e.event_type, e.severity_rank, e.reasons_json, e.created_at,
       s.observed_at, s.alert_state, s.health_factor, s.evaluation_json, s.created_at,
       p.watchlist_id, p.external_position_id, p.wallet_address, p.protocol, p.chain, p.asset,
       dd.id, dd.channel, dd.target
     HAVING COUNT(f.id) < ?
     ORDER BY last_attempted_at ASC
     LIMIT ?`
  ).bind(safeMaxAttempts,safeLimit).all();

  return (out.results || []).map(x=>({
    failedAttempts:Number(x.failed_attempts || 0),
    lastAttemptedAt:x.last_attempted_at,
    event:{
      id:x.event_id,
      positionId:x.position_id,
      snapshotId:x.snapshot_id,
      previousState:x.previous_state,
      currentState:x.current_state,
      eventType:x.event_type,
      severityRank:x.severity_rank,
      reasons:JSON.parse(x.reasons_json || '[]'),
      createdAt:x.event_created_at
    },
    change:{
      changed:true,
      previousState:x.previous_state,
      currentState:x.current_state,
      eventType:x.event_type,
      severityRank:x.severity_rank
    },
    snapshot:{
      id:x.snapshot_id,
      positionId:x.position_id,
      observedAt:x.observed_at,
      alertState:x.alert_state,
      healthFactor:x.health_factor,
      createdAt:x.snapshot_created_at
    },
    evaluation:JSON.parse(x.evaluation_json || '{}'),
    position:{
      id:x.position_id,
      watchlistId:x.watchlist_id,
      externalPositionId:x.external_position_id,
      walletAddress:x.wallet_address,
      protocol:x.protocol,
      chain:x.chain,
      asset:x.asset
    },
    destination:{
      id:x.destination_id,
      watchlistId:x.watchlist_id,
      channel:x.channel,
      target:x.target,
      enabled:true
    }
  }));
}


export async function createOnboardingBundle(db, bundle) {
  requireDb(db);
  const {watchlist,position,destination}=bundle;
  const statements=[
    db.prepare(
      'INSERT INTO watchlists (id, owner_key, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      watchlist.id,watchlist.ownerKey,watchlist.label,watchlist.createdAt,watchlist.updatedAt
    ),
    db.prepare(
      `INSERT INTO positions
        (id, watchlist_id, external_position_id, wallet_address, protocol, chain, asset, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(
      position.id,position.watchlistId,position.externalPositionId,position.walletAddress,
      position.protocol,position.chain,position.asset,position.createdAt,position.updatedAt
    ),
    db.prepare(
      `INSERT INTO delivery_destinations
        (id, watchlist_id, channel, target, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    ).bind(
      destination.id,destination.watchlistId,destination.channel,destination.target,
      destination.createdAt,destination.updatedAt
    )
  ];

  await db.batch(statements);
  return {watchlist,position,destination};
}
