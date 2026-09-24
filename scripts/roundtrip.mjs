#!/usr/bin/env node
// Structural oracle for the grammar, driven by real MOO code.
//
// MOO servers store verb source as the output of ToastStunt's unparser
// (src/unparse.cc), called with fully_parenthesize=1 and no indentation. That
// text is a canonical rendering of the server's own AST. For every file:
//
//   1. parse it, re-render the tree with the same rules, and require the
//      original text back (checks tree shape: every token lands in the node
//      the server would have put it in);
//   2. render the tree again with minimal parentheses (fully_parenthesize=0,
//      using the server's precedence table), parse THAT, render fully
//      parenthesized, and require the original text again (checks that our
//      operator precedence and associativity agree with the server's).
//
// Usage: node scripts/roundtrip.mjs <dir-or-file>... [--show N] [--only-step1]
// Input is never copied anywhere; failures print only a short excerpt.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser } from "web-tree-sitter";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// unparse.cc prec_table. Kinds missing from the table (maps, scatters) are 0.
const PREC = {
  assign: 1,
  cond: 2,
  "||": 3,
  "&&": 3,
  "==": 4,
  "!=": 4,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  in: 4,
  "|.": 5,
  "&.": 5,
  "^.": 5,
  "<<": 6,
  ">>": 6,
  "+": 7,
  "-": 7,
  "*": 8,
  "/": 8,
  "%": 8,
  "^": 9,
  unary: 10,
  postfix: 11,
  atom: 12,
  map: 0,
};

// keywords.gperf; ok_identifier() refuses these as bare property/verb names.
const KEYWORDS = new Set(
  (
    "if else elseif endif for in endfor fork endfork return while endwhile try except finally endtry any " +
    "break continue e_none e_type e_div e_perm e_propnf e_verbnf e_varnf e_invind e_recmove e_maxrec " +
    "e_range e_args e_nacc e_invarg e_quota e_float e_file e_exec e_intrpt"
  ).split(" "),
);

const okIdentifier = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !KEYWORDS.has(s.toLowerCase());

class UnparseError extends Error {}

function named(node) {
  return node.namedChildren.filter((c) => c.type !== "comment");
}

function unwrap(node) {
  while (node.type === "parenthesized_expression") node = named(node)[0];
  return node;
}

// Toast folds `-<number literal>` into a negative literal at parse time.
function foldedLiteral(node) {
  node = unwrap(node);
  if (node.type === "integer" || node.type === "float") return node.text;
  if (node.type === "unary_expression" && node.childForFieldName("operator").text === "-") {
    const inner = foldedLiteral(node.childForFieldName("argument"));
    if (inner !== null) return inner.startsWith("-") ? inner.slice(1) : `-${inner}`;
  }
  return null;
}

function precOf(node) {
  node = unwrap(node);
  switch (node.type) {
    case "assignment_expression":
    case "scatter_assignment":
      return PREC.assign;
    case "ternary_expression":
      return PREC.cond;
    case "binary_expression":
      return PREC[node.childForFieldName("operator").text.toLowerCase()];
    case "unary_expression":
      return foldedLiteral(node) !== null ? PREC.atom : PREC.unary;
    case "property_expression":
    case "waif_property_expression":
    case "index_expression":
    case "range_expression":
    case "verb_call_expression":
    case "dollar_property":
    case "dollar_verb_call":
      return PREC.postfix;
    case "map":
      return PREC.map;
    default:
      return PREC.atom;
  }
}

