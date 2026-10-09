# DeFi Guard

Read-only DeFi position monitoring and risk alerts.

## Project boundary

DeFi Guard monitors normalized DeFi position/risk snapshots and emits explainable alert events.

It does **not**:
- custody assets;
- request or store private keys;
- sign or execute transactions;
- move user funds;
- provide discretionary portfolio management.

## Build path

`BUILD-001 — Guard Core v0.1`

`Position Snapshot → Rule Engine → Alert Severity → Evidence → Alert Event`

Initial target states:
- `OK`
- `WATCH`
- `WARNING`
- `CRITICAL`
- `VERIFY`

Development happens on dedicated branches and pull requests.

## License

Proprietary / All Rights Reserved.
