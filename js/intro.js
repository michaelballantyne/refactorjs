var State = function(statements, environment) {
    this.statements = statements;
    this.environment = environment;
}

var deepCopy = function(object) {
    return JSON.parse(JSON.stringify(object));
}

var abstractInt = function(number) {
    if (number < 0) {
        return ['-'];
    } else if (number === 0) {
        return [0];
    } else if (number > 0) {
        return ['+'];
    }

    throw "Number should be positive, negative, or zero."
}

var signPlus = function(left, right) {
    if (right === 0) {
        return [left];
    } else if (left === 0) {
        return [right];
    } else if (left === '-' && right === '-') {
        return ['-'];
    } else if (left === '+' && right === '+') {
        return ['+'];
    } else if ((left === '+' && right === '-')
            || (left === '-' && right === '+')) {
        return ['-', 0, '+'];
    } else {
        throw "Missed a sign combo, I guess";
    }
}

var signMinus = function(left, right) {
    if (left === '+' && right === '+') {
        return ['-', 0, '+'];
    } else if (left === '+' && right === 0) {
        return ['+'];
    } else if (left === '+' && right === '-') {
        return ['+'];
    } else if (left === 0 && right === '+') {
        return ['-'];
    } else if (left === 0 && right === 0) {
        return [0];
    } else if (left === 0 && right === '-') {
        return ['+'];
    } else if (left === '-' && right === '+') {
        return ['-'];
    } else if (left === '-' && right === 0) {
        return ['-'];
    } else if (left === '-' && right === '-') {
        return ['-', 0, '+'];
    }
}

var abstractOperation = function(left, right, signOperation) {
    var result = [];
    _.each(left, function(lsign) {
        _.each(right, function(rsign) {
           result = _.union(result, signOperation(lsign, rsign));
        });
    });
    return result;
}

var absEvalExpression = function(expression, env) {
    if (expression.type === "Literal") {
        return abstractInt(expression.value);
    }

    if (expression.type === "BinaryExpression") {
        var left = absEvalExpression(expression.left, env);
        var right = absEvalExpression(expression.right, env);

        var opMap = {'+': signPlus, '-': signMinus};

        if (!_.contains(_.keys(opMap), expression.operator)) {
            throw "Operation " + expression.operator + " not supported";
        }

        return abstractOperation(left, right, opMap[expression.operator]);
    }

    if (expression.type === "Identifier") {
        return env[expression.name];
    }

    if (expression.type === "UnaryExpression"
        && expression.operator === "-") {
        return abstractOperation([0], absEvalExpression(expression.argument, env), signMinus);
    }

    throw "Support for this expression not implemented";
}

var absStep = function(state) {
    var statement = state.statements[0];

    if (statement.type === "ExpressionStatement" &&
        statement.expression.type === "AssignmentExpression") {
        var identifier = statement.expression.left.name;
        var expression = statement.expression.right;
        var newStatements = state.statements.slice(1);

        var newEnv = Object.create(state.environment);
        newEnv[identifier] = absEvalExpression(expression, state.environment);

        return [new State(newStatements, newEnv)];
    } else if (statement.type === "IfStatement") {
        var newStatementsIf = statement.consequent.body.concat(state.statements.slice(1));

        return [new State(newStatementsIf, state.environment),
                new State(state.statements.slice(1), state.environment)];
    } else if (statement.type === "WhileStatement") { 
        var newStatements = statement.body.body.concat([statement], state.statements.slice(1));
        return [new State(newStatements, state.environment),
                new State(state.statements.slice(1), state.environment)];
    } else {
        throw "Only variable assignments are implemented.";
    }

}

// Linear search.
var deepIndexOf = function(lst, obj) { 
    var i;
    for (i = 0; i < lst.length; i++) {
        if (_.isEqual(lst[i], obj)) {
            return i;
        }
    }
    return false;
}

var analyze = function(program) {
    var nodes = [new State(program.body, {})];
    var todoIndex = 0;
    var neighborsMap = {};

    while (todoIndex < nodes.length) {
        var currentState = nodes[todoIndex];
        if (currentState.statements.length > 0) {
            var successors = absStep(currentState);
            var i;
            neighborsMap[todoIndex] = [];
            for (i = 0; i < successors.length; i++) {
                var successorIndex = deepIndexOf(nodes, successors[i]);
                if (!successorIndex) {
                    successorIndex = nodes.push(successors[i]) - 1;
                }
                neighborsMap[todoIndex].push(successorIndex);
            }
        }
        todoIndex++;
    }

    return {nodes: nodes, neighborsMap: neighborsMap};
}

function main(data) {
    var tree = parser.parse(data)
    console.log(tree);

    var analysis = analyze(tree);
    var nodes = analysis.nodes;
    console.log(JSON.stringify(nodes, null, 4));
    var stringNodes = _.map(nodes, function(node) { 
        var program = {};
        program.type = "Program";
        program.body = node.statements;
        return {code: escodegen.generate(program), env: node.environment};
    });
    console.log(JSON.stringify({nodes: stringNodes}, null, 4));
    var vizsrc = "digraph G {\n"
    var i;
    _.each(stringNodes, function(node, element) {
        vizsrc += '"' + String(element) + '" [\nshape = "box"\nlabel = "program:\\l' + node.code.replace(/\n/g, "\\l") + '\\l\\lenv: ' + JSON.stringify(node.env).replace(/\"/g, "\\\"") + '\\l"\n];\n';
    });
    
    _.each(analysis.neighborsMap, function(l, source) {
        _.each(l, function(dest) {
            vizsrc += '"' + String(source) + '" -> "' + String(dest) + '"\n';
        });
    });


    vizsrc += '}';
    console.log(vizsrc);
    document.getElementById('canvas').innerHTML = Viz(vizsrc, "svg");
}
