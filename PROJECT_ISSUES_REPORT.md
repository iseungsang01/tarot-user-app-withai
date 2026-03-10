# 프로젝트에서 우선 수정할 만한 부분

점검 일시: 2026-03-10 UTC

## 1) 우선순위 높음

### 1-1. `typecheck`가 환경 의존으로 깨짐 (`deno` 미설치)
- 현재 `npm run typecheck`는 `typecheck:edge` 단계에서 `deno check`를 호출합니다.
- 로컬/CI에 `deno`가 없으면 타입체크가 즉시 실패해, PR 품질 게이트로 쓰기 어렵습니다.
- 재현: `npm run typecheck` → `sh: 1: deno: not found`
- 관련 파일: `package.json`
- 권장 수정:
  - CI에 `deno` 설치 단계를 명시하거나,
  - `pretypecheck`에서 `deno` 존재 여부를 검사해 안내 메시지를 명확히 출력,
  - 앱 타입체크(`typecheck:app`)와 엣지 타입체크(`typecheck:edge`)를 파이프라인에서 분리.

### 1-2. 에러 전파 경로가 이원화/불일치
- 실제 앱은 `src/context/ErrorContext.js`를 사용하고, 이 구현은 `global.showGlobalError`에 의존합니다.
- 반면 `src/utils/ErrorContext.js`는 `errorEmitter` 기반으로 작성되어 있으나 현재 사용되지 않습니다.
- 즉, 에러 처리 아키텍처가 두 버전으로 공존해 유지보수 시 혼선이 발생합니다.
- 관련 파일: `App.js`, `src/context/ErrorContext.js`, `src/utils/ErrorContext.js`, `src/utils/errorHandler.js`
- 권장 수정:
  - 하나의 방식으로 통일(권장: `errorEmitter` 기반),
  - 미사용 `ErrorContext` 파일 제거 또는 통합,
  - `global.*` 의존 제거.

## 2) 우선순위 중간

### 2-1. 런타임 `console.log`가 과다하여 운영 로그 노이즈 발생
- 사용자 동작/파일 I/O 경로에 디버깅 로그가 많이 남아 있습니다.
- 특히 이미지 저장/삭제, 에러 표시, 모달 액션 등 빈도 높은 경로에서 노이즈가 큽니다.
- 관련 파일 예시: `src/utils/storage.js`, `src/utils/imageOptimizer.js`, `src/components/fortune/TarotCardModal.js`, `src/context/ErrorContext.js`
- 권장 수정:
  - `__DEV__` 가드 또는 로거 레벨(`debug/info/warn/error`) 도입,
  - 개인정보/민감정보가 섞일 수 있는 payload 로그 제거.

### 2-2. `storage.js` 단일 파일 책임 과다 (638 lines)
- 이미지 저장/삭제, 리뷰 저장, 캐시 정리, 공지 읽음 처리 등 서로 다른 책임이 한 파일에 집중되어 있습니다.
- 변경 영향도 파악이 어렵고 테스트 분리가 어렵습니다.
- 관련 파일: `src/utils/storage.js`
- 권장 수정:
  - `storage/imageStorage.js`, `storage/reviewStorage.js`, `storage/cacheMaintenance.js` 등으로 분리,
  - 공통 키/직렬화 로직만 별도 유틸로 추출.

## 3) 우선순위 낮음 (하지만 누적되면 피로도 큼)

### 3-1. npm 경고 상시 출력 (`Unknown env config "http-proxy"`)
- `npm run typecheck`, `npm test` 실행 시 반복적으로 경고가 출력됩니다.
- 실제 오류 탐지 가독성을 떨어뜨립니다.
- 권장 수정:
  - 사용자/CI 환경의 npm config에서 `http-proxy` 설정 키 정리,
  - 팀 공통 실행 환경(.npmrc/CI 환경변수) 표준화.

---

## 이번 점검에서 실행한 명령
- `npm run typecheck` (실패: `deno` 실행 파일 미존재)
- `npm test` (성공)
- `rg -n "TODO|FIXME|HACK|@ts-ignore|console\.log\(" src supabase App.js test scripts --glob '!node_modules/**'`
- `rg -n "global\.showGlobalError|errorEmitter" src App.js`
- `wc -l src/utils/storage.js src/context/ErrorContext.js src/utils/ErrorContext.js src/components/fortune/TarotCardModal.js src/utils/imageOptimizer.js`
