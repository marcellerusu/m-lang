import { TOKEN_NAMES } from "./tokenizer.mjs";
import { match, any, eq } from './utils.mjs';
import assert from 'assert';
import pkg from 'immutable';
const { fromJS, Map } = pkg;

export const STATEMENT_TYPE = {
  DECLARATION: 'DECLARATION',
  ASSIGNMENT: 'ASSIGNMENT',
  FUNCTION: 'FUNCTION',
  RETURN: 'RETURN',
  PROGRAM: 'PROGRAM',
  NUMBER_LITERAL: 'NUMBER_LITERAL',
  STRING_LITERAL: 'STRING_LITERAL',
  OBJECT_LITERAL: 'OBJECT_LITERAL',
  OBJECT_DECONSTRUCTION: 'OBJECT_DECONSTRUCTION',
  ARRAY_LITERAL: 'ARRAY_LITERAL',
  FUNCTION_APPLICATION: 'FUNCTION_APPLICATION',
  SYMBOL_LOOKUP: 'SYMBOL_LOOKUP',
  PROPERTY_LOOKUP: 'PROPERTY_LOOKUP',
  CONDITIONAL: 'CONDITIONAL',
  DYNAMIC_LOOKUP: 'DYNAMIC_LOOKUP',
  MATCH_EXPRESSION: 'MATCH_EXPRESSION',
  MATCH_CASE: 'MATCH_CASE',
  BOUND_VARIABLE: 'BOUND_VARIABLE',
  BOOLEAN_LITERAL: 'BOOLEAN_LITERAL'
};

export const declaration = ({ symbol, expr, mutable }) => fromJS({
  type: STATEMENT_TYPE.DECLARATION,
  mutable: !!mutable,
  symbol,
  expr
});

export const assignment = ({ symbol, expr }) => fromJS({
  type: STATEMENT_TYPE.ASSIGNMENT,
  symbol,
  expr
});

export const objectLiteral = ({ value }) => fromJS({
  type: STATEMENT_TYPE.OBJECT_LITERAL,
  value,
});

export const objectDeconstruction = ({ expr }) => fromJS({
  type: STATEMENT_TYPE.OBJECT_DECONSTRUCTION,
  expr
})

export const arrayLiteral = ({ elements }) => fromJS({
  type: STATEMENT_TYPE.ARRAY_LITERAL,
  elements
});

export const dynamicLookup = ({ expr, lookupKey }) => fromJS({
  type: STATEMENT_TYPE.DYNAMIC_LOOKUP,
  expr,
  lookupKey
})

export const numberLiteral = ({ value }) => fromJS({
  type: STATEMENT_TYPE.NUMBER_LITERAL,
  value,
});

export const stringLiteral = ({ value }) => fromJS({
  type: STATEMENT_TYPE.STRING_LITERAL,
  value,
});

export const booleanLiteral = ({ value }) => fromJS({
  type: STATEMENT_TYPE.BOOLEAN_LITERAL,
  value
});

export const fn = ({ paramNames = [], body }) => fromJS({
  type: STATEMENT_TYPE.FUNCTION,
  paramNames,
  body,
});

export const fnCall = ({ expr, paramExprs = [] }) => fromJS({
  type: STATEMENT_TYPE.FUNCTION_APPLICATION,
  expr,
  paramExprs
});

export const _return = ({ expr }) => fromJS({
  type: STATEMENT_TYPE.RETURN,
  expr
});

export const symbolLookup = ({ symbol }) => fromJS({
  type: STATEMENT_TYPE.SYMBOL_LOOKUP,
  symbol,
});

export const propertyLookup = ({ property, expr }) => fromJS({
  type: STATEMENT_TYPE.PROPERTY_LOOKUP,
  property,
  expr,
});

export const conditional = ({ expr, pass, fail = null }) => fromJS({
  type: STATEMENT_TYPE.CONDITIONAL,
  expr,
  pass,
  fail
});

export const matchExpression = ({ expr, cases }) => fromJS({
  type: STATEMENT_TYPE.MATCH_EXPRESSION,
  expr,
  cases
});

