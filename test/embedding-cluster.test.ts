import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kMeansAssignments, labelClustersFromTokens, normalizeVector } from "../src/embedding-cluster.js";

describe("embedding-cluster", () => {
  it("kMeansAssignments groups similar vectors", () => {
    const a = normalizeVector([1, 0, 0]);
    const b = normalizeVector([0.9, 0.1, 0]);
    const c = normalizeVector([0, 1, 0]);
    const d = normalizeVector([0, 0.95, 0.05]);
    const assignments = kMeansAssignments([a, b, c, d], 2, 8);
    assert.equal(assignments[0], assignments[1]);
    assert.equal(assignments[2], assignments[3]);
    assert.notEqual(assignments[0], assignments[2]);
  });

  it("labelClustersFromTokens picks frequent cluster terms", () => {
    const assignments = [0, 0, 1, 1];
    const bags = [["클로드", "코덱스"], ["클로드", "api"], ["점심", "메뉴"], ["점심", "밥"]];
    const labels = labelClustersFromTokens(assignments, bags, 2, new Set(), 2);
    assert.equal(labels.length, 2);
    assert.ok(labels[0]!.terms.includes("클로드") || labels[0]!.terms.includes("점심"));
  });
});
