export interface LlmHarnessAttemptExpect {
  label?: string;
  ok: boolean;
  code?: string;
}

export interface LlmHarnessCase {
  name: string;
  mock: string;
  planSize: "0.8B" | "4B";
  minFreeGb?: string;
  expectUsed: boolean;
  expectAttempts?: LlmHarnessAttemptExpect[];
  expectRepairAttempts?: number;
  note?: string;
}

/** runLlmHarness + KCA_LLM_MOCK 매트릭스 */
export const LLM_HARNESS_CASES: LlmHarnessCase[] = [
  {
    name: "primary-valid",
    mock: "valid",
    planSize: "0.8B",
    expectUsed: true,
    expectAttempts: [{ label: "primary", ok: true }],
    expectRepairAttempts: 0,
  },
  {
    name: "parse-fail-then-valid",
    mock: "sequence:invalid,valid",
    planSize: "0.8B",
    expectUsed: true,
    expectAttempts: [
      { label: "primary", ok: false, code: "parse_fail" },
      { label: "compact-repair", ok: true },
    ],
    expectRepairAttempts: 1,
  },
  {
    name: "validation-fail-then-valid",
    mock: "sequence:validation_fail,valid",
    planSize: "0.8B",
    expectUsed: true,
    expectAttempts: [
      { label: "primary", ok: false, code: "validation_fail" },
      { label: "compact-repair", ok: true },
    ],
    expectRepairAttempts: 1,
  },
  {
    name: "truncated-then-valid",
    mock: "sequence:truncated,valid",
    planSize: "0.8B",
    expectUsed: true,
    expectAttempts: [
      { label: "primary", ok: false, code: "validation_fail" },
      { label: "compact-repair", ok: true },
    ],
    expectRepairAttempts: 1,
  },
  {
    name: "timeout-then-valid",
    mock: "sequence:timeout,valid",
    planSize: "0.8B",
    expectUsed: true,
    expectAttempts: [
      { label: "primary", ok: false, code: "timeout" },
      { label: "compact-repair", ok: true },
    ],
    expectRepairAttempts: 1,
  },
  {
    name: "all-invalid-fails",
    mock: "invalid",
    planSize: "0.8B",
    expectUsed: false,
    note: "4 attempts all parse_fail on 0.8B ladder",
  },
  {
    name: "4b-ladder-includes-downgrade",
    mock: "sequence:invalid,invalid,invalid,valid",
    planSize: "4B",
    expectUsed: true,
    expectAttempts: [
      { label: "primary", ok: false, code: "parse_fail" },
      { label: "compact-repair", ok: false, code: "parse_fail" },
      { label: "cpu-compact", ok: false, code: "parse_fail" },
      { label: "downgrade-0.8B", ok: true },
    ],
    expectRepairAttempts: 3,
    note: "primary→compact→cpu→downgrade",
  },
  {
    name: "ram-gate-blocks-retries",
    mock: "sequence:invalid,valid",
    planSize: "0.8B",
    minFreeGb: "99999",
    expectUsed: false,
    expectAttempts: [
      { label: "primary", ok: false, code: "parse_fail" },
      { label: "compact-repair", ok: false, code: "ram_skip" },
    ],
    note: "retry blocked by KCA_LLM_MIN_FREE_GB",
  },
];
