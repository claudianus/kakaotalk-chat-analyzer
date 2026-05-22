export interface HonorificAnalysis {
  honorificCount: number;
  casualCount: number;
  honorificRatio: number;
  casualRatio: number;
  dominantStyle: "honorific" | "casual" | "mixed";
}

const HONORIFIC_PATTERNS = [
  /[해가있좋아보]요[.!?]?$/,
  /습니다[.!?]?$/,
  /ㅂ니다[.!?]?$/,
  /[하가보]세요/,
  /[하가보드먹]시[는을에]/,
  /[는은]데요/,
];

const CASUAL_PATTERNS = [
  /[해가있좋아보어]$/,
  /[한다간먹보]다$/,
  /[이그]야[.!?]?$/,
  /[하그]지[.!?]?$/,
  /[하그맞]잖아[.!?]?$/,
];

export function analyzeHonorificStyle(text: string): "honorific" | "casual" | "neutral" {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "neutral";

  let honorific = 0;
  let casual = 0;

  for (const p of HONORIFIC_PATTERNS) {
    if (p.test(trimmed)) {
      honorific += 1;
      break;
    }
  }

  for (const p of CASUAL_PATTERNS) {
    if (p.test(trimmed)) {
      casual += 1;
      break;
    }
  }

  if (honorific > 0 && casual === 0) return "honorific";
  if (casual > 0 && honorific === 0) return "casual";
  return "neutral";
}

export function analyzeParticipantHonorific(
  messages: string[],
): HonorificAnalysis {
  let honorificCount = 0;
  let casualCount = 0;

  for (const msg of messages) {
    const style = analyzeHonorificStyle(msg);
    if (style === "honorific") honorificCount += 1;
    else if (style === "casual") casualCount += 1;
  }

  const total = honorificCount + casualCount;
  const honorificRatio = total > 0 ? honorificCount / total : 0;
  const casualRatio = total > 0 ? casualCount / total : 0;

  let dominantStyle: "honorific" | "casual" | "mixed" = "mixed";
  if (honorificRatio >= 0.7) dominantStyle = "honorific";
  else if (casualRatio >= 0.7) dominantStyle = "casual";

  return {
    honorificCount,
    casualCount,
    honorificRatio,
    casualRatio,
    dominantStyle,
  };
}
