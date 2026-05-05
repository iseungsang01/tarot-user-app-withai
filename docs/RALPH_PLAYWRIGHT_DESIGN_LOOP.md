# Continuous Frontend Design Iteration with Ralph & Playwright MCP

이 문서는 AI 에이전트(Ralph)와 **Playwright MCP(Model Context Protocol)**를 결합하여, 사람이 직접 브라우저를 확인하지 않고도 `frontend-design` 스킬(독창적이고 과감한 디자인)에 맞춰 UI를 지속적으로 반복 개선(Iteration)하는 워크플로우를 가이드합니다.

## 🌟 1. 개요 (Overview)

일반적인 AI 코딩은 코드를 작성한 후 사용자가 화면을 보고 피드백을 주는 방식입니다. 하지만 **Playwright MCP**를 사용하면 Ralph가 직접 브라우저를 제어하고 화면을 스크린샷으로 캡처하여 스스로 시각적 비평(Visual Critique)을 수행할 수 있습니다. 

방금 추가된 `frontend-design` 스킬과 결합하면, Ralph는 "흔한 AI 스타일"을 벗어나 극단적이고 매력적인(예: Brutally minimal, Maximalist chaos) 디자인이 나올 때까지 코드를 수정하고 확인하는 **시각적 피드백 루프(Visual Feedback Loop)**를 혼자서 돌 수 있습니다.

## ⚙️ 2. 사전 요구 사항 (Prerequisites)

1. **로컬 개발 서버 실행**
   - React Native (Expo Web), React, Vue 등 프론트엔드 서버가 켜져 있어야 합니다.
   - 예: `npm run web` (통상적으로 `http://localhost:8081` 또는 `3000` 사용)
2. **Playwright MCP 서버 활성화**
   - Ralph가 Playwright 도구(스크린샷 캡처, DOM 조회, 콘솔 로그 확인 등)에 접근할 수 있도록 MCP가 연결되어 있어야 합니다.
3. **Frontend Design 스킬 로드**
   - Ralph가 디자인 작업을 시작하기 전, `.agents/skills/frontend-design/SKILL.md` 원칙을 숙지해야 합니다.

## 🔄 3. 핵심 워크플로우: 시각적 피드백 루프

Ralph에게 디자인 개선을 요청하면 다음과 같은 5단계 루프를 거치게 됩니다.

1. **Navigate (이동):** 
   - Playwright MCP를 사용해 로컬 테스트 URL(`http://localhost:8081`)로 이동합니다.
2. **Capture & Inspect (캡처 및 분석):** 
   - 렌더링된 화면의 스크린샷을 찍고, DOM 구조와 적용된 CSS를 분석합니다.
3. **Visual Critique (시각적 비평):** 
   - Ralph가 캡처된 이미지를 보고 `frontend-design` 가이드라인에 비추어 스스로 평가합니다.
   - *평가 기준 예시: "너무 평범한 폰트(Inter)를 썼다", "여백(Negative space)이 부족하다", "컬러 배색이 지나치게 안전하다(지루하다)".*
4. **Code Modification (코드 수정):** 
   - 비평을 바탕으로 IDE(파일 편집) 도구를 사용해 React 컴포넌트나 CSS를 직접 수정합니다.
5. **Verify & Repeat (검증 및 반복):** 
   - 코드가 저장되고 핫-리로딩(Hot-reloading)이 완료되면 다시 스크린샷을 찍어 확인합니다.
   - 목표한 "독창적인 미적 기준(Aesthetic vision)"에 도달할 때까지 이 과정을 3~5회 스스로 반복합니다.

## 🗣️ 4. Ralph를 위한 프롬프트 가이드 (Prompting Ralph)

Ralph가 이 루프를 제대로 수행하도록 지시하는 강력한 프롬프트 예시들입니다. 복사해서 사용하세요.

### 예시 1: 특정 테마를 적용한 자율 반복
> "Ralph, Playwright MCP를 이용해 `http://localhost:8081/home` 화면을 열어줘. `frontend-design` 스킬을 참고해서 현재 화면을 **'Retro-futuristic (레트로 퓨처리즘)'** 테마로 완전히 바꿔줘. 코드를 수정한 뒤 스크린샷을 찍어 스스로 확인하고, 완벽한 레트로 퓨처리즘 느낌이 날 때까지 최대 3번 스스로 코드를 수정하며 반복(Iterate)해줘."

### 예시 2: 타이포그래피와 여백 집중 개선
> "Ralph, 현재 작성된 `<DailyFortune />` 컴포넌트를 브라우저(Playwright)로 띄워서 스크린샷을 확인해봐. 지금 너무 '흔한 AI 스타일(Generic AI aesthetics)' 같아. 폰트를 과감한 Display 폰트로 바꾸고, 비대칭적(Asymmetry)인 레이아웃을 적용해봐. 코드를 고치고 스크린샷으로 결과를 확인하는 과정을 거쳐서 가장 인상적인 결과물이 나오면 알려줘."

### 예시 3: 다크 모드 / 라이트 모드 시각적 디버깅
> "Ralph, 설정 페이지의 다크 모드를 구현해줘. 구현 후 Playwright로 라이트 모드 스크린샷을 찍고, 시스템 테마를 다크 모드로 변경한 뒤 다시 스크린샷을 찍어줘. 두 화면 모두 `brutalist/raw` 테마의 디자인 룰을 잘 따르고 있는지 시각적으로 확인하고 부족한 점을 수정해줘."

## 💡 5. 주의 사항 및 팁 (Best Practices)

- **애니메이션 대기 (Wait for Animations):** 
  Playwright로 스크린샷을 찍을 때 화면 진입 애니메이션이 끝나기 전에 찍힐 수 있습니다. 스크린샷 캡처 전 `waitForTimeout(1000)` 등 적절한 대기 시간을 주도록 Ralph에게 지시하세요.
- **다양한 뷰포트(Viewport) 확인:** 
  모바일 환경이 타겟이라면, Playwright 설정에서 뷰포트를 모바일 사이즈(예: `width: 390, height: 844`)로 설정하고 캡처하도록 명시하세요.
- **콘솔 에러 확인:** 
  시각적 확인뿐만 아니라 Playwright MCP를 통해 브라우저 콘솔 로그를 확인하여, 과감한 디자인 변경 중 발생한 렌더링 에러나 경고를 함께 수정하도록 하면 더 완벽한 결과물을 얻을 수 있습니다.
