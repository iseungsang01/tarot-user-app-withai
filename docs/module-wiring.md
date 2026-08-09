# 모듈 배선 구조

앱의 import 그래프와 계층 규칙을 정리한 문서. 2026-08-07 배선 정리 시점 기준.

## 계층

```
App.js
  └ context/AuthContext (AuthProvider — 유일한 Provider)
      └ navigation/ (AppNavigator → AuthNavigator | MainNavigator)
          └ screens/
              ├ components/   ← 배럴: components/index.js
              ├ hooks/        (useAuth · useVisits · useAI · useHistoryLogic · useVoteLogic · useNotifications · useTarotCardImage)
              └ services/
                  └ utils/storage/  ← 배럴: utils/storage/index.js
```

의존 방향은 위에서 아래로만 흐른다. `utils/`는 어떤 상위 계층도 import하지 않는다.

**전역 에러 표시**는 Context를 거치지 않는다. 서비스/유틸이 `utils/errorEmitter`로 발행하고
`components/common/GlobalErrorDisplay`가 직접 구독한다 (구독자가 그 컴포넌트 하나뿐이라 Provider가 불필요).

## 단일 진입점 (중복 정의 금지)

| 대상 | 정의 위치 | 비고 |
|---|---|---|
| AsyncStorage 키 | `utils/storage/core.js`의 `STORAGE_KEYS` | 키 문자열을 다른 파일에 하드코딩하지 않는다 |
| AsyncStorage 접근 | `utils/storage/core.js`의 `coreStorage` | 앱 코드에서 `AsyncStorage`를 직접 import하지 않는다 |
| 고객 RPC 세션 토큰 | `services/customerSession.js` | `requireCustomerSessionToken()`만 export |
| Supabase 클라이언트 | `services/supabase.js` | `supabase` Proxy 경유. RPC 래퍼는 `services/supabaseClient.js` |
| 월 한도가 걸린 AI 액션 | `hooks/useAI.js`의 `createDrawerAIAction` | 상태·취소·사용량 회계를 한 곳에서 관리 |
| 날짜 표기 | `utils/formatters.js` | `formatDateShort`(12월25일) · `formatDateDot`(24.12.25) |
| 에러 문구 | `constants/ErrorMessages.js` | |
| 디자인 토큰 | `constants/DrawerTheme.js` (named export only) | |

## 스토리지 스코프

로컬 데이터는 `tarot_local:<scope>:<key>` 형태로 계정별 격리된다 (`scope`는 `guest` 또는 `member:<id>`).
스코프는 `CUSTOMER_SESSION`·`CUSTOMER` 두 키로 결정되므로 `coreStorage`가 이를 캐시하고,
그 두 키가 `save`/`remove`될 때만 캐시를 버린다. **세션을 `AsyncStorage`로 직접 쓰면 캐시가 어긋난다** —
세션 쓰기는 반드시 `storage.save`/`storage.remove`를 거칠 것.

## 배럴 파일

- `components/index.js` — 화면에서 쓰는 공용 컴포넌트만 재export
- `utils/storage/index.js` — `storage` 단일 객체 + `STORAGE_KEYS`

`utils/storage/drawerAIUsage.js`는 배럴을 거치지 않고 `hooks/useAI.js`가 직접 import한다 (AI 사용량 한도는 storage 전반과 성격이 달라 의도적으로 분리).

## 동적 import

`constants/TarotCardImages.js`는 카드 아트를 `require()`로 묶고 있어 `hooks/useTarotCardImage.js`에서 `import()`로 지연 로드한다. **정적 분석에서는 고아로 보이지만 실제로는 살아있는 노드다.**

## 이미지 에셋

카드 아트는 `full`·`thumb` 두 벌이고, `useTarotCardImage(cardId, variant)`가 유일한 진입점이다.

| 변형 | 파일 | 해상도 | 쓰는 곳 |
|---|---|---|---|
| `full` (기본) | `assets/card/*.webp` | 800×1200 | 확대 모달(260×390dp)·데일리 결과 카드 |
| `thumb` | `assets/card-thumb/*.webp` | 240×360 | 티켓 화면 스탬프 슬롯(약 66×97dp) |

