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

; When several patterns capture the same node the last one wins, so the
; identifier patterns run from least to most specific.
(identifier) @variable

; Not keywords to the server, but variables it predefines in every verb. The
; server looks names up without regard to case, so `list` is `LIST`. These two
; predicates are generated from builtin-variables.json; after editing that
; file run `node scripts/check-builtin-variables.mjs --print`.
((identifier) @constant.builtin
  (#match? @constant.builtin "^([Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee])$"))

((identifier) @variable.builtin
  (#match? @variable.builtin "^([Nn][Uu][Mm]|[Oo][Bb][Jj]|[Ss][Tt][Rr]|[Ll][Ii][Ss][Tt]|[Ee][Rr][Rr]|[Pp][Ll][Aa][Yy][Ee][Rr]|[Tt][Hh][Ii][Ss]|[Cc][Aa][Ll][Ll][Ee][Rr]|[Vv][Ee][Rr][Bb]|[Aa][Rr][Gg][Ss]|[Aa][Rr][Gg][Ss][Tt][Rr]|[Dd][Oo][Bb][Jj]|[Dd][Oo][Bb][Jj][Ss][Tt][Rr]|[Pp][Rr][Ee][Pp][Ss][Tt][Rr]|[Ii][Oo][Bb][Jj]|[Ii][Oo][Bb][Jj][Ss][Tt][Rr]|[Ii][Nn][Tt]|[Ff][Ll][Oo][Aa][Tt]|[Mm][Aa][Pp]|[Aa][Nn][Oo][Nn]|[Ww][Aa][Ii][Ff]|[Bb][Oo][Oo][Ll])$"))

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
