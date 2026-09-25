/**
 * Tree-sitter grammar for LambdaMOO / ToastStunt MOO code.
 *
 * The reference is ToastStunt's `src/parser.y` (yacc grammar and hand-written
 * lexer), `src/keywords.gperf`, and `src/unparse.cc`. Where this grammar is
 * more permissive than the server it says so in a comment.
 */

// Mirrors the yacc precedence declarations in parser.y (lowest first).
const PREC = {
  assign: 1, //     %right  '='
  ternary: 2, //    %nonassoc '?' '|'
  logical: 3, //    %left   tOR tAND          (same level!)
  compare: 4, //    %left   tEQ tNE '<' tLE '>' tGE tIN
  bitwise: 5, //    %left   tBITOR tBITAND tBITXOR (same level!)
  shift: 6, //      %left   tBITSHL tBITSHR
  add: 7, //        %left   '+' '-'
  multiply: 8, //   %left   '*' '/' '%'
  power: 9, //      %right  '^'
  unary: 10, //     %left   '!' '~' tUNARYMINUS
  postfix: 11, //   %nonassoc '.' ':' '[' '$'
};

// keywords.gperf is compiled with --ignore-case, so every keyword and error
// code is case-insensitive.
const ERROR_CODES = [
  "E_NONE",
  "E_TYPE",
  "E_DIV",
  "E_PERM",
  "E_PROPNF",
  "E_VERBNF",
  "E_VARNF",
  "E_INVIND",
  "E_RECMOVE",
  "E_MAXREC",
  "E_RANGE",
  "E_ARGS",
  "E_NACC",
  "E_INVARG",
  "E_QUOTA",
  "E_FLOAT",
  "E_FILE",
  "E_EXEC",
  "E_INTRPT",
];

const DIGITS = /[0-9]+/.source;
const EXPONENT = /[eE][+-]?[0-9]+/.source;