두 벌로 나눈 이유는 파일 크기가 아니라 **런타임 메모리**다. 디코딩된 비트맵은 포맷과 무관하게
`가로 × 세로 × 4바이트`를 차지한다. 스탬프 그리드는 카드 10장을 한 화면에 동시에 띄우므로
`full`을 쓰면 화면 하나가 63MB를 잡는다. 작게 그리는 자리를 새로 만들 때는 `thumb`을 쓸 것.

원본(`assets/card-original/`)과 파생물(`assets/card/`·`assets/card-thumb/`)은 모두 `.gitignore`
대상이라 저장소에 없다. 카드 아트를 교체하려면 `assets/card-original/`에 PNG를 넣고
`python scripts/optimize-card-assets.py`를 돌린다.

새 이미지 에셋을 추가할 때는 **표시 크기의 3배(dp→px)를 넘지 않게** 맞추고 WebP로 넣는다.
앱 아이콘·스플래시(`assets/icon.png` 등)만 예외로 PNG다 — Expo 빌드 파이프라인이 PNG를 요구한다.

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

## 단순화 내역 (2026-08-07, 정리 후속)

살아있는 코드에서 중복·죽은 분기·낭비 I/O를 걷어냈다. 동작 변경 없음.

**중복 제거**
- `useAI.js`의 세 훅(전체 요약·메모 축약·문장 다듬기)이 ~90% 복붙이던 것을 `createDrawerAIAction` 팩토리로 통합 (278줄 → 165줄). 취소 처리 같은 수정이 이제 한 곳에서 끝난다
- `NoticeCard`/`VoteCard`에 각각 복사돼 있던 `formatShortDate` → `formatters.formatDateDot`
- `supabase.js`가 `AsyncStorage`로 직접 읽던 세션 → `coreStorage.get`. 세션 읽기 경로가 3개에서 1개로
- `cards.js`의 3개 CRUD 그룹 → `cardField` 팩토리

**죽은 코드**
- `dailyFortune.canDrawDailyFortune` — 항상 `true`를 반환해 호출부의 분기·`disabled` prop이 전부 죽어 있었다 (3개 파일)
- `customerService`의 미사용 `requireSession`, `visitService`의 순수 forwarding 래퍼 `getSessionState`
- `useVisits`의 게스트 분기에서 결과를 버리는 storage 읽기 2건

**낭비 I/O**
- `coreStorage`가 매 `get`/`save`/`remove`마다 스코프를 재조회하던 것을 캐시 (스토리지 접근이 호출당 2~3회 → 1회)
- `getVoteResults`/`getVoteParticipants`가 같은 `get_vote_summary` RPC를 각각 호출하던 것을 `getVoteSummary` 하나로 (투표 조회 네트워크 왕복 절반)
- `incrementDrawerAIUsage`가 이미 돌려주는 잔여 횟수를 버리고 다시 읽던 것 제거
- `hasUnreadNotices`가 `syncReadNotices` 직후 같은 키를 다시 읽던 것 제거
- `visitService`의 `getVisit`·`deleteVisit`에서 독립적인 storage 호출 4건씩을 `Promise.all`로

## 단순화 내역 (2026-08-08)

**껍데기만 남은 계층 제거**
- `context/UIContext.js` 삭제 — 코치마크 기능이 걷힌 뒤 `startCoachMarks`/`completeCoachMarks`/`triggerCoachMarks`가 전부 빈 함수였고, 노출하던 `showCoachMarks`·`coachMarksSessionId`·`uiLoading`도 전부 고정 상수였다. 유일한 소비처인 `AppNavigator`의 로딩 분기에서 `uiLoading`은 항상 `false`
- `context/ErrorContext.js` 삭제 — `errorEmitter`를 구독해 `GlobalErrorDisplay` 하나에만 넘기는 1:1 중간층이었다. 컴포넌트가 직접 구독하도록 바꿔 Provider 두 개가 App.js에서 사라졌다

