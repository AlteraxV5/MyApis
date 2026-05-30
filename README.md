# Changelog

## [3.0.0] - 2026-05-30

### Breaking Changes

- **removed** `src/gistHelper.js` — all persistence migrated to Supabase
- **removed** `src/apiKeys.json` — no longer needed

### Fixed

- **fix** API keys vanishing on restart — Gist reads would fail silently after Vercel cold starts, returning empty `keys: []`. Supabase always available.
- **fix** Validation always returning 403 — middleware was comparing raw key against stored SHA-256 hash. Now hashes incoming key before lookup.
- **fix** Key list returning hash instead of key — `GET /admin/list-apikey` was returning `key_hash` field. Now returns `key_name` (actual key).
- **fix** Unlimited keys getting limit 1000 — `rate_limit` was never passed to `createApiKey()`. Unlimited now correctly stores `-1`.
- **fix** Delete silently failing — was deleting by raw key against `key_hash` column. Now hashes first, then deletes.

### Changed

- **refactor** Centralized database helpers — duplicate `getGistData()` and `updateGistData()` across 3 files collapsed into `src/supabaseHelper.js`
- **refactor** Consistent function naming — `updateGistLimit()` renamed to `updateGistData()` then removed entirely in favor of Supabase

### Migration

Set the following environment variables in Vercel before deploying:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon_key>
```

Remove `GITHUB_TOKEN` and `GIST_ID` from Vercel env vars after deploy.

---

## [2.0.0] - 2026-05-29

### Breaking Changes

- **removed** duplicate `getGistData()` and `updateGistLimit()` functions from `admin/generate-apikey.js` and `router/admin/keys.js`

### Fixed

- **fix** `require('crypto')` declared twice in `admin/generate-apikey.js`

### Changed

- **refactor** Centralized Gist helpers into `src/gistHelper.js`
- **refactor** Renamed `updateGistLimit()` to `updateGistData()` for consistency
- **refactor** `script.js` imports updated to use `src/gistHelper.js`

### Removed

- **removed** `src/apiKeys.json` — unused, data was already in GitHub Gist

---

## [1.0.0] - 2026-02-01

- Initial release
