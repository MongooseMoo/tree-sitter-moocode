# tree-sitter-moocode

Tree-sitter grammar for LambdaMOO/ToastStunt MOO code.

This package is intended to be the durable parser layer behind editor support:
Monaco highlighting and diagnostics can use the lightweight language service,
while Tree-sitter gives us structural parsing, queries, folding, locals, and a
future path to richer browser or LSP integration.

## Source Grammar

The reference is ToastStunt's `src/parser.y` (yacc grammar and hand-written
lexer), `src/keywords.gperf`, and `src/unparse.cc`. Things that are easy to get
wrong, and that this grammar follows the server on:

- **Precedence.** `||` and `&&` are one level and associate left, so
  `a || b && c` is `(a || b) && c`. Comparisons (including `in`) bind *looser*
  than the bitwise operators `|.`, `&.`, `^.`, which also share one level.
  Unary `-`, `!` and `~` bind tighter than `^`, so `-a ^ b` is `(-a) ^ b`.
- **Keywords are case-insensitive** (`IF`, `EndWhile`, `any`), and show up in
  the tree under one canonical spelling. `ANY` and the `E_*` error codes are
  keywords. `true`, `false` and `error` are *not*; they are ordinary names.
- **Numbers carry no sign.** `x-1` is a subtraction. Floats include exponent
  forms such as `1e-09` and `1E+15`.
- **Comments** are `/* ... */` only. `//` is not a comment to the server.
- **Catch expressions** accept any argument list as codes, e.g. `` `x ! @codes' ``.
- `@` splices are only allowed in argument lists, lists and scatter targets.

The grammar stays permissive where ToastStunt rejects code after parsing:
`^`/`$` outside an index, an index assignment rooted at something other than
a variable or property, and an unparenthesized ternary nested in a ternary's
condition or alternate. It also does not lex `1.` (digits and a trailing dot)
as a float, because tree-sitter has no lookahead to tell it apart from `1..2`.
The server always writes such values back as `1.0`.

## Commands

```sh
npm install
npm run generate
npm run build:wasm
npm test
npm run roundtrip -- <dir-with-.moo-files>...
```

## Round-trip oracle

`scripts/roundtrip.mjs` checks the grammar against real code. MOO servers store
verb source as the output of ToastStunt's unparser, fully parenthesized and
unindented, which is a canonical rendering of the server's own syntax tree.
For every `.moo` file under the given paths the script:

1. parses it, re-renders the tree with the unparser's rules, and requires the
   original text back (this checks tree shape);
2. renders the tree again with *minimal* parentheses using the server's
   precedence table, parses that, re-renders it fully parenthesized, and
   requires the original text again (this checks precedence and
   associativity).

The corpus is not part of this repository. Point the script at verb code
exported from any database, for example with
[lambdamoo-db-py](https://github.com/MongooseMoo/lambdamoo-db-py). It only
checks shapes that actually occur in that code, so edge cases such as
`-a ^ b` are covered by `test/corpus` instead.

## Browser Parser

The package includes `tree-sitter-moocode.wasm` for `web-tree-sitter` consumers:

```js
import { Language, Parser } from "web-tree-sitter";
import mooWasmUrl from "tree-sitter-moocode/tree-sitter-moocode.wasm?url";

await Parser.init();
const language = await Language.load(mooWasmUrl);
const parser = new Parser();
parser.setLanguage(language);
const tree = parser.parse(source);
```

## Tree shape

Expressions appear directly under their parent; `_expression` is a hidden
supertype. The main node types are `assignment_expression`,
`scatter_assignment`, `ternary_expression`, `binary_expression`,
`unary_expression`, `property_expression`, `waif_property_expression`,
`index_expression`, `range_expression`, `verb_call_expression`,
`dollar_property`, `dollar_verb_call`, `function_call`, `catch_expression`,
`parenthesized_expression`, `list`, `map`, `splice`, `first_index`,
`last_index`, `identifier`, `integer`, `float`, `string`, `object`, and
`error_code`. Statement and block node names are unchanged from 0.1.
