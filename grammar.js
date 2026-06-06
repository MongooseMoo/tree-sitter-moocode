const PREC = {
  assign: 1,
  ternary: 2,
  or: 3,
  and: 4,
  bitOr: 5,
  bitXor: 6,
  bitAnd: 7,
  compare: 8,
  shift: 9,
  add: 10,
  multiply: 11,
  power: 12,
  unary: 13,
  postfix: 14,
};

const commaSep = (rule) => optional(commaSep1(rule));
const commaSep1 = (rule) => seq(rule, repeat(seq(",", rule)));

module.exports = grammar({
  name: "moocode",

  extras: ($) => [/[ \t\r\n\f]+/, $.comment],

  word: ($) => $.identifier,

  conflicts: ($) => [
    [$.primary_expression, $.scatter_target_item],
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
        optional(choice($.return_statement, $.break_statement, $.continue_statement, $.expression)),
        ";",
      ),

    condition: ($) => $.expression,

    if_statement: ($) =>
      seq($.if_clause, repeat($.elseif_clause), optional($.else_clause), "endif"),

    if_clause: ($) => seq("if", "(", field("condition", $.condition), ")", field("body", repeat($.statement))),

    elseif_clause: ($) =>
      seq("elseif", "(", field("condition", $.condition), ")", field("body", repeat($.statement))),

    else_clause: ($) => seq("else", field("body", repeat($.statement))),

    for_statement: ($) => seq($.for_clause, field("body", repeat($.statement)), "endfor"),

    for_clause: ($) =>
      seq(
        "for",
        field("value", $.identifier),
        optional(seq(",", field("index", $.identifier))),
        "in",
        choice(
          seq("(", field("iterable", $.expression), ")"),
          seq("[", field("start", $.expression), "..", field("end", $.expression), "]"),
        ),
      ),

    while_statement: ($) => seq($.while_clause, field("body", repeat($.statement)), "endwhile"),

    while_clause: ($) =>
      seq("while", optional(field("label", $.identifier)), "(", field("condition", $.condition), ")"),

    fork_statement: ($) => seq($.fork_clause, field("body", repeat($.statement)), "endfork"),

    fork_clause: ($) =>
      seq("fork", optional(field("task", $.identifier)), "(", field("delay", $.expression), ")"),

    try_except_statement: ($) =>
      seq("try", field("body", repeat($.statement)), repeat1($.except_statement), "endtry"),

    except_statement: ($) => seq($.except_clause, field("body", repeat($.statement))),

    except_clause: ($) =>
      seq("except", optional(field("name", $.identifier)), "(", field("codes", $.exception_codes), ")"),

    try_finally_statement: ($) =>
      seq("try", field("body", repeat($.statement)), $.finally_statement, "endtry"),

    finally_statement: ($) => seq("finally", field("body", repeat($.statement))),

    return_statement: ($) => seq("return", optional(field("value", $.expression))),

    break_statement: ($) => seq("break", optional(field("label", $.identifier))),

    continue_statement: ($) => seq("continue", optional(field("label", $.identifier))),

    expression: ($) =>
      choice(
        $.assignment_expression,
        $.ternary_expression,
        $.catch_expression,
        $.splice_expression,
        $.scatter_assignment,
        $.binary_expression,
        $.unary_expression,
        $.postfix_expression,
        $.primary_expression,
      ),

    assignment_expression: ($) =>
      prec.right(
        PREC.assign,
        seq(field("left", choice($.identifier, $.postfix_expression)), "=", field("right", $.expression)),
      ),

    scatter_assignment: ($) =>
      prec.right(
        PREC.assign,
        seq("{", field("target", $.scatter_target), "}", "=", field("right", $.expression)),
      ),

    ternary_expression: ($) =>
      prec.right(
        PREC.ternary,
        seq(
          field("condition", $.expression),
          "?",
          field("consequent", $.expression),
          "|",
          field("alternate", $.expression),
        ),
      ),

    catch_expression: ($) =>
      seq(
        "`",
        field("body", $.expression),
        "!",
        field("codes", $.exception_codes),
        optional(seq("=>", field("default", $.expression))),
        "'",
      ),

    splice_expression: ($) => prec(PREC.unary, seq("@", field("value", $.expression))),

    binary_expression: ($) =>
      choice(
        binary($, "||", PREC.or),
        binary($, "&&", PREC.and),
        binary($, "|.", PREC.bitOr),
        binary($, "^.", PREC.bitXor),
        binary($, "&.", PREC.bitAnd),
        binary($, choice("<=", ">=", "==", "!=", "<", ">", "in"), PREC.compare),
        binary($, choice(">>", "<<"), PREC.shift),
        binary($, choice("+", "-"), PREC.add),
        binary($, choice("*", "/", "%"), PREC.multiply),
        prec.right(PREC.power, seq(field("left", $.expression), field("operator", "^"), field("right", $.expression))),
      ),

    unary_expression: ($) =>
      prec(PREC.unary, seq(field("operator", choice("!", "~", "-")), field("argument", $.expression))),

    postfix_expression: ($) =>
      choice(
        $.property_expression,
        $.waif_property_expression,
        $.index_expression,
        $.range_expression,
        $.verb_call_expression,
      ),

    property_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $.expression),
          ".",
          field("property", choice($.identifier, seq("(", $.expression, ")"))),
        ),
      ),

    waif_property_expression: ($) =>
      prec(PREC.postfix, seq(field("object", $.expression), ".:", field("property", $.identifier))),

    index_expression: ($) =>
      prec(PREC.postfix, seq(field("object", $.expression), "[", field("index", $.expression), "]")),

    range_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $.expression),
          "[",
          field("start", $.expression),
          "..",
          field("end", $.expression),
          "]",
        ),
      ),

    verb_call_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $.expression),
          ":",
          field("verb", choice($.identifier, seq("(", $.expression, ")"))),
          "(",
          field("arguments", optional($.argument_list)),
          ")",
        ),
      ),

    primary_expression: ($) =>
      choice(
        seq("(", $.expression, ")"),
        $.literal,
        $.function_call,
        $.dollar_property,
        $.dollar_verb_call,
        $.first_index,
        $.last_index,
        $.identifier,
      ),

    function_call: ($) =>
      seq(field("function", $.identifier), "(", field("arguments", optional($.argument_list)), ")"),

    dollar_property: ($) => seq("$", field("property", $.identifier)),

    dollar_verb_call: ($) =>
      seq(
        "$",
        field("verb", choice($.identifier, seq("(", $.expression, ")"))),
        "(",
        field("arguments", optional($.argument_list)),
        ")",
      ),

    first_index: () => "^",

    last_index: () => "$",

    literal: ($) =>
      choice("error", $.string, $.object, $.float, $.number, $.boolean, $.list, $.map),

    list: ($) => seq("{", field("items", optional($.argument_list)), "}"),

    map: ($) => seq("[", commaSep($.map_entry), "]"),

    map_entry: ($) => seq(field("key", $.expression), "->", field("value", $.expression)),

    argument_list: ($) => commaSep1($.argument),

    argument: ($) => choice($.expression, seq("@", field("value", $.expression))),

    exception_codes: ($) =>
      choice(
        seq("@", field("value", $.expression)),
        "any",
        commaSep1($.exception_code),
      ),

    exception_code: ($) => choice($.identifier, "error", $.string),

    scatter_target: ($) => commaSep1($.scatter_target_item),

    scatter_target_item: ($) =>
      choice(
        $.identifier,
        seq("?", field("name", $.identifier), optional(seq("=", field("default", $.expression)))),
        seq("@", field("name", $.identifier)),
      ),

    boolean: () => choice("true", "false"),

    object: () => token(seq("#", /-?[0-9]+/)),

    float: () => token(/-?(?:[0-9]+\.[0-9]+|[0-9]*\.[0-9]+)(?:[eE][-+]?[0-9]+)?/),

    number: () => token(/-?[0-9]+/),

    string: () => token(seq('"', repeat(choice(/[^"\\\n]/, /\\./)), '"')),

    identifier: () => /[_a-zA-Z][_a-zA-Z0-9]*/,

    comment: () => token(choice(seq("//", /[^\n]*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"))),
  },
});

function binary($, operator, precedence) {
  return prec.left(
    precedence,
    seq(field("left", $.expression), field("operator", operator), field("right", $.expression)),
  );
}
