import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveLlmHeadroomGb,
  resolveLlmRunPlan,
} from "../src/llm-resolve.js";
import type { MachineProfile } from "../src/analysis-capability.js";
import {
  getMemoryTimeline,
  pushMemoryTimeline,
  resetMemoryTimeline,
} from "../src/memory-plan.js";

const richProfile: MachineProfile = {
  totalMemGb: 48,
  freeMemGb: 14,
  availableMemGb: 28,
  cpuCores: 10,
  platform: "darwin",
  arch: "arm64",
  gpu: "metal",
};

const tightFreeProfile: MachineProfile = {
  ...richProfile,
  freeMemGb: 3.5,
  availableMemGb: 22,
};

const postMlMediumFree: MachineProfile = {
  ...richProfile,
  freeMemGb: 5.5,
  availableMemGb: 24,
};

test("effectiveLlmHeadroomGb caps by low free after ML (non-darwin)", () => {
  const linuxTight: MachineProfile = { ...tightFreeProfile, platform: "linux" };
  const linuxRich: MachineProfile = { ...richProfile, platform: "linux" };
  const rich = effectiveLlmHeadroomGb(linuxRich);
  const tight = effectiveLlmHeadroomGb(linuxTight);
  assert.ok(tight < rich);
  assert.ok(tight <= 3);
});

test("effectiveLlmHeadroomGb uses availableMemGb on darwin with ample inactive memory", () => {
  // macOS에서 availableMemGb가 충분하면 freeMemGb 함정 완화
  const darwinTight = effectiveLlmHeadroomGb(tightFreeProfile);
  // available=22, total=48 → slack=0.5, availableCap=21.5
  // loadHeadroom = 22 - 8 = 14, free=3.5 < 4 → cap to 5GB → effective = 5
  assert.ok(darwinTight >= 5);
});

test("resolveLlmRunPlan postMl picks smaller model when free is low (linux)", () => {
  const linuxMedium: MachineProfile = { ...postMlMediumFree, platform: "linux" };
  const pre = resolveLlmRunPlan({ preset: "quality", profile: linuxMedium, postMl: false });
  const post = resolveLlmRunPlan({ preset: "quality", profile: linuxMedium, postMl: true });
  assert.ok(pre.enabled);
  assert.ok(post.enabled);
  const order = ["9B", "4B", "2B", "0.8B"];
  assert.ok(order.indexOf(pre.size!) < order.indexOf(post.size!));
});

test("memory timeline records phases", () => {
  resetMemoryTimeline();
  pushMemoryTimeline("analysis_start", richProfile);
  pushMemoryTimeline("post_ml_dispose", tightFreeProfile, { note: "test" });
  const t = getMemoryTimeline();
  assert.equal(t.length, 2);
  assert.equal(t[1]!.phase, "post_ml_dispose");
  assert.equal(t[1]!.freeGb, 3.5);
});
