import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DyadAccumulator } from "../src/dyad-matrix.js";
import type { ParticipantStat } from "../src/types.js";

describe("DyadAccumulator", () => {
  it("builds reply matrix for top participants", () => {
    const d = new DyadAccumulator();
    d.addReply("alice", "bob");
    d.addReply("alice", "bob");
    d.addReply("bob", "alice");
    const participants: ParticipantStat[] = [
      {
        alias: "A",
        messages: 10,
        characters: 100,
        averageLength: 10,
        attachmentMessages: 0,
        linkMessages: 0,
        sharePercent: 50,
        nightMessages: 0,
        maxConsecutive: 1,
      },
      {
        alias: "B",
        messages: 8,
        characters: 80,
        averageLength: 10,
        attachmentMessages: 0,
        linkMessages: 0,
        sharePercent: 40,
        nightMessages: 0,
        maxConsecutive: 1,
      },
    ];
    const aliases = new Map<string, string>([
      ["alice", "A"],
      ["bob", "B"],
    ]);
    const m = d.buildMatrix(participants, aliases);
    assert.ok(m);
    assert.equal(m!.totalReplies, 3);
    assert.equal(m!.matrix[0]![1], 2);
    assert.equal(m!.matrix[1]![0], 1);
  });
});
