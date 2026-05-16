import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classTfidfTopTerms } from "../src/ctfidf.js";

describe("classTfidfTopTerms", () => {
  it("ranks terms that are distinctive within a class", () => {
    const classes = new Map<string, Map<string, number>>([
      ["a", new Map([["apple", 10], ["banana", 2]])],
      ["b", new Map([["banana", 8], ["cherry", 5]])],
    ]);
    const ranked = classTfidfTopTerms(classes, 3);
    const aTop = ranked.get("a")!.map((x) => x.term);
    const bTop = ranked.get("b")!.map((x) => x.term);
    assert.ok(aTop.includes("apple"));
    assert.ok(bTop.includes("cherry"));
  });

  it("returns empty map for empty input", () => {
    assert.equal(classTfidfTopTerms(new Map(), 5).size, 0);
  });
});
