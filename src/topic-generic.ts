/** 주제 lead로 쓰이면 안 되는 범용어 — 키워드 상위가 우선 */
export const GENERIC_TOPIC_LEADS = new Set([
  "회사",
  "서비스",
  "한국",
  "데이터",
  "영상",
  "자동화",
  "업무",
  "일정",
  "오늘",
  "내일",
  "감사",
  "부탁",
  "확인",
  "문의",
  "공유",
  "정보",
  "내용",
  "관련",
  "경우",
  "사람",
  "생각",
  "이야기",
  "말씀",
  "진행",
  "작업",
  "프로젝트",
  "팀",
  "고객",
]);

export function isGenericTopicLead(term: string): boolean {
  const t = term.trim().toLowerCase();
  if (GENERIC_TOPIC_LEADS.has(term)) return true;
  const first = term.split(/\s+/)[0]?.trim().toLowerCase();
  return first ? GENERIC_TOPIC_LEADS.has(first) : false;
}

export function themeLeadPenalty(title: string): number {
  const lead = title.split(" · ")[0]?.trim() ?? title;
  return isGenericTopicLead(lead) ? 0.35 : 1;
}
