[
  "if"
  "elseif"
  "else"
  "endif"
  "for"
  "in"
  "endfor"
  "while"
  "endwhile"
  "fork"
  "endfork"
  "try"
  "except"
  "finally"
  "endtry"
  "return"
  "break"
  "continue"
] @keyword

[
  "any"
  "error"
  "true"
  "false"
] @constant.builtin

(comment) @comment
(string) @string
(number) @number
(float) @number
(object) @constant
(identifier) @variable

(function_call
  function: (identifier) @function.call)

(verb_call_expression
  verb: (identifier) @function.method)

(dollar_verb_call
  verb: (identifier) @function.builtin)

(property_expression
  property: (identifier) @property)

(waif_property_expression
  property: (identifier) @property)

(dollar_property
  property: (identifier) @property)

[
  "+"
  "-"
  "*"
  "/"
  "%"
  "^"
  "&&"
  "||"
  "|."
  "^."
  "&."
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "<<"
  ">>"
  "="
  "->"
  "=>"
  "@"
  "!"
  "~"
  "?"
  "|"
  ":"
  "."
  ".:"
  ".."
] @operator