module.exports = grammar({
  name: "moocode",

  // MOO only has /* */ comments; `//` is not a comment to the server.
  extras: ($) => [/\s+/, $.comment],

  word: ($) => $.identifier,

  supertypes: ($) => [$._expression],

  conflicts: ($) => [
    // `{a, @b}` is a list until a following `=` makes it a scatter target.
    [$._expression, $.scatter_item],
  ],

  rules: {
    source_file: ($) => repeat($.statement),

    statement: ($) =>
      choice(
        $.single_statement,
        $.if_statement,
        $.for_statement,
        $.while_statement,
        $.fork_statement,
        $.try_except_statement,
        $.try_finally_statement,
      ),

    single_statement: ($) =>
      seq(
        optional(choice($.return_statement, $.break_statement, $.continue_statement, $._expression)),
        ";",
      ),

    condition: ($) => $._expression,

    if_statement: ($) => seq($.if_clause, repeat($.elseif_clause), optional($.else_clause), kw("endif")),

    if_clause: ($) =>
      seq(kw("if"), "(", field("condition", $.condition), ")", field("body", repeat($.statement))),

    elseif_clause: ($) =>
      seq(kw("elseif"), "(", field("condition", $.condition), ")", field("body", repeat($.statement))),

    else_clause: ($) => seq(kw("else"), field("body", repeat($.statement))),

    for_statement: ($) => seq($.for_clause, field("body", repeat($.statement)), kw("endfor")),

    // Toast only allows the `value, index` form when iterating a list or map.
    for_clause: ($) =>
      seq(
        kw("for"),
        field("value", $.identifier),
        choice(
          seq(
            optional(seq(",", field("index", $.identifier))),
            kw("in"),
            "(",
            field("iterable", $._expression),
            ")",
          ),
          seq(kw("in"), "[", field("start", $._expression), "..", field("end", $._expression), "]"),
        ),
      ),

    while_statement: ($) => seq($.while_clause, field("body", repeat($.statement)), kw("endwhile")),

    while_clause: ($) =>
      seq(kw("while"), optional(field("label", $.identifier)), "(", field("condition", $.condition), ")"),

    fork_statement: ($) => seq($.fork_clause, field("body", repeat($.statement)), kw("endfork")),

    fork_clause: ($) =>
      seq(kw("fork"), optional(field("task", $.identifier)), "(", field("delay", $._expression), ")"),

    try_except_statement: ($) =>
      seq(kw("try"), field("body", repeat($.statement)), repeat1($.except_statement), kw("endtry")),

    except_statement: ($) => seq($.except_clause, field("body", repeat($.statement))),

    except_clause: ($) =>
      seq(kw("except"), optional(field("name", $.identifier)), "(", field("codes", $.exception_codes), ")"),

    try_finally_statement: ($) =>
      seq(kw("try"), field("body", repeat($.statement)), $.finally_statement, kw("endtry")),

    finally_statement: ($) => seq(kw("finally"), field("body", repeat($.statement))),

    return_statement: ($) => seq(kw("return"), optional(field("value", $._expression))),

    break_statement: ($) => seq(kw("break"), optional(field("label", $.identifier))),

    continue_statement: ($) => seq(kw("continue"), optional(field("label", $.identifier))),

    _expression: ($) =>
      choice(
        $.assignment_expression,
        $.scatter_assignment,
        $.ternary_expression,
        $.binary_expression,
        $.unary_expression,
        $.property_expression,
        $.waif_property_expression,
        $.index_expression,
        $.range_expression,
        $.verb_call_expression,
        $.dollar_property,
        $.dollar_verb_call,
        $.function_call,
        $.catch_expression,
        $.parenthesized_expression,
        $.list,
        $.map,
        $.first_index,
        $.last_index,
        $.identifier,
        $.integer,
        $.float,
        $.string,
        $.object,
        $.error_code,
      ),

    // Toast accepts any expression here syntactically and then rejects
    // anything but these forms (and `{...}` lists, see scatter_assignment).
    assignment_expression: ($) =>
      prec.right(
        PREC.assign,
        seq(
          field(
            "left",
            choice(
              $.identifier,
              $.dollar_property,
              $.property_expression,
              $.waif_property_expression,
              $.index_expression,
              $.range_expression,
            ),
          ),
          "=",
          field("right", $._expression),
        ),
      ),

    scatter_assignment: ($) =>
      prec.right(PREC.assign, seq("{", commaSep1($.scatter_item), "}", "=", field("right", $._expression))),

    scatter_item: ($) =>
      choice(
        field("name", $.identifier),
        seq("?", field("name", $.identifier), optional(seq("=", field("default", $._expression)))),
        seq("@", field("name", $.identifier)),
      ),

    // Toast declares `?` / `|` %nonassoc, so an unparenthesized ternary in the
    // condition or alternate is a server-side syntax error. We accept it
    // (right-associative) rather than fail the whole parse.
    ternary_expression: ($) =>
      prec.right(
        PREC.ternary,
        seq(
          field("condition", $._expression),
          "?",
          field("consequent", $._expression),
          "|",
          field("alternate", $._expression),
        ),
      ),

    binary_expression: ($) =>
      choice(
        binary($, choice("||", "&&"), PREC.logical),
        binary($, choice("==", "!=", "<", "<=", ">", ">=", kw("in")), PREC.compare),
        binary($, choice("|.", "&.", "^."), PREC.bitwise),
        binary($, choice("<<", ">>"), PREC.shift),
        binary($, choice("+", "-"), PREC.add),
        binary($, choice("*", "/", "%"), PREC.multiply),
        prec.right(
          PREC.power,
          seq(field("left", $._expression), field("operator", "^"), field("right", $._expression)),
        ),
      ),

    unary_expression: ($) =>
      prec(PREC.unary, seq(field("operator", choice("!", "~", "-")), field("argument", $._expression))),

    property_expression: ($) =>
      prec(PREC.postfix, seq(field("object", $._expression), ".", field("property", $._name))),

    waif_property_expression: ($) =>
      prec(PREC.postfix, seq(field("object", $._expression), ".", ":", field("property", $.identifier))),

    index_expression: ($) =>
      prec(PREC.postfix, seq(field("object", $._expression), "[", field("index", $._expression), "]")),

    range_expression: ($) =>
      prec(
        PREC.postfix,
        seq(field("object", $._expression), "[", field("start", $._expression), "..", field("end", $._expression), "]"),
      ),

    verb_call_expression: ($) =>
      prec(
        PREC.postfix,
        seq(field("object", $._expression), ":", field("verb", $._name), field("arguments", $.arguments)),
      ),

    // `.name` / `:name` or a computed `.(expr)` / `:(expr)`.
    _name: ($) => choice($.identifier, $.parenthesized_expression),

    dollar_property: ($) => prec(PREC.postfix, seq("$", field("property", $.identifier))),

    dollar_verb_call: ($) =>
      prec(PREC.postfix, seq("$", field("verb", $.identifier), field("arguments", $.arguments))),

    function_call: ($) => seq(field("function", $.identifier), field("arguments", $.arguments)),

    arguments: ($) => seq("(", commaSep($._argument), ")"),

    catch_expression: ($) =>
      seq(
        "`",
        field("body", $._expression),
        "!",
        field("codes", $.exception_codes),
        optional(seq("=>", field("default", $._expression))),
        "'",
      ),

    // `ANY` or a non-empty argument list; codes are arbitrary expressions.
    exception_codes: ($) => choice(kw("ANY"), commaSep1($._argument)),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    list: ($) => seq("{", commaSep($._argument), "}"),

    map: ($) => seq("[", commaSep($.map_entry), "]"),

    map_entry: ($) => seq(field("key", $._expression), "->", field("value", $._expression)),

    _argument: ($) => choice($._expression, $.splice),

    splice: ($) => seq("@", field("value", $._expression)),

    // `^` and `$` are only meaningful inside an index; Toast checks that
    // after parsing, and so do we (by not checking).
    first_index: () => "^",

    last_index: () => "$",

    error_code: () => token(choice(...ERROR_CODES.map(caseInsensitive))),

    object: () => token(seq("#", optional("-"), /[0-9]+/)),

    integer: () => /[0-9]+/,

    // Toast also lexes `1.` (digits, dot, no second dot) as a float. Tree-sitter
    // has no lookahead to tell that apart from `1..2`, and the server never
    // writes it back that way (unparse always prints `1.0`), so we omit it.
    float: () =>
      token(
        choice(
          new RegExp(`${DIGITS}\\.${DIGITS}(${EXPONENT})?`),
          new RegExp(`\\.${DIGITS}(${EXPONENT})?`),
          new RegExp(`${DIGITS}(\\.[0-9]*)?${EXPONENT}`),
        ),
      ),

    string: () => token(seq('"', repeat(choice(/[^"\\\n]/, /\\[^\n]/)), '"')),

    identifier: () => /[_a-zA-Z][_a-zA-Z0-9]*/,

    comment: () => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

function binary($, operator, precedence) {
  return prec.left(
    precedence,
    seq(field("left", $._expression), field("operator", operator), field("right", $._expression)),
  );
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function caseInsensitive(word) {
  return new RegExp(
    word
      .split("")
      .map((c) => (/[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c))
      .join(""),
  );
}

// A case-insensitive keyword that shows up in the tree under its canonical
// spelling, so queries can match "endif" whatever the author typed.
function kw(word) {
  return alias(caseInsensitive(word), word);
}
