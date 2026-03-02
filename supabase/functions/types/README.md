# Edge Function Type Compatibility

이 디렉터리는 Supabase Edge Function 타입체크에서 필요한 Deno 전역 타입 보강을 담습니다.

## 현재 결정: Edge 타입체크는 Deno로 일원화

- 앱 코드는 `tsc`(`typecheck:app`)로 검사합니다.
- Edge Function 코드는 `deno check`(`typecheck:edge`)로 검사합니다.
- 따라서 이전의 `tsconfig.edge.json` 기반 `tsc` 검사는 유지하지 않고, Deno 전용 검사로 이관했습니다.

## `deno.d.ts`와 URL import의 호환성

Edge Function(`supabase/functions/ai-proxy/index.ts`)은 다음처럼 URL import를 사용합니다.

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
```

Deno는 URL import 타입을 원격 모듈 메타데이터로 해석하고, 로컬의 `types/deno.d.ts`는 `Deno` 전역(namespace) 보강 역할만 담당합니다.

즉,

- URL import 타입: 원격 모듈에서 해결
- `Deno.env`, `Deno.serve` 타입: `types/deno.d.ts`에서 해결

이 설정은 `supabase/functions/deno.json`의 `compilerOptions.types`로 연결되어 `deno check` 시 함께 로드됩니다.
