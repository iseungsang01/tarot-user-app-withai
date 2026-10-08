// ai-proxy 의 작업별 프롬프트와 입력 검증.
//
// 프롬프트는 서버가 만든다. 클라이언트가 system/user 메시지를 통째로 보내던 때는
// 게스트 세션 하나(anon 이 무제한 발급)로 아무 프롬프트나 우리 Google 키로 돌릴 수
// 있었다. 이제 클라이언트는 작업 이름과 구조화된 입력만 보내고, 각 필드는 길이가
// 잘린 채 서버 프롬프트의 정해진 자리에만 들어간다.

export type TaskRequest = {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  responseSchema: Record<string, unknown>;
};

export type BuildResult = { ok: true; request: TaskRequest } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 문자열이면 trim 후 max 자로 자른다. 문자열이 아니면 빈 문자열. */
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const stringSchema = (description: string) => ({ type: 'string', description });

const objectSchema = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const MAX_VISITS = 50;
const MAX_REVIEW_LENGTH = 3000;
const MAX_VISITS_TOTAL_LENGTH = 30000;

function buildAnalyzeVisitHistory(input: Record<string, unknown>): BuildResult {
  if (!Array.isArray(input.visits) || input.visits.length === 0) {
    return { ok: false, error: '분석할 상담 기록이 없습니다.' };
  }
  if (input.visits.length > MAX_VISITS) {
    return { ok: false, error: `상담 기록은 최대 ${MAX_VISITS}개까지 분석할 수 있습니다.` };
  }

  const visits = input.visits
    .filter(isRecord)
    .map((visit) => ({ date: text(visit.date, 10) || '날짜 없음', review: text(visit.review, MAX_REVIEW_LENGTH) }))
    .filter((visit) => visit.review);

  if (visits.length === 0) return { ok: false, error: '분석할 상담 기록이 없습니다.' };

  const visitsText = visits
    .map((visit, i) => `[${i + 1}번째 방문 - ${visit.date}]\n${visit.review}`)
    .join('\n\n---\n\n')
    .slice(0, MAX_VISITS_TOTAL_LENGTH);

  return {
    ok: true,
    request: {
      system: `당신은 타로 상담 기록을 종합 분석하는 전문 어시스턴트입니다.
여러 번의 상담 기록을 분석하여 다음 JSON 형식으로 응답하세요.
반드시 JSON만 출력하고 다른 텍스트는 포함하지 마세요.

{
  "overallSummary": "전체 상담 흐름 2-3문장 요약",
  "patterns": ["반복되는 패턴이나 주제 1", "패턴 2", "패턴 3"],
  "growthPoints": "방문을 거듭하며 변화된 긍정적인 점",
  "recommendation": "향후 상담 방향 제안",
  "totalVisits": ${visits.length}
}`,
      user: `총 ${visits.length}회의 상담 기록을 분석해주세요:\n\n${visitsText}`,
      temperature: 0.5,
      maxTokens: 800,
      responseSchema: objectSchema({
        overallSummary: stringSchema('Overall consultation flow summary'),
        patterns: { type: 'array', items: { type: 'string' }, description: 'Recurring patterns or themes' },
        growthPoints: stringSchema('Positive changes across visits'),
        recommendation: stringSchema('Suggested direction for future consultations'),
        totalVisits: { type: 'integer', description: 'Number of analyzed visits' },
      }),
    },
  };
}

function buildPolishReviewText(input: Record<string, unknown>): BuildResult {
  const reviewText = text(input.text, 4000);
  if (!reviewText) return { ok: false, error: '다듬을 상담 기록이 없습니다.' };

  return {
    ok: true,
    request: {
      system: `당신은 타로 상담 기록 정리 전문 어시스턴트입니다.
상담사가 작성한 메모의 의미를 유지한 채 가독성만 높여주세요.
- 사실/의미를 추가하거나 왜곡하지 마세요
- 어조는 원문의 분위기를 유지하세요
- 핵심 포인트를 정돈해서 4~8문장 내로 작성하세요
- 반드시 JSON 형식으로만 응답하세요

{
  "polished": "다듬어진 상담 기록 텍스트"
}`,
      user: `아래 메모를 다듬어주세요:\n\n${reviewText}`,
      temperature: 0.4,
      maxTokens: 600,
      responseSchema: objectSchema({
        polished: stringSchema('Polished Korean consultation memo, preserving original facts and intent'),
      }),
    },
  };
}

