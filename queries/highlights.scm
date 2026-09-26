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

"ANY" @constant.builtin
(error_code) @constant.builtin
(first_index) @constant.builtin
(last_index) @constant.builtin

; Not keywords to the server, but predefined variables in every verb.
((identifier) @constant.builtin
  (#match? @constant.builtin "^([Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee])$"))

((identifier) @variable.builtin
  (#match? @variable.builtin "^(player|this|caller|verb|args|argstr|dobj|dobjstr|prepstr|iobj|iobjstr|INT|NUM|FLOAT|OBJ|STR|LIST|ERR|MAP|BOOL|ANON|WAIF)$"))

(comment) @comment
(line_comment) @comment
(string) @string
(integer) @number
(float) @number
(object) @constant

(function_call
  function: (identifier) @function.builtin)

(verb_call_expression
  verb: (identifier) @function.method)

(dollar_verb_call
  verb: (identifier) @function.method)

(property_expression
  property: (identifier) @property)

(waif_property_expression
  property: (identifier) @property)

(dollar_property
  property: (identifier) @property)

(identifier) @variable

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
  ".."
] @operator

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ";"
] @punctuation.delimiter
