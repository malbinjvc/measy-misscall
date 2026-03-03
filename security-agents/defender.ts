import * as path from "path";
import type { DefenseRule, Defense, Prediction, DefenseReport, FileContent } from "./shared/types";
import { CATEGORIES } from "./shared/categories";
import { discoverFiles, readFileLines } from "./shared/scanner";
import { writeReport } from "./shared/report-writer";

const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(__dirname, "reports");

function isRouteFile(filePath: string): boolean {
  return filePath.includes("/api/") && filePath.includes("route.");
}

function isPublicRoute(filePath: string): boolean {
  return filePath.includes("/api/public/");
}

const DEFENSE_RULES: DefenseRule[] = [
  // 1. Auth present
  {
    id: "DEF-001",
    name: "Authentication Check",
    pattern: /getServerSession|getToken|requireAuth/,
    category: "AUTH_BYPASS",
    description: "Authentication check present in API route",
    fileFilter: (f) => isRouteFile(f) && !isPublicRoute(f),
  },
  // 2. Input validation
  {
    id: "DEF-002",
    name: "Input Validation (Zod)",
    pattern: /\.parse\(|\.safeParse\(|z\.object\(/,
    category: "MISSING_VALIDATION",
    description: "Zod schema validation applied to user input",
    fileFilter: isRouteFile,
  },
  // 3. Rate limiting
  {
    id: "DEF-003",
    name: "Rate Limiting",
    pattern: /rateLimit|rateLimiter|RateLimit/,
    category: "RATE_LIMIT",
    description: "Rate limiting applied to endpoint",
    fileFilter: isRouteFile,
  },
  // 4. Encryption at rest
  {
    id: "DEF-004",
    name: "Encryption at Rest",
    pattern: /encrypt\(|encryptField|encrypted/,
    category: "DATA_EXPOSURE",
    description: "Sensitive data encrypted before storage",
  },
  // 5. OTP hashing
  {
    id: "DEF-005",
    name: "OTP Hashing",
    pattern: /hashOtp|bcrypt\.hash.*otp|hashSync.*otp/i,
    category: "CRYPTO_WEAK",
    description: "OTP values hashed before database storage",
  },
  // 6. Atomic operations
  {
    id: "DEF-006",
    name: "Atomic Operations",
    pattern: /\$transaction|\bupdateMany\b|\.atomic/,
    category: "RACE_CONDITION",
    description: "Atomic database operations preventing race conditions",
  },
  // 7. Path sanitization
  {
    id: "DEF-007",
    name: "Path Sanitization",
    pattern: /replace\(\/\[^a-zA-Z0-9|sanitizePath|path\.basename\(/,
    category: "PATH_TRAVERSAL",
    description: "User-supplied paths sanitized before file system access",
  },
  // 8. Security headers
  {
    id: "DEF-008",
    name: "Security Headers",
    pattern: /Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Strict-Transport/,
    category: "INSECURE_CONFIG",
    description: "Security headers configured in application",
  },
  // 9. Password hashing policy
  {
    id: "DEF-009",
    name: "Password Policy",
    pattern: /bcrypt\.hash|hashSync|argon2\.hash/,
    category: "AUTH_BYPASS",
    description: "Passwords hashed with strong algorithm before storage",
  },
  // 10. Secret masking
  {
    id: "DEF-010",
    name: "Secret Masking",
    pattern: /maskSecret|mask\(|\.replace\(.*\*+/,
    category: "DATA_EXPOSURE",
    description: "Sensitive values masked in API responses",
  },
  // 11. File upload validation
  {
    id: "DEF-011",
    name: "File Upload Validation",
    pattern: /magic.*byte|file.*type.*check|allowedTypes|ALLOWED_MIME/i,
    category: "FILE_UPLOAD",
    description: "File uploads validated by type/magic bytes",
  },
  // 12. HTTPS enforcement
  {
    id: "DEF-012",
    name: "HTTPS Enforcement",
    pattern: /Strict-Transport-Security|forceSSL|https.*redirect/i,
    category: "INSECURE_CONFIG",
    description: "HTTPS enforced via HSTS or redirect",
  },
  // 13. Error sanitization
  {
    id: "DEF-013",
    name: "Error Sanitization",
    pattern: /generic.*error|sanitizeError|"Internal server error"|'Internal server error'/i,
    category: "DATA_EXPOSURE",
    description: "Error messages sanitized before client response",
  },
];

function scanDefenses(files: FileContent[]): Defense[] {
  const defenses: Defense[] = [];
  let count = 0;

  for (const file of files) {
    for (const rule of DEFENSE_RULES) {
      if (rule.fileFilter && !rule.fileFilter(file.path)) continue;

      for (let i = 0; i < file.lines.length; i++) {
        if (rule.pattern.test(file.lines[i])) {
          rule.pattern.lastIndex = 0;
          count++;
          defenses.push({
            id: `D-${String(count).padStart(3, "0")}`,
            file: file.path,
            line: i + 1,
            code: file.lines[i].trim(),
            rule: rule.name,
            category: rule.category,
            description: rule.description,
          });
        }
      }
    }
  }

  return defenses;
}

function generatePredictions(defenses: Defense[]): Prediction[] {
  const predictions: Prediction[] = [];
  const defendedCategories = new Set(defenses.map((d) => d.category));
  let count = 0;

  // For each vulnerability category, if we found defenses, predict we're covered
  // If we did NOT find defenses, predict the attacker will find vulnerabilities there
  for (const [catId, cat] of Object.entries(CATEGORIES)) {
    if (defendedCategories.has(catId)) {
      // We have defenses - predict attacker won't find anything here
      count++;
      predictions.push({
        id: `P-${String(count).padStart(3, "0")}`,
        category: catId,
        description: `Defense detected for ${cat.name} - predicting attacker will find this category defended`,
        pattern: `Defenses found: ${defenses.filter((d) => d.category === catId).length} controls`,
        severity: cat.severity,
      });
    } else {
      // No defenses found - predict attacker WILL find vulnerabilities here
      count++;
      predictions.push({
        id: `P-${String(count).padStart(3, "0")}`,
        category: catId,
        description: `No defense for ${cat.name} - predicting attacker will exploit this gap`,
        pattern: "No matching defense controls found",
        severity: cat.severity,
      });
    }
  }

  return predictions;
}

function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  BLUE TEAM AGENT - Defense Scan");
  console.log("=".repeat(60) + "\n");

  const files = discoverFiles(ROOT);
  console.log(`Discovered ${files.length} files to scan\n`);

  const fileContents = files.map(readFileLines);
  const defenses = scanDefenses(fileContents);
  const predictions = generatePredictions(defenses);

  const defendedCategories = Array.from(new Set(defenses.map((d) => d.category)));
  const allCategories = Object.keys(CATEGORIES);
  const uncovered = allCategories.filter((c) => !defendedCategories.includes(c));

  const report: DefenseReport = {
    timestamp: new Date().toISOString(),
    predictions,
    defenses,
    summary: {
      totalDefenses: defenses.length,
      totalPredictions: predictions.length,
      coveredCategories: defendedCategories,
      uncoveredCategories: uncovered,
    },
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = writeReport(REPORTS_DIR, `defense-${ts}`, report);

  // Print results
  console.log("DEFENSES DETECTED:");
  console.log("-".repeat(60));

  for (const d of defenses) {
    const relPath = path.relative(ROOT, d.file);
    console.log(`  \x1b[32m[DEFENDED]\x1b[0m ${d.rule}`);
    console.log(`    File: ${relPath}:${d.line}`);
    console.log(`    Category: ${d.category}`);
    console.log();
  }

  console.log("-".repeat(60));
  console.log("\nPREDICTIONS:");
  console.log("-".repeat(60));

  for (const p of predictions) {
    const icon = p.pattern.includes("No matching") ? "\x1b[31mVULNERABLE" : "\x1b[32mDEFENDED";
    console.log(`  ${icon}\x1b[0m ${p.category}: ${p.description}`);
  }

  console.log("-".repeat(60));
  console.log(`\nSUMMARY:`);
  console.log(`  Defenses found: ${defenses.length}`);
  console.log(`  Categories covered: ${defendedCategories.length}/${allCategories.length}`);
  console.log(`  Covered: ${defendedCategories.join(", ") || "none"}`);
  console.log(`  Uncovered: ${uncovered.join(", ") || "none"}`);
  console.log(`\nReport saved: ${path.relative(ROOT, reportPath)}`);
  console.log();
}

main();