function makeUnparser(fully) {
  const needParens = (parentPrec, child, inclusive) => {
    const p = precOf(child);
    return (fully && p < PREC.postfix) || (inclusive ? parentPrec >= p : parentPrec > p);
  };
  const bracket = (parentPrec, child, inclusive) =>
    needParens(parentPrec, child, inclusive) ? `(${expr(child)})` : expr(child);
  const lt = (p, c) => bracket(p, c, false);
  const le = (p, c) => bracket(p, c, true);

  const args = (nodes) =>
    nodes.map((n) => (n.type === "splice" ? `@${expr(n.childForFieldName("value"))}` : expr(n))).join(", ");

  const nameExpr = (node) => {
    if (node.type === "identifier") return node.text;
    const inner = unwrap(node);
    if (inner.type === "string") {
      // MOO strings: a backslash escapes whatever character follows it.
      const value = inner.text.slice(1, -1).replace(/\\(.)/g, "$1");
      if (okIdentifier(value)) return value;
    }
    return `(${expr(inner)})`;
  };

  const isSysObj = (node) => {
    const inner = unwrap(node);
    return inner.type === "object" && /^#0+$/.test(inner.text);
  };

  function expr(node) {
    const folded = foldedLiteral(node);
    if (folded !== null) return folded;
    node = unwrap(node);
    const f = (name) => node.childForFieldName(name);
    switch (node.type) {
      case "identifier":
      case "string":
      case "object":
      case "error_code":
        return node.text;
      case "first_index":
        return "^";
      case "last_index":
        return "$";
      case "assignment_expression":
        return `${expr(f("left"))} = ${expr(f("right"))}`;
      case "scatter_assignment": {
        const items = named(node)
          .filter((c) => c.type === "scatter_item")
          .map((item) => {
            const name = item.childForFieldName("name").text;
            const first = item.child(0).type;
            if (first === "@") return `@${name}`;
            if (first === "?") {
              const def = item.childForFieldName("default");
              return def ? `?${name} = ${expr(def)}` : `?${name}`;
            }
            return name;
          });
        return `{${items.join(", ")}} = ${expr(f("right"))}`;
      }
      case "ternary_expression":
        return `${le(PREC.cond, f("condition"))} ? ${expr(f("consequent"))} | ${le(PREC.cond, f("alternate"))}`;
      case "binary_expression": {
        const op = f("operator").text.toLowerCase();
        const p = PREC[op];
        if (op === "^") return `${le(p, f("left"))} ^ ${lt(p, f("right"))}`;
        return `${lt(p, f("left"))} ${op} ${le(p, f("right"))}`;
      }
      case "unary_expression":
        return `${f("operator").text}${lt(PREC.unary, f("argument"))}`;
      case "dollar_property":
        return `$${f("property").text}`;
      case "dollar_verb_call":
        return `$${f("verb").text}(${args(named(f("arguments")))})`;
      case "property_expression": {
        const obj = f("object");
        const name = nameExpr(f("property"));
        if (isSysObj(obj) && okIdentifier(name)) return `$${name}`;
        const space = unwrap(obj).type === "integer" ? " " : "";
        return `${lt(PREC.postfix, obj)}${space}.${name}`;
      }
      case "waif_property_expression":
        return `${lt(PREC.postfix, f("object"))}.(":${f("property").text}")`;
      case "verb_call_expression": {
        const obj = f("object");
        const name = nameExpr(f("verb"));
        const a = `(${args(named(f("arguments")))})`;
        if (isSysObj(obj) && okIdentifier(name)) return `$${name}${a}`;
        return `${lt(PREC.postfix, obj)}:${name}${a}`;
      }
      case "index_expression":
        return `${lt(PREC.postfix, f("object"))}[${expr(f("index"))}]`;
      case "range_expression":
        return `${lt(PREC.postfix, f("object"))}[${expr(f("start"))}..${expr(f("end"))}]`;
      case "function_call":
        return `${f("function").text}(${args(named(f("arguments")))})`;
      case "list":
        return `{${args(named(node))}}`;
      case "map":
        return `[${named(node)
          .map((e) => `${expr(e.childForFieldName("key"))} -> ${expr(e.childForFieldName("value"))}`)
          .join(", ")}]`;
      case "catch_expression": {
        const def = f("default");
        return `\`${expr(f("body"))} ! ${codes(f("codes"))}${def ? ` => ${expr(def)}` : ""}'`;
      }
      default:
        throw new UnparseError(`unhandled expression node ${node.type}`);
    }
  }

  const codes = (node) => {
    const items = named(node);
    return items.length === 0 ? "ANY" : args(items);
  };

  const body = (node, field = "body") => node.childrenForFieldName(field).filter((c) => c.type === "statement");

  function statements(nodes, out) {
    for (const s of nodes) statement(s.type === "statement" ? named(s)[0] : s, out);
  }

  function statement(node, out) {
    const f = (n, name) => n.childForFieldName(name);
    const cond = (clause) => expr(named(f(clause, "condition"))[0]);
    switch (node.type) {
      case "single_statement": {
        const inner = named(node)[0];
        if (!inner) return; // a lone `;` compiles to nothing
        if (inner.type === "return_statement") {
          const v = f(inner, "value");
          out.push(v ? `return ${expr(v)};` : "return;");
        } else if (inner.type === "break_statement" || inner.type === "continue_statement") {
          const kw = inner.type === "break_statement" ? "break" : "continue";
          const label = f(inner, "label");
          out.push(label ? `${kw} ${label.text};` : `${kw};`);
        } else {
          out.push(`${expr(inner)};`);
        }
        return;
      }
      case "if_statement":
        for (const clause of named(node)) {
          if (clause.type === "if_clause") out.push(`if (${cond(clause)})`);
          else if (clause.type === "elseif_clause") out.push(`elseif (${cond(clause)})`);
          else out.push("else");
          statements(body(clause), out);
        }
        out.push("endif");
        return;
      case "for_statement": {
        const c = named(node)[0];
        const value = f(c, "value").text;
        const index = f(c, "index");
        if (f(c, "iterable")) {
          out.push(`for ${value}${index ? `, ${index.text}` : ""} in (${expr(f(c, "iterable"))})`);
        } else {
          out.push(`for ${value} in [${expr(f(c, "start"))}..${expr(f(c, "end"))}]`);
        }
        statements(body(node), out);
        out.push("endfor");
        return;
      }
      case "while_statement": {
        const c = named(node)[0];
        const label = f(c, "label");
        out.push(`while ${label ? `${label.text} ` : ""}(${cond(c)})`);
        statements(body(node), out);
        out.push("endwhile");
        return;
      }
      case "fork_statement": {
        const c = named(node)[0];
        const task = f(c, "task");
        out.push(`fork ${task ? `${task.text} ` : ""}(${expr(f(c, "delay"))})`);
        statements(body(node), out);
        out.push("endfork");
        return;
      }
      case "try_except_statement":
        out.push("try");
        statements(body(node), out);
        for (const ex of named(node).filter((c) => c.type === "except_statement")) {
          const c = named(ex)[0];
          const name = f(c, "name");
          out.push(`except ${name ? `${name.text} ` : ""}(${codes(f(c, "codes"))})`);
          statements(body(ex), out);
        }
        out.push("endtry");
        return;
      case "try_finally_statement": {
        out.push("try");
        statements(body(node), out);
        out.push("finally");
        statements(body(named(node).find((c) => c.type === "finally_statement")), out);
        out.push("endtry");
        return;
      }
      default:
        throw new UnparseError(`unhandled statement node ${node.type}`);
    }
  }

  return (tree) => {
    const out = [];
    statements(named(tree.rootNode), out);
    return out;
  };
}

