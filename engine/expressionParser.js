// ---------- Story Parser ----------

export function resolveExpression(expr, context) {
  // número direto
  if (typeof expr === "number") {
    return expr;
  }

  // variável
  if (expr.var) {
    return context.variables[expr.var] ?? 0;
  }

  // dice
  if (expr.dice) {
    const { count, sides } = expr.dice;
    const results = rollDice(count, sides);

    context.events.push({
      type: "dice",
      dice: { count, sides },
      results,
      total: results.reduce((a, b) => a + b, 0)
    });

    return results.reduce((a, b) => a + b, 0);
  }

  // operadores
  if (expr.add) {
    return expr.add
      .map(e => resolveExpression(e, context))
      .reduce((a, b) => a + b, 0);
  }

  if (expr.subtract) {
    const values = expr.subtract.map(e =>
      resolveExpression(e, context)
    );
    return values.slice(1).reduce((a, b) => a - b, values[0]);
  }

  if (expr.multiply) {
    return expr.multiply
      .map(e => resolveExpression(e, context))
      .reduce((a, b) => a * b, 1);
  }

  if (expr.divide) {
    const values = expr.divide.map(e =>
      resolveExpression(e, context)
    );
    return values.slice(1).reduce((a, b) => a / b, values[0]);
  }

  throw new Error("Invalid expression");
}


// ----------Visual Editor ----------

export function parseNaturalExpression(input) {
  const normalized = normalizeExpression(input);
  const tokens = tokenize(normalized);
  const ast = buildAST(tokens);
  return convertASTToEngineFormat(ast);
}

function normalizeExpression(str) {
  return str
    .replace(/[\[\{]/g, "(")
    .replace(/[\]\}]/g, ")")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function tokenize(str) {
  const regex = /\d+d\d+|d\d+|\d+|[a-z_]\w*|[()+\-*/^%]/gi;
  return str.match(regex) || [];
}

const PRECEDENCE = {
  "+": 2,
  "-": 2,
  "*": 1,
  "/": 1,
  "%": 1,
  "^": 3
};

function buildAST(tokens) {
  const output = [];
  const operators = [];

  for (const token of tokens) {
    if (isNumber(token) || isVariable(token) || isDice(token)) {
      output.push(token);
    }
    else if (isOperator(token)) {
      while (
        operators.length &&
        PRECEDENCE[operators[operators.length - 1]] >= PRECEDENCE[token]
      ) {
        output.push(operators.pop());
      }
      operators.push(token);
    }
    else if (token === "(") {
      operators.push(token);
    }
    else if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") {
        output.push(operators.pop());
      }
      operators.pop();
    }
  }

  while (operators.length) {
    output.push(operators.pop());
  }

  return buildTreeFromRPN(output);
}

function buildTreeFromRPN(rpn) {
  const stack = [];

  for (const token of rpn) {
    if (isOperator(token)) {
      const right = stack.pop();
      const left = stack.pop();
      stack.push({
        type: "binary",
        operator: token,
        left,
        right
      });
    } else {
      stack.push(token);
    }
  }

  return stack[0];
}

function convertASTToEngineFormat(node) {
  if (typeof node === "string") {
    if (isNumber(node)) {
      return Number(node);
    }

    if (isDice(node)) {
      const [count, sides] = parseDice(node);
      return { dice: { count, sides } };
    }

    if (isVariable(node)) {
      return { var: node };
    }
  }

  if (node.type === "binary") {
    const left = convertASTToEngineFormat(node.left);
    const right = convertASTToEngineFormat(node.right);

    switch (node.operator) {
      case "+":
        return { add: [left, right] };
      case "-":
        return { subtract: [left, right] };
      case "*":
        return { multiply: [left, right] };
      case "/":
        return { divide: [left, right] };
      case "%":
        return { modulo: [left, right] };
      case "^":
        return { power: [left, right] };
    }
  }

  throw new Error("Invalid expression");
}

function isNumber(token) {
  return /^\d+$/.test(token);
}

function isVariable(token) {
  return /^[a-z_]\w*$/.test(token) && !token.includes("d");
}

function isDice(token) {
  return /^\d*d\d+$/.test(token);
}

function isOperator(token) {
  return "+-*/%^".includes(token);
}

function parseDice(token) {
  if (token.startsWith("d")) {
    return [1, Number(token.slice(1))];
  }

  const [count, sides] = token.split("d");
  return [Number(count), Number(sides)];
}


// sample
//((lockPicking + 1) + 2d6) * strength
//{
//  multiply: [
//    {
//      add: [
//        {
//          add: [
//            { var: "lockPicking" },
//            1
//          ]
//        },
//        { dice: { count: 2, sides: 6 } }
//      ]
//    },
//    { var: "strength" }
//  ]
//}



//No futuro
//clamp(x, min, max)
//round(x)
//floor(x)
//ceil(x)
//min(a,b)
//max(a,b)
//abs(x)
//
