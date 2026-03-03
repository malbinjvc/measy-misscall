import * as fs from "fs";
import * as path from "path";
import type { FileContent, Finding, ScanRule } from "./types";

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "__tests__",
  ".git",
  "dist",
  "security-agents",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

export function discoverFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }

  const srcDir = path.join(rootDir, "src");
  const prismaDir = path.join(rootDir, "prisma");
  const nextConfig = path.join(rootDir, "next.config.js");
  const nextConfigMjs = path.join(rootDir, "next.config.mjs");

  if (fs.existsSync(srcDir)) walk(srcDir);
  if (fs.existsSync(prismaDir)) walk(prismaDir);
  if (fs.existsSync(nextConfig)) results.push(nextConfig);
  if (fs.existsSync(nextConfigMjs)) results.push(nextConfigMjs);

  return results;
}

export function readFileLines(filePath: string): FileContent {
  const content = fs.readFileSync(filePath, "utf-8");
  return {
    path: filePath,
    lines: content.split("\n"),
  };
}

export function scanWithRules(files: FileContent[], rules: ScanRule[]): Finding[] {
  const findings: Finding[] = [];
  let findingCount = 0;

  for (const file of files) {
    for (const rule of rules) {
      if (rule.fileFilter && !rule.fileFilter(file.path)) continue;

      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i];
        if (rule.pattern.test(line)) {
          // Reset lastIndex for global regexes
          rule.pattern.lastIndex = 0;

          if (rule.contextCheck && !rule.contextCheck(file.lines, i)) continue;

          findingCount++;
          findings.push({
            id: `F-${String(findingCount).padStart(3, "0")}`,
            file: file.path,
            line: i + 1,
            code: line.trim(),
            rule: rule.name,
            severity: rule.severity,
            category: rule.category,
            description: rule.description,
          });
        }
      }
    }
  }

  return findings;
}
