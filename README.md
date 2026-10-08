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

## Supabase Edge Function secrets

The `supabase/functions/ai-proxy` Edge Function expects these secrets in the Supabase environment:

```text
GOOGLE_API_KEY=
GOOGLE_MODEL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The function always requires a customer or guest session token. Prompts are built server-side in
`supabase/functions/ai-proxy/tasks.ts`; the app sends only `{ task, input }`. Usage limits are
counted in the database by `consume_ai_proxy_quota` (see
`supabase/migrations/20261008120000_ai_proxy_server_side_quota.sql`), so that migration must be
applied before deploying the function.

### Daily fortune redraws (AdMob server-side verification)

The first daily fortune draw per day (KST) is free; every redraw needs a rewarded ad that the
server has verified. The app gets a one-time nonce from `ai-proxy`, passes it to AdMob as SSV
`customData`, and AdMob calls `supabase/functions/admob-ssv` with a signed callback that records
the reward. Setup:

1. Apply `supabase/migrations/20261008180000_daily_fortune_ad_reward_ssv.sql`.
2. `supabase functions deploy admob-ssv` (JWT verification is off in `config.toml`; the handler
   verifies Google's ECDSA signature).
3. In the AdMob console, open the rewarded ad unit → **Server-side verification** → set the
   callback URL to `https://<project-ref>.supabase.co/functions/v1/admob-ssv`.
4. Optional secret `ADMOB_REWARDED_AD_UNITS`: comma-separated numeric ad unit ids (the part after
   `/`) that the callback accepts.

Google's test ad units do not call the SSV URL, so redraws cannot be completed in dev builds.

## Product/architecture notes

- Authentication intentionally uses the custom customer session model. Do not migrate this app to Supabase Auth without an explicit product decision.
- Detailed tarot note data remains local-first/local-only for now: card images, review text, note titles, and AI insights should not be uploaded to server visit rows. Server visit rows stay lightweight.
- Guest data is persistent and migrates into the member local namespace after signup/login. Legacy global local-storage keys are still readable for existing users.
- Coupon redemption intentionally prompts for an admin password and sends it to the existing RPC. Do not redesign this flow casually.
- Daily fortune has no per-day draw cap. The first draw of the day is free; every redraw requires a completed rewarded ad (`needsRewardedAdForDailyFortune`). The `30` cap applies to the three drawer AI features (`voiceCondense`, `polishReview`, `historySummary`) and is monthly, not daily.

## Local card assets

`assets/card` is intentionally local and ignored by Git because it can contain large/static card image assets. Supply the card image files locally before running production Android builds. Do not remove static asset usage solely because the files are not tracked.

## Validation

```bash
npm test
npm run security-check
npm run typecheck:app
npm run typecheck:edge # requires Deno
```

Manual smoke checks: login, guest login, guest manual note, guest daily fortune, signup migration visibility, history multi-delete, image fallback save, coupon redemption unchanged, and native AI daily fortune.
