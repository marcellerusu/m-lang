require "strscan"

module Lexer
  def self.tokenize(program)
    lines = program.split("\n")
    lines.map do |line|
      Lexer::tokenize_line line
    end
  end

  def self.tokenize_line(line)
    tokens = []
    scanner = StringScanner.new(line)
    while true
      column = scanner.pos
      case
      when scanner.eos?
        break
      when scanner.scan(/\s+/)
        next
      when scanner.scan(/#\{/)
        tokens.push [column, :anon_short_fn_start]
      when scanner.scan(/#.*/)
        break
      when scanner.scan(/".*"/)
        tokens.push [column, :str_lit, scanner.matched[1...-1]]
      when scanner.scan(/(true|false)\b/)
        tokens.push [column, (scanner.matched == "true").to_s.to_sym]
      when scanner.scan(/self\b/)
        tokens.push [column, :self]
      when scanner.scan(/fn\b/)
        tokens.push [column, :fn]
      when scanner.scan(/if\b/)
        tokens.push [column, :if]
      when scanner.scan(/unless\b/)
        tokens.push [column, :unless]
      when scanner.scan(/else\b/)
        tokens.push [column, :else]
      when scanner.scan(/end\b/)
        tokens.push [column, :end]
      when scanner.scan(/=>/)
        tokens.push [column, :arrow]
      when scanner.scan(/==/)
        tokens.push [column, :eq]
      when scanner.scan(/=/)
        tokens.push [column, :declare]
      when scanner.scan(/:=/)
        tokens.push [column, :assign]
      when scanner.scan(/\(/)
        tokens.push [column, :open_parenthesis]
      when scanner.scan(/\)/)
        tokens.push [column, :close_parenthesis]
      when scanner.scan(/\{/)
        tokens.push [column, :open_brace]
      when scanner.scan(/\}/)
        tokens.push [column, :close_brace]
      when scanner.scan(/\[/)
        tokens.push [column, :open_square_bracket]
      when scanner.scan(/\]/)
        tokens.push [column, :close_square_bracket]
      when scanner.scan(/\./)
        tokens.push [column, :dot]
      when scanner.scan(/,/)
        tokens.push [column, :comma]
      when scanner.scan(/\*/)
        tokens.push [column, :mult]
      when scanner.scan(/\//)
        tokens.push [column, :div]
      when scanner.scan(/\+/)
        tokens.push [column, :plus]
      when scanner.scan(/\|\|/)
        tokens.push [column, :or]
      when scanner.scan(/&&/)
        tokens.push [column, :and]
      when scanner.scan(/\|/)
        tokens.push [column, :schema_or]
      when scanner.scan(/&/)
        tokens.push [column, :schema_and]
      when scanner.scan(/%/)
        tokens.push [column, :anon_short_id]
      when scanner.scan(/-/)
        tokens.push [column, :minus]
      when scanner.scan(/reduce\b/)
        tokens.push [column, :reduce]
      when scanner.scan(/next\b/)
        tokens.push [column, :next]
      when scanner.scan(/break\b/)
        tokens.push [column, :break]
      when scanner.scan(/module\b/)
        tokens.push [column, :module]
      when scanner.scan(/class\b/)
        tokens.push [column, :class]
      when scanner.scan(/return\b/)
        tokens.push [column, :return]
      when scanner.scan(/schema\b/)
        tokens.push [column, :schema]
      when scanner.scan(/:[a-zA-Z][a-zA-Z1-9\_!?]*/)
        tokens.push [column, :symbol, scanner.matched[1..]]
      when scanner.scan(/:/)
        tokens.push [column, :colon]
      when scanner.scan(/[a-zA-Z][a-zA-Z1-9\_!?]*/)
        tokens.push [column, :identifier, scanner.matched]
      when scanner.scan(/\d+\.\d+/)
        tokens.push [column, :float_lit, scanner.matched.to_f]
      when scanner.scan(/\d+/)
        tokens.push [column, :int_lit, scanner.matched.to_i]
      else
        raise AssertionError
      end
    end
    return tokens
  end
end
