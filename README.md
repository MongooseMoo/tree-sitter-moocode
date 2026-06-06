# tree-sitter-moocode

Tree-sitter grammar for LambdaMOO/ToastStunt MOO code.

This package is intended to be the durable parser layer behind editor support:
Monaco highlighting and diagnostics can use the lightweight language service,
while Tree-sitter gives us structural parsing, queries, folding, locals, and a
future path to richer browser or LSP integration.

## Source Grammar

The grammar is based on `C:\Users\Q\src\toaststunt\src\parser.y` plus the EBNF
seed used for the Monaco workstream. ToastStunt confirms:

- `statement*` programs.
- Block statements for `if`, `for`, `while`, `fork`, `try/except`, and
  `try/finally`.
- Semicolon-terminated expression, return, break, and continue statements.
- `..` range syntax through parser token `tTO`.
- MOO property, waif property, verb call, index, range, catch, map, list, splice,
  and scattering forms.

## Commands

```sh
npm install
npm run generate
npm test
```

## Current Scope

The first corpus covers the editor-critical parse surface:

- single statements and control statements
- conditional and loop blocks
- try/except and try/finally blocks
- assignment, ternary, catch, splice, maps, lists, ranges, verb calls, and
  property chains
- highlight, fold, and local-definition queries

The grammar is intentionally permissive where ToastStunt performs semantic
checks after parsing, such as validating legal assignment targets or legal `$`
and `^` contexts.

