import * as path from "path";
import type { ScanRule, AttackReport } from "./shared/types";
import { discoverFiles, readFileLines, scanWithRules } from "./shared/scanner";
import { writeReport } from "./shared/report-writer";

const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(__dirname, "reports");

function isRouteFile(filePath: string): boolean {
  return filePath.includes("/api/") && filePath.includes("route.");
}

function isPublicRoute(filePath: string): boolean {
  return filePath.includes("/api/public/");
}

function linesNearby(lines: string[], index: number, range: number): string {
  const start = Math.max(0, index - range);
  const end = Math.min(lines.length - 1, index + range);
  return lines.slice(start, end + 1).join("\n");
}

const ATTACK_RULES: ScanRule[] = [
  // 1. Raw SQL injection
  {
    id: "ATK-001",
    name: "Raw SQL Query",
    pattern: /\$queryRaw|execute.*\$\{|\$executeRaw/,
    severity: "CRITICAL",
    category: "INJECTION",
    description: "Raw SQL query with potential for injection via string interpolation",
  },
  // 2. Missing auth on route
  {
    id: "ATK-002",
    name: "No Auth Check",
    pattern: /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/,
    severity: "CRITICAL",
    category: "AUTH_BYPASS",
    description: "API route handler without authentication check",
    fileFilter: (f) => isRouteFile(f) && !isPublicRoute(f) && !f.includes("/auth/"),
    contextCheck: (lines) => {
      const content = lines.join("\n");
      return !content.includes("getServerSession") && !content.includes("getToken") &&
             !content.includes("verifyTwilioWebhook") && // Twilio signature verification
             !content.includes("constructEvent") && // Stripe webhook signature verification
             !content.includes("CRON_SECRET"); // Bearer token auth for cron jobs
    },
  },
  // 3. Unvalidated input
  {
    id: "ATK-003",
    name: "Unvalidated Input",
    pattern: /(?:await\s+)?req\.json\(\)|request\.json\(\)/,
    severity: "HIGH",
    category: "MISSING_VALIDATION",
    description: "Request body parsed without schema validation",
    contextCheck: (lines, idx) => {
      const nearby = linesNearby(lines, idx, 10);
      return !nearby.includes(".parse(") && !nearby.includes(".safeParse(");
    },
  },
  // 4. Hardcoded secrets
  {
    id: "ATK-004",
    name: "Hardcoded Secret",
    pattern: /(?:password|secret|apiKey|api_key|token)\s*[:=]\s*['"][^'"$]{4,}['"]/i,
    severity: "CRITICAL",
    category: "DATA_EXPOSURE",
    description: "Hardcoded secret or credential in source code",
    contextCheck: (lines, idx) => {
      const line = lines[idx];
      // Skip type definitions, comments, schema definitions, and env references
      return !line.includes("//") && !line.includes("process.env") &&
             !line.includes("interface ") && !line.includes("type ") &&
             !line.includes(".env") && !line.includes("schema");
    },
  },
  // 5. Missing rate limiting
  {
    id: "ATK-005",
    name: "Missing Rate Limit",
    pattern: /export\s+async\s+function\s+POST/,
    severity: "HIGH",
    category: "RATE_LIMIT",
    description: "Public POST endpoint without rate limiting",
    fileFilter: isPublicRoute,
    contextCheck: (lines) => {
      const content = lines.join("\n");
      return !content.includes("rateLimit") && !content.includes("rateLimiter") &&
             !content.includes("checkRateLimit");
    },
  },
  // 6. Non-atomic operations (TOCTOU)
  {
    id: "ATK-006",
    name: "Non-Atomic Operation",
    pattern: /\.findFirst\(|\.findUnique\(/,
    severity: "HIGH",
    category: "RACE_CONDITION",
    description: "Read-then-write pattern vulnerable to TOCTOU race condition",
    contextCheck: (lines, idx) => {
      // Only check lines AFTER the find (not before) for writes
      const afterLines = lines.slice(idx + 1, Math.min(lines.length, idx + 16)).join("\n");
      const hasWriteAfter = afterLines.includes(".update(") || afterLines.includes(".delete(");
      if (!hasWriteAfter) return false;
      // Check if the find is already inside a $transaction (look at surrounding context)
      const fullContext = linesNearby(lines, idx, 30);
      return !fullContext.includes("$transaction") && !fullContext.includes("updateMany");
    },
  },
  // 7. Unencrypted sensitive data
  {
    id: "ATK-007",
    name: "Unencrypted Secret Storage",
    pattern: /(?:twilioSid|twilioToken|twilioAuthToken|apiSecret)\s*[:=]/i,
    severity: "HIGH",
    category: "DATA_EXPOSURE",
    description: "Sensitive field stored without encryption",
    fileFilter: (f) => !f.endsWith(".tsx") && !f.includes("validations"), // Skip UI components and schema definitions
    contextCheck: (lines, idx) => {
      const nearby = linesNearby(lines, idx, 5);
      const line = lines[idx];
      return !nearby.includes("encrypt(") && !nearby.includes("encrypted") &&
             !nearby.includes("maskSecret") && // Already masked before client exposure
             !line.includes("interface ") && !line.includes("type ") && // TypeScript type declarations
             !line.includes("z.string()") && !line.includes("z.object("); // Zod schema definitions
    },
  },
  // 8. Missing CSRF protection
  {
    id: "ATK-008",
    name: "Missing CSRF Token",
    pattern: /export\s+async\s+function\s+(POST|PUT|DELETE|PATCH)/,
    severity: "MEDIUM",
    category: "CSRF",
    description: "State-changing endpoint without CSRF token verification",
    fileFilter: isRouteFile,
    contextCheck: (lines) => {
      const content = lines.join("\n");
      return !content.includes("csrf") && !content.includes("CSRF") &&
             !content.includes("x-csrf-token") &&
             !content.includes("verifyCsrf") && // Explicit CSRF verification
             !content.includes("getServerSession") && // Session auth with SameSite cookies = CSRF protected
             !content.includes("verifyTwilioWebhook") && // Webhook signature verification
             !content.includes("constructEvent") && // Stripe webhook signature verification
             !content.includes("CRON_SECRET"); // Bearer token auth
    },
  },
  // 9. Open redirect
  {
    id: "ATK-009",
    name: "Open Redirect",
    pattern: /redirect\(.*(?:req\.query|searchParams|url\.searchParams)/,
    severity: "HIGH",
    category: "AUTH_BYPASS",
    description: "Redirect using unvalidated user-supplied URL",
    contextCheck: (lines, idx) => {
      const nearby = linesNearby(lines, idx, 5);
      return !nearby.includes("allowedUrls") && !nearby.includes("startsWith");
    },
  },
  // 10. Path traversal
  {
    id: "ATK-010",
    name: "Path Traversal",
    pattern: /(?:readFile|writeFile|createReadStream|access)\(.*(?:req\.|params\.|query\.)/,
    severity: "HIGH",
    category: "PATH_TRAVERSAL",
    description: "File system operation with user-controlled path component",
    contextCheck: (lines, idx) => {
      const nearby = linesNearby(lines, idx, 5);
      return !nearby.includes("sanitize") && !nearby.includes("replace(/[^a-zA-Z0-9");
    },
  },
  // 11. Weak crypto
  {
    id: "ATK-011",
    name: "Weak Cryptography",
    pattern: /md5|sha1|createHash\(['"]md5['"]\)|createHash\(['"]sha1['"]\)/i,
    severity: "MEDIUM",
    category: "CRYPTO_WEAK",
    description: "Use of weak or deprecated cryptographic hash algorithm",
  },
  // 12. Verbose error responses
  {
    id: "ATK-012",
    name: "Verbose Error Exposure",
    pattern: /error\.message|error\.stack|err\.message|err\.stack/,
    severity: "MEDIUM",
    category: "DATA_EXPOSURE",
    description: "Internal error details exposed in API response",
    fileFilter: isRouteFile,
    contextCheck: (lines, idx) => {
      const line = lines[idx];
      // Only flag if error.message is directly used in a response (not just in console.error or variable assignment)
      const nearby = linesNearby(lines, idx, 3);
      const isInResponse = nearby.includes("NextResponse.json") || nearby.includes("Response.json");
      // Skip console.log/error/warn lines — those are server-side logging, not client exposure
      const isLogging = line.includes("console.") || line.includes("getErrorMessage");
      return isInResponse && !isLogging;
    },
  },
  // 13. Missing Content-Type
  {
    id: "ATK-013",
    name: "Missing Content-Type",
    pattern: /new\s+Response\(/,
    severity: "LOW",
    category: "INSECURE_CONFIG",
    description: "API response without explicit Content-Type header",
    fileFilter: isRouteFile,
    contextCheck: (lines, idx) => {
      const nearby = linesNearby(lines, idx, 3);
      return !nearby.includes("Content-Type") && !nearby.includes("content-type") &&
             !nearby.includes("NextResponse.json");
    },
  },
  // 14. Disabled security controls
  {
    id: "ATK-014",
    name: "Disabled Security Control",
    pattern: /no-verify|dangerouslyAllow|dangerouslySetInnerHTML|unsafe-eval/,
    severity: "HIGH",
    category: "INSECURE_CONFIG",
    description: "Explicitly disabled security control or unsafe configuration",
    contextCheck: (lines, idx) => {
      const line = lines[idx];
      // Skip comments
      return !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*");
    },
  },
  // 15. Unrestricted CORS
  {
    id: "ATK-015",
    name: "Unrestricted CORS",
    pattern: /Access-Control-Allow-Origin.*\*|cors\(\s*\)/,
    severity: "MEDIUM",
    category: "CORS",
    description: "Wildcard CORS policy allows requests from any origin",
  },
];

function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  RED TEAM AGENT - Attack Scan");
  console.log("=".repeat(60) + "\n");

  const files = discoverFiles(ROOT);
  console.log(`Discovered ${files.length} files to scan\n`);

  const fileContents = files.map(readFileLines);
  const findings = scanWithRules(fileContents, ATTACK_RULES);

  // Build summary
  const summary = {
    total: findings.length,
    critical: findings.filter((f) => f.severity === "CRITICAL").length,
    high: findings.filter((f) => f.severity === "HIGH").length,
    medium: findings.filter((f) => f.severity === "MEDIUM").length,
    low: findings.filter((f) => f.severity === "LOW").length,
    categories: {} as Record<string, number>,
  };

  for (const f of findings) {
    summary.categories[f.category] = (summary.categories[f.category] || 0) + 1;
  }

  const report: AttackReport = {
    timestamp: new Date().toISOString(),
    findings,
    summary,
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = writeReport(REPORTS_DIR, `attack-${ts}`, report);

  // Print results
  console.log("FINDINGS:");
  console.log("-".repeat(60));

  if (findings.length === 0) {
    console.log("  No vulnerabilities found. The codebase looks clean!");
  }

  for (const f of findings) {
    const relPath = path.relative(ROOT, f.file);
    const severityColors: Record<string, string> = {
      CRITICAL: "\x1b[31m",
      HIGH: "\x1b[33m",
      MEDIUM: "\x1b[36m",
      LOW: "\x1b[37m",
    };
    const color = severityColors[f.severity] || "\x1b[0m";
    console.log(`  ${color}[${f.severity}]\x1b[0m ${f.rule}`);
    console.log(`    File: ${relPath}:${f.line}`);
    console.log(`    Category: ${f.category}`);
    console.log(`    Code: ${f.code.substring(0, 80)}`);
    console.log();
  }

  console.log("-".repeat(60));
  console.log(`\nSUMMARY: ${summary.total} findings`);
  console.log(`  Critical: ${summary.critical} | High: ${summary.high} | Medium: ${summary.medium} | Low: ${summary.low}`);
  console.log(`\nCategories hit: ${Object.keys(summary.categories).join(", ")}`);
  console.log(`\nReport saved: ${path.relative(ROOT, reportPath)}`);
  console.log();
}

main();