**중복 제거**
- `errorHandler.handleApiCall`의 try 블록과 catch 블록이 같은 5단계 보고 절차(로깅 여부 판단 → 파싱 → 로깅 → emit → onError)를 복붙하던 것을 `report()` 하나로
- `TicketScreen`이 스탬프용 카드 10장을 별도 배열로 하드코딩하던 것을 `MAJOR_ARCANA.slice(0, MAX_STAMPS)`로. 이 과정에서 `m07` 이름이 두 곳에서 달랐던 것(`Chariot` vs `The Chariot`)이 드러나 표준 명칭 `The Chariot`으로 통일
- `showSuccessAlert` 안의 지연 `require('../constants/ErrorMessages')`를 파일 상단 import로 (같은 모듈을 위에서 이미 import 중이었다)

## 에셋·메모리 정리 (2026-08-09)

앱 무게가 코드가 아니라 이미지에 몰려 있어 에셋을 걷어냈다. 에셋 69MB → 8.1MB.

**카드 아트 (62MB → 7.5MB)**
- 1024×1536 PNG 22장(장당 약 3MB)을 800×1200 WebP(장당 약 340KB)로. 확대 모달 260×390dp 기준 @3.0x라 선명도는 그대로다
- 스탬프 슬롯용 240×360 썸네일을 따로 만들어 `useTarotCardImage`에 `variant` 인자를 추가. **티켓 화면 비트맵 63MB → 3.5MB**
- 스탬프 확대본은 슬롯이 아니라 모달이 직접 받는다. 눌러서 열기 전에는 `full`을 아예 로드하지 않는다

**배경 텍스처 (3.3MB → 74KB)**
- `bg-cellar` — 해상도 유지, WebP로만 (1.2MB → 14KB). opacity 0.16으로 그라디언트 4겹 밑에 깔리는 배경이다
- `drawer-walnut` — 1774×887 → 1024×512 WebP (2.1MB → 60KB). 서랍 한 칸이 약 340dp 폭이라 원본이 과했다. 비트맵 6.3MB → 2.1MB

**중복 디코딩 제거**
- `imageOptimizer.compressImage`가 원본 치수를 알아내려고 `manipulateAsync(uri, [])`를 부르고 있었다. 이건 이미지를 통째로 디코딩해 임시 파일로 저장한 뒤 버리는 동작이라 12MP 사진이면 48MB 비트맵이 한 번 더 펼쳐진다. 헤더만 읽는 `Image.getSize`로 교체
- 아무도 쓰지 않는 반환 필드(`width` `height` `size` `originalSize` `compressionRatio`)를 걷어내면서 그 값을 만들려고 돌던 `FileSystem.getInfoAsync` 2회와 디버그 로그 7줄도 함께 사라졌다. 반환값은 `{ uri, base64 }`뿐

**손대지 않은 것**
- 앱 아이콘·스플래시 3.1MB — PNG 무손실 재압축만 했다(3.4MB → 3.1MB). 256색 팔레트로 줄이면 1.4MB까지 내려가지만 고유색이 5만~10만이라 밴딩이 생긴다. 브랜드 첫인상이라 화질을 택했다

## 배선 점검 방법

새 고아 노드가 생겼는지 확인하려면 import 그래프를 다시 뜨면 된다. 확인 시 아래 2가지는 정적 분석의 구조적 오탐이므로 제외하고 봐야 한다.

1. 동적 `import()` — `TarotCardImages.js`
2. `test/helpers/moduleLoader.cjs`의 문자열 경로 주입 — `getSupabase` `validateCondensedVoiceMemo` `getUniformRandomIndex` `getDrawerAIUsage`는 테스트 전용 export다

**import 그래프만으로는 안 잡히는 죽은 코드**가 따로 있다. UIContext처럼 배선은 살아 있는데 값이
죽은 경우다. 주기적으로 아래를 함께 훑을 것.

- 빈 함수: `grep -rn "=> {}" src`
- 상수만 반환하는 함수 — 호출부의 분기가 통째로 죽어 있을 수 있다 (`canDrawDailyFortune`, `getRemainingDraws`가 이 경우였다)
- Context value에 담긴 리터럴 상수 (`uiLoading: false`)
