/**
 * A shared policy spec for conformance tests: one canonical `permission.bash`
 * block, and the decision each command should get once a harness loads the
 * generated config.
 *
 * Expectations are written in rulesync's own terms (`allow`/`ask`/`deny`).
 * When a harness legitimately decides differently, the case carries an
 * override with the reason, so the difference is reviewed once instead of
 * being re-derived in every test. `unmatched` means no generated rule applies
 * and the harness falls back to its own default.
 */

export type ConformanceDecision = "allow" | "ask" | "deny" | "unmatched";

type ConformanceHarness = "codexcli";

type BashPolicyCase = {
  command: string[];
  expected: ConformanceDecision;
  overrides?: Partial<
    Record<ConformanceHarness, { expected: ConformanceDecision; reason: string }>
  >;
};

export const CANONICAL_BASH_PERMISSIONS = {
  "*": "ask",
  "git status": "allow",
  "git diff *": "allow",
  "npm publish": "ask",
  "sudo *": "deny",
  "rm -rf *": "deny",
} as const;

const BASH_POLICY_CASES: BashPolicyCase[] = [
  { command: ["sudo", "pacman", "-S", "foo"], expected: "deny" },
  { command: ["sudo"], expected: "deny" },
  { command: ["rm", "-rf", "/tmp/x"], expected: "deny" },
  { command: ["git", "status"], expected: "allow" },
  {
    command: ["git", "status", "--short"],
    expected: "ask",
    overrides: {
      codexcli: {
        expected: "allow",
        reason: "Codex rules are prefix matches, so `git status` also covers its arguments.",
      },
    },
  },
  { command: ["git", "diff", "HEAD"], expected: "allow" },
  { command: ["npm", "publish"], expected: "ask" },
  {
    command: ["ls", "-la"],
    expected: "ask",
    overrides: {
      codexcli: {
        expected: "unmatched",
        reason: "Codex has no catch-all prefix rule; `approval_policy` decides instead.",
      },
    },
  },
];

/**
 * Returns `{ "<command>": decision }` for one harness, with its overrides
 * applied, so a test can compare the whole table in a single assertion.
 */
export function expectedBashDecisions(harness: ConformanceHarness): Record<string, string> {
  return Object.fromEntries(
    BASH_POLICY_CASES.map((c) => [
      c.command.join(" "),
      c.overrides?.[harness]?.expected ?? c.expected,
    ]),
  );
}

export function bashPolicyCommands(): string[][] {
  return BASH_POLICY_CASES.map((c) => c.command);
}
