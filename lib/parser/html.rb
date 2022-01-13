ID_TO_STR = {
  dot: ".",
  gt: ">",
  lt: "<",
}

module HTML
  def parse_html_tag!
    line, c, tag_name = consume! :open_html_tag
    self_closed, attributes = parse_html_attributes!

    if peek_type == :self_close_html_tag
      consume! :self_close_html_tag
    else
      children = parse_html_children!
      _, _, close_tag_name = consume! :close_html_tag
      assert { tag_name == close_tag_name }
    end
    AST::html_tag(
      AST::str(tag_name),
      AST::record(attributes),
      AST::array(children || []),
      line,
      c
    )
  end

  def parse_custom_element!
    line, c, element_name = consume! :open_custom_element_tag
    self_closed, attributes = parse_html_attributes!
    if !self_closed
      children = parse_html_children!
      _, _, close_element_name = consume! :close_html_tag
      assert { element_name == close_element_name }
    end
    AST::function_call(
      [AST::record(attributes)],
      AST::dot(
        AST::identifier_lookup(element_name, line, c),
        "new"
      ),
      line,
      c
    )
  end

  def parse_html_attributes!
    return !!consume!(:self_close_html_tag), {} if peek_type == :self_close_html_tag
    attributes = {}
    while ![:gt, :self_close_html_tag].include?(peek_type) # `>` as in capture <div [name="3">] part
      _, _, sym = consume! :identifier
      consume! :declare
      expr_context.set! :html_tag
      value = if peek_type == :str_lit
          parse_lit! :str_lit
        elsif peek_type == :open_brace
          consume! :open_brace
          val = parse_expr!
          consume! :close_brace
          val
        else
          assert { false }
        end
      expr_context.unset! :html_tag
      attributes[sym] = value
    end
    _, _, _, type = consume!
    return type == :self_close_html_tag, attributes
  end

  def parse_html_children!
    children = []
    while peek_type != :close_html_tag
      if peek_type == :identifier
        children.push parse_text_node!
      elsif peek_type == :open_custom_element_tag
        children.push parse_custom_element!
      elsif peek_type == :open_html_tag
        children.push parse_html_tag!
      elsif peek_type == :open_brace
        children.push parse_html_expr_node!
      else
        assert { false }
      end
    end
    children
  end

  def parse_html_expr_node!
    consume! :open_brace
    expr = parse_expr!
    consume! :close_brace
    str = AST::function_call([], AST::dot(expr, "to_s"))
    AST::html_text_node(str)
  end

  def parse_text_node!
    text = []
    # TODO: heckin' hack! find a way to consume raw text..
    # maybe I'll have to put this in the lexer somehow..
    # Things to think about..
    while ![:open_html_tag, :close_html_tag].include?(peek_type)
      _, _, word, type = consume!
      text.push(word || ID_TO_STR[type] || type.to_s)
    end
    AST::html_text_node(AST::str(text.join(" ")))
  end
end
