import parse, {
  STATEMENT_TYPE,
  declaration,
  assignment,
  objectLiteral,
  arrayLiteral,
  numberLiteral,
  stringLiteral,
  fn,
  fnCall,
  _return,
  symbolLookup,
  propertyLookup,
  makeConsumer,
} from './parser.mjs';
import diff from './diff.mjs';
import tokenize, { TOKEN_NAMES } from './tokenizer.mjs';
import { eq } from './utils.mjs';
import assert from 'assert';

let passed = 0;
const it = (str, fn) => {
  console.log(`it - ${str}`);
  fn();
  passed++;
}

it('should parse `let var = 3;`', () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'var'],
    TOKEN_NAMES.ASSIGNMENT,
    [TOKEN_NAMES.LITERAL, 3],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);
  console.log(ast.body[0]);
  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'var',
        mutable: false,
        expr: numberLiteral({value: 3})
      })
    ]
  }))
});


it('should parse `let var = \'abc\';`', () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'var'],
    TOKEN_NAMES.ASSIGNMENT,
    [TOKEN_NAMES.LITERAL, 'abc'],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'var',
        mutable: false,
        expr: stringLiteral({value: 'abc'})
      })
    ]
  }))
});

it(`should parse mutable variable`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    TOKEN_NAMES.MUT,
    [TOKEN_NAMES.SYMBOL, 'var'],
    TOKEN_NAMES.ASSIGNMENT,
    [TOKEN_NAMES.LITERAL, 3],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);
  // console.log(ast);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'var',
        mutable: true,
        expr: numberLiteral({value: 3})
      }),
    ]
  }))
});

it(`should parse variable assignment`, () => {
  const tokens = [
    [TOKEN_NAMES.SYMBOL, 'var'],
    TOKEN_NAMES.ASSIGNMENT,
    [TOKEN_NAMES.LITERAL, 3],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);
  // console.log(ast);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      assignment({symbol: 'var', expr: numberLiteral({value: 3})}),
    ]
  }))
});

it(`should parse function`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'function'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_PARAN,
    TOKEN_NAMES.CLOSE_PARAN,
    TOKEN_NAMES.ARROW,
    [TOKEN_NAMES.LITERAL, 3],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'function',
        mutable: false,
        expr: fn({paramNames: [], body: [_return({expr: numberLiteral({value: 3})})]})
      })
    ]
  }))
});


it(`should parse function with variable lookup`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'function'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_PARAN,
    TOKEN_NAMES.CLOSE_PARAN,
    TOKEN_NAMES.ARROW,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);
  // console.log(ast.body[0].expr.body);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'function',
        mutable: false,
        expr: fn({paramNames: [], body: [_return({expr: symbolLookup({symbol: 'a'})})]})
      })
    ]
  }))
});

it(`should parse identity function`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'id'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_PARAN,
    [TOKEN_NAMES.SYMBOL, 'x'],
    TOKEN_NAMES.CLOSE_PARAN,
    TOKEN_NAMES.ARROW,
    [TOKEN_NAMES.SYMBOL, 'x'],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);
  // console.log(JSON.stringify(ast.body[0].expr));

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'id',
        mutable: false,
        expr: fn({paramNames: ['x'], body: [_return({expr: symbolLookup({symbol: 'x'})})]})
      }),
    ]
  }))
});


it(`should parse function application with arguments`, () => {
  const tokens = [
    [TOKEN_NAMES.SYMBOL, 'add'],
    TOKEN_NAMES.OPEN_PARAN,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.COMMA,
    [TOKEN_NAMES.SYMBOL, 'b'],
    TOKEN_NAMES.CLOSE_PARAN,
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      fnCall({
        expr: symbolLookup({symbol: 'add'}),
        paramExprs: [
          symbolLookup({symbol: 'a'}),
          symbolLookup({symbol: 'b'}),
        ]
      }),
    ]
  }))
});


it(`should parse function with multiple args`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'add'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_PARAN,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.COMMA,
    [TOKEN_NAMES.SYMBOL, 'b'],
    TOKEN_NAMES.CLOSE_PARAN,
    TOKEN_NAMES.ARROW,
    [TOKEN_NAMES.SYMBOL, 'a'],
    [TOKEN_NAMES.OPERATOR, '+'],
    [TOKEN_NAMES.SYMBOL, 'b'],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'add',
        mutable: false,
        expr: fn({
          paramNames: ['a', 'b'],
          body: [_return({
            expr: fnCall({
              expr: symbolLookup({symbol: '+'}),
              paramExprs: [symbolLookup({symbol: 'a'}), symbolLookup({symbol: 'b'})]
            })
          })]
        })
      }),
    ]
  }))
});


