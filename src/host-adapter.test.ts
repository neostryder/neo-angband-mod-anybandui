import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/* Only host-adapter.ts may read the core, the live state, the registries or a
 * raw snapshot. A feature that reads one directly would still work today, and
 * would break silently when the adapter moves to mod API 2. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ADAPTER = join("src", "host-adapter.ts");
const RULES: readonly [string, RegExp][] = [
  ["ctx.core, ctx.state or ctx.registries", /\bctx\??\.(?:core|state|registries)\b/],
  ["a .core member, such as a snapshot's", /\.core\b/],
  ["a direct snapshot or remembered-map call", /\bctx\??\.(?:snapshot|knownLevel)(?:\?\.)?\(/],
  ["the registries", /\bregistries\b/],
];

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

function code(text: string): string[] {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " ")).split("\n").map((line) => line.replace(/\/\/.*$/, ""));
}

describe("host adapter boundary", () => {
  it("keeps every host read inside src/host-adapter.ts", () => {
    const files = ["plugin.ts", ...sources("src")].filter((path) => path !== ADAPTER);
    expect(files.length).toBeGreaterThan(20);
    const found: string[] = [];
    for (const path of files) {
      code(readFileSync(join(ROOT, path), "utf8")).forEach((line, index) => {
        for (const [what, rule] of RULES) if (rule.test(line)) found.push(`${path}:${index + 1} reads ${what}`);
      });
    }
    expect(found).toEqual([]);
  });
});
