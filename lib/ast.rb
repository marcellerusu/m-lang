module AST
  def self.remove_numbers_single(node)
    node.delete(:line)
    node.delete(:column)
    node[:expr] = AST::remove_numbers_single(node[:expr]) if node[:expr]
    node[:property] = AST::remove_numbers_single(node[:property]) if node[:property]
    node[:lhs_expr] = AST::remove_numbers_single(node[:lhs_expr]) if node[:lhs_expr]
    node[:value] = AST::remove_numbers(node[:value]) if node[:value].is_a?(Array)
    node[:value] = AST::remove_numbers_from_hash(node[:value]) if node[:value].is_a?(Hash)
    node[:args] = AST::remove_numbers(node[:args]) if node[:args]
    node[:body] = AST::remove_numbers(node[:body]) if node[:body]
    node[:pass] = AST::remove_numbers(node[:pass]) if node[:pass]
    node[:fail] = AST::remove_numbers(node[:fail]) if node[:fail]

    return node
  end

  def self.remove_numbers(nodes)
    nodes.map { |n| AST::remove_numbers_single(n) }
  end

  def self.remove_numbers_from_hash(hash)
    hash.map { |k, n| [k, AST::remove_numbers_single(n)] }.to_h
  end

  def self.int(value, line = nil, column = nil)
    { node_type: :int_lit,
      value: value,
      line: line,
      column: column }
  end

  def self.literal(line, c, type, value)
    { node_type: type,
      line: line,
      column: c,
      value: value }
  end

  def self.array(value, line = nil, c = nil)
    { node_type: :array_lit,
      line: line,
      column: c,
      value: value }
  end

  def self.record(value, line = nil, c = nil)
    { node_type: :record_lit,
      line: line,
      column: c,
      value: value }
  end

  def self.sym(value, line = nil, c = nil)
    { node_type: :symbol,
      line: line,
      column: c,
      value: value }
  end

  def self.bool(value, line = nil, c = nil)
    { node_type: :bool_lit,
      line: line,
      column: c,
      value: value }
  end

  def self.float(value, line = nil, c = nil)
    { node_type: :float_lit,
      line: line,
      column: c,
      value: value }
  end

  def self.str(value, line = nil, c = nil)
    { node_type: :str_lit,
      line: line,
      column: c,
      value: value }
  end

  def self.return(expr, line = nil, c = nil)
    { node_type: :return,
      line: line,
      column: c,
      expr: expr }
  end

  def self.if(expr, pass, _fail, line = nil, c = nil)
    { node_type: :if,
      line: line,
      column: c,
      expr: expr,
      pass: pass,
      fail: _fail }
  end

  def self.function_call(args, expr, line = nil, c = nil)
    { node_type: :function_call,
      line: line,
      column: c,
      args: args,
      expr: expr }
  end

  def self.function(args, body, line = nil, c = nil)
    { node_type: :function,
      line: line,
      column: c,
      args: args,
      body: body }
  end

  def self.function_argument(sym, line = nil, c = nil)
    { node_type: :function_argument,
      line: line,
      column: c,
      sym: sym }
  end

  def self.identifier_lookup(sym, line = nil, c = nil)
    { node_type: :identifier_lookup,
      line: line,
      column: c,
      sym: sym }
  end

  def self.declare(sym_expr, expr)
    { node_type: :declare,
      sym: sym_expr[:sym],
      line: sym_expr[:line],
      column: sym_expr[:column],
      expr: expr }
  end

  def self.assignment(sym, expr, line = nil, c = nil)
    { node_type: :assign,
      sym: sym,
      line: line,
      column: c,
      expr: expr }
  end

  def self.property_lookup(line, c, lhs_expr, property)
    # just convert to string for now... TODO: idk
    { node_type: :property_lookup,
      lhs_expr: lhs_expr,
      line: line,
      column: c,
      property: property }
  end

  def self.dot(line, c, lhs_expr, id)
    lit_c, sym = id
    property = AST::literal line, lit_c, :str_lit, sym
    AST::property_lookup line, c, lhs_expr, property
  end

  def self.index_on(lhs, index)
    AST::property_lookup lhs[:line], lhs[:column], lhs, index
  end

  def self.throw(line, c, expr)
    { node_type: :throw,
      line: line,
      column: c,
      expr: expr }
  end
end