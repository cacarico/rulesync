import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RULESYNC_PERMISSIONS_RELATIVE_FILE_PATH } from "../constants/rulesync-paths.js";
import { ensureDir, writeFileContent } from "../utils/file.js";
import {
  bashPolicyCommands,
  CANONICAL_BASH_PERMISSIONS,
  type ConformanceDecision,
  expectedBashDecisions,
} from "./conformance-bash-policy.js";
import { execFileAsync, runGenerate, useTestDirectory } from "./e2e-helper.js";

// Asks the real Codex CLI what it decides for each command, instead of
// asserting the shape of the generated rules. A unit test that encodes a wrong
// idea of Codex's matching passes against wrong output; `codex execpolicy
// check` does not. It needs no login or network, so it runs wherever `codex`
// is on PATH and is skipped elsewhere.
const codexAvailable = spawnSync("codex", ["--version"], { stdio: "ignore" }).status === 0;

const CODEX_TO_RULESYNC: Record<string, ConformanceDecision> = {
  allow: "allow",
  prompt: "ask",
  forbidden: "deny",
};

describe.skipIf(!codexAvailable)("E2E conformance: codexcli bash rules", () => {
  const { getTestDir } = useTestDirectory();

  it("should make codex execpolicy decide each command as the policy spec expects", async () => {
    const testDir = getTestDir();
    await writeFileContent(
      join(testDir, RULESYNC_PERMISSIONS_RELATIVE_FILE_PATH),
      JSON.stringify({ permission: { bash: CANONICAL_BASH_PERMISSIONS } }, null, 2),
    );

    await runGenerate({ target: "codexcli", features: "permissions" });

    // An empty CODEX_HOME keeps the runner's own Codex config and rules out of
    // the decision.
    const codexHome = join(testDir, "codex-home");
    await ensureDir(codexHome);
    const rulesPath = join(testDir, ".codex", "rules", "rulesync.rules");

    const actual: Record<string, ConformanceDecision> = {};
    for (const command of bashPolicyCommands()) {
      const { stdout } = await execFileAsync(
        "codex",
        ["execpolicy", "check", "--rules", rulesPath, "--", ...command],
        { env: { ...process.env, CODEX_HOME: codexHome } },
      );
      const result: { decision?: string } = JSON.parse(stdout);
      actual[command.join(" ")] = result.decision
        ? (CODEX_TO_RULESYNC[result.decision] ?? "unmatched")
        : "unmatched";
    }

    expect(actual).toEqual(expectedBashDecisions("codexcli"));
  });
});
