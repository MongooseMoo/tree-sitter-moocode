(for_clause
  value: (identifier) @local.definition)

(for_clause
  index: (identifier) @local.definition)

(while_clause
  label: (identifier) @local.definition)

(fork_clause
  task: (identifier) @local.definition)

(except_clause
  name: (identifier) @local.definition)

(scatter_item
  name: (identifier) @local.definition)

(assignment_expression
  left: (identifier) @local.definition)

(identifier) @local.reference
