# 모듈 배선 구조

앱의 import 그래프와 계층 규칙을 정리한 문서. 2026-08-07 배선 정리 시점 기준.

## 계층

```
App.js
  └ context/ (AuthProvider · UIProvider · ErrorProvider)
      └ navigation/ (AppNavigator → AuthNavigator | MainNavigator)
          └ screens/
              ├ components/   ← 배럴: components/index.js
              ├ hooks/        (useAuth · useVisits · useAI · useHistoryLogic · useVoteLogic · useNotifications · useTarotCardImage)
              └ services/
                  └ utils/storage/  ← 배럴: utils/storage/index.js
```

의존 방향은 위에서 아래로만 흐른다. `utils/`는 어떤 상위 계층도 import하지 않는다.

## 단일 진입점 (중복 정의 금지)

| 대상 | 정의 위치 | 비고 |
|---|---|---|
| AsyncStorage 키 | `utils/storage/core.js`의 `STORAGE_KEYS` | 키 문자열을 다른 파일에 하드코딩하지 않는다 |
| 고객 RPC 세션 토큰 | `services/customerSession.js` | `requireCustomerSessionToken()`만 export |
| Supabase 클라이언트 | `services/supabase.js` | `supabase` Proxy 경유. RPC 래퍼는 `services/supabaseClient.js` |
| 에러 문구 | `constants/ErrorMessages.js` | |
| 디자인 토큰 | `constants/DrawerTheme.js` (named export only) | |

## 배럴 파일

- `components/index.js` — 화면에서 쓰는 공용 컴포넌트만 재export
- `utils/storage/index.js` — `storage` 단일 객체 + `STORAGE_KEYS`

`utils/storage/drawerAIUsage.js`는 배럴을 거치지 않고 `hooks/useAI.js`가 직접 import한다 (AI 사용량 한도는 storage 전반과 성격이 달라 의도적으로 분리).

## 동적 import

`constants/TarotCardImages.js`는 22장 PNG를 `require()`로 묶고 있어 `hooks/useTarotCardImage.js`에서 `import()`로 지연 로드한다. **정적 분석에서는 고아로 보이지만 실제로는 살아있는 노드다.**

## 정리 내역 (2026-08-07)

죽은 배선 472줄 제거. 앱 동작 변경 없음 (테스트 77개 통과 + Metro 번들 빌드 확인).

**제거된 죽은 코드**
- `utils/storage/history.js` 파일 전체 — 방문/쿠폰 로컬 캐시. 호출처 0
- storage 메서드 26개 — 이미지 캐시 메타데이터 계열, `selectedCard` 계열, `cleanupOrphaned*` 5종, `coreStorage.clear/getAllKeys/getScopedKey/_cleanup`
- `STORAGE_KEYS` 9개 키 — `SELECTED_CARDS` `IMAGE_CACHE` `APP_SETTINGS` `VISIT_CACHE` `COUPON_CACHE` `LAST_SYNC` `SAVED_PHONE` `REMEMBER_ME` `COACH_MARKS`
- `aiService.sendChatMessage` + `TAROT_SYSTEM_PROMPT` — 인앱 AI 챗봇. O2O 매장 연계 앱 정책상 미사용 기능
- `aiService.summarizeReview` — `polishReviewText`/`condenseVoiceMemo`로 대체된 뒤 방치
- `dailyFortune.getRemainingDraws` — 항상 `Infinity` 반환

**통합된 중복**
- `'tarot_customer_session'` 하드코딩 5곳 → `STORAGE_KEYS.CUSTOMER_SESSION`
- `getCustomerSessionToken`/`requireCustomerSessionToken` 3중 복사 → `services/customerSession.js`
- `Config.js`의 `ERROR_MESSAGES`/`STORAGE_KEYS` → `ErrorMessages.js`/`storage/core.js`로 일원화

**축소된 노출**
- 소비자 없는 default export 제거: `aiService` `rewardedAdService` `DrawerTheme`
- 내부 전용 전환: `MIN_PASSWORD_LENGTH` `getDailyFortuneRewardedAdUnitId` `getCustomerSessionToken` `DRAWER_AI_USAGE_LIMITS` `getDrawerAIUsageMonthKey` `getDrawerAIFeatureLimit`
- 미사용 import 43건 (`React` 41건 포함 — Expo SDK 54는 automatic JSX runtime이라 불필요)

## 배선 점검 방법

새 고아 노드가 생겼는지 확인하려면 import 그래프를 다시 뜨면 된다. 확인 시 아래 3가지는 정적 분석의 구조적 오탐이므로 제외하고 봐야 한다.

1. 동적 `import()` — `TarotCardImages.js`
2. `require()` 호출 — `errorHandler.js`가 `ErrorMessages.js`의 `SUCCESS_MESSAGES`를 이렇게 읽는다
3. `test/helpers/moduleLoader.cjs`의 문자열 경로 주입 — `getSupabase` `validateCondensedVoiceMemo` `getUniformRandomIndex` `getDrawerAIUsage`는 테스트 전용 export다
