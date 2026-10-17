import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "./config";

// vitest runs from frontend/
const srcDir = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("config", () => {
  it("is parsed into a complete config", () => {
    expect(config.productName).not.toBe("");
    expect(config.basePath.endsWith("/")).toBe(true);
    expect(["none", "lemonsqueezy", "gumroad"]).toContain(config.unlockProvider);
  });

  it("src/config.ts is the only module that reads import.meta.env", () => {
    const readers = sourceFiles(srcDir)
      .filter((path) => readFileSync(path, "utf8").includes("import.meta.env"))
      .map((path) => relative(srcDir, path));
    expect(readers).toEqual(["config.ts"]);
  });
});
