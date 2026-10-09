# D1 Deployment Gate

Do not mark BUILD-002 deployed until a real Cloudflare D1 database is created.

## Required operator steps

1. Create a D1 database for DeFi Guard.
2. Add a `[[d1_databases]]` binding named `DB` in `wrangler.toml` using the real database id.
3. Apply `migrations/0001_watchlists.sql`.
4. Deploy the Worker.
5. Confirm `GET /api/health` returns `persistence: true`.
6. Create a test watchlist and position.
7. Submit two snapshots with different risk states.
8. Confirm an alert event is persisted.

Never commit Cloudflare account secrets or API tokens to the repository.
