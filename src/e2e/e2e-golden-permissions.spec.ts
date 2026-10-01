import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RULESYNC_PERMISSIONS_RELATIVE_FILE_PATH } from "../constants/rulesync-paths.js";
import { readFileContent, writeFileContent } from "../utils/file.js";
import { CANONICAL_BASH_PERMISSIONS } from "./conformance-bash-policy.js";
import { runGenerate, useTestDirectory } from "./e2e-helper.js";

// Golden files: the full generated output for one canonical source, committed
// under `__golden__/`, so any change to what a target emits shows up as a diff
// in review. Run `pnpm test:e2e -u` to accept a change. A golden only proves
// the output did not change unnoticed; whether the tool reads it as intended
// is the job of the `e2e-conformance-*` specs. Leading dots in golden paths
// become `dot-`, so the repository's ignore rules for tool output do not hide
// the goldens.
const goldenTargets = [
  { target: "claudecode", files: [[".claude", "settings.json"]] },
  { target: "opencode", files: [["opencode.jsonc"]] },
  {
    target: "codexcli",
    files: [
      [".codex", "config.toml"],
      [".codex", "rules", "rulesync.rules"],
    ],
  },
];

describe("E2E golden: permissions", () => {
  const { getTestDir } = useTestDirectory();

  it.each(goldenTargets)(
    "should match the golden output for $target",
    async ({ target, files }) => {
      const testDir = getTestDir();
      await writeFileContent(
        join(testDir, RULESYNC_PERMISSIONS_RELATIVE_FILE_PATH),
        JSON.stringify({ permission: { bash: CANONICAL_BASH_PERMISSIONS } }, null, 2),
      );

      await runGenerate({ target, features: "permissions" });

      for (const segments of files) {
        const content = await readFileContent(join(testDir, ...segments));
        await expect(content).toMatchFileSnapshot(
          join(
            "__golden__",
            "permissions",
            target,
            ...segments.map((s) => s.replace(/^\./, "dot-")),
          ),
        );
      }
    },
  );
});
