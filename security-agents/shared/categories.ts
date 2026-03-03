export interface VulnerabilityCategory {
  id: string;
  name: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export const CATEGORIES: Record<string, VulnerabilityCategory> = {
  INJECTION: {
    id: "INJECTION",
    name: "SQL/NoSQL Injection",
    description: "Raw queries with unsanitized user input",
    severity: "CRITICAL",
  },
  AUTH_BYPASS: {
    id: "AUTH_BYPASS",
    name: "Authentication Bypass",
    description: "Missing or weak authentication checks on protected routes",
    severity: "CRITICAL",
  },
  CRYPTO_WEAK: {
    id: "CRYPTO_WEAK",
    name: "Weak Cryptography",
    description: "Use of deprecated or weak hash algorithms",
    severity: "MEDIUM",
  },
  RACE_CONDITION: {
    id: "RACE_CONDITION",
    name: "Race Condition / TOCTOU",
    description: "Non-atomic read-then-write patterns vulnerable to race conditions",
    severity: "HIGH",
  },
  DATA_EXPOSURE: {
    id: "DATA_EXPOSURE",
    name: "Sensitive Data Exposure",
    description: "Secrets, error details, or sensitive data leaked in responses",
    severity: "HIGH",
  },
  MISSING_VALIDATION: {
    id: "MISSING_VALIDATION",
    name: "Missing Input Validation",
    description: "User input accepted without schema validation",
    severity: "HIGH",
  },
  INSECURE_CONFIG: {
    id: "INSECURE_CONFIG",
    name: "Insecure Configuration",
    description: "Disabled security features or unsafe configuration flags",
    severity: "HIGH",
  },
  FILE_UPLOAD: {
    id: "FILE_UPLOAD",
    name: "Insecure File Upload",
    description: "File uploads without proper type/size validation",
    severity: "HIGH",
  },
  RATE_LIMIT: {
    id: "RATE_LIMIT",
    name: "Missing Rate Limiting",
    description: "Public endpoints without rate limiting protections",
    severity: "HIGH",
  },
  XSS: {
    id: "XSS",
    name: "Cross-Site Scripting",
    description: "Unsanitized user input rendered in HTML context",
    severity: "HIGH",
  },
  IDOR: {
    id: "IDOR",
    name: "Insecure Direct Object Reference",
    description: "Direct access to resources without ownership verification",
    severity: "HIGH",
  },
  SSRF: {
    id: "SSRF",
    name: "Server-Side Request Forgery",
    description: "User-controlled URLs used in server-side HTTP requests",
    severity: "HIGH",
  },
  PATH_TRAVERSAL: {
    id: "PATH_TRAVERSAL",
    name: "Path Traversal",
    description: "File system access with user-controlled path components",
    severity: "HIGH",
  },
  CORS: {
    id: "CORS",
    name: "Unrestricted CORS",
    description: "Wildcard or overly permissive CORS configuration",
    severity: "MEDIUM",
  },
  CSRF: {
    id: "CSRF",
    name: "Cross-Site Request Forgery",
    description: "State-changing operations without CSRF token verification",
    severity: "MEDIUM",
  },
};
