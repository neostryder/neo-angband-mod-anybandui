/**
 * The plugin ABI, checked at the seam the host calls.
 *
 * The context is a hand-made stand-in for the host's. It carries only the fields
 * this plugin reads, because booting a game to watch a mod log one line would
 * test the host rather than the mod.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import plugin from "./plugin.js";

describe("the AnybandUI plugin", () => {
  it("implements plugin ABI 1", () => {
    expect(plugin.api).toBe(1);
  });

  it("registers without touching the registry host, and says so in the log", () => {
    const logged: string[] = [];
    plugin.register(undefined, { id: "anybandui", engine: "1.18.0", log: (m) => logged.push(m) });
    expect(logged).toEqual(["AnybandUI loaded on engine 1.18.0; no panels are enabled in this version"]);
  });

  it("declares no capabilities while it adds nothing to the screen", () => {
    const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8")) as {
      capabilities: string[];
    };
    expect(manifest.capabilities).toEqual([]);
  });
});
