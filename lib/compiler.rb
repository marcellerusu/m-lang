require "utils"
require "pry"
require "parser"

class Compiler
  # TODO: do something better for tests
  @@use_std_lib = true
  def self.use_std_lib=(other)
    @@use_std_lib = other
  end

  def initialize(ast, indent = 0)
    @ast = ast
    @indent = indent
  end

  def eval
    program = ""
    program += std_lib if first_run?
    program += eval_assignment_declarations
    # program += collapse_function_overloading
    @ast.each do |statement|
      program += " " * @indent
      program += eval_expr(statement)
      program += ";" << "\n"
    end
    program.rstrip
  end

  def eval_without_variable_declarations
    program = ""
    # program += collapse_function_overloading
    @ast.each do |statement|
      program += " " * @indent
      program += eval_expr(statement)
      program += ";" << "\n"
    end
    program.rstrip
  end

  private

  def first_run?
    # TODO: I don't think this is correct
    @@use_std_lib && @indent == 0
  end

  def std_lib
    schema_lib
  end

  def schema_lib
    File.read(File.dirname(__FILE__) + "/pea_std_lib/schema.js")
  end

  def css_preprocessor
    File.read(File.dirname(__FILE__) + "/pea_std_lib/css_preprocessor.js")
  end

  def indent!
    @indent += 2
  end

  def dedent!
    @indent -= 2
  end

  def padding(by = 0)
    assert { @indent + by >= 0 }
    " " * (@indent + by)
  end

  def eval_assignment_declarations
    names = find_assignments
    if names.any?
      vars = padding
      vars += "let "
      vars += names.map { |names| sub_q(names) }.join(", ")
      vars += ";" << "\n"
    end
    vars || ""
  end

  def find_assignments
    nodes = @ast.flat_map do |node|
      if node.is_a?(AST::If)
        node.pass + node.fail
      else
        [node]
      end
    end

    nodes
      .filter { |node| node.is_a?(AST::Assign) }
      .uniq { |node| node.name }
      .map(&:name) +
      nodes
        .filter { |node| node.is_a?(AST::MatchAssignment) }
        .flat_map { |node| node.captures }
        .uniq
  end

  def eval_expr(node)
    case node
    when AST::Declare
      eval_declaration node
    when AST::SimpleAssignment
      eval_assignment node
    when AST::SimpleSchemaAssignment
      eval_simple_schema_assignment node
    when AST::Assign
      eval_assignment node
    when AST::PropertyLookup
      eval_property_lookup node
    when AST::ArrayLiteral
      eval_array_literal node
    when AST::SimpleObjectLiteral
      eval_simple_object_literal node
    when AST::ObjectLiteral
      eval_object_literal node
    when AST::Bool
      eval_bool node
    when AST::Int
      eval_int node
    when AST::Float
      eval_float node
    when AST::SimpleString
      eval_simple_string node
    when AST::Str
      eval_str node
    when AST::SingleLineDefWithArgs
      eval_single_line_fn_with_args node
    when AST::Fn
      eval_function node
    when AST::SingleLineArrowFnWithoutArgs
      eval_arrow_fn_without_args node
    when AST::SingleLineArrowFnWithArgs
      eval_arrow_fn_with_args node
    when AST::SingleLineArrowFnWithOneArg
      eval_arrow_fn_with_one_arg node
    when AST::ShortFn
      eval_short_fn node
    when AST::AnonIdLookup
      eval_anon_id_lookup
    when AST::Return
      eval_return node
    when AST::FnCall
      eval_function_call node
    when AST::IdLookup
      eval_identifier_lookup node
    when AST::If
      eval_if_expression node
    when AST::Throw
      eval_throw node
    when AST::Case
      eval_case_expression node
    when AST::MatchAssignment
      eval_match_assignment node
    when AST::SchemaCapture
      eval_schema_capture node
    when AST::Dot
      eval_dot node
    when AST::Op
      eval_operator node
    when AST::ArgsSchema
      eval_args_schema node
    when AST::MultilineDefWithoutArgs
      eval_multiline_def_without_args node
    when AST::MultilineDefWithArgs
      eval_multiline_def_with_args node
    when AST::FunctionCallWithoutArgs
      eval_function_call_without_args node
    when AST::FunctionCallWithArgs
      eval_function_call_with_args node
    when AST::SimpleForOfLoop
      eval_simple_for_of_loop node
    when AST::ForOfObjDeconstructLoop
      eval_for_of_obj_descontruct_loop node
    when AST::SchemaDefinition
      eval_schema_definition node
    when AST::SchemaObjectLiteral
      eval_schema_object_literal node
    when AST::Await
      eval_await node
    else
      binding.pry
      puts "no case matched node_type: #{node.class}"
      assert_not_reached!
    end
  end

  def eval_await(node)
    "await #{eval_expr node.value}"
  end

  def eval_simple_schema_assignment(node)
    "#{node.name} = s.verify(#{node.schema_name}, #{eval_expr node.expr})"
  end

  def eval_schema_object_literal(node)
    schema_obj = "{ "
    for name, value in node.properties
      schema_obj += "#{name}: #{eval_expr value}, "
    end
    # remove last ", "
    schema_obj[0...-2] + " }"
  end

  def eval_schema_definition(node)
    "const #{node.name} = #{eval_expr node.schema_expr}"
  end

  def eval_for_of_obj_descontruct_loop(node)
    properties = node.iter_properties.join ", "
    for_loop = "for ({ #{properties} } of #{eval_expr node.arr_expr}) {\n"
    for_loop += Compiler.new(node.body, @indent + 2).eval + "\n"
    for_loop += "}"
  end

  def eval_simple_for_of_loop(node)
    for_loop = "for (#{node.iter_name} of #{eval_expr node.arr_expr}) {\n"
    for_loop += Compiler.new(node.body, @indent + 2).eval + "\n"
    for_loop += "}"
  end

  def eval_args_schema(node)
    node.args.join(", ")
  end

  def eval_multiline_def_without_args(fn_node)
    fn = "#{padding}function #{fn_node.name}() {\n"
    fn += Compiler.new(fn_node.body, @indent + 2).eval + "\n"
    fn += "#{padding}}"
    fn
  end

  def eval_dot(node)
    "#{eval_expr(node.lhs)}.#{eval_expr(node.rhs)}"
  end

  def eval_operator(node)
    "#{eval_expr(node.lhs)} #{node.type} #{eval_expr(node.rhs)}"
  end

  def eval_function_call_with_args(node)
    args = node.args.map { |node| eval_expr node }.join ", "
    "#{node.name}(#{args})"
  end

  def eval_function_call_without_args(node)
    "#{node.name}()"
  end

  def eval_schema_capture(node)
    "s('#{node.name}')"
  end

  def eval_match_assignment(node)
    "(#{eval_expr(node.pattern)} = s.verify(#{eval_expr(node.schema)}, #{eval_expr(node.value)}))"
  end

  def eval_if_expression(node)
    cond = eval_expr(node.value)
    pass_body = Compiler.new(node.pass, @indent + 2).eval_without_variable_declarations
    fail_body = Compiler.new(node.fail, @indent + 2).eval_without_variable_declarations

    "#{padding}if (#{cond}) {\n" \
    "#{pass_body}\n" \
    "#{padding}} else {\n" \
    "#{fail_body}\n" \
    "#{padding}}"
  end

  def eval_throw(node)
    "throw #{eval_expr(node.expr)}"
  end

  def eval_simple_string(node)
    "\"#{node.value}\""
  end

  def eval_str(node)
    "`#{node.value}`"
  end

  def eval_int(node)
    "#{node.value}"
  end

  def eval_float(node)
    "#{node.value}"
  end

  def eval_bool(node)
    "#{node.value}"
  end

  def eval_array_literal(node)
    elements = node.value.map { |n| eval_expr n }.join(", ")
    "[#{elements}]"
  end

  def eval_simple_object_literal(node)
    eval_object_literal(node)
  end

  def eval_object_literal(node)
    indent!
    object_literal = "{\n"
    object_literal += node.value.map do |key, value|
      "#{padding}#{key}: #{eval_expr(value)}"
    end.join(",\n")
    dedent!
    object_literal += "\n#{padding}}"
  end

  def eval_property_lookup(node)
    lhs, key = eval_expr(node.lhs_expr), node.property
    if key =~ /[a-zA-Z\_][a-zA-Z1-9\_?]*/
      "#{lhs}.#{sub_q(key)}"
    else
      "#{lhs}[#{sub_q(key)}]"
    end
  end

  def sub_q(sym)
    sym
      .sub("?", "_q")
      .sub("!", "_b")
  end

  def eval_declaration(node)
    "const #{sub_q(node.name)} = #{eval_expr(node.expr)}"
  end

  def eval_assignment(node)
    "#{sub_q(node.name)} = #{eval_expr(node.expr)}"
  end

  def eval_arrow_fn_with_one_arg(node)
    "(#{node.arg}) => #{eval_expr node.return_expr}"
  end

  def arg_names(args_node)
    args_node.value.map { |node| node.name }.join ", "
  end

  def eval_multiline_def_with_args(fn_node)
    args = arg_names fn_node.args

    fn = "#{padding}function #{fn_node.name}(#{args}) {\n"
    fn += Compiler.new(fn_node.body, @indent + 2).eval + "\n"
    fn += "#{padding}}"
    fn
  end

  def schema_arg_assignments(args_node)
    args_node.value
      .select { |node| node.is_a?(AST::SimpleSchemaArg) }
      .map do |arg|
      "#{padding}#{arg.name} = s.verify(#{arg.schema_name}, #{arg.name});"
    end.join "\n"
  end

  def eval_single_line_fn_with_args(fn_node)
    args = arg_names fn_node.args

    fn = "#{padding}function #{fn_node.name}(#{args}) {\n"
    indent!
    fn += schema_arg_assignments(fn_node.args) + "\n"

    fn += "#{padding}return #{eval_expr fn_node.return_value};\n"
    dedent!
    fn += "#{padding}}"
    fn
  end

  def eval_arrow_fn_with_args(node)
    args = arg_names node.args

    fn = "(#{args}) => {\n"
    indent!
    fn += padding + schema_arg_assignments(node.args) + "\n"
    fn += padding + "return #{eval_expr node.return_expr};\n"
    dedent!
    fn + "}"
  end

  def eval_arrow_fn_without_args(node)
    "() => #{eval_expr node.return_expr}"
  end

  def eval_anon_id_lookup
    "_it"
  end

  def eval_short_fn(node)
    "(#{eval_anon_id_lookup} => #{eval_expr node.return_expr})"
  end

  def eval_function(node, pattern = nil)
    node.body[0] = node.body[0].value if node.body.size == 1
    body = Compiler.new(node.body, @indent + 2).eval
    args = node.args.join(", ")
    pattern = AST::ArgsSchema.new(node.args) if pattern.nil?
    body = "{\n #{body}\n#{padding}}" if node.body.size > 1
    "((#{eval_expr(pattern.from_schema)}) => #{body.strip.delete_suffix ";"})"
  end

  def eval_return(node)
    "return #{eval_expr node.value}"
  end

  def eval_function_call(node)
    args = node.args.map { |arg| eval_expr arg }.join ", "
    fn = eval_expr node.expr
    "#{fn}(#{args})"
  end

  def eval_identifier_lookup(node)
    assert { node.value }
    sub_q(node.value)
  end

  def eval_case_expression(node)
    "s.match(#{node.cases.map { |_case| eval_expr(_case) }.join(",")})(#{eval_expr(node.value)})"
  end
end
