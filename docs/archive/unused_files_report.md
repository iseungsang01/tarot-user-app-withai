# Unused Files Static Audit

This report is based on static import/require/path reachability from Expo app entry files.

It is conservative: dynamic runtime references may not be detected.

## Entry files used

- `.gitignore`
- `App.js`
- `app.json`
- `assets/adaptive-icon.png`
- `assets/favicon.png`
- `assets/icon.png`
- `assets/splash.png`
- `eas.json`
- `metro.config.js`
- `package-lock.json`
- `package.json`
- `scripts/security-check.cjs`
- `supabase/functions/ai-proxy/index.ts`
- `tsconfig.app.json`
- `tsconfig.json`

## Probably unused app source files

- None detected.

## Probably unused asset files

- `assets/antique_1024x500.png` (1.1MB)
- `assets/antique_1488x702.png` (2.3MB)
- `assets/resized_icon_512.jpg` (53.9KB)

## Assets not imported but textually mentioned somewhere reachable

These are not safe-delete yet. Check them manually.

- None detected.

## Reinstallable/generated directories

- `.expo/`
- `node_modules/`

## Non-runtime files to review manually

- `.agents/skills/frontend-design/SKILL.md` (4.2KB)
- `.omx/context/ai-usage-monthly-db-limits-20260529T085358Z.md` (1.9KB)
- `.omx/context/dead-screens-20260529T140624Z.md` (712B)
- `.omx/context/drawer-archive-history-redesign-20260528T152416Z.md` (1.3KB)
- `.omx/context/news-ticket-ui-restructure-20260528T055825Z.md` (1.7KB)
- `.omx/context/non-db-code-review-fixes-20260528T055220Z.md` (786B)
- `.omx/context/stamp-card-assets-20260529T132728Z.md` (766B)
- `.omx/context/tarot-cellar-redesign-20260528T062041Z.md` (1.6KB)
- `.omx/plans/code-review-dead-screens.md` (767B)
- `.omx/plans/code-review-drawer-archive-history-redesign.md` (1.4KB)
- `.omx/plans/code-review-news-ticket-ui-restructure.md` (1.1KB)
- `.omx/plans/code-review-stamp-card-assets.md` (579B)
- `.omx/plans/code-review-tarot-cellar-redesign.md` (451B)
- `.omx/plans/prd-ai-usage-monthly-db-limits.md` (2.7KB)
- `.omx/plans/prd-dead-screens.md` (1.3KB)
- `.omx/plans/prd-drawer-archive-history-redesign.md` (1.4KB)
- `.omx/plans/prd-news-ticket-ui-restructure.md` (3.0KB)
- `.omx/plans/prd-stamp-card-assets.md` (1.3KB)
- `.omx/plans/prd-tarot-cellar-redesign.md` (1.1KB)
- `.omx/plans/test-spec-ai-usage-monthly-db-limits.md` (1.0KB)
- `.omx/plans/test-spec-dead-screens.md` (661B)
- `.omx/plans/test-spec-drawer-archive-history-redesign.md` (839B)
- `.omx/plans/test-spec-news-ticket-ui-restructure.md` (1.1KB)
- `.omx/plans/test-spec-stamp-card-assets.md` (905B)
- `.omx/plans/test-spec-tarot-cellar-redesign.md` (758B)
- `code_review.md` (12.1KB)
- `docs/RALPH_PLAYWRIGHT_DESIGN_LOOP.md` (5.3KB)
- `docs/SupabaseSQL.md` (3.9KB)
- `docs/customer-rpc-session-auth.md` (1.2KB)
- `docs/tarot-manager-supabase-schema.md` (1.8KB)

## Suggested deletion workflow

1. Review `Probably unused app source files` and `Probably unused asset files` first.
2. Move candidates to a temporary folder, do not permanently delete immediately.
3. Run `npm run typecheck`, `npm run test`, and `npm start`.
4. If the app opens and key screens render, commit the cleanup.
