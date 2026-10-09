# DeFi Guard — Alert Model v0.1

DeFi Guard is a read-only monitoring layer.

## Input

The v0.1 engine evaluates a normalized position snapshot:

- position identity: protocol, chain, asset;
- Health Factor;
- collateral and debt values;
- LTV and liquidation threshold;
- upstream market decision;
- upstream security state;
- upstream data-quality state;
- snapshot timestamp.

The engine does not require a private key and does not execute transactions.

## Alert states

### OK
No v0.1 guard rule is triggered and the required evidence is sufficient.

### WATCH
A non-urgent risk condition should be monitored.

Examples:
- Health Factor <= 1.50;
- upstream market/security state is REVIEW;
- liquidation buffer <= 10 percentage points.

### WARNING
A material risk condition is present.

Examples:
- Health Factor <= 1.20;
- liquidation buffer <= 5 percentage points.

### CRITICAL
An explicit high-risk condition is present.

Examples:
- Health Factor <= 1.05;
- upstream market/security state is BLOCK;
- liquidation buffer <= 2 percentage points.

### VERIFY
Required evidence is missing, stale or incomplete.

Examples:
- data state is PARTIAL/UNKNOWN/STALE/INVALID;
- debt exists but Health Factor is missing;
- upstream decision/security state is VERIFY;
- snapshot timestamp is missing or older than 10 minutes.

## Precedence

An explicit CRITICAL condition outranks VERIFY, but `verificationRequired=true` is preserved.

Otherwise:

`VERIFY → WARNING → WATCH → OK`

This prevents missing evidence from silently becoming a green result.

## v0.1 boundary

This model is deterministic and intentionally small. It is not a probability of liquidation and it is not a recommendation to transact.

Later builds may add:
- protocol adapters;
- wallet discovery;
- persistent watchlists;
- scheduled polling;
- alert delivery;
- event history;
- risk-change detection;
- user-defined thresholds.
