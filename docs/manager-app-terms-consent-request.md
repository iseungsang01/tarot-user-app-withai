# 매니저 앱 협의 요청 — 약관 동의 이력 컬럼

작성일: 2026-09-11 · 작성: 유저앱(tarot-user-app-withai)
관련: [`manager-app-db-issues-round2.md`](./manager-app-db-issues-round2.md)

---

## 요청

`public.customers` 에 약관 동의 이력 컬럼을 추가해 주세요.

```sql
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version varchar(10);
```

`register_customer` 가 가입 시 두 값을 함께 기록하도록 바꿔야 합니다.

## 왜 유저앱이 단독으로 못 하는가

`customers` 테이블과 `register_customer` 는 양쪽 스키마에 모두 정의돼 있어, 나중에
배포하는 쪽이 상대 정의를 덮어씁니다. 유저앱이 혼자 올리면 매니저 재배포 때 사라집니다.

## 왜 필요한가

2026-09-11 유저앱에 서비스 이용약관과 개인정보 처리방침을 넣고, 회원가입 시 필수 동의를
받도록 했습니다(`src/constants/legal/`, `ConsentCheckList`). 개인정보 보호법은 동의를 받은
사실을 입증할 수 있도록 보관할 것을 요구하는데, 지금은 동의 기록이 **가입한 기기의
로컬 저장소에만** 남습니다. 앱을 지우거나 기기를 바꾸면 기록이 사라져 입증 자료로
쓸 수 없습니다.

약관을 개정해 재동의를 받아야 할 때도, 서버에 버전이 없으면 누가 어느 버전에 동의했는지
알 수 없어 전원에게 다시 받는 수밖에 없습니다.

## 매장(매니저 앱)에 미치는 영향

- 매니저 앱이 회원을 직접 등록하는 경로에서는 두 컬럼이 NULL 로 남습니다.
  그 회원이 유저앱에서 처음 로그인할 때 동의를 받아 채우는 것이 자연스럽습니다.
- 기존 회원 데이터에 대한 소급 처리는 필요 없습니다 (2026-09-11 기준 가입 회원 없음).

## 유저앱 쪽 준비 상태

- 컬럼이 생기면 `register_customer` 호출부에 버전·시각을 실어 보내고, 로컬 기록은
  보조 수단으로만 남깁니다.
- 동의 버전은 `src/constants/legal/index.js` 의 `CONSENT_VERSION` 하나로 관리합니다.
