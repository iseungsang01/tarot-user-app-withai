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
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROXY_REQUIRE_AUTH=true
```

`AI_PROXY_REQUIRE_AUTH=false` is only for controlled development/testing.

## Product/architecture notes

- Authentication intentionally uses the custom customer session model. Do not migrate this app to Supabase Auth without an explicit product decision.
- Detailed tarot note data remains local-first/local-only for now: card images, review text, note titles, and AI insights should not be uploaded to server visit rows. Server visit rows stay lightweight.
- Guest data is persistent and migrates into the member local namespace after signup/login. Legacy global local-storage keys are still readable for existing users.
- Coupon redemption intentionally prompts for an admin password and sends it to the existing RPC. Do not redesign this flow casually.
- Daily fortune draw limit is intentionally high for bug-fix/testing and should remain 30 until the product decision changes.

## Local card assets

`assets/card` is intentionally local and ignored by Git because it can contain large/static card image assets. Supply the card image files locally before running production Android builds. Do not remove static asset usage solely because the files are not tracked.

Before a local production Android build/upload, run:

```bash
npm run check:assets
```

If the project uses EAS cloud builds, `assets/card` must be supplied in the cloud build environment as well, for example through Git LFS, a private package, a prebuild download step, or another reproducible asset delivery process.

## Validation

```bash
npm test
npm run security-check
npm run check:assets # only when production card images are supplied locally
npm run typecheck:app
npm run typecheck:edge # requires Deno
```

Manual smoke checks: login, guest login, guest manual note, guest daily fortune, signup migration visibility, history multi-delete, image fallback save, coupon redemption unchanged, and native AI daily fortune.
