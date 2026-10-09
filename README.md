# Tarot User App With AI

Expo React Native tarot/stamp user app. Android is the production target; iOS and web are preview targets only.

## Setup

```bash
npm install
npm start
```

Required app environment variables:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Copy `.env.example` to `.env` and fill these values for local development.

## Backend

This repo holds no database schema or Edge Functions. The single source of truth for the DB
(baseline migration, PGlite contract tests) and all Edge Functions (`ai-proxy`, `admob-ssv`,
`redeem-coupon`, `admin-login`) is the manager app repo: `tarot-manager-app/supabase/`. The app's
RPC contract and error codes are defined in `tarot-manager-app/docs/db-redesign.md` (§2-1, §4).

Errors: RPC failures arrive as `error.code` (SQLSTATE) + `error.message` (reason code); Edge Function
failures as `{ code }`, lifted into `error.reason` by `readFunctionError`. `INVALID_SESSION` logs out
globally, `PASSWORD_CHANGE_REQUIRED` routes to the forced password change screen.

Daily fortune redraws need a server-verified rewarded ad (AdMob SSV → `admob-ssv`). Google's test ad
units do not call the SSV URL, so redraws cannot be completed in dev builds.

## Product/architecture notes

- Authentication intentionally uses the custom customer session model. Do not migrate this app to Supabase Auth without an explicit product decision.
- Detailed tarot note data remains local-first/local-only for now: card images, review text, note titles, and AI insights should not be uploaded to server visit rows. Server visit rows stay lightweight.
- Guest data is persistent and migrates into the member local namespace after signup/login. Legacy global local-storage keys are still readable for existing users.
- Coupon redemption intentionally prompts for an admin password and sends it to the `redeem-coupon` Edge Function. Do not redesign this flow casually.
- Daily fortune has no per-day draw cap. The first draw of the day is free; every redraw requires a completed rewarded ad (`needsRewardedAdForDailyFortune`). The `30` cap applies to the three drawer AI features (`voiceCondense`, `polishReview`, `historySummary`) and is monthly, not daily.

## Local card assets

`assets/card` is intentionally local and ignored by Git because it can contain large/static card image assets. Supply the card image files locally before running production Android builds. Do not remove static asset usage solely because the files are not tracked.

## Validation

```bash
npm test
npm run security-check
npm run typecheck:app
```

Manual smoke checks: login, guest login, guest manual note, guest daily fortune, signup migration visibility, history multi-delete, image fallback save, coupon redemption unchanged, and native AI daily fortune.