export const matchCase = ({ expr, invoke }) => fromJS({
  type: STATEMENT_TYPE.MATCH_CASE,
  expr,
  invoke
});

export const boundVariable = ({ symbol }) => fromJS({
  type: STATEMENT_TYPE.BOUND_VARIABLE,
  symbol
});

export const makeConsumer = tokens => (i, tokensToConsume) => {
  const tokenValues = [];
  for (let consumable of tokensToConsume) {
    const token = tokens[i++];
    let tokenValue;

    if (!eq(token, consumable.token)) {
      if (consumable.optional) {
        tokenValue = null;
        i--;
      } else {
        // assert(false);
        throw `Token mismatch -- expected ${consumable.token}, got ${token}`;
      }
    } else {
      tokenValue = match(token, [
        [[TOKEN_NAMES.SYMBOL, any], ([_, sym]) => sym],
        [[TOKEN_NAMES.LITERAL, any], ([_, lit]) => lit],
        [[TOKEN_NAMES.OPERATOR, any], ([_, op]) => op],
        [TOKEN_NAMES.MUT, t => t],
        [any, () => undefined]
      ]);
    }
    if (typeof tokenValue !== 'undefined') tokenValues.push(tokenValue);
  }
  return [tokenValues, i];
};

const isExpression = contexts => [
  STATEMENT_TYPE.RETURN,
  STATEMENT_TYPE.FUNCTION_APPLICATION,
  STATEMENT_TYPE.ASSIGNMENT,
  STATEMENT_TYPE.DECLARATION,
  STATEMENT_TYPE.ARRAY_LITERAL,
  STATEMENT_TYPE.OBJECT_LITERAL,
  STATEMENT_TYPE.CONDITIONAL,
  STATEMENT_TYPE.MATCH_EXPRESSION,
  STATEMENT_TYPE.MATCH_CASE,
].includes(contexts[contexts.length - 1]);

const inMatchCond = contexts => {
  let i = contexts.length - 1;
  let mostRecentMatchIndex = -1;
  // last index of :/
  while (i > 0) {
    if (contexts[i] === STATEMENT_TYPE.MATCH_CASE) {
      mostRecentMatchIndex = i;
      break;
    }
    i--;
  }
  if (mostRecentMatchIndex === -1) return false;
  return !contexts.slice(mostRecentMatchIndex + 1)
    .some(context => 
      // these can not belong in a match condition
      [
        STATEMENT_TYPE.RETURN,
        STATEMENT_TYPE.FUNCTION_APPLICATION,
        STATEMENT_TYPE.ASSIGNMENT,
        STATEMENT_TYPE.DECLARATION,
        STATEMENT_TYPE.CONDITIONAL,
        STATEMENT_TYPE.MATCH_EXPRESSION,
        STATEMENT_TYPE.MATCH_CASE,
      ].includes(context)
    )
}

