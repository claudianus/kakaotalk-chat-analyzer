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
        characterSharePercent: 55,
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
        characterSharePercent: 45,
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
    assert.deepEqual(m!.messageCounts, [10, 8]);
    assert.deepEqual(m!.aliases, ["A", "B"]);
  });

  it("orders matrix axes by message count descending", () => {
    const d = new DyadAccumulator();
    d.addReply("c", "a");
    d.addReply("a", "b");
    d.addReply("b", "c");
    const participants: ParticipantStat[] = [
      {
        alias: "Low",
        messages: 5,
        characters: 50,
        averageLength: 10,
        attachmentMessages: 0,
        linkMessages: 0,
        sharePercent: 10,
        characterSharePercent: 10,
        nightMessages: 0,
        maxConsecutive: 1,
      },
      {
        alias: "High",
        messages: 100,
        characters: 500,
        averageLength: 5,
        attachmentMessages: 0,
        linkMessages: 0,
        sharePercent: 50,
        characterSharePercent: 55,
        nightMessages: 0,
        maxConsecutive: 3,
      },
      {
        alias: "Mid",
        messages: 40,
        characters: 200,
        averageLength: 5,
        attachmentMessages: 0,
        linkMessages: 0,
        sharePercent: 20,
        characterSharePercent: 20,
        nightMessages: 0,
        maxConsecutive: 2,
      },
    ];
    const aliasMap = new Map<string, string>([
      ["a", "Low"],
      ["b", "Mid"],
      ["c", "High"],
    ]);
    const m = d.buildMatrix(participants, aliasMap);
    assert.ok(m);
    assert.deepEqual(m!.aliases, ["High", "Mid", "Low"]);
    assert.deepEqual(m!.messageCounts, [100, 40, 5]);
  });

  it("keeps top pairs inside the displayed matrix participants", () => {
    const d = new DyadAccumulator();
    d.addReply("alice", "bob");
    d.addReply("alice", "bob");
    d.addReply("outside", "ghost");
    d.addReply("outside", "ghost");
    d.addReply("outside", "ghost");
    const participants: ParticipantStat[] = [
      {
        alias: "A",
        messages: 10,
        characters: 100,
        averageLength: 10,
        attachmentMessages: 0,
        linkMessages: 0,
        sharePercent: 50,
        characterSharePercent: 55,
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
        characterSharePercent: 45,
        nightMessages: 0,
        maxConsecutive: 1,
      },
    ];
    const aliases = new Map<string, string>([
      ["alice", "A"],
      ["bob", "B"],
      ["outside", "Outside"],
      ["ghost", "Ghost"],
    ]);
    const m = d.buildMatrix(participants, aliases);
    assert.ok(m);
    assert.deepEqual(m!.topPairs.map((p) => `${p.fromAlias}->${p.toAlias}`), ["A->B"]);
    const visibleReplies = m!.matrix.flat().reduce((sum, n) => sum + n, 0);
    assert.equal(m!.totalReplies, visibleReplies);
  });
});