it(`should parse function with body`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'function'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_PARAN,
    TOKEN_NAMES.CLOSE_PARAN,
    TOKEN_NAMES.ARROW,
    TOKEN_NAMES.OPEN_BRACE,
    TOKEN_NAMES.RETURN,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.END_STATEMENT,
    TOKEN_NAMES.CLOSE_BRACE,
    TOKEN_NAMES.END_STATEMENT
  ];
  // console.log(tokens);
  const ast = parse(tokens);
  // console.log(ast.body[0].expr.body);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'function',
        mutable: false,
        expr: fn({
          paramNames: [],
          body: [_return({expr: symbolLookup({symbol: 'a'})})]
        })
      }),
    ]
  }))
});


it(`should parse object literal`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'obj'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_BRACE,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.COLON,
    [TOKEN_NAMES.LITERAL, 3],
    TOKEN_NAMES.COMMA,
    [TOKEN_NAMES.SYMBOL, 'yesa'],
    TOKEN_NAMES.COLON,
    [TOKEN_NAMES.LITERAL, 5],
    TOKEN_NAMES.COMMA,
    TOKEN_NAMES.CLOSE_BRACE,
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        symbol: 'obj',
        mutable: false,
        expr: objectLiteral({value: { a: numberLiteral({value: 3}), yesa: numberLiteral({value: 5})}})
      })
    ]
  }))
});

it(`should parse object dot notation on variable`, () => {
  const tokens = [
    [TOKEN_NAMES.SYMBOL, 'obj'],
    TOKEN_NAMES.PROPERTY_ACCESSOR,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      {
        type: STATEMENT_TYPE.PROPERTY_LOOKUP,
        expr: {
          type: STATEMENT_TYPE.SYMBOL_LOOKUP,
          symbol: 'obj',
        },
        property: 'a',
      }
    ]
  }))
});

it(`should parse object dot notation on object`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'obj'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_BRACE,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.COLON,
    [TOKEN_NAMES.LITERAL, 3],
    TOKEN_NAMES.COMMA,
    [TOKEN_NAMES.SYMBOL, 'yesa'],
    TOKEN_NAMES.COLON,
    [TOKEN_NAMES.LITERAL, 5],
    TOKEN_NAMES.COMMA,
    TOKEN_NAMES.CLOSE_BRACE,
    TOKEN_NAMES.PROPERTY_ACCESSOR,
    [TOKEN_NAMES.SYMBOL, 'yesa'],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      {
        type: STATEMENT_TYPE.DECLARATION,
        mutable: false,
        symbol: 'obj',
        expr: {
          type: STATEMENT_TYPE.PROPERTY_LOOKUP,
          property: 'yesa',
          expr: {
            type: STATEMENT_TYPE.OBJECT_LITERAL,
            value: {
              a: {
                type: STATEMENT_TYPE.NUMBER_LITERAL,
                value: 3
              },
              yesa: {
                type: STATEMENT_TYPE.NUMBER_LITERAL,
                value: 5
              }
            }
          },
        }
      }
    ]
  }))
});

it(`should parse nested object dot notation on variable`, () => {
  const tokens = [
    [TOKEN_NAMES.SYMBOL, 'obj'],
    TOKEN_NAMES.PROPERTY_ACCESSOR,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.PROPERTY_ACCESSOR,
    [TOKEN_NAMES.SYMBOL, 'b'],
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      {
        type: STATEMENT_TYPE.PROPERTY_LOOKUP,
        expr: {
          type: STATEMENT_TYPE.PROPERTY_LOOKUP,
          expr: {
            type: STATEMENT_TYPE.SYMBOL_LOOKUP,
            symbol: 'obj',
          },
          property: 'a',
        },
        property: 'b',
      }
    ]
  }))
});

