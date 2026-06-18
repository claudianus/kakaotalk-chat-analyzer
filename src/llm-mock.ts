/** 테스트·벤치용 LLM mock — KCA_LLM_MOCK 시퀀스·시나리오 지원 */

const KNOWN_MODES = new Set([
  "1",
  "valid",
  "invalid",
  "validation_fail",
  "truncated",
  "empty",
  "timeout",
  "error",
]);

let callIndex = 0;

export function resetLlmMockCallIndex(): void {
  callIndex = 0;
}

export function isLlmMockEnabled(): boolean {
  const mode = process.env.KCA_LLM_MOCK?.trim();
  if (!mode) return false;
  if (mode.startsWith("sequence:")) return true;
  return KNOWN_MODES.has(mode);
}

function validMockPayload(): string {
  return JSON.stringify({
    topicTitles: [{ i: 0, title: "모의 LLM 주제" }],
    topicProposals: [
      {
        title: "AI 코딩 도구",
        terms: ["클로드", "코덱스", "토큰"],
        keywordEvidence: ["클로드", "코덱스"],
      },
    ],
    paragraphs: [
      "**통계 기반** 서사 첫 문단입니다.",
      "두 번째 문단은 규칙 기반 서사를 보강합니다.",
    ],
    insightBullets: ["모의 인사이트: 상위 키워드가 개발·AI 도구에 집중됩니다."],
    shopSearchSummary: "샵검색 태그는 소수이며 환율·계산기 등 실용 주제가 보입니다.",
    dyadInsight: "상위 두 명이 대화 허브 역할을 합니다.",
    roomArchetype: {
      name: "야근 크루",
      description: "밤에 몰아 치는 개발·AI 잡담 방",
      traits: ["심야", "키워드 집중", "응답 빠름"],
    },
    moments: [{ headline: "가장 바빴던 순간", statRef: "10000" }],
    relationshipBeats: [{ pair: "A→B", beat: "질문을 던지고 답을 받는 허브", role: "질문러" }],
    episodeCards: [
      { period: "1막", title: "첫 불꽃", tagline: "키워드가 모이기 시작", emoji: "🔥" },
    ],
    eraLabels: [{ label: "1막: 초반 키워드", detail: "후반과 다른 화제" }],
    shareLine: "우리 방 올해의 대화 리듬을 숫자로 정리했어요",
    hashtags: ["카톡리포트", "kca", "대화통계"],
  });
}

function resolveMockStep(): string {
  const mode = process.env.KCA_LLM_MOCK?.trim() ?? "";
  if (mode.startsWith("sequence:")) {
    const steps = mode
      .slice("sequence:".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const step = steps[callIndex] ?? steps[steps.length - 1] ?? "invalid";
    callIndex += 1;
    return step;
  }
  return mode || "1";
}

/** KCA_LLM_MOCK 시나리오별 raw LLM 출력 (또는 throw) */
export async function runLlmMockCompletion(): Promise<string> {
  const step = resolveMockStep();
  switch (step) {
    case "invalid":
      return "서사만 한국어로 씁니다. JSON 아님.";
    case "validation_fail":
      return JSON.stringify({
        paragraphs: ["흥미로운 대화가 이어졌습니다.", "압도적인 활동이 특징입니다."],
        insightBullets: ["다채로운 이야기를 나누는 공간"],
        roomArchetype: { name: "chatroom", description: "messages are too general" },
      });
    case "truncated":
      return '{"paragraphs":["미완","둘째';
    case "empty":
      return JSON.stringify({ paragraphs: [] });
    case "timeout":
      throw new Error("LLM timeout");
    case "error":
      throw new Error("inference failed");
    case "1":
    case "valid":
      return validMockPayload();
    default:
      return validMockPayload();
  }
}
