export interface LlmJsonCase {
  name: string;
  raw: string;
  expectParse: boolean;
  note?: string;
}

/** parseLlmJsonResponse / extractLlmJsonObject 매트릭스 */
export const LLM_JSON_CASES: LlmJsonCase[] = [
  {
    name: "bare-minimal",
    raw: '{"paragraphs":["첫 문단","둘째 문단"],"insightBullets":["참여 40명"]}',
    expectParse: true,
  },
  {
    name: "fence-with-prefix",
    raw: '다음은 JSON입니다.\n```json\n{"paragraphs":["**강조**","두"],"topicTitles":[{"i":0,"title":"주제"}]}\n```',
    expectParse: true,
  },
  {
    name: "thinking-suffix-stripped",
    raw: '내부 추론\n{"topicTitles":[{"i":1,"title":"토론"}],"paragraphs":["a","b"]}',
    expectParse: true,
  },
  {
    name: "trailing-noise",
    raw: '{"paragraphs":["본문","둘"],"insightBullets":["40명"]} 참고: } 잡음',
    expectParse: true,
  },
  {
    name: "trailing-comma-repair",
    raw: '{"paragraphs":["첫","둘"],}',
    expectParse: true,
    note: "repairJsonSlice",
  },
  {
    name: "full-deck-shape",
    raw: JSON.stringify({
      paragraphs: ["**클로드** 중심 대화", "코덱스 언급 증가"],
      roomArchetype: { name: "AI 크루", description: "클로드와 코덱스", traits: ["개발"] },
      episodeCards: [{ period: "1막", title: "시작", tagline: "클로드", emoji: "🔥" }],
      moments: [{ headline: "피크", statRef: "1000" }],
    }),
    expectParse: true,
  },
  {
    name: "prose-only",
    raw: "서사만 한국어로 씁니다.",
    expectParse: false,
  },
  {
    name: "truncated-mid-string",
    raw: "not-even-brace",
    expectParse: false,
  },
  {
    name: "truncated-mid-array-repaired",
    raw: '{"paragraphs":["첫","둘째',
    expectParse: true,
    note: "jsonrepair closes array/object",
  },
  {
    name: "json-field-name-only",
    raw: "topicProposals",
    expectParse: false,
  },
  {
    name: "empty-object",
    raw: "{}",
    expectParse: true,
  },
  {
    name: "nested-strings-escaped",
    raw: '{"paragraphs":["따옴표 \\"테스트\\"","둘"]}',
    expectParse: true,
  },
];
