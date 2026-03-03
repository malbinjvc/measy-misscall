import * as path from "path";
import type { AttackReport, DefenseReport, BattleResult, Scores, Finding, Prediction } from "./shared/types";
import { readLatestReport, readReport, writeReport } from "./shared/report-writer";

const REPORTS_DIR = path.join(__dirname, "reports");
const SCORES_PATH = path.join(REPORTS_DIR, "scores.json");
const WIN_SCORE = 10;

function loadScores(): Scores {
  const existing = readReport<Scores>(SCORES_PATH);
  if (existing) return existing;
  return { attacker: 0, defender: 0, rounds: 0, history: [] };
}

function matchFindings(
  findings: Finding[],
  predictions: Prediction[]
): { matched: { finding: Finding; prediction: Prediction }[]; missed: Finding[] } {
  const matched: { finding: Finding; prediction: Prediction }[] = [];
  const missed: Finding[] = [];

  // Deduplicate findings by category for scoring purposes
  const seenCategories = new Set<string>();
  const uniqueFindings: Finding[] = [];
  for (const f of findings) {
    if (!seenCategories.has(f.category)) {
      seenCategories.add(f.category);
      uniqueFindings.push(f);
    }
  }

  for (const finding of uniqueFindings) {
    const matchingPrediction = predictions.find((p) => p.category === finding.category);
    if (matchingPrediction) {
      matched.push({ finding, prediction: matchingPrediction });
    } else {
      missed.push(finding);
    }
  }

  return { matched, missed };
}

function printBanner(winner?: "RedTeam" | "BlueTeam") {
  if (winner === "RedTeam") {
    console.log(`
\x1b[31m
    ____           _   _____
   |  _ \\ ___  __| | |_   _|__  __ _ _ __ ___
   | |_) / _ \\/ _\` |   | |/ _ \\/ _\` | '_ \` _ \\
   |  _ <  __/ (_| |   | |  __/ (_| | | | | | |
   |_| \\_\\___|\\__,_|   |_|\\___|\\__,_|_| |_| |_|

              W I N S !
   BlueTeam has been eliminated.
\x1b[0m`);
  } else if (winner === "BlueTeam") {
    console.log(`
\x1b[34m
    ____  _          _____
   | __ )| |_   _   |_   _|__  __ _ _ __ ___
   |  _ \\| | | | |    | |/ _ \\/ _\` | '_ \` _ \\
   | |_) | | |_| |    | |  __/ (_| | | | | | |
   |____/|_|\\__,_|    |_|\\___|\\__,_|_| |_| |_|

              W I N S !
   RedTeam has been eliminated.
\x1b[0m`);
  }
}

function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  BATTLE ENGINE - RedTeam vs BlueTeam");
  console.log("=".repeat(60) + "\n");

  // Load reports
  const attackReport = readLatestReport<AttackReport>(REPORTS_DIR, "attack-");
  const defenseReport = readLatestReport<DefenseReport>(REPORTS_DIR, "defense-");

  if (!attackReport) {
    console.error("No attack report found. Run 'npm run security:attack' first.");
    process.exit(1);
  }
  if (!defenseReport) {
    console.error("No defense report found. Run 'npm run security:defend' first.");
    process.exit(1);
  }

  // Load cumulative scores
  const scores = loadScores();
  scores.rounds++;

  // Match findings against predictions
  const { matched, missed } = matchFindings(attackReport.findings, defenseReport.predictions);

  // Calculate round delta
  let attackerDelta = 0;
  let defenderDelta = 0;

  // Defender gets +1 for each correctly predicted category
  defenderDelta += matched.length;

  // Attacker gets +1 for each missed finding, defender gets -2
  attackerDelta += missed.length;
  defenderDelta -= missed.length * 2;

  // Update cumulative scores
  scores.attacker += attackerDelta;
  scores.defender += defenderDelta;

  // Don't go below 0
  if (scores.defender < 0) scores.defender = 0;
  if (scores.attacker < 0) scores.attacker = 0;

  scores.history.push({
    round: scores.rounds,
    attackerDelta,
    defenderDelta,
  });

  // Check winner
  let winner: "RedTeam" | "BlueTeam" | undefined;
  if (scores.attacker >= WIN_SCORE) winner = "RedTeam";
  if (scores.defender >= WIN_SCORE) winner = "BlueTeam";

  // Build battle result
  const battleResult: BattleResult = {
    round: scores.rounds,
    timestamp: new Date().toISOString(),
    attackFindings: attackReport.findings,
    defenderPredictions: defenseReport.predictions,
    matched,
    missed,
    scores: { attacker: scores.attacker, defender: scores.defender },
    winner,
  };

  // Save reports
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  writeReport(REPORTS_DIR, `battle-${ts}`, battleResult);
  writeReport(REPORTS_DIR, "scores", scores);

  // Print battle summary
  console.log(`ROUND ${scores.rounds}`);
  console.log("-".repeat(60));
  console.log(`  Attack findings: ${attackReport.findings.length} total (${new Set(attackReport.findings.map((f) => f.category)).size} unique categories)`);
  console.log(`  Defender predictions: ${defenseReport.predictions.length}`);
  console.log();

  console.log("MATCHED (Defender predicted correctly):");
  if (matched.length === 0) {
    console.log("  None - Defender failed to predict any attacks!");
  }
  for (const m of matched) {
    console.log(`  \x1b[32m+1 DEF\x1b[0m ${m.finding.category}: ${m.finding.rule} -> ${m.prediction.description.substring(0, 60)}`);
  }
  console.log();

  console.log("MISSED (Attacker found undefended vulnerabilities):");
  if (missed.length === 0) {
    console.log("  None - Defender predicted all attacks!");
  }
  for (const m of missed) {
    console.log(`  \x1b[31m+1 ATK / -2 DEF\x1b[0m ${m.category}: ${m.rule}`);
  }
  console.log();

  console.log("-".repeat(60));
  console.log(`  Round delta:  Attacker ${attackerDelta >= 0 ? "+" : ""}${attackerDelta}  |  Defender ${defenderDelta >= 0 ? "+" : ""}${defenderDelta}`);
  console.log();

  // Scoreboard
  const maxScore = Math.max(scores.attacker, scores.defender, WIN_SCORE);
  const atkBar = "\x1b[31m" + "#".repeat(Math.round((scores.attacker / maxScore) * 30)) + "\x1b[0m";
  const defBar = "\x1b[34m" + "#".repeat(Math.round((scores.defender / maxScore) * 30)) + "\x1b[0m";

  console.log("SCOREBOARD:");
  console.log(`  RedTeam  [${atkBar}] ${scores.attacker}/${WIN_SCORE}`);
  console.log(`  BlueTeam [${defBar}] ${scores.defender}/${WIN_SCORE}`);
  console.log();

  if (winner) {
    printBanner(winner);
    // Reset scores after a win
    const resetScores: Scores = { attacker: 0, defender: 0, rounds: 0, history: [] };
    writeReport(REPORTS_DIR, "scores", resetScores);
    console.log("Scores have been reset for a new battle!\n");
  } else {
    const atkToWin = WIN_SCORE - scores.attacker;
    const defToWin = WIN_SCORE - scores.defender;
    console.log(`  RedTeam needs ${atkToWin} more points to win`);
    console.log(`  BlueTeam needs ${defToWin} more points to win`);
    console.log();
  }
}

main();
