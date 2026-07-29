#!/usr/bin/env node
// Cross-references requirement IDs declared in .kiro/specs/*/requirements.md
// against "Requirement: <ID>" tags found in test files, per the traceability
// convention in .kiro/steering/project-standards.md. Flags requirements with
// no test coverage and test tags that don't match any known requirement.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, matcher, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next" || entry === "dist") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, matcher, results);
    } else if (matcher(entry)) {
      results.push(full);
    }
  }
  return results;
}

function extractRequirementsFromSpec(text) {
  const ids = new Set();

  // Table rows: | D-0001 | ... |  or  | AC-SP0-001 | ... |
  for (const match of text.matchAll(/^\|\s*([A-Z]+-[A-Z0-9-]+)\s*\|/gm)) {
    ids.add(match[1]);
  }

  // Story headers with numbered acceptance criteria:
  // ### US-0006 — Title
  // **Acceptance Criteria:**
  // 1. ...
  // 2. ...
  const storyBlocks = text.split(/^### /m).slice(1);
  for (const block of storyBlocks) {
    const idMatch = block.match(/^([A-Z]+-\d+)/);
    if (!idMatch) continue;
    const storyId = idMatch[1];
    ids.add(storyId);

    const acSection = block.split(/\*\*Acceptance Criteria:\*\*/)[1];
    if (!acSection) continue;
    const acLines = acSection.split(/^###/m)[0];
    const acCount = [...acLines.matchAll(/^\d+\./gm)].length;
    for (let i = 1; i <= acCount; i++) {
      ids.add(`${storyId} AC${i}`);
    }
  }

  return ids;
}

function extractRequirementTagsFromTests(text) {
  const tags = new Set();
  for (const match of text.matchAll(/Requirement:\s*([A-Z]+-[A-Z0-9-]+(?:\s+AC\d+)?)/g)) {
    tags.add(match[1].trim());
  }
  return tags;
}

const specFiles = walk(path.join(ROOT, ".kiro", "specs"), (name) => name === "requirements.md");
const testFiles = walk(ROOT, (name) => /\.test\.[jt]sx?$/.test(name));

const knownRequirements = new Set();
for (const file of specFiles) {
  const text = readFileSync(file, "utf8");
  for (const id of extractRequirementsFromSpec(text)) knownRequirements.add(id);
}

const referencedRequirements = new Map(); // id -> [test files]
for (const file of testFiles) {
  const text = readFileSync(file, "utf8");
  for (const tag of extractRequirementTagsFromTests(text)) {
    const rel = path.relative(ROOT, file);
    if (!referencedRequirements.has(tag)) referencedRequirements.set(tag, []);
    referencedRequirements.get(tag).push(rel);
  }
}

const covered = [...knownRequirements].filter((id) => referencedRequirements.has(id)).sort();
const untested = [...knownRequirements].filter((id) => !referencedRequirements.has(id)).sort();
const dangling = [...referencedRequirements.keys()].filter((id) => !knownRequirements.has(id)).sort();

const report = {
  generatedAt: new Date().toISOString(),
  specFiles: specFiles.map((f) => path.relative(ROOT, f)),
  testFiles: testFiles.map((f) => path.relative(ROOT, f)),
  totals: {
    knownRequirements: knownRequirements.size,
    covered: covered.length,
    untested: untested.length,
    dangling: dangling.length,
  },
  covered: covered.map((id) => ({ id, testFiles: referencedRequirements.get(id) })),
  untested,
  dangling: dangling.map((id) => ({ id, testFiles: referencedRequirements.get(id) })),
};

writeFileSync(path.join(ROOT, "traceability-report.json"), JSON.stringify(report, null, 2));

const md = [
  "# Traceability Report",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  `- Known requirements: ${report.totals.knownRequirements}`,
  `- Covered by at least one test: ${report.totals.covered}`,
  `- Untested: ${report.totals.untested}`,
  `- Dangling test tags (no matching requirement): ${report.totals.dangling}`,
  "",
  "## Untested requirements",
  untested.length ? untested.map((id) => `- ${id}`).join("\n") : "None.",
  "",
  "## Dangling test tags",
  dangling.length
    ? dangling.map((d) => `- ${d.id} (${d.testFiles.join(", ")})`).join("\n")
    : "None.",
].join("\n");

writeFileSync(path.join(ROOT, "traceability-report.md"), md);

console.log(md);

if (dangling.length > 0) {
  console.error("\nFAIL: one or more test tags reference an unknown requirement ID.");
  process.exit(1);
}