function buildCondenseVoiceMemo(input: Record<string, unknown>): BuildResult {
  const transcriptText = text(input.text, 2000);
  if (!transcriptText) return { ok: false, error: '축약할 메모가 없습니다.' };

  return {
    ok: true,
    request: {
      system: `당신은 한국어 메모를 아주 짧게 정리하는 편집 도우미입니다.
사용자가 입력한 현재 메모 전체를 읽고 핵심만 3~6어절의 짧은 한국어 문구로 축약하세요.
반드시 JSON 객체 하나만 출력하세요. JSON 바깥의 설명, 마크다운, 코드펜스, 분석 과정, 내부 지침, 영어 시스템 설명은 절대 출력하지 마세요.
입력 원문을 그대로 복사하지 말고 더 짧고 자연스러운 문구로 바꾸세요.
음성 인식 결과가 깨졌거나 의미가 불명확하면 내용을 지어내지 말고 "의미 불명확한 메모", "음성 인식 불명확", "메모 정리 필요" 중 하나처럼 안전한 짧은 문구로 축약하세요.

{
  "condensed": "3~6어절의 짧은 한국어 축약문"
}`,
      user: `다음 현재 메모 내용을 짧게 축약해 주세요:\n\n${transcriptText}`,
      temperature: 0.35,
      maxTokens: 500,
      responseSchema: objectSchema({
        condensed: stringSchema('3 to 6 word short Korean condensed memo'),
      }),
    },
  };
}

const CARD_FIELD_LENGTH = 300;

function buildGetDailyFortune(input: Record<string, unknown>): BuildResult {
  const card = isRecord(input.card) ? input.card : {};
  const domains = isRecord(card.domains) ? card.domains : {};
  const keywords = Array.isArray(card.keywords)
    ? card.keywords.slice(0, 10).map((keyword) => text(keyword, 30)).filter(Boolean)
    : [];
  const cardName = text(card.name, 40);
  if (!cardName) return { ok: false, error: '오늘의 카드 정보가 없습니다.' };

  const userName = text(input.userName, 20) || '사용자';
  const previousFortune = text(input.previousFortune, 120);

  const cardContext = `id: ${text(card.id, 40)}
name: ${cardName}
nameKr: ${text(card.nameKr, 40)}
keywords: ${keywords.join(', ')}
light: ${text(card.light, CARD_FIELD_LENGTH)}
shadow: ${text(card.shadow, CARD_FIELD_LENGTH)}
advice: ${text(card.advice, CARD_FIELD_LENGTH)}

[분야별 참고]
관계: ${text(domains.relationship, CARD_FIELD_LENGTH)}
일/공부: ${text(domains.work, CARD_FIELD_LENGTH)}
금전: ${text(domains.money, CARD_FIELD_LENGTH)}
컨디션: ${text(domains.health, CARD_FIELD_LENGTH)}`;

  return {
    ok: true,
    request: {
      system: `당신은 drawer 앱의 오늘의 타로 메시지를 작성하는 해석자입니다.
오늘의 카드는 이미 앱에서 선택되었습니다.
AI는 카드를 선택하거나 바꾸지 마세요.
제공된 카드 context만 바탕으로 운세 문장을 작성하세요.
과도한 예언, 불안 조성, 단정적 표현은 금지합니다.
운세는 자기 성찰과 하루 조언 중심으로 작성합니다.
반드시 JSON만 출력하세요. JSON 바깥의 설명, 마크다운, 코드펜스는 금지합니다.`,
      user: `[사용자]
이름: ${userName}
${previousFortune ? `이전 오늘 운세 요약: ${previousFortune}` : ''}

[오늘의 카드]
${cardContext}

[작성 규칙]
- 한국어 존댓말
- 예언처럼 단정하지 말 것
- 불안감을 조성하지 말 것
- 카드 의미를 단순 나열하지 말고 자연스러운 하루 조언으로 풀 것
- fortune은 3~4문장
- summary는 20자 이내
- relationship, work, money, care는 각각 1~2문장
- action은 오늘 바로 할 수 있는 구체적 행동 1개
- luckyColor와 luckyItem은 짧고 구체적으로 작성
- 반드시 JSON만 출력

[출력 JSON]
{
  "summary": "오늘의 핵심 메시지",
  "fortune": "오늘의 운세 본문",
  "relationship": "관계 조언",
  "work": "일/공부 조언",
  "money": "금전 조언",
  "care": "주의할 점",
  "action": "오늘 바로 해볼 행동",
  "luckyColor": "행운의 색",
  "luckyItem": "행운의 아이템"
}`,
      temperature: 0.75,
      maxTokens: 700,
      responseSchema: objectSchema({
        summary: stringSchema('Core daily message'),
        fortune: stringSchema('Daily fortune body'),
        relationship: stringSchema('Relationship advice'),
        work: stringSchema('Work or study advice'),
        money: stringSchema('Money advice'),
        care: stringSchema('Care point'),
        action: stringSchema('Concrete action for today'),
        luckyColor: stringSchema('Lucky color'),
        luckyItem: stringSchema('Lucky item'),
      }),
    },
  };
}

const TASK_BUILDERS: Record<string, (input: Record<string, unknown>) => BuildResult> = {
  analyzeVisitHistory: buildAnalyzeVisitHistory,
  polishReviewText: buildPolishReviewText,
  condenseVoiceMemo: buildCondenseVoiceMemo,
  getDailyFortune: buildGetDailyFortune,
};

export function buildTaskRequest(task: unknown, input: unknown): BuildResult {
  const builder = typeof task === 'string' && Object.hasOwn(TASK_BUILDERS, task) ? TASK_BUILDERS[task] : null;
  if (!builder) return { ok: false, error: 'Unsupported AI task.' };
  if (!isRecord(input)) return { ok: false, error: 'input must be an object.' };
  return builder(input);
}