const parse = tokens => {
  let AST = fromJS({ type: STATEMENT_TYPE.PROGRAM, body: [], });
  for (let i = 0; i < tokens.length; i++) {
    const consume = consumables => {
      const [arr, i2] = makeConsumer(tokens)(i, consumables);
      i = i2;
      return arr;
    };
    const consumeOne = token => consume([{token}])[0];
    const parseFunctionCall = (contexts, expr) => {
      consumeOne(TOKEN_NAMES.OPEN_PARAN);
      const paramExprs = [];
      while (tokens[i] !== TOKEN_NAMES.CLOSE_PARAN) {
        const expr = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.FUNCTION_APPLICATION]);
        paramExprs.push(expr);
        if (tokens[i] !== TOKEN_NAMES.COMMA) break;
        consumeOne(TOKEN_NAMES.COMMA);
      }
      consumeOne(TOKEN_NAMES.CLOSE_PARAN);
      return fnCall({ expr, paramExprs });
    };

    const parseDotNotation = expr => {
      const propertyList = [];
      while (tokens[i] === TOKEN_NAMES.PROPERTY_ACCESSOR) {
        consumeOne(TOKEN_NAMES.PROPERTY_ACCESSOR);
        propertyList.push(consumeOne([TOKEN_NAMES.SYMBOL, any]));
      }
      for (const prop of propertyList) {
        expr = propertyLookup({ property: prop, expr });
      }
      return expr;
    };

    const parseObjectLiteralOrDeconstruction = contexts => {
      consumeOne(TOKEN_NAMES.OPEN_BRACE);
      let value = {}, isDeconstruction = false;
      while (tokens[i] !== TOKEN_NAMES.CLOSE_BRACE) {
        let varName;
        if (eq(tokens[i], [TOKEN_NAMES.SYMBOL, any])) {
          varName = consumeOne([TOKEN_NAMES.SYMBOL, any]);
        } else if (eq(tokens[i], [TOKEN_NAMES.LITERAL, any])) {
          varName = consumeOne([TOKEN_NAMES.LITERAL, any]);
          assert(typeof varName === 'string');
        } else {
          assert(false);
        }
        if (tokens[i] !== TOKEN_NAMES.COLON) isDeconstruction = true;
        if (tokens[i] === TOKEN_NAMES.COLON) {
          consumeOne(TOKEN_NAMES.COLON);
          value[varName] = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.OBJECT_LITERAL]);
        } else {
          value[varName] = boundVariable({ symbol: varName });
        }
        if (tokens[i] !== TOKEN_NAMES.COMMA) break;
        consumeOne(TOKEN_NAMES.COMMA);
      }
      consumeOne(TOKEN_NAMES.CLOSE_BRACE);
      return [value, isDeconstruction];
    };

    const parseArrayLiteral = contexts => {
      consumeOne(TOKEN_NAMES.OPEN_SQ_BRACE);
      const elements = [];
      while (tokens[i] !== TOKEN_NAMES.CLOSE_SQ_BRACE) {
        elements.push(parseNode(tokens[i],  [...contexts, STATEMENT_TYPE.ARRAY_LITERAL]));
        if (tokens[i] !== TOKEN_NAMES.COMMA) break;
        consumeOne(TOKEN_NAMES.COMMA);
      }
      consumeOne(TOKEN_NAMES.CLOSE_SQ_BRACE);
      if (tokens[i] === TOKEN_NAMES.OPEN_SQ_BRACE) {
        return parseDynamicLookup(contexts, arrayLiteral({ elements }));
      } else {
        return arrayLiteral({ elements });
      }
    };

    const parseFunctionDefinitionArgs = () => {
      const paramNames = [];
      while (tokens[i] !== TOKEN_NAMES.CLOSE_PARAN) {
        paramNames.push(consumeOne([TOKEN_NAMES.SYMBOL, any]));
        if (tokens[i] !== TOKEN_NAMES.COMMA) break;
        consumeOne(TOKEN_NAMES.COMMA);
      }
      return paramNames;
    };

    const parseStatements = contexts => {
      const body = [];
      while (tokens[i] !== TOKEN_NAMES.CLOSE_BRACE && i < tokens.length) {
        const expr = parseNode(tokens[i],  [...contexts, STATEMENT_TYPE.FUNCTION]);
        body.push(expr);
      }
      return body;
    };

    const parseFunctionBody = contexts => {
      if (tokens[i] !== TOKEN_NAMES.OPEN_BRACE) {
        // function expression
        const expr = parseNode(tokens[i],  [...contexts, STATEMENT_TYPE.RETURN]);
        return [_return({ expr })];
      } else {
        // function statement
        consumeOne(TOKEN_NAMES.OPEN_BRACE);
        const body = parseStatements(contexts);
        consumeOne(TOKEN_NAMES.CLOSE_BRACE);
        return body;
      }
    };

    const parseOperatorExpr = (contexts, firstArg) => {
      const op = consumeOne([TOKEN_NAMES.OPERATOR, any]);
      const expr = parseNode(
        tokens[i],
        [...contexts, STATEMENT_TYPE.FUNCTION_APPLICATION],
        // parse UNTIL we hit another operator
        [TOKEN_NAMES.OPERATOR, any]
      );
      // console.log(expr.toJS())
      const val = fnCall({
        expr: symbolLookup({ symbol: op }),
        paramExprs: [
          firstArg,
          expr
        ]
      });
      if (eq(tokens[i], [TOKEN_NAMES.OPERATOR, any])) {
        return parseOperatorExpr(contexts, val);
      } else {
        return val;
      }
    };

    const parseConditional = contexts => {
      consumeOne(TOKEN_NAMES.OPEN_PARAN);
      const expr = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.CONDITIONAL]);
      consumeOne(TOKEN_NAMES.CLOSE_PARAN);
      const passBody = parseFunctionBody(contexts);
      let failBody = [];
      if (tokens[i] === TOKEN_NAMES.ELSE) {
        consumeOne(TOKEN_NAMES.ELSE);
        failBody = parseFunctionBody(contexts);
      } else if (tokens[i] === TOKEN_NAMES.ELIF) {
        consumeOne(TOKEN_NAMES.ELIF);
        failBody = [parseConditional(contexts)];
      }
      return conditional({
        expr,
        pass: fnCall({ expr: fn({ body: passBody }) }),
        fail: fnCall({ expr: fn({ body: failBody }) })
      });
    };

    const parseLiteral = contexts => {
      const value = consumeOne([TOKEN_NAMES.LITERAL, any]);
      let literal;
      if (typeof value === 'number') {
        literal = numberLiteral({ value });
      } else if (typeof value === 'string') {
        literal = stringLiteral({ value });
      } else {
        throw 'should not reach';
      }
      if (eq(tokens[i], [TOKEN_NAMES.OPERATOR, any])) {
        return parseOperatorExpr(contexts, literal);
      } else {
        return literal;
      }
    };

    // TODO: re-write using immutable
    const findBoundVariable = (expr, found, prevExpr = symbolLookup({ symbol: 'arg' })) => {
      if (expr.type === STATEMENT_TYPE.BOUND_VARIABLE) {
        if (found.includes(expr.symbol)) {
          return null;
        } else {
          return fromJS([expr.symbol, prevExpr]);
        }
      } else if (expr.type === STATEMENT_TYPE.ARRAY_LITERAL) {
        for (let i = 0; i < expr.elements.length; i++) {
          const elem = expr.elements[i];
          if (elem.type === STATEMENT_TYPE.BOUND_VARIABLE) {
            const val = findBoundVariable(elem, found, dynamicLookup({ expr: prevExpr, lookupKey: i }));
            if (val) return val;
          } else if (elem.type === STATEMENT_TYPE.ARRAY_LITERAL
            || elem.type === STATEMENT_TYPE.OBJECT_DECONSTRUCTION) {
            const val = findBoundVariable(elem, found, dynamicLookup({ expr: prevExpr, lookupKey: i }));
            if (val) return val;
          }
        }
        return null;
      } else if (expr.type === STATEMENT_TYPE.OBJECT_DECONSTRUCTION) {
        for (const [k, elem] of Object.entries(expr.expr)) {
          // console.log(elem);
          if (elem.type === STATEMENT_TYPE.BOUND_VARIABLE) {
            const val = findBoundVariable(elem, found, dynamicLookup({ expr: prevExpr, lookupKey: k }));
            if (val) return val;
          } else if (elem.type === STATEMENT_TYPE.ARRAY_LITERAL
            || elem.type === STATEMENT_TYPE.OBJECT_DECONSTRUCTION) {
            const val = findBoundVariable(elem, found, dynamicLookup({ expr: prevExpr, lookupKey: k }));
            if (val) return val;
          }
        }
        return null;
      } else {
        return null;
      }
    };

    const parseMatchCase = (matchExpr, contexts) => {
      const expr = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.MATCH_CASE]);
      let paramNames = [], paramExprs = [], symbol, boundExpr;
      while (symbol !== null) {
        const res = findBoundVariable(expr.toJS(), paramNames);
        [symbol, boundExpr] = res === null ? [null] : res;
        if (symbol != null) {
          paramNames.push(symbol);
          paramExprs.push(
            fnCall({
              expr: fn({
                paramNames: ['arg'],
                body: [_return({ expr: boundExpr })]
              }),
              paramExprs: [ matchExpr ]
            })
          );
        }
      }
      consumeOne(TOKEN_NAMES.ARROW);
      const body = parseFunctionBody(contexts);
      return matchCase({
        expr,
        invoke: fnCall({
          expr: fn({ body, paramNames }),
          paramExprs
        })
      });
    };

    const parseMatchExpression = contexts => {
      consumeOne(TOKEN_NAMES.MATCH);
      consumeOne(TOKEN_NAMES.OPEN_PARAN);
      const expr = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.MATCH_EXPRESSION]);
      consumeOne(TOKEN_NAMES.CLOSE_PARAN);
      consumeOne(TOKEN_NAMES.OPEN_BRACE);
      const cases = [];
      while (tokens[i] !== STATEMENT_TYPE.CLOSE_BRACE) {
        cases.push(parseMatchCase(expr, contexts));
        if (tokens[i] !== TOKEN_NAMES.COMMA) break;
        consumeOne(TOKEN_NAMES.COMMA);
      }
      consumeOne(TOKEN_NAMES.CLOSE_BRACE);
      return matchExpression({ expr, cases });
    };

    const parseDynamicLookup = (contexts, expr) => {
      consumeOne(TOKEN_NAMES.OPEN_SQ_BRACE);
      const lookupKey = parseLiteral(contexts).get('value');
      assert((typeof lookupKey === 'number' && Number.isInteger(lookupKey))
        || typeof lookupKey === 'string');
      consumeOne(TOKEN_NAMES.CLOSE_SQ_BRACE);
      return dynamicLookup({ expr, lookupKey });
    };

    const parseNode = (token, contexts = [], until = undefined) => match(token, [
      [[TOKEN_NAMES.LITERAL, any], () => parseLiteral(contexts)],
      [TOKEN_NAMES.RETURN, () => {
        consumeOne(TOKEN_NAMES.RETURN);
        const expr = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.RETURN]);
        consumeOne(TOKEN_NAMES.END_STATEMENT);
        return _return({ expr });
      }],
      [TOKEN_NAMES.IF, () => {
        consumeOne(TOKEN_NAMES.IF);
        return parseConditional(contexts);
      }],
      [TOKEN_NAMES.MATCH, () => parseMatchExpression(contexts)],
      [TOKEN_NAMES.LET, () => {
        assert(!isExpression(contexts));
        consumeOne(TOKEN_NAMES.LET);
        const [mutable, symbol] = consume([
          { token: TOKEN_NAMES.MUT, optional: true },
          { token: [TOKEN_NAMES.SYMBOL, any] },
          { token: TOKEN_NAMES.ASSIGNMENT },
        ]);
        const expr = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.DECLARATION]);

        consumeOne(TOKEN_NAMES.END_STATEMENT);
        return declaration({ mutable: !!mutable, symbol, expr });
      }],
      [[TOKEN_NAMES.SYMBOL, any], function parseSymbol(symToken, prevExpr) {
        let symbol
        if (!prevExpr) symbol = consumeOne(symToken);
        const isSymbol = typeof symbol !== 'undefined';
        return match(tokens[i], [
          [until, () => prevExpr || symbolLookup({ symbol })],
          [TOKEN_NAMES.ASSIGNMENT, () => {
            assert(isSymbol);
            assert(!isExpression(contexts));
            consumeOne(TOKEN_NAMES.ASSIGNMENT);
            const expr = parseNode(tokens[i], [...contexts, STATEMENT_TYPE.ASSIGNMENT]);
            consumeOne(TOKEN_NAMES.END_STATEMENT);
            return assignment({ symbol, expr });
          }],
          [TOKEN_NAMES.OPEN_PARAN, () => {
            const call = parseFunctionCall(contexts, prevExpr || symbolLookup({ symbol }));
            if (tokens[i] === TOKEN_NAMES.END_STATEMENT) {
              if (isExpression(contexts)) return call;
              consumeOne(TOKEN_NAMES.END_STATEMENT); // for top level function application
              return call;
            }
            return parseSymbol(tokens[i], call);
          }],
          [[TOKEN_NAMES.OPERATOR, any], () => {
            if (!prevExpr) assert(isSymbol);
            return parseOperatorExpr(contexts, prevExpr || symbolLookup({ symbol }));
          }],
          [TOKEN_NAMES.PROPERTY_ACCESSOR, () => {
            const expr = parseDotNotation(prevExpr || symbolLookup({ symbol }));
            // check if reached end of expression
            if (
              tokens[i] === TOKEN_NAMES.END_STATEMENT || tokens[i] === TOKEN_NAMES.CLOSE_PARAN
            ) return expr;
            return parseSymbol(tokens[i], expr);
          }],
          [TOKEN_NAMES.OPEN_SQ_BRACE, () => {  
            const expr = parseDynamicLookup(contexts, prevExpr || symbolLookup({ symbol }));
            // check if reached end of expression
            if (
              tokens[i] === TOKEN_NAMES.END_STATEMENT || tokens[i] === TOKEN_NAMES.CLOSE_PARAN
            ) return expr;
            return parseSymbol(tokens[i], expr);
          }],
          [TOKEN_NAMES.ARROW, () => {
            if (inMatchCond(contexts)) {
              return boundVariable({ symbol });
            } else {
              // TODO: not sure why I can't have this at top of fn
              consumeOne(TOKEN_NAMES.ARROW);
              return fn({ body: parseFunctionBody(contexts), paramNames: [symbol] })
            }
          }],
          [any, () => {
            if (inMatchCond(contexts)) {
              return boundVariable({ symbol });
            } else {  
              return prevExpr || symbolLookup({ symbol });
            }
          }]
        ]);
      }],
      [TOKEN_NAMES.OPEN_PARAN, () => {
        // function definition
        consumeOne(TOKEN_NAMES.OPEN_PARAN);
        const paramNames = parseFunctionDefinitionArgs();
        consumeOne(TOKEN_NAMES.CLOSE_PARAN);
        consumeOne(TOKEN_NAMES.ARROW);
        return fn({ body: parseFunctionBody(contexts), paramNames });
      }],
      [TOKEN_NAMES.OPEN_BRACE, () => {
        assert(isExpression(contexts));
        const [value, isDeconstruction] = parseObjectLiteralOrDeconstruction(contexts);
        if (isDeconstruction) {
          return objectDeconstruction({ expr: value });
        } else {
          if (tokens[i] === TOKEN_NAMES.PROPERTY_ACCESSOR) {
            return parseDotNotation(objectLiteral({ value }))
          }
          return objectLiteral({ value });
        }
      }],
      [TOKEN_NAMES.OPEN_SQ_BRACE, () => {
        assert(isExpression(contexts));
        const array = parseArrayLiteral(contexts);
        return match(tokens[i], [
          [until, () => array],
          [[TOKEN_NAMES.OPERATOR, any], () =>
            parseOperatorExpr(contexts, array)
          ],
          [any, () => array]
        ]);
      }],
      [TOKEN_NAMES.TRUE, () => {
        assert(isExpression(contexts));
        consumeOne(TOKEN_NAMES.TRUE);
        return booleanLiteral({ value: true });
      }],
      [TOKEN_NAMES.FALSE, () => {
        assert(isExpression(contexts));
        consumeOne(TOKEN_NAMES.FALSE);
        return booleanLiteral({ value: false });
      }],
      [any, () => { throw 'did not match any ' + token }],
    ]);
    // TODO: W T F
    if (i !== 0) --i;
    AST = AST.set('body', AST.get('body').push(parseNode(tokens[i])));
  }
  return AST;
};

export default parse;