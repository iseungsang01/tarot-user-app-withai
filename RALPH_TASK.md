# Ralph Iteration Task

**Target URL:** http://localhost:8081
**Target Component/Screen:** Home Screen (메인 홈 화면) 
*(※ 필요에 따라 타겟 화면을 자유롭게 수정하세요)*

## 🎯 Objective (목표)
현재 화면의 시각적 디자인을 완전히 뜯어고쳐서 "흔한 AI 스타일(Generic AI aesthetics)"을 탈피하고, 독창적이고 과감한 프로덕션 레벨의 UI로 업그레이드합니다. 

## 🛠️ Required Steps (이번 이터레이션 수행 단계)
1. **Load Guidelines:** `.agents/skills/frontend-design/SKILL.md` 파일을 읽고 디자인 핵심 원칙(Brutalism, Maximalism 등 명확한 방향성)을 숙지하세요.
2. **Visual Inspection:** Playwright MCP를 사용해 **Target URL**에 접속하고 스크린샷을 캡처하여 현재 상태를 확인하세요.
3. **Critique:** 캡처된 화면에서 평범하거나 지루한 요소(예: 뻔한 폰트, 심심한 색상, 어색한 여백) 2~3가지를 찾아 스스로 비평(Critique)하세요.
4. **Implementation:** 비평을 바탕으로 `src/` 디렉토리 내의 관련 React 컴포넌트 및 스타일 코드를 직접 과감하게 수정하세요.
5. **Report:** 수정한 파일 목록과 "어떤 미적 의도(Aesthetic intention)로 디자인을 변경했는지" 요약하고 턴을 종료하세요.

## ⚠️ Boundaries (주의 사항)
- 기존의 핵심 비즈니스 로직(데이터 패칭, 네비게이션, 상태 관리 등)은 절대 건드리지 마세요.
- 오직 레이아웃, 타이포그래피, 컬러, 애니메이션, 여백(Spacing) 등 시각적 요소(Visuals)에만 집중하세요.
- 코드를 수정한 후 컴파일 에러(앱 크래시)가 발생하지 않도록 주의하세요.