it(`should parse array literal`, () => {
  const tokens = [
    TOKEN_NAMES.LET,
    [TOKEN_NAMES.SYMBOL, 'arr'],
    TOKEN_NAMES.ASSIGNMENT,
    TOKEN_NAMES.OPEN_SQ_BRACE,
    [TOKEN_NAMES.LITERAL, 3],
    TOKEN_NAMES.COMMA,
    [TOKEN_NAMES.SYMBOL, 'a'],
    TOKEN_NAMES.COMMA,
    TOKEN_NAMES.OPEN_BRACE,
    [TOKEN_NAMES.SYMBOL, 'b'],
    TOKEN_NAMES.COLON,
    [TOKEN_NAMES.LITERAL, 'str'],
    TOKEN_NAMES.CLOSE_BRACE,
    TOKEN_NAMES.CLOSE_SQ_BRACE,
    TOKEN_NAMES.END_STATEMENT
  ];
  const ast = parse(tokens);

  // let arr = [3, a, { b: 'str' }];
  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      {
        type: STATEMENT_TYPE.DECLARATION,
        mutable: false,
        symbol: 'arr',
        expr: {
          type: STATEMENT_TYPE.ARRAY_LITERAL,
          elements: [
            {
              type: STATEMENT_TYPE.NUMBER_LITERAL,
              value: 3
            },
            {
              type: STATEMENT_TYPE.SYMBOL_LOOKUP,
              symbol: 'a'
            },
            {
              type: STATEMENT_TYPE.OBJECT_LITERAL,
              value: {
                b: {
                  type: STATEMENT_TYPE.STRING_LITERAL,
                  value: 'str'
                }
              }
            }
          ]
        }
      }
    ]
  }))
});

it('should parse assignment with variable & literal', () => {
  const program = tokenize(`
  let a = 1;
  let b = a + 1;
  `);
  const ast = parse(program);
  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      {
        type: STATEMENT_TYPE.DECLARATION,
        mutable: false,
        symbol: 'a',
        expr: {
          type: STATEMENT_TYPE.NUMBER_LITERAL,
          value: 1
        }
      },
      {
        type: STATEMENT_TYPE.DECLARATION,
        mutable: false,
        symbol: 'b',
        expr: {
          type: STATEMENT_TYPE.FUNCTION_APPLICATION,
          expr: symbolLookup({symbol: '+'}),
          paramExprs: [
            {
              type: STATEMENT_TYPE.SYMBOL_LOOKUP,
              symbol: 'a'
            },
            {
              type: STATEMENT_TYPE.NUMBER_LITERAL,
              value: 1
            }
          ]
        }
      }
    ]
  }));
});

it('should parse function statements', () => {
  const program = tokenize(`
  let makeCounter = () => {
  };
  `);
  // console.log(program);
  const ast = parse(program);
  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      {
        type: STATEMENT_TYPE.DECLARATION,
        mutable: false,
        symbol: 'makeCounter',
        expr: {
          type: STATEMENT_TYPE.FUNCTION,
          paramNames: [],
          body: []
        }
      }
    ]
  }))
});

it('should parse double function application', () => {
  const program = tokenize(`
  let f = (a) => (b) => a + b;
  let h = f(1)(2);
  `);
  const ast = parse(program);
  assert(eq(ast, {
    type: STATEMENT_TYPE.PROGRAM,
    body: [
      declaration({
        mutable: false,
        symbol: 'f',
        expr: fn({
          paramNames: ['a'],
          body: [
            _return({
              expr: fn({
                paramNames: ['b'],
                body: [
                  _return({expr: fnCall({
                    expr: symbolLookup({symbol: '+'}),
                    paramExprs: [symbolLookup({symbol: 'a'}), symbolLookup({symbol: 'b'})]
                  })})
                ]
              })
            })
          ]
        })
      }),
      declaration({
        mutable: false,
        symbol: 'h',
        expr: fnCall({
          expr: fnCall({
            expr: symbolLookup({symbol: 'f'}),
            paramExprs: [numberLiteral({value: 1})]
          }),
          paramExprs: [numberLiteral({value: 2})]
        })
      })
    ]
  }))
})

/*

if obj == { a: 3 } {

} else {

}
->
{
  type: 'CONDITION_STATEMENT'
  cond: {
    type: 'EXPRESSION'
    expr: {
      type: 'FUNCTION_APPLICATION',
      function: '==',
      params: [
        {
          type: 'VARIABLE_LOOKUP',
          symbol: 'obj
        },
        {
          type: 'OBJECT_LITERAL',
          value: {
            a: 3
          }
        }
      ]
    }
  },
  succeedBranch: null,
  failBranch: null
*/



console.log('Passed', passed, 'tests!');