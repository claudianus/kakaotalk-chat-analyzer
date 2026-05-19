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

test("effectiveLlmHeadroomGb caps by low free after ML", () => {
  const rich = effectiveLlmHeadroomGb(richProfile);
  const tight = effectiveLlmHeadroomGb(tightFreeProfile);
  assert.ok(tight < rich);
  assert.ok(tight <= 3);
});

test("resolveLlmRunPlan postMl picks smaller model when free is low", () => {
  const pre = resolveLlmRunPlan({ preset: "quality", profile: postMlMediumFree, postMl: false });
  const post = resolveLlmRunPlan({ preset: "quality", profile: postMlMediumFree, postMl: true });
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
