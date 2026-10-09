# DeFi Guard — Persistence v0.2

BUILD-002 adds durable state for watchlists, monitored positions, snapshots and alert events.

## Data model

```text
watchlists
   ↓
positions
   ↓
snapshots
   ↓
alert_events
```

### watchlists
Logical collection owned by an opaque `X-Guard-Owner-Key`.

### positions
The monitored DeFi target: protocol, chain, asset, optional wallet address and external position id.

### snapshots
Immutable observed position state plus the full Guard evaluation.

### alert_events
Created only when the alert state changes into or between non-identical states.

## Change detection

Examples:

- `OK → WATCH` = `RISK_ESCALATED`
- `WATCH → WARNING` = `RISK_ESCALATED`
- `CRITICAL → WATCH` = `RISK_IMPROVED`
- `VERIFY → VERIFY` = no new event
- initial `WARNING` = `INITIAL_ALERT`
- initial `OK` = no alert event

The full snapshot is still persisted even when no event is emitted.

## API

All persistence endpoints require:

`X-Guard-Owner-Key: <opaque-owner-key>`

This is only a temporary tenant-boundary mechanism for the beta architecture. It is **not production authentication**.

### Create watchlist
`POST /api/v1/watchlists`

### List watchlists
`GET /api/v1/watchlists`

### Add position
`POST /api/v1/watchlists/:watchlistId/positions`

### List positions
`GET /api/v1/watchlists/:watchlistId/positions`

### Save/evaluate snapshot
`POST /api/v1/positions/:positionId/snapshots`

This endpoint:
1. evaluates the normalized snapshot;
2. loads the previous snapshot;
3. detects alert-state change;
4. persists the new snapshot;
5. creates an alert event when appropriate.

### List alert events
`GET /api/v1/positions/:positionId/events`

## D1

Schema: `migrations/0001_watchlists.sql`.

Persistence endpoints require a Cloudflare D1 binding named `DB`.

Until a real D1 database is created and bound, the persistence endpoints return:

`503 d1_not_configured`

This is intentional. The repository does not contain a fake database id.

## BUILD-003 handoff

BUILD-003 Scheduled Monitoring can now operate as:

`enabled positions → fetch fresh state → POST/execute snapshot path → change detection → delivery queue`.
