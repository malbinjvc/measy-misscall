export interface Finding {
  id: string;
  file: string;
  line: number;
  code: string;
  rule: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  description: string;
}

export interface Prediction {
  id: string;
  category: string;
  description: string;
  pattern: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface Defense {
  id: string;
  file: string;
  line: number;
  code: string;
  rule: string;
  category: string;
  description: string;
}

export interface AttackReport {
  timestamp: string;
  findings: Finding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    categories: Record<string, number>;
  };
}

export interface DefenseReport {
  timestamp: string;
  predictions: Prediction[];
  defenses: Defense[];
  summary: {
    totalDefenses: number;
    totalPredictions: number;
    coveredCategories: string[];
    uncoveredCategories: string[];
  };
}

export interface BattleResult {
  round: number;
  timestamp: string;
  attackFindings: Finding[];
  defenderPredictions: Prediction[];
  matched: { finding: Finding; prediction: Prediction }[];
  missed: Finding[];
  scores: { attacker: number; defender: number };
  winner?: "RedTeam" | "BlueTeam";
}

export interface Scores {
  attacker: number;
  defender: number;
  rounds: number;
  history: { round: number; attackerDelta: number; defenderDelta: number }[];
}

export interface ScanRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  description: string;
  fileFilter?: (filePath: string) => boolean;
  contextCheck?: (lines: string[], lineIndex: number) => boolean;
}

export interface DefenseRule {
  id: string;
  name: string;
  pattern: RegExp;
  category: string;
  description: string;
  fileFilter?: (filePath: string) => boolean;
}

export interface FileContent {
  path: string;
  lines: string[];
}
