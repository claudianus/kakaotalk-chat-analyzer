import type { BenchmarkMetric } from "./types.js";

/** 합성·공개 fixture 기반 참고 분포(업로드 데이터 없음). 표본 편향 있음 — ‘추정 밴드’. */
const REFERENCE = {
  participantGini: [0.25, 0.38, 0.52, 0.65, 0.78, 0.88],
  nightSharePercent: [8, 15, 22, 32, 42, 55],
  speakerSwitchRatePer100: [28, 38, 48, 58, 68, 82],
  rhythmScore: [32, 42, 52, 62, 72, 85],
  weekendSharePercent: [18, 24, 30, 38, 46, 58],
} as const;

function percentileFromRef(value: number, ref: readonly number[]): number {
  let below = 0;
  for (const r of ref) {
    if (value >= r) below += 1;
  }
  return Math.min(99, Math.max(1, Math.round((below / ref.length) * 100)));
}

function bandLabel(p: number): string {
  if (p >= 85) return "상위권";
  if (p >= 60) return "다소 높음";
  if (p >= 40) return "중간";
  if (p >= 20) return "다소 낮음";
  return "하위권";
}

export function buildBenchmarkBandsFromValues(input: {
  participantGini: number | null;
  nightSharePercent: number;
  speakerSwitchRatePer100: number;
  rhythmScore: number;
  weekendSharePercent: number;
}): BenchmarkMetric[] {
  const gini = input.participantGini ?? 0.5;
  const defs: { key: string; label: string; value: number; ref: readonly number[] }[] = [
    { key: "gini", label: "참여 지니", value: gini, ref: REFERENCE.participantGini },
    { key: "night", label: "심야 비중(%)", value: input.nightSharePercent, ref: REFERENCE.nightSharePercent },
    {
      key: "switch",
      label: "화자 전환/100",
      value: input.speakerSwitchRatePer100,
      ref: REFERENCE.speakerSwitchRatePer100,
    },
    { key: "rhythm", label: "리듬 점수", value: input.rhythmScore, ref: REFERENCE.rhythmScore },
    {
      key: "weekend",
      label: "주말 비중(%)",
      value: input.weekendSharePercent,
      ref: REFERENCE.weekendSharePercent,
    },
  ];
  return defs.map((d) => {
    const percentile = percentileFromRef(d.value, d.ref);
    return {
      key: d.key,
      label: d.label,
      value: d.value,
      percentile,
      band: bandLabel(percentile),
    };
  });
}
