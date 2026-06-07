# Shared Supabase schema safety

The manager app and user app share the same Supabase database.

Do **not** apply manager-only destructive cleanup to a shared production DB unless user-app usage has been explicitly retired. In particular, user-app RPCs for custom sessions, guest AI sessions, visits, coupons, votes, bug reports, password/account operations, and AI monthly usage must remain installed.

## Responsibility split

- Shared/base tables: `customers`, `visit_history`, `coupon_history`, `notices`, `bug_reports`, `votes`, `vote_responses`.
- Manager/admin: `public.is_admin()`, manager-created customer registration behavior, admin RLS policies.
- User app: custom customer session RPCs, guest AI session RPCs, visit/coupon/vote/bug-report RPCs, session-token password/delete RPCs, and `increment_my_ai_monthly_usage(text, text)`.

## Sensitive RPC policy

Legacy uuid-only account RPCs must not be callable by arbitrary `anon`/`authenticated` clients. The user app should use session-token based RPCs instead:

- `verify_my_password(text, text)`
- `update_my_password(text, text, text, text)`
- `delete_my_account(text, text)`

The migration `20260607024000_add_server_ai_monthly_usage.sql` adds AI quota enforcement and revokes direct execute grants on the uuid-only sensitive account RPCs.
