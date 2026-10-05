#!/usr/bin/env node
// Keeps queries/highlights.scm in step with builtin-variables.json.
//
// builtin-variables.json is the one list of the variables ToastStunt predefines
// in every verb (src/sym_table.cc new_builtin_names()). The highlight query
// has to spell the same names out as a regex, so this script rebuilds the two
// predicates from the JSON and fails if the query file does not contain them.
//
// Usage: node scripts/check-builtin-variables.mjs [--print]
//   --print  write the expected predicates to stdout instead of checking.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { caseSensitive, variables } = JSON.parse(readFileSync(resolve(root, "builtin-variables.json"), "utf8"));

const KINDS = ["type", "context", "boolean"];
const failures = [];

if (caseSensitive !== false) {
  failures.push("caseSensitive must be false: find_name() compares with strcasecmp.");
}

const seen = new Set();
variables.forEach((variable, index) => {
  if (variable.slot !== index) {
    failures.push(`${variable.name}: slot ${variable.slot} at position ${index}; slots must be dense and in order.`);
  }
  if (!KINDS.includes(variable.kind)) {
    failures.push(`${variable.name}: unknown kind ${JSON.stringify(variable.kind)}.`);
  }
  const key = variable.name.toLowerCase();
  if (seen.has(key)) {
    failures.push(`${variable.name}: listed twice (names are case-insensitive).`);
  }
  seen.add(key);
});

// web-tree-sitter runs #match? through JavaScript's RegExp and the CLI through
// Rust's regex crate; per-letter classes are the spelling both accept.
const anyCase = (name) => name.replace(/[A-Za-z]/g, (letter) => `[${letter.toUpperCase()}${letter.toLowerCase()}]`);

const predicate = (capture, kinds) => {
  const names = variables.filter((variable) => kinds.includes(variable.kind)).map((variable) => anyCase(variable.name));
  return `((identifier) @${capture}\n  (#match? @${capture} "^(${names.join("|")})$"))`;
};

const expected = [predicate("constant.builtin", ["boolean"]), predicate("variable.builtin", ["type", "context"])];

if (process.argv.includes("--print")) {
  console.log(expected.join("\n\n"));
  process.exit(0);
}

const highlights = readFileSync(resolve(root, "queries/highlights.scm"), "utf8").replace(/\r\n/g, "\n");
for (const block of expected) {
  if (!highlights.includes(block)) {
    failures.push(`queries/highlights.scm is missing this predicate (run with --print to regenerate):\n${block}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`builtin variables: ${variables.length} names, highlights.scm in step.`);
