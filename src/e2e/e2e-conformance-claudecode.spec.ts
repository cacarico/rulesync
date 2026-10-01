import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RULESYNC_PERMISSIONS_RELATIVE_FILE_PATH } from "../constants/rulesync-paths.js";
import { ensureDir, writeFileContent } from "../utils/file.js";
import { CANONICAL_BASH_PERMISSIONS } from "./conformance-bash-policy.js";
import { execFileAsync, runGenerate, useTestDirectory } from "./e2e-helper.js";

// Claude Code has no offline way to ask for a permission decision, but
// `claude doctor` loads the project settings and reports rules it would skip
// or reject. That catches output Claude Code cannot parse, not wrong matching.
// It needs no login or network.
const claudeAvailable = spawnSync("claude", ["--version"], { stdio: "ignore" }).status === 0;

describe.skipIf(!claudeAvailable)("E2E conformance: claudecode settings", () => {
  const { getTestDir } = useTestDirectory();

  it("should generate permissions that claude doctor loads without complaint", async () => {
    const testDir = getTestDir();
    await writeFileContent(
      join(testDir, RULESYNC_PERMISSIONS_RELATIVE_FILE_PATH),
      JSON.stringify({ permission: { bash: CANONICAL_BASH_PERMISSIONS } }, null, 2),
    );

    await runGenerate({ target: "claudecode", features: "permissions" });

    // An empty config dir keeps the runner's own user settings out of the check.
    const configDir = join(testDir, "claude-config");
    await ensureDir(configDir);
    const { stdout } = await execFileAsync("claude", ["doctor"], {
      cwd: testDir,
      env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    });

    // `claude doctor` exits 0 even when settings are invalid, so read its report.
    expect(stdout).not.toContain("Invalid settings");
  });
});
