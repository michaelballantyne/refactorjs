var interpreter = {};

var State = function(statements, environment, store, ostore) {
    this.statements = statements;
    this.environment = environment;
    this.store = store;
    this.ostore = ostore;
};

var deepCopy = function(object) {
    return JSON.parse(JSON.stringify(object));
};

var absInt = function(number) {
    return {type: "integer"}; 
};

var absString = function(string) {
    return {type: "string", value: string};
}

var olocToParse = {};

var allocToAccess = {};
var accessToAlloc = {};

var posString = function(pos) {
    return pos.line + ":" + pos.column;
}

var locString = function(range) {
    return posString(range.start) + "-" + posString(range.end);
};

var fieldRange = function(expression, field) {
    var properties = expression.properties;
    var i;
    for (i = 0; i < properties.length; i++) {
        if (properties[i].key.name === field) {
            return locString(properties[i].key.loc);
        }
    }
    return null;
};

var absObject = function(expression, state) {
    var properties = expression.properties
    var object = {};
    var i;
    var property;

    var oloc = posString(expression.loc.start);

    olocToParse[oloc] = expression;

    for (i = 0; i < properties.length; i++) {
        property = properties[i];
        object[property.key.name] = interpreter.absEvalExpression(property.value, state);
    }

    state.ostore[oloc] = object;

    var result = {type: "oloc", value: oloc};
    return result;
};


var objAccess = function(expression, state) {
    var object = interpreter.absEvalExpression(expression.object, state);
    var property = interpreter.absEvalExpression(expression.property, state);

    if (property.type !== "string") {
        throw "Error";
    }

    if (object.type !== "oloc") {
        throw "Error";
    }

    var oloc = object.value;
    var alloc = fieldRange(olocToParse[oloc], property.value);
    var loc = expression.property.loc;
    var adjustedLoc = {start: {line: loc.start.line, column: loc.start.column + 1}, end: {line: loc.end.line, column: loc.end.column - 1}};
    var access = locString(adjustedLoc);

    if (!allocToAccess.hasOwnProperty(alloc)) {
        allocToAccess[alloc] = [];
    }
    allocToAccess[alloc].push(access);
    
    if (!accessToAlloc.hasOwnProperty(access)) {
        accessToAlloc[access] = [];
    }
    accessToAlloc[access].push(alloc);

    return state.ostore[object.value][property.value];
};

interpreter.absEvalExpression = function(expression, state) {
    if (expression.type === "Literal") {
        if (typeof(expression.value) === "number") {
            return absInt(expression.value);
        }
        else if (typeof(expression.value) === "string") {
            return absString(expression.value);
        }
    }

    if (expression.type === "BinaryExpression") {
        var left = interpreter.absEvalExpression(expression.left, state);
        var right = interpreter.absEvalExpression(expression.right, state);

        if (left.type == "integer" && right.type == "integer") {
            return {type: "integer"};
        }

        throw "Unsupported";
    }

    if (expression.type === "Identifier") {
        return state.environment[expression.name];
    }

    if (expression.type === "UnaryExpression"
        && expression.operator === "-") {
        return interpreter.absEvalExpression(expression.argument, state);
    }

    if (expression.type === "ObjectExpression") {
        return absObject(expression, state);
    }

    if (expression.type === "MemberExpression") {
        return objAccess(expression, state);
    }

    throw "Support for this expression not implemented";
};

var absAssignment = function(statement, state) {
    var newState = deepCopy(state);

    var identifier = statement.expression.left.name;
    var expression = statement.expression.right;

    newState.statements = newState.statements.slice(1);

    newState.environment[identifier] = interpreter.absEvalExpression(expression, newState);

    return [newState];
};

var absIf = function(statement, state) {
    var newStateIf = deepCopy(state);
    var newStateElse = deepCopy(state);

    newStateIf.statements = statement.consequent.body.concat(state.statements.slice(1));
    newStateElse.statements = newStateElse.statements.slice(1);

    return [newStateIf, newStateElse];
};

var absWhile = function(statement, state) {
    var newStateBody = deepCopy(state);
    var newStateElse = deepCopy(state);

    newStateBody.statements = statement.body.body.concat([statement], state.statements.slice(1)) 
    newStateElse.statements = newStateElse.statements.slice(1);

    return [newStateBody, newStateElse];
}

var absStep = function(state) {
    var statement = state.statements[0];

    if (statement.type === "ExpressionStatement" &&
        statement.expression.type === "AssignmentExpression") {
        return absAssignment(statement, state);
    } else if (statement.type === "IfStatement") {
        return absIf(statement, state);
    } else if (statement.type === "WhileStatement"
        || statement.type === "ForStatement") { 
        return absWhile(statement, state);
    } else if (statement.type === "VariableDeclaration") {
        var newState = deepCopy(state);
        newState.environment[statement.declarations[0].id.name] = {type: "undefined"}    
        return newState;
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
    var nodes = [new State(program.body, {}, {}, {})];
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

    return {nodes: nodes, neighborsMap: neighborsMap, accessToAlloc: accessToAlloc, allocToAccess: allocToAccess};

}


function flatten(obj) {
    var result = Object.create(obj);
    for(var key in result) {
        result[key] = result[key];
    }
    return result;
}

function main(data) {
    var tree = parser.parse(data, {loc: true})
    console.log(tree);

    var analysis = analyze(tree);
    var nodes = analysis.nodes;
    console.log(JSON.stringify(nodes, null, 4));
    var stringNodes = _.map(nodes, function(node) { 
        var program = {};
        program.type = "Program";
        program.body = node.statements;
        return {code: escodegen.generate(program), env: flatten(node.environment), ostore: flatten(node.ostore)};
    });
    console.log(JSON.stringify({nodes: stringNodes}, null, 4));
    var vizsrc = "digraph G {\n"
    var i;
    _.each(stringNodes, function(node, element) {
        vizsrc += '"' + String(element) + '" [\nshape = "box"\nlabel = "program:\\l' + node.code.replace(/\n/g, "\\l") + '\\l\\lenv: ' + JSON.stringify(node.env, null, 4).replace(/\"/g, "\\\"").replace(/\n/g, "\\l") + '\\l\\lostore: ' + JSON.stringify(node.ostore, null, 4).replace(/\"/g, "\\\"").replace(/\n/g, "\\l") + '\\l\"\n];\n';
    });
    
    _.each(analysis.neighborsMap, function(l, source) {
        _.each(l, function(dest) {
            vizsrc += '"' + String(source) + '" -> "' + String(dest) + '"\n';
        });
    });


    vizsrc += '}';
    console.log(vizsrc);
    document.getElementById('canvas').innerHTML = Viz(vizsrc, "svg");

    return analysis;
}