function collect(paths) {
  const files = [];
  const walk = (p) => {
    if (statSync(p).isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
    else if (p.endsWith(".moo")) files.push(p);
  };
  paths.forEach(walk);
  return files.sort();
}

function firstDiff(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
  return -1;
}

const clip = (s) => (s === undefined ? "<none>" : s.length > 160 ? `${s.slice(0, 160)}…` : s);

async function main() {
  const argv = process.argv.slice(2);
  const showIdx = argv.indexOf("--show");
  const show = showIdx >= 0 ? Number(argv.splice(showIdx, 2)[1]) : 20;
  const onlyStep1 = argv.includes("--only-step1");
  const paths = argv.filter((a) => !a.startsWith("--"));
  if (paths.length === 0) {
    console.error("usage: node scripts/roundtrip.mjs <dir-or-file>... [--show N] [--only-step1]");
    process.exit(2);
  }

  await Parser.init();
  const parser = new Parser();
  parser.setLanguage(await Language.load(join(root, "tree-sitter-moocode.wasm")));
  const full = makeUnparser(true);
  const minimal = makeUnparser(false);

  const counts = { files: 0, ok: 0, parseError: 0, shape: 0, precedence: 0, unparse: 0 };
  const failures = [];

  for (const file of collect(paths)) {
    counts.files++;
    const source = readFileSync(file, "utf8");
    const original = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
    const tree = parser.parse(source);
    try {
      if (tree.rootNode.hasError) {
        counts.parseError++;
        failures.push({ file, kind: "parse-error" });
        continue;
      }
      const step1 = full(tree);
      const d1 = firstDiff(original, step1);
      if (d1 >= 0) {
        counts.shape++;
        failures.push({ file, kind: "shape", line: d1, want: original[d1], got: step1[d1] });
        continue;
      }
      if (!onlyStep1) {
        const min = minimal(tree).join("\n");
        const tree2 = parser.parse(min);
        const step2 = tree2.rootNode.hasError ? null : full(tree2);
        tree2.delete();
        const d2 = step2 ? firstDiff(original, step2) : 0;
        if (d2 >= 0) {
          counts.precedence++;
          failures.push({
            file,
            kind: "precedence",
            line: d2,
            want: original[d2],
            got: step2 ? step2[d2] : "<minimal text did not parse>",
            minimal: min.split("\n")[d2],
          });
          continue;
        }
      }
      counts.ok++;
    } catch (err) {
      if (!(err instanceof UnparseError)) throw err;
      counts.unparse++;
      failures.push({ file, kind: "unparse", want: err.message });
    } finally {
      tree.delete();
    }
  }

  for (const f of failures.slice(0, show)) {
    console.log(`\n[${f.kind}] ${f.file}${f.line !== undefined ? ` line ${f.line + 1}` : ""}`);
    if (f.want !== undefined) console.log(`  want: ${clip(f.want)}`);
    if (f.got !== undefined) console.log(`  got:  ${clip(f.got)}`);
    if (f.minimal !== undefined) console.log(`  min:  ${clip(f.minimal)}`);
  }
  console.log(
    `\n${counts.files} files: ${counts.ok} ok, ${counts.parseError} parse errors, ` +
      `${counts.shape} shape mismatches, ${counts.precedence} precedence mismatches, ${counts.unparse} unparse errors`,
  );
  process.exit(counts.ok === counts.files ? 0 : 1);
}

await main();
