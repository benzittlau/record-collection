import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Keep the validation pipeline readable, fail fast, and check every browser
// module automatically as new responsibilities move out of the entry point.
const browserModules = readdirSync(new URL("../src/", import.meta.url))
  .filter((file) => file.endsWith(".js"))
  .sort();
const commands = [
  ["scripts/build.mjs"],
  [
    "--test",
    ...readdirSync(new URL("./", import.meta.url))
      .filter(
        (file) =>
          /^test-.*\.mjs$/.test(file) && !file.startsWith("test-spotify-"),
      )
      .sort()
      .map((file) => `scripts/${file}`),
  ],
  ...browserModules.map((file) => ["--check", `src/${file}`]),
  ...[
    "test-spotify-config",
    "test-spotify-session",
    "test-spotify-player",
    "validate-catalog",
    "validate-projection",
    "validate-spine-masks",
    "validate-capture-plan",
    "validate-deep-audit",
    "validate-spotify-links",
    "validate-capture-intake",
  ].map((name) => [`scripts/${name}.mjs`]),
];
for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: new URL("../", import.meta.url),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
