TOKENS = {
  "=" => :assign,
  "let" => :let,
  "==" => :eq,
  "!=" => :not_eq,
  "|>" => :pipe,
  "(" => :open_p,
  ")" => :close_p,
  "{" => :open_b,
  "}" => :close_b,
  "[" => :open_sb,
  "]" => :close_sb,
  "=>" => :arrow,
  ":" => :colon,
  "," => :comma,
}

class Token
  attr_reader :token, :line, :index

  def initialize(token, line, index)
    @token = token
    @start_index = index
    @current_index = index
    @line = line
  end

  def ==(other)
    @token == other.token
  end

  def clone
    Token.new(@token, @line, @start_index)
  end

  def undo!
    @current_index -= 1
    @token = @token.slice(0, @token.size - 1)
    self
  end

  def consume!(char)
    @current_index += 1
    @token += char
  end

  def as_token
    return as_literal if literal?
    return as_keyword if keyword?
    return as_symbol if symbol?
  end

  def as_keyword
    [@start_index, TOKENS[@token]]
  end

  def as_symbol
    [@start_index, :sym, @token]
  end

  def as_literal
    return [@start_index, :int_lit, as_int] if is_int?
    return [@start_index, :float_lit, as_float] if is_float?
  end

  def full_token?
    peek_rest_of_token == self
  end

  def invalid?
    !valid?
  end

  def valid?
    symbol? || keyword? || literal?
  end

  def symbol?
    return false if TOKENS.include?(@token)
    return false if @token =~ /\s/
    return false unless @token.chr =~ /[a-zA-Z]/
    return true
  end

  def keyword?
    TOKENS.include?(token)
  end

  def literal?
    is_int? || is_float?
  end

  def empty?
    @token.empty?
  end

  def is_int?
    as_int.to_s == @token
  end

  def as_int
    @token.to_i
  end

  def is_float?
    return clone.undo!.is_int? if @token[-1] == "."
    as_float.to_s == @token
  end

  def as_float
    @token.to_f
  end

  def peek_rest_of_token
    return self if @current_index >= @line.size
    peek_token = Token.new(@token, @line, @start_index)
    # binding.pry
    for char in @line.slice(@current_index + 1, @line.size - 1).split("")
      if peek_token.invalid?
        peek_token.undo!
        break
      end
      peek_token.consume! char
    end
    peek_token
  end
end
