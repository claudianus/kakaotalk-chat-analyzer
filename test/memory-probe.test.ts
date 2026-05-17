import assert from "node:assert/strict";
import test from "node:test";
import {
  darwinAvailableBytesFromVmStat,
  parseDarwinVmStatPages,
  parseLinuxMemAvailableKb,
} from "../src/memory-probe.js";

const SAMPLE_VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                123456.
Pages inactive:                            789012.
Pages speculative:                          34567.
Pages wired down:                          111111.
`;

test("parseDarwinVmStatPages extracts page counts", () => {
  const p = parseDarwinVmStatPages(SAMPLE_VM_STAT);
  assert.equal(p.free, 123456);
  assert.equal(p.inactive, 789012);
  assert.equal(p.speculative, 34567);
});

test("darwinAvailableBytesFromVmStat sums free+inactive+speculative", () => {
  const pageSize = 16384;
  const bytes = darwinAvailableBytesFromVmStat(SAMPLE_VM_STAT, pageSize);
  const pages = 123456 + 789012 + 34567;
  assert.equal(bytes, pages * pageSize);
  assert.ok(bytes > 1024 ** 3, "available should exceed 1GiB");
});

test("parseLinuxMemAvailableKb prefers MemAvailable", () => {
  const kb = parseLinuxMemAvailableKb(`MemTotal:       48000000 kB
MemFree:         5000000 kB
MemAvailable:   18000000 kB
`);
  assert.equal(kb, 18_000_000);
});

test("parseLinuxMemAvailableKb falls back to MemFree", () => {
  const kb = parseLinuxMemAvailableKb(`MemTotal:       8000000 kB
MemFree:         4000000 kB
`);
  assert.equal(kb, 4_000_000);
});
