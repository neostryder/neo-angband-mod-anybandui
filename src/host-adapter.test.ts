import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/* Only the two adapters, host-adapter.ts and host-adapter-api2.ts, may read
 * the core, the live state, the registries, a raw snapshot or the truth
 * domain. A feature that reads one directly would still work today, and would
 * break silently when the features move to mod API 2. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ADAPTERS = new Set([join("src", "host-adapter.ts"), join("src", "host-adapter-api2.ts"), join("src", "bridge.ts")]);
const RULES: readonly [string, RegExp][] = [
  ["ctx.core, ctx.state or ctx.registries", /\bctx!?\??\.(?:core|state|registries)\b/],
  ["a .core member, such as a snapshot's", /\.core\b/],
  ["a direct snapshot or remembered-map call", /\bctx\??\.(?:snapshot|knownLevel)(?:\?\.)?\(/],
  ["the registries", /\bregistries\b/],
  ["the truth domain", /\.truth\b/],
  ["a copy of the snapshot or remembered-map seam", /\b(?:const|let|var)\b[^=]*=\s*(?:\w+\.)*ctx!?\??\.(?:snapshot|knownLevel)\s*(?:[,;]|$)/],
  ["a host member taken apart from ctx", /\{[^}]*\b(?:core|state|snapshot|knownLevel)\b[^}]*\}\s*=\s*(?:\w+\.)*ctx\b/],
  ["a host member read by name", /\bctx!?\??\.?\[\s*["'`](?:core|state|registries|snapshot|knownLevel)["'`]\s*\]/],
];

/** Whether the boundary rules apply to a file: every .ts file except the adapters (the bridge is the one that reads the engine domain) and the tests. */
function checked(path: string): boolean {
  return path.endsWith(".ts") && !path.endsWith(".test.ts") && !ADAPTERS.has(path);
}

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

function code(text: string): string[] {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " ")).split("\n").map((line) => line.replace(/\/\/.*$/, ""));
}

function keyIsTruth(name: ts.PropertyName | ts.BindingName | undefined): boolean {
  return !!name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === "truth";
}

/* The 1-based lines that destructure a truth member: a binding pattern such
 * as `const { truth } = api` or `({ truth }) =>`, or a destructuring
 * assignment such as `({ truth } = api)`. A line regex cannot see these, since
 * the pattern can span lines and the source object can have any name. */
function truthDestructuring(path: string, text: string): number[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const lines: number[] = [];
  const mark = (node: ts.Node): void => { lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1); };
  const assignedPattern = (node: ts.Expression): void => {
    if (!ts.isObjectLiteralExpression(node)) return;
    for (const property of node.properties) {
      if ((ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property)) && keyIsTruth(property.name)) mark(property);
      if (ts.isPropertyAssignment(property)) assignedPattern(property.initializer);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) && keyIsTruth(node.propertyName ?? node.name)) mark(node);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) assignedPattern(node.left);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

/** Every boundary breach in one file's text, as "path:line reads what". */
function breaches(path: string, text: string): string[] {
  const found: string[] = [];
  code(text).forEach((line, index) => {
    for (const [what, rule] of RULES) if (rule.test(line)) found.push(`${path}:${index + 1} reads ${what}`);
  });
  for (const line of truthDestructuring(path, text)) found.push(`${path}:${line} reads the truth domain`);
  return found;
}

describe("host adapter boundary", () => {
  it("keeps every host read inside the adapters", () => {
    const files = ["plugin.ts", ...sources("src")].filter(checked);
    expect(files.length).toBeGreaterThan(20);
    expect(files.flatMap((path) => breaches(path, readFileSync(join(ROOT, path), "utf8")))).toEqual([]);
  });

  it("flags truth member access and destructuring, and exempts the adapters and tests", () => {
    const feature = join("src", "feature.ts");
    expect(breaches(feature, "const level = api.truth.level();")).toEqual([`${feature}:1 reads the truth domain`]);
    expect(breaches(feature, "const level = frame?.truth;")).toEqual([`${feature}:1 reads the truth domain`]);
    expect(breaches(feature, "const { truth } = input;")).toEqual([`${feature}:1 reads the truth domain`]);
    expect(breaches(feature, "const { view, truth: real } = api;")).toEqual([`${feature}:1 reads the truth domain`]);
    expect(breaches(feature, "const {\n  view,\n  truth,\n} = api;")).toEqual([`${feature}:3 reads the truth domain`]);
    expect(breaches(feature, "const { truth: { level } } = api;")).toEqual([`${feature}:1 reads the truth domain`]);
    expect(breaches(feature, "const read = ({ truth }: Frame) => truth;")).toEqual([`${feature}:1 reads the truth domain`]);
    expect(breaches(feature, "let truth; ({ truth } = api);")).toEqual([`${feature}:1 reads the truth domain`]);
    expect(breaches(feature, "const truth = truthLevel(frame);\nconst cell = truth?.get(0);\nconst { x: truthy } = grid;")).toEqual([]);
    expect(checked(feature)).toBe(true);
    expect(checked("plugin.ts")).toBe(true);
    for (const path of [...ADAPTERS, join("src", "host-adapter.test.ts"), join("src", "host-adapter-api2.test.ts"), join("src", "host-adapter-api2.integration.test.ts")]) expect(checked(path)).toBe(false);
    expect(sources("src").filter((path) => !checked(path))).toEqual(expect.arrayContaining([...ADAPTERS]));
  });

  it("catches each kind of read when one is written", () => {
    const sample = code([
      "const a = ctx.state;",
      "const b = ctx!.core;",
      "const read = ctx.snapshot, reply = ctx.prompt;",
      "const { knownLevel } = rt.ctx;",
      "const c = ctx[\"snapshot\"]();",
      "const d = ctx.snapshot?.();",
      "if (!ctx.snapshot) return;",
      "// ctx.state in a comment",
    ].join("\n"));
    const hits = sample.filter((line) => RULES.some(([, rule]) => rule.test(line)));
    expect(hits).toHaveLength(6);
  });
});
