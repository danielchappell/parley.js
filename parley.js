(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var Handlebars = require("./handlebars.runtime")["default"];

// Compiler imports
var AST = require("./handlebars/compiler/ast")["default"];
var Parser = require("./handlebars/compiler/base").parser;
var parse = require("./handlebars/compiler/base").parse;
var Compiler = require("./handlebars/compiler/compiler").Compiler;
var compile = require("./handlebars/compiler/compiler").compile;
var precompile = require("./handlebars/compiler/compiler").precompile;
var JavaScriptCompiler = require("./handlebars/compiler/javascript-compiler")["default"];

var _create = Handlebars.create;
var create = function() {
  var hb = _create();

  hb.compile = function(input, options) {
    return compile(input, options, hb);
  };
  hb.precompile = function (input, options) {
    return precompile(input, options, hb);
  };

  hb.AST = AST;
  hb.Compiler = Compiler;
  hb.JavaScriptCompiler = JavaScriptCompiler;
  hb.Parser = Parser;
  hb.parse = parse;

  return hb;
};

Handlebars = create();
Handlebars.create = create;

exports["default"] = Handlebars;
},{"./handlebars.runtime":3,"./handlebars/compiler/ast":5,"./handlebars/compiler/base":6,"./handlebars/compiler/compiler":7,"./handlebars/compiler/javascript-compiler":8}],3:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var base = require("./handlebars/base");

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
var SafeString = require("./handlebars/safe-string")["default"];
var Exception = require("./handlebars/exception")["default"];
var Utils = require("./handlebars/utils");
var runtime = require("./handlebars/runtime");

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
var create = function() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = SafeString;
  hb.Exception = Exception;
  hb.Utils = Utils;

  hb.VM = runtime;
  hb.template = function(spec) {
    return runtime.template(spec, hb);
  };

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

exports["default"] = Handlebars;
},{"./handlebars/base":4,"./handlebars/exception":12,"./handlebars/runtime":13,"./handlebars/safe-string":14,"./handlebars/utils":15}],4:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];

var VERSION = "1.3.0";
exports.VERSION = VERSION;var COMPILER_REVISION = 4;
exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};
exports.REVISION_CHANGES = REVISION_CHANGES;
var isArray = Utils.isArray,
    isFunction = Utils.isFunction,
    toString = Utils.toString,
    objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials) {
  this.helpers = helpers || {};
  this.partials = partials || {};

  registerDefaultHelpers(this);
}

exports.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: logger,
  log: log,

  registerHelper: function(name, fn, inverse) {
    if (toString.call(name) === objectType) {
      if (inverse || fn) { throw new Exception('Arg not supported with multiple helpers'); }
      Utils.extend(this.helpers, name);
    } else {
      if (inverse) { fn.not = inverse; }
      this.helpers[name] = fn;
    }
  },

  registerPartial: function(name, str) {
    if (toString.call(name) === objectType) {
      Utils.extend(this.partials,  name);
    } else {
      this.partials[name] = str;
    }
  }
};

function registerDefaultHelpers(instance) {
  instance.registerHelper('helperMissing', function(arg) {
    if(arguments.length === 2) {
      return undefined;
    } else {
      throw new Exception("Missing helper: '" + arg + "'");
    }
  });

  instance.registerHelper('blockHelperMissing', function(context, options) {
    var inverse = options.inverse || function() {}, fn = options.fn;

    if (isFunction(context)) { context = context.call(this); }

    if(context === true) {
      return fn(this);
    } else if(context === false || context == null) {
      return inverse(this);
    } else if (isArray(context)) {
      if(context.length > 0) {
        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      return fn(context);
    }
  });

  instance.registerHelper('each', function(context, options) {
    var fn = options.fn, inverse = options.inverse;
    var i = 0, ret = "", data;

    if (isFunction(context)) { context = context.call(this); }

    if (options.data) {
      data = createFrame(options.data);
    }

    if(context && typeof context === 'object') {
      if (isArray(context)) {
        for(var j = context.length; i<j; i++) {
          if (data) {
            data.index = i;
            data.first = (i === 0);
            data.last  = (i === (context.length-1));
          }
          ret = ret + fn(context[i], { data: data });
        }
      } else {
        for(var key in context) {
          if(context.hasOwnProperty(key)) {
            if(data) { 
              data.key = key; 
              data.index = i;
              data.first = (i === 0);
            }
            ret = ret + fn(context[key], {data: data});
            i++;
          }
        }
      }
    }

    if(i === 0){
      ret = inverse(this);
    }

    return ret;
  });

  instance.registerHelper('if', function(conditional, options) {
    if (isFunction(conditional)) { conditional = conditional.call(this); }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function(conditional, options) {
    return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
  });

  instance.registerHelper('with', function(context, options) {
    if (isFunction(context)) { context = context.call(this); }

    if (!Utils.isEmpty(context)) return options.fn(context);
  });

  instance.registerHelper('log', function(context, options) {
    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
    instance.log(level, context);
  });
}

var logger = {
  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

  // State enum
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 3,

  // can be overridden in the host environment
  log: function(level, obj) {
    if (logger.level <= level) {
      var method = logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};
exports.logger = logger;
function log(level, obj) { logger.log(level, obj); }

exports.log = log;var createFrame = function(object) {
  var obj = {};
  Utils.extend(obj, object);
  return obj;
};
exports.createFrame = createFrame;
},{"./exception":12,"./utils":15}],5:[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function LocationInfo(locInfo){
  locInfo = locInfo || {};
  this.firstLine   = locInfo.first_line;
  this.firstColumn = locInfo.first_column;
  this.lastColumn  = locInfo.last_column;
  this.lastLine    = locInfo.last_line;
}

var AST = {
  ProgramNode: function(statements, inverseStrip, inverse, locInfo) {
    var inverseLocationInfo, firstInverseNode;
    if (arguments.length === 3) {
      locInfo = inverse;
      inverse = null;
    } else if (arguments.length === 2) {
      locInfo = inverseStrip;
      inverseStrip = null;
    }

    LocationInfo.call(this, locInfo);
    this.type = "program";
    this.statements = statements;
    this.strip = {};

    if(inverse) {
      firstInverseNode = inverse[0];
      if (firstInverseNode) {
        inverseLocationInfo = {
          first_line: firstInverseNode.firstLine,
          last_line: firstInverseNode.lastLine,
          last_column: firstInverseNode.lastColumn,
          first_column: firstInverseNode.firstColumn
        };
        this.inverse = new AST.ProgramNode(inverse, inverseStrip, inverseLocationInfo);
      } else {
        this.inverse = new AST.ProgramNode(inverse, inverseStrip);
      }
      this.strip.right = inverseStrip.left;
    } else if (inverseStrip) {
      this.strip.left = inverseStrip.right;
    }
  },

  MustacheNode: function(rawParams, hash, open, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "mustache";
    this.strip = strip;

    // Open may be a string parsed from the parser or a passed boolean flag
    if (open != null && open.charAt) {
      // Must use charAt to support IE pre-10
      var escapeFlag = open.charAt(3) || open.charAt(2);
      this.escaped = escapeFlag !== '{' && escapeFlag !== '&';
    } else {
      this.escaped = !!open;
    }

    if (rawParams instanceof AST.SexprNode) {
      this.sexpr = rawParams;
    } else {
      // Support old AST API
      this.sexpr = new AST.SexprNode(rawParams, hash);
    }

    this.sexpr.isRoot = true;

    // Support old AST API that stored this info in MustacheNode
    this.id = this.sexpr.id;
    this.params = this.sexpr.params;
    this.hash = this.sexpr.hash;
    this.eligibleHelper = this.sexpr.eligibleHelper;
    this.isHelper = this.sexpr.isHelper;
  },

  SexprNode: function(rawParams, hash, locInfo) {
    LocationInfo.call(this, locInfo);

    this.type = "sexpr";
    this.hash = hash;

    var id = this.id = rawParams[0];
    var params = this.params = rawParams.slice(1);

    // a mustache is an eligible helper if:
    // * its id is simple (a single part, not `this` or `..`)
    var eligibleHelper = this.eligibleHelper = id.isSimple;

    // a mustache is definitely a helper if:
    // * it is an eligible helper, and
    // * it has at least one parameter or hash segment
    this.isHelper = eligibleHelper && (params.length || hash);

    // if a mustache is an eligible helper but not a definite
    // helper, it is ambiguous, and will be resolved in a later
    // pass or at runtime.
  },

  PartialNode: function(partialName, context, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type         = "partial";
    this.partialName  = partialName;
    this.context      = context;
    this.strip = strip;
  },

  BlockNode: function(mustache, program, inverse, close, locInfo) {
    LocationInfo.call(this, locInfo);

    if(mustache.sexpr.id.original !== close.path.original) {
      throw new Exception(mustache.sexpr.id.original + " doesn't match " + close.path.original, this);
    }

    this.type = 'block';
    this.mustache = mustache;
    this.program  = program;
    this.inverse  = inverse;

    this.strip = {
      left: mustache.strip.left,
      right: close.strip.right
    };

    (program || inverse).strip.left = mustache.strip.right;
    (inverse || program).strip.right = close.strip.left;

    if (inverse && !program) {
      this.isInverse = true;
    }
  },

  ContentNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "content";
    this.string = string;
  },

  HashNode: function(pairs, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "hash";
    this.pairs = pairs;
  },

  IdNode: function(parts, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "ID";

    var original = "",
        dig = [],
        depth = 0;

    for(var i=0,l=parts.length; i<l; i++) {
      var part = parts[i].part;
      original += (parts[i].separator || '') + part;

      if (part === ".." || part === "." || part === "this") {
        if (dig.length > 0) {
          throw new Exception("Invalid path: " + original, this);
        } else if (part === "..") {
          depth++;
        } else {
          this.isScoped = true;
        }
      } else {
        dig.push(part);
      }
    }

    this.original = original;
    this.parts    = dig;
    this.string   = dig.join('.');
    this.depth    = depth;

    // an ID is simple if it only has one part, and that part is not
    // `..` or `this`.
    this.isSimple = parts.length === 1 && !this.isScoped && depth === 0;

    this.stringModeValue = this.string;
  },

  PartialNameNode: function(name, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "PARTIAL_NAME";
    this.name = name.original;
  },

  DataNode: function(id, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "DATA";
    this.id = id;
  },

  StringNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "STRING";
    this.original =
      this.string =
      this.stringModeValue = string;
  },

  IntegerNode: function(integer, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "INTEGER";
    this.original =
      this.integer = integer;
    this.stringModeValue = Number(integer);
  },

  BooleanNode: function(bool, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "BOOLEAN";
    this.bool = bool;
    this.stringModeValue = bool === "true";
  },

  CommentNode: function(comment, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "comment";
    this.comment = comment;
  }
};

// Must be exported as an object rather than the root of the module as the jison lexer
// most modify the object to operate properly.
exports["default"] = AST;
},{"../exception":12}],6:[function(require,module,exports){
"use strict";
var parser = require("./parser")["default"];
var AST = require("./ast")["default"];

exports.parser = parser;

function parse(input) {
  // Just return if an already-compile AST was passed in.
  if(input.constructor === AST.ProgramNode) { return input; }

  parser.yy = AST;
  return parser.parse(input);
}

exports.parse = parse;
},{"./ast":5,"./parser":9}],7:[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function Compiler() {}

exports.Compiler = Compiler;// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  disassemble: function() {
    var opcodes = this.opcodes, opcode, out = [], params, param;

    for (var i=0, l=opcodes.length; i<l; i++) {
      opcode = opcodes[i];

      if (opcode.opcode === 'DECLARE') {
        out.push("DECLARE " + opcode.name + "=" + opcode.value);
      } else {
        params = [];
        for (var j=0; j<opcode.args.length; j++) {
          param = opcode.args[j];
          if (typeof param === "string") {
            param = "\"" + param.replace("\n", "\\n") + "\"";
          }
          params.push(param);
        }
        out.push(opcode.opcode + " " + params.join(" "));
      }
    }

    return out.join("\n");
  },

  equals: function(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || opcode.args.length !== otherOpcode.args.length) {
        return false;
      }
      for (var j = 0; j < opcode.args.length; j++) {
        if (opcode.args[j] !== otherOpcode.args[j]) {
          return false;
        }
      }
    }

    len = this.children.length;
    if (other.children.length !== len) {
      return false;
    }
    for (i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function(program, options) {
    this.opcodes = [];
    this.children = [];
    this.depths = {list: []};
    this.options = options;

    // These changes will propagate to the other compiler components
    var knownHelpers = this.options.knownHelpers;
    this.options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true
    };
    if (knownHelpers) {
      for (var name in knownHelpers) {
        this.options.knownHelpers[name] = knownHelpers[name];
      }
    }

    return this.accept(program);
  },

  accept: function(node) {
    var strip = node.strip || {},
        ret;
    if (strip.left) {
      this.opcode('strip');
    }

    ret = this[node.type](node);

    if (strip.right) {
      this.opcode('strip');
    }

    return ret;
  },

  program: function(program) {
    var statements = program.statements;

    for(var i=0, l=statements.length; i<l; i++) {
      this.accept(statements[i]);
    }
    this.isSimple = l === 1;

    this.depths.list = this.depths.list.sort(function(a, b) {
      return a - b;
    });

    return this;
  },

  compileProgram: function(program) {
    var result = new this.compiler().compile(program, this.options);
    var guid = this.guid++, depth;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;

    for(var i=0, l=result.depths.list.length; i<l; i++) {
      depth = result.depths.list[i];

      if(depth < 2) { continue; }
      else { this.addDepth(depth - 1); }
    }

    return guid;
  },

  block: function(block) {
    var mustache = block.mustache,
        program = block.program,
        inverse = block.inverse;

    if (program) {
      program = this.compileProgram(program);
    }

    if (inverse) {
      inverse = this.compileProgram(inverse);
    }

    var sexpr = mustache.sexpr;
    var type = this.classifySexpr(sexpr);

    if (type === "helper") {
      this.helperSexpr(sexpr, program, inverse);
    } else if (type === "simple") {
      this.simpleSexpr(sexpr);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue');
    } else {
      this.ambiguousSexpr(sexpr, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  hash: function(hash) {
    var pairs = hash.pairs, pair, val;

    this.opcode('pushHash');

    for(var i=0, l=pairs.length; i<l; i++) {
      pair = pairs[i];
      val  = pair[1];

      if (this.options.stringParams) {
        if(val.depth) {
          this.addDepth(val.depth);
        }
        this.opcode('getContext', val.depth || 0);
        this.opcode('pushStringParam', val.stringModeValue, val.type);

        if (val.type === 'sexpr') {
          // Subexpressions get evaluated and passed in
          // in string params mode.
          this.sexpr(val);
        }
      } else {
        this.accept(val);
      }

      this.opcode('assignToHash', pair[0]);
    }
    this.opcode('popHash');
  },

  partial: function(partial) {
    var partialName = partial.partialName;
    this.usePartial = true;

    if(partial.context) {
      this.ID(partial.context);
    } else {
      this.opcode('push', 'depth0');
    }

    this.opcode('invokePartial', partialName.name);
    this.opcode('append');
  },

  content: function(content) {
    this.opcode('appendContent', content.string);
  },

  mustache: function(mustache) {
    this.sexpr(mustache.sexpr);

    if(mustache.escaped && !this.options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },

  ambiguousSexpr: function(sexpr, program, inverse) {
    var id = sexpr.id,
        name = id.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', id.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleSexpr: function(sexpr) {
    var id = sexpr.id;

    if (id.type === 'DATA') {
      this.DATA(id);
    } else if (id.parts.length) {
      this.ID(id);
    } else {
      // Simplified ID for `this`
      this.addDepth(id.depth);
      this.opcode('getContext', id.depth);
      this.opcode('pushContext');
    }

    this.opcode('resolvePossibleLambda');
  },

  helperSexpr: function(sexpr, program, inverse) {
    var params = this.setupFullMustacheParams(sexpr, program, inverse),
        name = sexpr.id.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new Exception("You specified knownHelpersOnly, but used the unknown helper " + name, sexpr);
    } else {
      this.opcode('invokeHelper', params.length, name, sexpr.isRoot);
    }
  },

  sexpr: function(sexpr) {
    var type = this.classifySexpr(sexpr);

    if (type === "simple") {
      this.simpleSexpr(sexpr);
    } else if (type === "helper") {
      this.helperSexpr(sexpr);
    } else {
      this.ambiguousSexpr(sexpr);
    }
  },

  ID: function(id) {
    this.addDepth(id.depth);
    this.opcode('getContext', id.depth);

    var name = id.parts[0];
    if (!name) {
      this.opcode('pushContext');
    } else {
      this.opcode('lookupOnContext', id.parts[0]);
    }

    for(var i=1, l=id.parts.length; i<l; i++) {
      this.opcode('lookup', id.parts[i]);
    }
  },

  DATA: function(data) {
    this.options.data = true;
    if (data.id.isScoped || data.id.depth) {
      throw new Exception('Scoped data references are not supported: ' + data.original, data);
    }

    this.opcode('lookupData');
    var parts = data.id.parts;
    for(var i=0, l=parts.length; i<l; i++) {
      this.opcode('lookup', parts[i]);
    }
  },

  STRING: function(string) {
    this.opcode('pushString', string.string);
  },

  INTEGER: function(integer) {
    this.opcode('pushLiteral', integer.integer);
  },

  BOOLEAN: function(bool) {
    this.opcode('pushLiteral', bool.bool);
  },

  comment: function() {},

  // HELPERS
  opcode: function(name) {
    this.opcodes.push({ opcode: name, args: [].slice.call(arguments, 1) });
  },

  declare: function(name, value) {
    this.opcodes.push({ opcode: 'DECLARE', name: name, value: value });
  },

  addDepth: function(depth) {
    if(depth === 0) { return; }

    if(!this.depths[depth]) {
      this.depths[depth] = true;
      this.depths.list.push(depth);
    }
  },

  classifySexpr: function(sexpr) {
    var isHelper   = sexpr.isHelper;
    var isEligible = sexpr.eligibleHelper;
    var options    = this.options;

    // if ambiguous, we can possibly resolve the ambiguity now
    if (isEligible && !isHelper) {
      var name = sexpr.id.parts[0];

      if (options.knownHelpers[name]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) { return "helper"; }
    else if (isEligible) { return "ambiguous"; }
    else { return "simple"; }
  },

  pushParams: function(params) {
    var i = params.length, param;

    while(i--) {
      param = params[i];

      if(this.options.stringParams) {
        if(param.depth) {
          this.addDepth(param.depth);
        }

        this.opcode('getContext', param.depth || 0);
        this.opcode('pushStringParam', param.stringModeValue, param.type);

        if (param.type === 'sexpr') {
          // Subexpressions get evaluated and passed in
          // in string params mode.
          this.sexpr(param);
        }
      } else {
        this[param.type](param);
      }
    }
  },

  setupFullMustacheParams: function(sexpr, program, inverse) {
    var params = sexpr.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if (sexpr.hash) {
      this.hash(sexpr.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  }
};

function precompile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }

  var ast = env.parse(input);
  var environment = new env.Compiler().compile(ast, options);
  return new env.JavaScriptCompiler().compile(environment, options);
}

exports.precompile = precompile;function compile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
  }

  options = options || {};

  if (!('data' in options)) {
    options.data = true;
  }

  var compiled;

  function compileInput() {
    var ast = env.parse(input);
    var environment = new env.Compiler().compile(ast, options);
    var templateSpec = new env.JavaScriptCompiler().compile(environment, options, undefined, true);
    return env.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  return function(context, options) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled.call(this, context, options);
  };
}

exports.compile = compile;
},{"../exception":12}],8:[function(require,module,exports){
"use strict";
var COMPILER_REVISION = require("../base").COMPILER_REVISION;
var REVISION_CHANGES = require("../base").REVISION_CHANGES;
var log = require("../base").log;
var Exception = require("../exception")["default"];

function Literal(value) {
  this.value = value;
}

function JavaScriptCompiler() {}

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function(parent, name /* , type*/) {
    var wrap,
        ret;
    if (parent.indexOf('depth') === 0) {
      wrap = true;
    }

    if (/^[0-9]+$/.test(name)) {
      ret = parent + "[" + name + "]";
    } else if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      ret = parent + "." + name;
    }
    else {
      ret = parent + "['" + name + "']";
    }

    if (wrap) {
      return '(' + parent + ' && ' + ret + ')';
    } else {
      return ret;
    }
  },

  compilerInfo: function() {
    var revision = COMPILER_REVISION,
        versions = REVISION_CHANGES[revision];
    return "this.compilerInfo = ["+revision+",'"+versions+"'];\n";
  },

  appendToBuffer: function(string) {
    if (this.environment.isSimple) {
      return "return " + string + ";";
    } else {
      return {
        appendToBuffer: true,
        content: string,
        toString: function() { return "buffer += " + string + ";"; }
      };
    }
  },

  initializeBuffer: function() {
    return this.quotedString("");
  },

  namespace: "Handlebars",
  // END PUBLIC API

  compile: function(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options || {};

    log('debug', this.environment.disassemble() + "\n\n");

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      programs: [],
      environments: [],
      aliases: { }
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.registers = { list: [] };
    this.hashes = [];
    this.compileStack = [];
    this.inlineStack = [];

    this.compileChildren(environment, options);

    var opcodes = environment.opcodes, opcode;

    this.i = 0;

    for(var l=opcodes.length; this.i<l; this.i++) {
      opcode = opcodes[this.i];

      if(opcode.opcode === 'DECLARE') {
        this[opcode.name] = opcode.value;
      } else {
        this[opcode.opcode].apply(this, opcode.args);
      }

      // Reset the stripNext flag if it was not set by this operation.
      if (opcode.opcode !== this.stripNext) {
        this.stripNext = false;
      }
    }

    // Flush any trailing content that might be pending.
    this.pushSource('');

    if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
      throw new Exception('Compile completed with content left on stack');
    }

    return this.createFunctionContext(asObject);
  },

  preamble: function() {
    var out = [];

    if (!this.isChild) {
      var namespace = this.namespace;

      var copies = "helpers = this.merge(helpers, " + namespace + ".helpers);";
      if (this.environment.usePartial) { copies = copies + " partials = this.merge(partials, " + namespace + ".partials);"; }
      if (this.options.data) { copies = copies + " data = data || {};"; }
      out.push(copies);
    } else {
      out.push('');
    }

    if (!this.environment.isSimple) {
      out.push(", buffer = " + this.initializeBuffer());
    } else {
      out.push("");
    }

    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = out;
  },

  createFunctionContext: function(asObject) {
    var locals = this.stackVars.concat(this.registers.list);

    if(locals.length > 0) {
      this.source[1] = this.source[1] + ", " + locals.join(", ");
    }

    // Generate minimizer alias mappings
    if (!this.isChild) {
      for (var alias in this.context.aliases) {
        if (this.context.aliases.hasOwnProperty(alias)) {
          this.source[1] = this.source[1] + ', ' + alias + '=' + this.context.aliases[alias];
        }
      }
    }

    if (this.source[1]) {
      this.source[1] = "var " + this.source[1].substring(2) + ";";
    }

    // Merge children
    if (!this.isChild) {
      this.source[1] += '\n' + this.context.programs.join('\n') + '\n';
    }

    if (!this.environment.isSimple) {
      this.pushSource("return buffer;");
    }

    var params = this.isChild ? ["depth0", "data"] : ["Handlebars", "depth0", "helpers", "partials", "data"];

    for(var i=0, l=this.environment.depths.list.length; i<l; i++) {
      params.push("depth" + this.environment.depths.list[i]);
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource();

    if (!this.isChild) {
      source = this.compilerInfo()+source;
    }

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      var functionSource = 'function ' + (this.name || '') + '(' + params.join(',') + ') {\n  ' + source + '}';
      log('debug', functionSource + "\n\n");
      return functionSource;
    }
  },
  mergeSource: function() {
    // WARN: We are not handling the case where buffer is still populated as the source should
    // not have buffer append operations as their final action.
    var source = '',
        buffer;
    for (var i = 0, len = this.source.length; i < len; i++) {
      var line = this.source[i];
      if (line.appendToBuffer) {
        if (buffer) {
          buffer = buffer + '\n    + ' + line.content;
        } else {
          buffer = line.content;
        }
      } else {
        if (buffer) {
          source += 'buffer += ' + buffer + ';\n  ';
          buffer = undefined;
        }
        source += line + '\n  ';
      }
    }
    return source;
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#foo}}...{{/foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    this.replaceStack(function(current) {
      params.splice(1, 0, current);
      return "blockHelperMissing.call(" + params.join(", ") + ")";
    });
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    var current = this.topStack();
    params.splice(1, 0, current);

    this.pushSource("if (!" + this.lastHelper + ") { " + current + " = blockHelperMissing.call(" + params.join(", ") + "); }");
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function(content) {
    if (this.pendingContent) {
      content = this.pendingContent + content;
    }
    if (this.stripNext) {
      content = content.replace(/^\s+/, '');
    }

    this.pendingContent = content;
  },

  // [strip]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Removes any trailing whitespace from the prior content node and flags
  // the next operation for stripping if it is a content node.
  strip: function() {
    if (this.pendingContent) {
      this.pendingContent = this.pendingContent.replace(/\s+$/, '');
    }
    this.stripNext = 'strip';
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function() {
    // Force anything that is inlined onto the stack so we don't have duplication
    // when we examine local
    this.flushInline();
    var local = this.popStack();
    this.pushSource("if(" + local + " || " + local + " === 0) { " + this.appendToBuffer(local) + " }");
    if (this.environment.isSimple) {
      this.pushSource("else { " + this.appendToBuffer("''") + " }");
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function() {
    this.context.aliases.escapeExpression = 'this.escapeExpression';

    this.pushSource(this.appendToBuffer("escapeExpression(" + this.popStack() + ")"));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function(depth) {
    if(this.lastContext !== depth) {
      this.lastContext = depth;
    }
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function(name) {
    this.push(this.nameLookup('depth' + this.lastContext, name, 'context'));
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function() {
    this.pushStackLiteral('depth' + this.lastContext);
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function() {
    this.context.aliases.functionType = '"function"';

    this.replaceStack(function(current) {
      return "typeof " + current + " === functionType ? " + current + ".apply(depth0) : " + current;
    });
  },

  // [lookup]
  //
  // On stack, before: value, ...
  // On stack, after: value[name], ...
  //
  // Replace the value on the stack with the result of looking
  // up `name` on `value`
  lookup: function(name) {
    this.replaceStack(function(current) {
      return current + " == null || " + current + " === false ? " + current + " : " + this.nameLookup(current, name, 'context');
    });
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function() {
    this.pushStackLiteral('data');
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function(string, type) {
    this.pushStackLiteral('depth' + this.lastContext);

    this.pushString(type);

    // If it's a subexpression, the string result
    // will be pushed after this opcode.
    if (type !== 'sexpr') {
      if (typeof string === 'string') {
        this.pushString(string);
      } else {
        this.pushStackLiteral(string);
      }
    }
  },

  emptyHash: function() {
    this.pushStackLiteral('{}');

    if (this.options.stringParams) {
      this.push('{}'); // hashContexts
      this.push('{}'); // hashTypes
    }
  },
  pushHash: function() {
    if (this.hash) {
      this.hashes.push(this.hash);
    }
    this.hash = {values: [], types: [], contexts: []};
  },
  popHash: function() {
    var hash = this.hash;
    this.hash = this.hashes.pop();

    if (this.options.stringParams) {
      this.push('{' + hash.contexts.join(',') + '}');
      this.push('{' + hash.types.join(',') + '}');
    }

    this.push('{\n    ' + hash.values.join(',\n    ') + '\n  }');
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [push]
  //
  // On stack, before: ...
  // On stack, after: expr, ...
  //
  // Push an expression onto the stack
  push: function(expr) {
    this.inlineStack.push(expr);
    return expr;
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function(paramSize, name, isRoot) {
    this.context.aliases.helperMissing = 'helpers.helperMissing';
    this.useRegister('helper');

    var helper = this.lastHelper = this.setupHelper(paramSize, name, true);
    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');

    var lookup = 'helper = ' + helper.name + ' || ' + nonHelper;
    if (helper.paramsInit) {
      lookup += ',' + helper.paramsInit;
    }

    this.push(
      '('
        + lookup
        + ',helper '
          + '? helper.call(' + helper.callParams + ') '
          + ': helperMissing.call(' + helper.helperMissingParams + '))');

    // Always flush subexpressions. This is both to prevent the compounding size issue that
    // occurs when the code has to be duplicated for inlining and also to prevent errors
    // due to the incorrect options object being passed due to the shared register.
    if (!isRoot) {
      this.flushInline();
    }
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(helper.name + ".call(" + helper.callParams + ")");
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function(name, helperCall) {
    this.context.aliases.functionType = '"function"';
    this.useRegister('helper');

    this.emptyHash();
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');
    var nextStack = this.nextStack();

    if (helper.paramsInit) {
      this.pushSource(helper.paramsInit);
    }
    this.pushSource('if (helper = ' + helperName + ') { ' + nextStack + ' = helper.call(' + helper.callParams + '); }');
    this.pushSource('else { helper = ' + nonHelper + '; ' + nextStack + ' = typeof helper === functionType ? helper.call(' + helper.callParams + ') : helper; }');
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function(name) {
    var params = [this.nameLookup('partials', name, 'partial'), "'" + name + "'", this.popStack(), "helpers", "partials"];

    if (this.options.data) {
      params.push("data");
    }

    this.context.aliases.self = "this";
    this.push("self.invokePartial(" + params.join(", ") + ")");
  },

  // [assignToHash]
  //
  // On stack, before: value, hash, ...
  // On stack, after: hash, ...
  //
  // Pops a value and hash off the stack, assigns `hash[key] = value`
  // and pushes the hash back onto the stack.
  assignToHash: function(key) {
    var value = this.popStack(),
        context,
        type;

    if (this.options.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts.push("'" + key + "': " + context);
    }
    if (type) {
      hash.types.push("'" + key + "': " + type);
    }
    hash.values.push("'" + key + "': (" + value + ")");
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function(environment, options) {
    var children = environment.children, child, compiler;

    for(var i=0, l=children.length; i<l; i++) {
      child = children[i];
      compiler = new this.compiler();

      var index = this.matchExistingProgram(child);

      if (index == null) {
        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context);
        this.context.environments[index] = child;
      } else {
        child.index = index;
        child.name = 'program' + index;
      }
    }
  },
  matchExistingProgram: function(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return i;
      }
    }
  },

  programExpression: function(guid) {
    this.context.aliases.self = "this";

    if(guid == null) {
      return "self.noop";
    }

    var child = this.environment.children[guid],
        depths = child.depths.list, depth;

    var programParams = [child.index, child.name, "data"];

    for(var i=0, l = depths.length; i<l; i++) {
      depth = depths[i];

      if(depth === 1) { programParams.push("depth0"); }
      else { programParams.push("depth" + (depth - 1)); }
    }

    return (depths.length === 0 ? "self.program(" : "self.programWithDepth(") + programParams.join(", ") + ")";
  },

  register: function(name, val) {
    this.useRegister(name);
    this.pushSource(name + " = " + val + ";");
  },

  useRegister: function(name) {
    if(!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  pushStackLiteral: function(item) {
    return this.push(new Literal(item));
  },

  pushSource: function(source) {
    if (this.pendingContent) {
      this.source.push(this.appendToBuffer(this.quotedString(this.pendingContent)));
      this.pendingContent = undefined;
    }

    if (source) {
      this.source.push(source);
    }
  },

  pushStack: function(item) {
    this.flushInline();

    var stack = this.incrStack();
    if (item) {
      this.pushSource(stack + " = " + item + ";");
    }
    this.compileStack.push(stack);
    return stack;
  },

  replaceStack: function(callback) {
    var prefix = '',
        inline = this.isInline(),
        stack,
        createdStack,
        usedLiteral;

    // If we are currently inline then we want to merge the inline statement into the
    // replacement statement via ','
    if (inline) {
      var top = this.popStack(true);

      if (top instanceof Literal) {
        // Literals do not need to be inlined
        stack = top.value;
        usedLiteral = true;
      } else {
        // Get or create the current stack name for use by the inline
        createdStack = !this.stackSlot;
        var name = !createdStack ? this.topStackName() : this.incrStack();

        prefix = '(' + this.push(name) + ' = ' + top + '),';
        stack = this.topStack();
      }
    } else {
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (inline) {
      if (!usedLiteral) {
        this.popStack();
      }
      if (createdStack) {
        this.stackSlot--;
      }
      this.push('(' + prefix + item + ')');
    } else {
      // Prevent modification of the context depth variable. Through replaceStack
      if (!/^stack/.test(stack)) {
        stack = this.nextStack();
      }

      this.pushSource(stack + " = (" + prefix + item + ");");
    }
    return stack;
  },

  nextStack: function() {
    return this.pushStack();
  },

  incrStack: function() {
    this.stackSlot++;
    if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
    return this.topStackName();
  },
  topStackName: function() {
    return "stack" + this.stackSlot;
  },
  flushInline: function() {
    var inlineStack = this.inlineStack;
    if (inlineStack.length) {
      this.inlineStack = [];
      for (var i = 0, len = inlineStack.length; i < len; i++) {
        var entry = inlineStack[i];
        if (entry instanceof Literal) {
          this.compileStack.push(entry);
        } else {
          this.pushStack(entry);
        }
      }
    }
  },
  isInline: function() {
    return this.inlineStack.length;
  },

  popStack: function(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      if (!inline) {
        if (!this.stackSlot) {
          throw new Exception('Invalid stack pop');
        }
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function(wrapped) {
    var stack = (this.isInline() ? this.inlineStack : this.compileStack),
        item = stack[stack.length - 1];

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      return item;
    }
  },

  quotedString: function(str) {
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')   // Per Ecma-262 7.3 + 7.8.4
      .replace(/\u2029/g, '\\u2029') + '"';
  },

  setupHelper: function(paramSize, name, missingParams) {
    var params = [],
        paramsInit = this.setupParams(paramSize, params, missingParams);
    var foundHelper = this.nameLookup('helpers', name, 'helper');

    return {
      params: params,
      paramsInit: paramsInit,
      name: foundHelper,
      callParams: ["depth0"].concat(params).join(", "),
      helperMissingParams: missingParams && ["depth0", this.quotedString(name)].concat(params).join(", ")
    };
  },

  setupOptions: function(paramSize, params) {
    var options = [], contexts = [], types = [], param, inverse, program;

    options.push("hash:" + this.popStack());

    if (this.options.stringParams) {
      options.push("hashTypes:" + this.popStack());
      options.push("hashContexts:" + this.popStack());
    }

    inverse = this.popStack();
    program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      if (!program) {
        this.context.aliases.self = "this";
        program = "self.noop";
      }

      if (!inverse) {
        this.context.aliases.self = "this";
        inverse = "self.noop";
      }

      options.push("inverse:" + inverse);
      options.push("fn:" + program);
    }

    for(var i=0; i<paramSize; i++) {
      param = this.popStack();
      params.push(param);

      if(this.options.stringParams) {
        types.push(this.popStack());
        contexts.push(this.popStack());
      }
    }

    if (this.options.stringParams) {
      options.push("contexts:[" + contexts.join(",") + "]");
      options.push("types:[" + types.join(",") + "]");
    }

    if(this.options.data) {
      options.push("data:data");
    }

    return options;
  },

  // the params and contexts arguments are passed in arrays
  // to fill in
  setupParams: function(paramSize, params, useRegister) {
    var options = '{' + this.setupOptions(paramSize, params).join(',') + '}';

    if (useRegister) {
      this.useRegister('options');
      params.push('options');
      return 'options=' + options;
    } else {
      params.push(options);
      return '';
    }
  }
};

var reservedWords = (
  "break else new var" +
  " case finally return void" +
  " catch for switch while" +
  " continue function this with" +
  " default if throw" +
  " delete in try" +
  " do instanceof typeof" +
  " abstract enum int short" +
  " boolean export interface static" +
  " byte extends long super" +
  " char final native synchronized" +
  " class float package throws" +
  " const goto private transient" +
  " debugger implements protected volatile" +
  " double import public let yield"
).split(" ");

var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

for(var i=0, l=reservedWords.length; i<l; i++) {
  compilerWords[reservedWords[i]] = true;
}

JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
  if(!JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name)) {
    return true;
  }
  return false;
};

exports["default"] = JavaScriptCompiler;
},{"../base":4,"../exception":12}],9:[function(require,module,exports){
"use strict";
/* jshint ignore:start */
/* Jison generated parser */
var handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"statements":4,"EOF":5,"program":6,"simpleInverse":7,"statement":8,"openInverse":9,"closeBlock":10,"openBlock":11,"mustache":12,"partial":13,"CONTENT":14,"COMMENT":15,"OPEN_BLOCK":16,"sexpr":17,"CLOSE":18,"OPEN_INVERSE":19,"OPEN_ENDBLOCK":20,"path":21,"OPEN":22,"OPEN_UNESCAPED":23,"CLOSE_UNESCAPED":24,"OPEN_PARTIAL":25,"partialName":26,"partial_option0":27,"sexpr_repetition0":28,"sexpr_option0":29,"dataName":30,"param":31,"STRING":32,"INTEGER":33,"BOOLEAN":34,"OPEN_SEXPR":35,"CLOSE_SEXPR":36,"hash":37,"hash_repetition_plus0":38,"hashSegment":39,"ID":40,"EQUALS":41,"DATA":42,"pathSegments":43,"SEP":44,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",14:"CONTENT",15:"COMMENT",16:"OPEN_BLOCK",18:"CLOSE",19:"OPEN_INVERSE",20:"OPEN_ENDBLOCK",22:"OPEN",23:"OPEN_UNESCAPED",24:"CLOSE_UNESCAPED",25:"OPEN_PARTIAL",32:"STRING",33:"INTEGER",34:"BOOLEAN",35:"OPEN_SEXPR",36:"CLOSE_SEXPR",40:"ID",41:"EQUALS",42:"DATA",44:"SEP"},
productions_: [0,[3,2],[3,1],[6,2],[6,3],[6,2],[6,1],[6,1],[6,0],[4,1],[4,2],[8,3],[8,3],[8,1],[8,1],[8,1],[8,1],[11,3],[9,3],[10,3],[12,3],[12,3],[13,4],[7,2],[17,3],[17,1],[31,1],[31,1],[31,1],[31,1],[31,1],[31,3],[37,1],[39,3],[26,1],[26,1],[26,1],[30,2],[21,1],[43,3],[43,1],[27,0],[27,1],[28,0],[28,2],[29,0],[29,1],[38,1],[38,2]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return new yy.ProgramNode($$[$0-1], this._$); 
break;
case 2: return new yy.ProgramNode([], this._$); 
break;
case 3:this.$ = new yy.ProgramNode([], $$[$0-1], $$[$0], this._$);
break;
case 4:this.$ = new yy.ProgramNode($$[$0-2], $$[$0-1], $$[$0], this._$);
break;
case 5:this.$ = new yy.ProgramNode($$[$0-1], $$[$0], [], this._$);
break;
case 6:this.$ = new yy.ProgramNode($$[$0], this._$);
break;
case 7:this.$ = new yy.ProgramNode([], this._$);
break;
case 8:this.$ = new yy.ProgramNode([], this._$);
break;
case 9:this.$ = [$$[$0]];
break;
case 10: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 11:this.$ = new yy.BlockNode($$[$0-2], $$[$0-1].inverse, $$[$0-1], $$[$0], this._$);
break;
case 12:this.$ = new yy.BlockNode($$[$0-2], $$[$0-1], $$[$0-1].inverse, $$[$0], this._$);
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = $$[$0];
break;
case 15:this.$ = new yy.ContentNode($$[$0], this._$);
break;
case 16:this.$ = new yy.CommentNode($$[$0], this._$);
break;
case 17:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 18:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 19:this.$ = {path: $$[$0-1], strip: stripFlags($$[$0-2], $$[$0])};
break;
case 20:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 21:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 22:this.$ = new yy.PartialNode($$[$0-2], $$[$0-1], stripFlags($$[$0-3], $$[$0]), this._$);
break;
case 23:this.$ = stripFlags($$[$0-1], $$[$0]);
break;
case 24:this.$ = new yy.SexprNode([$$[$0-2]].concat($$[$0-1]), $$[$0], this._$);
break;
case 25:this.$ = new yy.SexprNode([$$[$0]], null, this._$);
break;
case 26:this.$ = $$[$0];
break;
case 27:this.$ = new yy.StringNode($$[$0], this._$);
break;
case 28:this.$ = new yy.IntegerNode($$[$0], this._$);
break;
case 29:this.$ = new yy.BooleanNode($$[$0], this._$);
break;
case 30:this.$ = $$[$0];
break;
case 31:$$[$0-1].isHelper = true; this.$ = $$[$0-1];
break;
case 32:this.$ = new yy.HashNode($$[$0], this._$);
break;
case 33:this.$ = [$$[$0-2], $$[$0]];
break;
case 34:this.$ = new yy.PartialNameNode($$[$0], this._$);
break;
case 35:this.$ = new yy.PartialNameNode(new yy.StringNode($$[$0], this._$), this._$);
break;
case 36:this.$ = new yy.PartialNameNode(new yy.IntegerNode($$[$0], this._$));
break;
case 37:this.$ = new yy.DataNode($$[$0], this._$);
break;
case 38:this.$ = new yy.IdNode($$[$0], this._$);
break;
case 39: $$[$0-2].push({part: $$[$0], separator: $$[$0-1]}); this.$ = $$[$0-2]; 
break;
case 40:this.$ = [{part: $$[$0]}];
break;
case 43:this.$ = [];
break;
case 44:$$[$0-1].push($$[$0]);
break;
case 47:this.$ = [$$[$0]];
break;
case 48:$$[$0-1].push($$[$0]);
break;
}
},
table: [{3:1,4:2,5:[1,3],8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],25:[1,15]},{1:[3]},{5:[1,16],8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],25:[1,15]},{1:[2,2]},{5:[2,9],14:[2,9],15:[2,9],16:[2,9],19:[2,9],20:[2,9],22:[2,9],23:[2,9],25:[2,9]},{4:20,6:18,7:19,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,21],20:[2,8],22:[1,13],23:[1,14],25:[1,15]},{4:20,6:22,7:19,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,21],20:[2,8],22:[1,13],23:[1,14],25:[1,15]},{5:[2,13],14:[2,13],15:[2,13],16:[2,13],19:[2,13],20:[2,13],22:[2,13],23:[2,13],25:[2,13]},{5:[2,14],14:[2,14],15:[2,14],16:[2,14],19:[2,14],20:[2,14],22:[2,14],23:[2,14],25:[2,14]},{5:[2,15],14:[2,15],15:[2,15],16:[2,15],19:[2,15],20:[2,15],22:[2,15],23:[2,15],25:[2,15]},{5:[2,16],14:[2,16],15:[2,16],16:[2,16],19:[2,16],20:[2,16],22:[2,16],23:[2,16],25:[2,16]},{17:23,21:24,30:25,40:[1,28],42:[1,27],43:26},{17:29,21:24,30:25,40:[1,28],42:[1,27],43:26},{17:30,21:24,30:25,40:[1,28],42:[1,27],43:26},{17:31,21:24,30:25,40:[1,28],42:[1,27],43:26},{21:33,26:32,32:[1,34],33:[1,35],40:[1,28],43:26},{1:[2,1]},{5:[2,10],14:[2,10],15:[2,10],16:[2,10],19:[2,10],20:[2,10],22:[2,10],23:[2,10],25:[2,10]},{10:36,20:[1,37]},{4:38,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,7],22:[1,13],23:[1,14],25:[1,15]},{7:39,8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,21],20:[2,6],22:[1,13],23:[1,14],25:[1,15]},{17:23,18:[1,40],21:24,30:25,40:[1,28],42:[1,27],43:26},{10:41,20:[1,37]},{18:[1,42]},{18:[2,43],24:[2,43],28:43,32:[2,43],33:[2,43],34:[2,43],35:[2,43],36:[2,43],40:[2,43],42:[2,43]},{18:[2,25],24:[2,25],36:[2,25]},{18:[2,38],24:[2,38],32:[2,38],33:[2,38],34:[2,38],35:[2,38],36:[2,38],40:[2,38],42:[2,38],44:[1,44]},{21:45,40:[1,28],43:26},{18:[2,40],24:[2,40],32:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],40:[2,40],42:[2,40],44:[2,40]},{18:[1,46]},{18:[1,47]},{24:[1,48]},{18:[2,41],21:50,27:49,40:[1,28],43:26},{18:[2,34],40:[2,34]},{18:[2,35],40:[2,35]},{18:[2,36],40:[2,36]},{5:[2,11],14:[2,11],15:[2,11],16:[2,11],19:[2,11],20:[2,11],22:[2,11],23:[2,11],25:[2,11]},{21:51,40:[1,28],43:26},{8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,3],22:[1,13],23:[1,14],25:[1,15]},{4:52,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,5],22:[1,13],23:[1,14],25:[1,15]},{14:[2,23],15:[2,23],16:[2,23],19:[2,23],20:[2,23],22:[2,23],23:[2,23],25:[2,23]},{5:[2,12],14:[2,12],15:[2,12],16:[2,12],19:[2,12],20:[2,12],22:[2,12],23:[2,12],25:[2,12]},{14:[2,18],15:[2,18],16:[2,18],19:[2,18],20:[2,18],22:[2,18],23:[2,18],25:[2,18]},{18:[2,45],21:56,24:[2,45],29:53,30:60,31:54,32:[1,57],33:[1,58],34:[1,59],35:[1,61],36:[2,45],37:55,38:62,39:63,40:[1,64],42:[1,27],43:26},{40:[1,65]},{18:[2,37],24:[2,37],32:[2,37],33:[2,37],34:[2,37],35:[2,37],36:[2,37],40:[2,37],42:[2,37]},{14:[2,17],15:[2,17],16:[2,17],19:[2,17],20:[2,17],22:[2,17],23:[2,17],25:[2,17]},{5:[2,20],14:[2,20],15:[2,20],16:[2,20],19:[2,20],20:[2,20],22:[2,20],23:[2,20],25:[2,20]},{5:[2,21],14:[2,21],15:[2,21],16:[2,21],19:[2,21],20:[2,21],22:[2,21],23:[2,21],25:[2,21]},{18:[1,66]},{18:[2,42]},{18:[1,67]},{8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,4],22:[1,13],23:[1,14],25:[1,15]},{18:[2,24],24:[2,24],36:[2,24]},{18:[2,44],24:[2,44],32:[2,44],33:[2,44],34:[2,44],35:[2,44],36:[2,44],40:[2,44],42:[2,44]},{18:[2,46],24:[2,46],36:[2,46]},{18:[2,26],24:[2,26],32:[2,26],33:[2,26],34:[2,26],35:[2,26],36:[2,26],40:[2,26],42:[2,26]},{18:[2,27],24:[2,27],32:[2,27],33:[2,27],34:[2,27],35:[2,27],36:[2,27],40:[2,27],42:[2,27]},{18:[2,28],24:[2,28],32:[2,28],33:[2,28],34:[2,28],35:[2,28],36:[2,28],40:[2,28],42:[2,28]},{18:[2,29],24:[2,29],32:[2,29],33:[2,29],34:[2,29],35:[2,29],36:[2,29],40:[2,29],42:[2,29]},{18:[2,30],24:[2,30],32:[2,30],33:[2,30],34:[2,30],35:[2,30],36:[2,30],40:[2,30],42:[2,30]},{17:68,21:24,30:25,40:[1,28],42:[1,27],43:26},{18:[2,32],24:[2,32],36:[2,32],39:69,40:[1,70]},{18:[2,47],24:[2,47],36:[2,47],40:[2,47]},{18:[2,40],24:[2,40],32:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],40:[2,40],41:[1,71],42:[2,40],44:[2,40]},{18:[2,39],24:[2,39],32:[2,39],33:[2,39],34:[2,39],35:[2,39],36:[2,39],40:[2,39],42:[2,39],44:[2,39]},{5:[2,22],14:[2,22],15:[2,22],16:[2,22],19:[2,22],20:[2,22],22:[2,22],23:[2,22],25:[2,22]},{5:[2,19],14:[2,19],15:[2,19],16:[2,19],19:[2,19],20:[2,19],22:[2,19],23:[2,19],25:[2,19]},{36:[1,72]},{18:[2,48],24:[2,48],36:[2,48],40:[2,48]},{41:[1,71]},{21:56,30:60,31:73,32:[1,57],33:[1,58],34:[1,59],35:[1,61],40:[1,28],42:[1,27],43:26},{18:[2,31],24:[2,31],32:[2,31],33:[2,31],34:[2,31],35:[2,31],36:[2,31],40:[2,31],42:[2,31]},{18:[2,33],24:[2,33],36:[2,33],40:[2,33]}],
defaultActions: {3:[2,2],16:[2,1],50:[2,42]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == "undefined") {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
            }
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};


function stripFlags(open, close) {
  return {
    left: open.charAt(2) === '~',
    right: close.charAt(0) === '~' || close.charAt(1) === '~'
  };
}

/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {


function strip(start, end) {
  return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng-end);
}


var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:
                                   if(yy_.yytext.slice(-2) === "\\\\") {
                                     strip(0,1);
                                     this.begin("mu");
                                   } else if(yy_.yytext.slice(-1) === "\\") {
                                     strip(0,1);
                                     this.begin("emu");
                                   } else {
                                     this.begin("mu");
                                   }
                                   if(yy_.yytext) return 14;
                                 
break;
case 1:return 14;
break;
case 2:
                                   this.popState();
                                   return 14;
                                 
break;
case 3:strip(0,4); this.popState(); return 15;
break;
case 4:return 35;
break;
case 5:return 36;
break;
case 6:return 25;
break;
case 7:return 16;
break;
case 8:return 20;
break;
case 9:return 19;
break;
case 10:return 19;
break;
case 11:return 23;
break;
case 12:return 22;
break;
case 13:this.popState(); this.begin('com');
break;
case 14:strip(3,5); this.popState(); return 15;
break;
case 15:return 22;
break;
case 16:return 41;
break;
case 17:return 40;
break;
case 18:return 40;
break;
case 19:return 44;
break;
case 20:// ignore whitespace
break;
case 21:this.popState(); return 24;
break;
case 22:this.popState(); return 18;
break;
case 23:yy_.yytext = strip(1,2).replace(/\\"/g,'"'); return 32;
break;
case 24:yy_.yytext = strip(1,2).replace(/\\'/g,"'"); return 32;
break;
case 25:return 42;
break;
case 26:return 34;
break;
case 27:return 34;
break;
case 28:return 33;
break;
case 29:return 40;
break;
case 30:yy_.yytext = strip(1,2); return 40;
break;
case 31:return 'INVALID';
break;
case 32:return 5;
break;
}
};
lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/,/^(?:[\s\S]*?--\}\})/,/^(?:\()/,/^(?:\))/,/^(?:\{\{(~)?>)/,/^(?:\{\{(~)?#)/,/^(?:\{\{(~)?\/)/,/^(?:\{\{(~)?\^)/,/^(?:\{\{(~)?\s*else\b)/,/^(?:\{\{(~)?\{)/,/^(?:\{\{(~)?&)/,/^(?:\{\{!--)/,/^(?:\{\{![\s\S]*?\}\})/,/^(?:\{\{(~)?)/,/^(?:=)/,/^(?:\.\.)/,/^(?:\.(?=([=~}\s\/.)])))/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}(~)?\}\})/,/^(?:(~)?\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=([~}\s)])))/,/^(?:false(?=([~}\s)])))/,/^(?:-?[0-9]+(?=([~}\s)])))/,/^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)]))))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/];
lexer.conditions = {"mu":{"rules":[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32],"inclusive":false},"emu":{"rules":[2],"inclusive":false},"com":{"rules":[3],"inclusive":false},"INITIAL":{"rules":[0,1,32],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;
function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();exports["default"] = handlebars;
/* jshint ignore:end */
},{}],10:[function(require,module,exports){
"use strict";
var Visitor = require("./visitor")["default"];

function print(ast) {
  return new PrintVisitor().accept(ast);
}

exports.print = print;function PrintVisitor() {
  this.padding = 0;
}

exports.PrintVisitor = PrintVisitor;PrintVisitor.prototype = new Visitor();

PrintVisitor.prototype.pad = function(string, newline) {
  var out = "";

  for(var i=0,l=this.padding; i<l; i++) {
    out = out + "  ";
  }

  out = out + string;

  if(newline !== false) { out = out + "\n"; }
  return out;
};

PrintVisitor.prototype.program = function(program) {
  var out = "",
      statements = program.statements,
      i, l;

  for(i=0, l=statements.length; i<l; i++) {
    out = out + this.accept(statements[i]);
  }

  this.padding--;

  return out;
};

PrintVisitor.prototype.block = function(block) {
  var out = "";

  out = out + this.pad("BLOCK:");
  this.padding++;
  out = out + this.accept(block.mustache);
  if (block.program) {
    out = out + this.pad("PROGRAM:");
    this.padding++;
    out = out + this.accept(block.program);
    this.padding--;
  }
  if (block.inverse) {
    if (block.program) { this.padding++; }
    out = out + this.pad("{{^}}");
    this.padding++;
    out = out + this.accept(block.inverse);
    this.padding--;
    if (block.program) { this.padding--; }
  }
  this.padding--;

  return out;
};

PrintVisitor.prototype.sexpr = function(sexpr) {
  var params = sexpr.params, paramStrings = [], hash;

  for(var i=0, l=params.length; i<l; i++) {
    paramStrings.push(this.accept(params[i]));
  }

  params = "[" + paramStrings.join(", ") + "]";

  hash = sexpr.hash ? " " + this.accept(sexpr.hash) : "";

  return this.accept(sexpr.id) + " " + params + hash;
};

PrintVisitor.prototype.mustache = function(mustache) {
  return this.pad("{{ " + this.accept(mustache.sexpr) + " }}");
};

PrintVisitor.prototype.partial = function(partial) {
  var content = this.accept(partial.partialName);
  if(partial.context) { content = content + " " + this.accept(partial.context); }
  return this.pad("{{> " + content + " }}");
};

PrintVisitor.prototype.hash = function(hash) {
  var pairs = hash.pairs;
  var joinedPairs = [], left, right;

  for(var i=0, l=pairs.length; i<l; i++) {
    left = pairs[i][0];
    right = this.accept(pairs[i][1]);
    joinedPairs.push( left + "=" + right );
  }

  return "HASH{" + joinedPairs.join(", ") + "}";
};

PrintVisitor.prototype.STRING = function(string) {
  return '"' + string.string + '"';
};

PrintVisitor.prototype.INTEGER = function(integer) {
  return "INTEGER{" + integer.integer + "}";
};

PrintVisitor.prototype.BOOLEAN = function(bool) {
  return "BOOLEAN{" + bool.bool + "}";
};

PrintVisitor.prototype.ID = function(id) {
  var path = id.parts.join("/");
  if(id.parts.length > 1) {
    return "PATH:" + path;
  } else {
    return "ID:" + path;
  }
};

PrintVisitor.prototype.PARTIAL_NAME = function(partialName) {
    return "PARTIAL:" + partialName.name;
};

PrintVisitor.prototype.DATA = function(data) {
  return "@" + this.accept(data.id);
};

PrintVisitor.prototype.content = function(content) {
  return this.pad("CONTENT[ '" + content.string + "' ]");
};

PrintVisitor.prototype.comment = function(comment) {
  return this.pad("{{! '" + comment.comment + "' }}");
};
},{"./visitor":11}],11:[function(require,module,exports){
"use strict";
function Visitor() {}

Visitor.prototype = {
  constructor: Visitor,

  accept: function(object) {
    return this[object.type](object);
  }
};

exports["default"] = Visitor;
},{}],12:[function(require,module,exports){
"use strict";

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var line;
  if (node && node.firstLine) {
    line = node.firstLine;

    message += ' - ' + line + ':' + node.firstColumn;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  if (line) {
    this.lineNumber = line;
    this.column = node.firstColumn;
  }
}

Exception.prototype = new Error();

exports["default"] = Exception;
},{}],13:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];
var COMPILER_REVISION = require("./base").COMPILER_REVISION;
var REVISION_CHANGES = require("./base").REVISION_CHANGES;

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = REVISION_CHANGES[currentRevision],
          compilerVersions = REVISION_CHANGES[compilerRevision];
      throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
            "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
            "Please update your runtime to a newer version ("+compilerInfo[1]+").");
    }
  }
}

exports.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

function template(templateSpec, env) {
  if (!env) {
    throw new Exception("No environment passed to template");
  }

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  var invokePartialWrapper = function(partial, name, context, helpers, partials, data) {
    var result = env.VM.invokePartial.apply(this, arguments);
    if (result != null) { return result; }

    if (env.compile) {
      var options = { helpers: helpers, partials: partials, data: data };
      partials[name] = env.compile(partial, { data: data !== undefined }, env);
      return partials[name](context, options);
    } else {
      throw new Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    }
  };

  // Just add water
  var container = {
    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,
    programs: [],
    program: function(i, fn, data) {
      var programWrapper = this.programs[i];
      if(data) {
        programWrapper = program(i, fn, data);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = program(i, fn);
      }
      return programWrapper;
    },
    merge: function(param, common) {
      var ret = param || common;

      if (param && common && (param !== common)) {
        ret = {};
        Utils.extend(ret, common);
        Utils.extend(ret, param);
      }
      return ret;
    },
    programWithDepth: env.VM.programWithDepth,
    noop: env.VM.noop,
    compilerInfo: null
  };

  return function(context, options) {
    options = options || {};
    var namespace = options.partial ? options : env,
        helpers,
        partials;

    if (!options.partial) {
      helpers = options.helpers;
      partials = options.partials;
    }
    var result = templateSpec.call(
          container,
          namespace, context,
          helpers,
          partials,
          options.data);

    if (!options.partial) {
      env.VM.checkRevision(container.compilerInfo);
    }

    return result;
  };
}

exports.template = template;function programWithDepth(i, fn, data /*, $depth */) {
  var args = Array.prototype.slice.call(arguments, 3);

  var prog = function(context, options) {
    options = options || {};

    return fn.apply(this, [context, options.data || data].concat(args));
  };
  prog.program = i;
  prog.depth = args.length;
  return prog;
}

exports.programWithDepth = programWithDepth;function program(i, fn, data) {
  var prog = function(context, options) {
    options = options || {};

    return fn(context, options.data || data);
  };
  prog.program = i;
  prog.depth = 0;
  return prog;
}

exports.program = program;function invokePartial(partial, name, context, helpers, partials, data) {
  var options = { partial: true, helpers: helpers, partials: partials, data: data };

  if(partial === undefined) {
    throw new Exception("The partial " + name + " could not be found");
  } else if(partial instanceof Function) {
    return partial(context, options);
  }
}

exports.invokePartial = invokePartial;function noop() { return ""; }

exports.noop = noop;
},{"./base":4,"./exception":12,"./utils":15}],14:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],15:[function(require,module,exports){
"use strict";
/*jshint -W004 */
var SafeString = require("./safe-string")["default"];

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

function escapeChar(chr) {
  return escape[chr] || "&amp;";
}

function extend(obj, value) {
  for(var key in value) {
    if(Object.prototype.hasOwnProperty.call(value, key)) {
      obj[key] = value[key];
    }
  }
}

exports.extend = extend;var toString = Object.prototype.toString;
exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
var isFunction = function(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
if (isFunction(/x/)) {
  isFunction = function(value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
var isFunction;
exports.isFunction = isFunction;
var isArray = Array.isArray || function(value) {
  return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
};
exports.isArray = isArray;

function escapeExpression(string) {
  // don't escape SafeStrings, since they're already safe
  if (string instanceof SafeString) {
    return string.toString();
  } else if (!string && string !== 0) {
    return "";
  }

  // Force a string conversion as this will be done by the append regardless and
  // the regex test will do this transparently behind the scenes, causing issues if
  // an object's to string has escaped characters in it.
  string = "" + string;

  if(!possible.test(string)) { return string; }
  return string.replace(badChars, escapeChar);
}

exports.escapeExpression = escapeExpression;function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

exports.isEmpty = isEmpty;
},{"./safe-string":14}],16:[function(require,module,exports){
// USAGE:
// var handlebars = require('handlebars');

// var local = handlebars.create();

var handlebars = require('../dist/cjs/handlebars')["default"];

handlebars.Visitor = require('../dist/cjs/handlebars/compiler/visitor')["default"];

var printer = require('../dist/cjs/handlebars/compiler/printer');
handlebars.PrintVisitor = printer.PrintVisitor;
handlebars.print = printer.print;

module.exports = handlebars;

// Publish a Node.js require() handler for .handlebars and .hbs files
if (typeof require !== 'undefined' && require.extensions) {
  var extension = function(module, filename) {
    var fs = require("fs");
    var templateString = fs.readFileSync(filename, "utf8");
    module.exports = handlebars.compile(templateString);
  };
  require.extensions[".handlebars"] = extension;
  require.extensions[".hbs"] = extension;
}

},{"../dist/cjs/handlebars":2,"../dist/cjs/handlebars/compiler/printer":10,"../dist/cjs/handlebars/compiler/visitor":11,"fs":1}],17:[function(require,module,exports){
// Create a simple path alias to allow browserify to resolve
// the runtime on a supported path.
module.exports = require('./dist/cjs/handlebars.runtime');

},{"./dist/cjs/handlebars.runtime":3}],18:[function(require,module,exports){
module.exports = require("handlebars/runtime")["default"];

},{"handlebars/runtime":17}],19:[function(require,module,exports){
var App, Conversation, Message, User, command_center, oauth, object, parley;

object = {};

module.exports = object;


/*   PARLEY.JS CHAT LIBRARY EXTRODINAIRE */

App = (function() {
  function App() {
    this.current_users = [];
    this.open_conversations = [];
    this.conversations = [];
    this.pub_sub = $({});
    (function() {
      var s, script;
      script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = "/socket.io/socket.io.js";
      s = document.getElementsByTagName('script')[0];
      return s.parentNode.insertBefore(script, s);
    })();
    (function() {
      var po, s;
      po = document.createElement('script');
      po.type = 'text/javascript';
      po.async = true;
      po.src = 'https://apis.google.com/js/client:plusone.js';
      s = document.getElementsByTagName('script')[0];
      return s.parentNode.insertBefore(po, s);
    })();
    this.title_notification = {
      notified: false,
      page_title: $('html title').html()
    };
    this.server.on('persistent_convo', this.load_persistent_convo.bind(this));
    this.server.on('message', this.update_persistent_convos.bind(this));
    this.server.on('current_users', this.load_current_users.bind(this));
    this.server.on('user_logged_on', this.user_logged_on.bind(this));
    this.server.on('user_logged_off', this.user_logged_off.bind(this));
  }

  App.prototype.server = io.connect('wss://' + window.location.hostname);

  App.prototype.load_persistent_convo = function(convo_partners, messages) {
    var message, new_convo, new_message, new_partner, parsed, parsed_convo_partners, parsed_messages, partner, _i, _j, _len, _len1;
    parsed_messages = [];
    parsed_convo_partners = [];
    for (_i = 0, _len = convo_partners.length; _i < _len; _i++) {
      partner = convo_partners[_i];
      new_partner = new User(partner.display_name, partner.image_url);
      parsed_convo_partners.push(new_partner);
    }
    for (_j = 0, _len1 = messages.length; _j < _len1; _j++) {
      message = messages[_j];
      parsed = JSON.parse(message);
      new_message = new Message(parsed.recipients, parsed.sender, parsed.content, parsed.image, parsed.time_stamp);
      parsed_messages.push(new_message);
    }
    new_convo = new Conversation(parsed_convo_partners, parsed_messages);
    return this.sort_incoming_convo(new_convo);
  };

  App.prototype.sort_incoming_convo = function(new_convo) {
    var convo, i, _i, _len, _ref;
    if (this.conversations.length === 0) {
      this.conversations.push(new_convo);
      return;
    }
    _ref = this.conversations;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      convo = _ref[i];
      if (convo.messages[convo.messages.length - 1].time_stamp < new_convo.messages[new_convo.messages.length - 1].time_stamp) {
        this.conversations.splice(i, 0, new_convo);
        return;
      }
      if (i === this.conversations.length - 1) {
        this.conversations.push(new_convo);
        return;
      }
    }
  };

  App.prototype.update_persistent_convos = function(message) {
    var convo, convo_members_ids, convo_partner_ids, convo_partners, corres_convo, i, index, new_convo, new_message, online_user, user_id, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1;
    console.log('goodbye!');
    _ref = this.conversations;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      convo = _ref[i];
      if (convo.message_filter === message.convo_id) {
        corres_convo = convo;
        index = i;
      }
    }
    new_message = new Message(message.recipients, message.sender, message.content, message.image, message.time_stamp);
    if (corres_convo) {
      this.conversations.splice(index, 1);
      this.conversations.unshift(corres_convo);
      return corres_convo.add_message(new_message);
    } else {
      convo_members_ids = new_message.convo_id.split(',');
      convo_partner_ids = [];
      for (_j = 0, _len1 = convo_members_ids.length; _j < _len1; _j++) {
        user_id = convo_members_ids[_j];
        if (user_id !== this.me.image_url) {
          convo_partner_ids.push(user_id);
        }
      }
      convo_partners = [];
      for (_k = 0, _len2 = convo_partner_ids.length; _k < _len2; _k++) {
        user_id = convo_partner_ids[_k];
        _ref1 = this.current_users;
        for (_l = 0, _len3 = _ref1.length; _l < _len3; _l++) {
          online_user = _ref1[_l];
          if (user_id === online_user.image_url) {
            convo_partners.push(online_user);
          }
        }
      }
      new_convo = new Conversation(convo_partners, [], true);
      new_convo.add_message(new_message, true);
      this.conversations.unshift(new_convo);
      return this.pub_sub.trigger('new_convo', new_convo);
    }
  };

  App.prototype.load_current_users = function(logged_on) {
    var new_user, user, users_sans_me, _i, _j, _len, _len1, _ref;
    logged_on = logged_on.sort(function(a, b) {
      if (a.display_name > b.display_name) {
        return 1;
      }
      if (a.display_name < b.display_name) {
        return -1;
      }
      return 0;
    });
    for (_i = 0, _len = logged_on.length; _i < _len; _i++) {
      user = logged_on[_i];
      new_user = new User(user.display_name, user.image_url);
      this.current_users.push(new_user);
    }
    users_sans_me = [];
    _ref = this.current_users;
    for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
      user = _ref[_j];
      if (user.image_url !== this.me.image_url) {
        users_sans_me.push(user);
      }
    }
    return this.current_users = users_sans_me;
  };

  App.prototype.user_logged_on = function(display_name, image_url) {
    var i, new_user, user, _i, _len, _ref;
    new_user = new User(display_name, image_url);
    if (this.current_users.length === 0) {
      this.current_users.push(new_user);
      this.pub_sub.trigger('user_logged_on', [new_user, 0, "first"]);
      return;
    }
    _ref = this.current_users;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      if (user.display_name > new_user.display_name) {
        this.current_users.splice(i, 0, new_user);
        this.pub_sub.trigger('user_logged_on', [new_user, i]);
        return;
      }
      if (i === this.current_users.length - 1) {
        this.current_users.push(new_user);
        this.pub_sub.trigger('user_logged_on', [new_user, i + 1, "last"]);
      }
    }
  };

  App.prototype.user_logged_off = function(display_name, image_url) {
    var i, new_online_users, user, _i, _len, _ref;
    new_online_users = [];
    _ref = this.current_users;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      if (image_url !== user.image_url) {
        new_online_users.push(user);
      } else {
        this.pub_sub.trigger('user_logged_off', [user, i]);
      }
    }
    return this.current_users = new_online_users;
  };

  return App;

})();

parley = new App();

module.exports = parley;

oauth = require('./oauth.coffee');

command_center = require('./command_center_view.coffee');

Conversation = require('./conversation_model.coffee');

User = require('./user_model.coffee');

Message = require('./message_model.coffee');

App.prototype.command_center = command_center;

App.prototype.oauth = oauth;


},{"./command_center_view.coffee":21,"./conversation_model.coffee":22,"./message_model.coffee":23,"./oauth.coffee":25,"./user_model.coffee":34}],20:[function(require,module,exports){
var ChatRoom, Conversation, Handlebars, Message, MessageView, PersistentConversationView, UserView, app, chat_room_template;

app = require('./app.coffee');

Message = require('./message_model.coffee');

MessageView = require('./message_view.coffee');

Conversation = require('./conversation_model.coffee');

UserView = require('./user_view.coffee');

PersistentConversationView = require('./persistent_conversation_view.coffee');

chat_room_template = require('./templates/chat_room.hbs');

Handlebars = require('hbsfy/runtime');

Handlebars.registerHelper('title_bar_function', function() {
  if (this.convo_partners.length < 2) {
    return this.convo_partners[0].display_name;
  } else {
    return this.first_name_list;
  }
});

ChatRoom = (function() {
  function ChatRoom(convo) {
    var prop, value, _ref, _ref1;
    this.convo = convo;
    this.$element = $('<div class="parley"></div>');
    this.render();
    $('body').append(this.$element);
    this.loadPersistentMessages();
    this.pubsub_listeners = {
      'user_logged_on': this.sync_user_logged_on.bind(this),
      'user_logged_off': this.sync_user_logged_off.bind(this),
      'new_convo': this.sync_new_convo.bind(this),
      'picture_message': this.renderDiscussion.bind(this)
    };
    this.socket_listeners = {
      'message': this.message_callback.bind(this),
      'user_offline': this.user_offline_callback.bind(this),
      'typing_notification': this.typing_notification_callback.bind(this)
    };
    _ref = this.pubsub_listeners;
    for (prop in _ref) {
      value = _ref[prop];
      app.pub_sub.on(prop, value);
    }
    _ref1 = this.socket_listeners;
    for (prop in _ref1) {
      value = _ref1[prop];
      app.server.on(prop, value);
    }
    this.add_user_bar = '<div class="add-user-bar"><a class="cancel">Cancel</a><a class="confirm disabled">Add People</a></div>';
  }

  ChatRoom.prototype.message_callback = function(message) {
    var new_message;
    if (this.convo.message_filter === message.convo_id) {
      new_message = new Message(message.recipients, message.sender, message.content, message.image, message.time_stamp);
      this.convo.add_message(new_message, true);
      if (this.menu === "chat") {
        this.renderDiscussion();
        this.$element.find('.top-bar').addClass('new-message');
        return this.titleAlert();
      }
    }
  };

  ChatRoom.prototype.user_offline_callback = function() {
    var message;
    if (this.menu === "chat") {
      message = new Message(app.me, {
        image_url: 'http://storage.googleapis.com/parley-assets/server_network.png'
      }, "This user is no longer online", false, new Date());
      this.convo.add_message(message);
      return this.renderDiscussion();
    }
  };

  ChatRoom.prototype.typing_notification_callback = function(convo_id, typist, bool) {
    var typing_notification;
    if (this.menu === "chat") {
      if (convo_id === this.convo.message_filter) {
        if (bool) {
          if (this.$discussion.find('.incoming').length === 0) {
            typing_notification = "<li class='incoming'><div class='avatar'><img src='" + typist.image_url + "'/></div><div class='messages'><p>" + typist.display_name + " is typing...</p></div></li>";
            this.$discussion.append(typing_notification);
            return this.scrollToLastMessage();
          }
        } else {
          this.$discussion.find('.incoming').remove();
          return this.scrollToLastMessage();
        }
      }
    }
  };

  ChatRoom.prototype.switch_to_persistent_convo = function(e) {
    var convo, view, _i, _len, _ref;
    e.preventDefault();
    e.stopPropagation();
    if (this.menu !== "convo_switch") {
      this.$discussion.children().remove();
      this.$element.find('textarea.send').remove();
      this.$element.find('.mirrordiv').remove();
      this.$element.find('.parley_file_upload').remove();
      this.$element.find('label.img_upload').remove();
      _ref = app.conversations;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        convo = _ref[_i];
        if (convo.messages.length > 0) {
          view = new PersistentConversationView(convo, this);
          view.render();
          this.$discussion.append(view.$element);
        }
      }
      return this.menu = "convo_switch";
    } else {
      this.render();
      return this.loadPersistentMessages();
    }
  };

  ChatRoom.prototype.add_users_to_convo = function(e) {
    var user, view, _i, _len, _ref;
    e.preventDefault();
    this.menu = "add_users";
    this.new_convo_params = [];
    this.$discussion.children().remove();
    this.$discussion.append('<input class="search" placeholder="Add People">');
    _ref = app.current_users;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      view = new UserView(user, this);
      view.render();
      this.$discussion.append(view.$element);
    }
    this.$discussion.append(this.add_user_bar);
    return this.$element.find('.cancel').on('click', this.cancel_add_users.bind(this));
  };

  ChatRoom.prototype.cancel_add_users = function(e) {
    e.preventDefault();
    this.render();
    this.loadPersistentMessages();
    return this.new_convo_params = [];
  };

  ChatRoom.prototype.confirm_new_convo_params = function(e) {
    var conversation, convo, convo_exists, convo_id, convo_partners_image_urls, new_convo_partners, persistent_convo, user, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    e.preventDefault();
    new_convo_partners = this.convo.convo_partners;
    convo_partners_image_urls = this.convo.message_filter.split(',');
    _ref = this.new_convo_params;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      convo_partners_image_urls.push(user.image_url);
      new_convo_partners.push(user);
    }
    convo_id = convo_partners_image_urls.sort().join();
    _ref1 = app.open_conversations;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      convo = _ref1[_j];
      if (convo_id === convo) {
        return;
      }
    }
    convo_exists = false;
    _ref2 = app.conversations;
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      convo = _ref2[_k];
      if (convo.message_filter === convo_id) {
        convo_exists = true;
        persistent_convo = convo;
      }
    }
    if (convo_exists) {
      this.convo = persistent_convo;
      app.open_conversations.push(convo_id);
    } else {
      conversation = new Conversation(new_convo_partners);
      this.convo = conversation;
      app.conversations.push(conversation);
      app.open_conversations.push(convo_id);
    }
    this.$element.find('.add-user-bar').remove();
    this.render();
    this.loadPersistentMessages();
    return this.new_convo_params = [];
  };

  ChatRoom.prototype.render = function() {
    this.menu = "chat";
    this.$element.children().remove();
    this.$element.html(chat_room_template(this.convo));
    this.$discussion = this.$element.find('.discussion');
    this.$mirror_div = $("<div class='mirrordiv'></div>");
    this.$element.find('section.conversation .message-area').append(this.$mirror_div);
    this.hidden_div_height = this.$element.find('.mirrordiv').css('height');
    this.$file_upload = this.$element.find('label.img_upload');
    this.$element.find('.chat-close').on('click', this.closeWindow.bind(this));
    this.$element.find('.entypo-user-add').on('click', this.add_users_to_convo.bind(this));
    this.$element.find('.entypo-chat').on('click', this.switch_to_persistent_convo.bind(this));
    this.$element.find('.send').on('keypress', this.sendOnEnter.bind(this));
    this.$element.find('.send').on('keyup', this.emitTypingNotification.bind(this));
    this.$element.find('.send').on('keyup', this.grow_message_field.bind(this));
    this.$element.find('.send').on('keyup', this.toggle_file_upload_button.bind(this));
    this.$element.find('.top-bar, minify ').on('click', this.toggleChat.bind(this));
    this.$element.on('click', this.removeNotifications.bind(this));
    return this.$element.find('input.parley_file_upload').on('change', this.file_upload.bind(this));
  };

  ChatRoom.prototype.renderDiscussion = function() {
    var new_message;
    new_message = this.convo.messages.slice(-1)[0];
    this.appendMessage(new_message);
    return this.scrollToLastMessage();
  };

  ChatRoom.prototype.appendMessage = function(message) {
    var message_view;
    message_view = new MessageView(message);
    message_view.render();
    return this.$discussion.append(message_view.$element);
  };

  ChatRoom.prototype.scrollToLastMessage = function() {
    return this.$discussion.scrollTop(this.$discussion.find('li:last-child').offset().top + this.$discussion.scrollTop());
  };

  ChatRoom.prototype.loadPersistentMessages = function() {
    var message, _i, _len, _ref;
    _ref = this.convo.messages;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      message = _ref[_i];
      this.appendMessage(message);
    }
    if (this.convo.messages.length > 0) {
      return this.scrollToLastMessage();
    }
  };

  ChatRoom.prototype.sendOnEnter = function(e) {
    if (e.which === 13) {
      e.preventDefault();
      this.sendMessage();
      return this.removeNotifications();
    }
  };

  ChatRoom.prototype.sendMessage = function() {
    var message;
    message = new Message(this.convo.convo_partners, app.me, this.$element.find('.send').val());
    this.convo.add_message(message, true);
    this.renderDiscussion();
    console.log('hello');
    app.server.emit('message', message);
    this.$element.find('.send').val('');
    return this.emitTypingNotification();
  };

  ChatRoom.prototype.toggleChat = function(e) {
    e.preventDefault();
    this.$element.find('.message-area').toggle();
    if (this.$discussion.attr('display') === !"none") {
      return this.scrollToLastMessage;
    }
  };

  ChatRoom.prototype.closeWindow = function(e) {
    var new_open_convos, open_convo, prop, value, _i, _len, _ref, _ref1;
    e.preventDefault();
    e.stopPropagation();
    new_open_convos = [];
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      open_convo = _ref[_i];
      if (open_convo !== this.convo.message_filter) {
        new_open_convos.push(open_convo);
      }
    }
    app.open_conversations = new_open_convos;
    _ref1 = this.socket_listeners;
    for (prop in _ref1) {
      value = _ref1[prop];
      app.server.removeListener(prop, value);
    }
    app.pub_sub.off();
    return this.$element.remove();
  };

  ChatRoom.prototype.removeNotifications = function(e) {
    this.$element.find('.top-bar').removeClass('new-message');
    if (app.title_notification.notified) {
      return this.clearTitleNotification();
    }
  };

  ChatRoom.prototype.emitTypingNotification = function(e) {
    if (this.$element.find('.send').val() !== "") {
      return app.server.emit('user_typing', this.convo.convo_partners_image_urls, app.me, true);
    } else {
      return app.server.emit('user_typing', this.convo.convo_partners_image_urls, app.me, false);
    }
  };

  ChatRoom.prototype.clearTitleNotification = function() {
    app.clear_alert();
    $('html title').html(app.title_notification.page_title);
    return app.title_notification.notified = false;
  };

  ChatRoom.prototype.titleAlert = function() {
    var alert, sender_name, setAlert, title_alert;
    if (!app.title_notification.notified) {
      sender_name = this.convo.messages[this.convo.messages.length - 1].sender.display_name;
      alert = "Pending ** " + sender_name;
      setAlert = function() {
        if (app.title_notification.page_title === $('html title').html()) {
          return $('html title').html(alert);
        } else {
          return $('html title').html(app.title_notification.page_title);
        }
      };
      title_alert = setInterval(setAlert, 2200);
      app.clear_alert = function() {
        return clearInterval(title_alert);
      };
      return app.title_notification.notified = true;
    }
  };

  ChatRoom.prototype.file_upload = function() {
    var file;
    console.log('hear click');
    file = this.$element.find('.parley_file_upload').get(0).files[0];
    return app.oauth.file_upload(file, this.convo.convo_partners, this.convo.message_filter);
  };

  ChatRoom.prototype.grow_message_field = function() {
    var $txt, adjusted_content, content;
    $txt = this.$element.find('textarea.send');
    content = $txt.val();
    adjusted_content = content.replace(/\n/g, "<br>");
    this.$mirror_div.html(adjusted_content);
    this.hidden_div_height = this.$mirror_div.css('height');
    if (this.hidden_div_height !== $txt.css('height')) {
      return $txt.css('height', this.hidden_div_height);
    }
  };

  ChatRoom.prototype.toggle_file_upload_button = function() {
    if (this.$element.find('textarea.send').val() !== "") {
      if (this.$element.find('label.img_upload').length === 1) {
        return this.$element.find('label.img_upload').remove();
      }
    } else {
      if (this.$element.find('label.img_upload').length === 0) {
        this.$element.find('section.conversation').append(this.$file_upload);
        return this.$element.find('input.parley_file_upload').on('change', this.file_upload.bind(this));
      }
    }
  };

  ChatRoom.prototype.sync_user_logged_on = function(e, user, index, location) {
    var view;
    if (this.menu === "add_users") {
      view = new UserView(user, this);
      view.render();
      if (location === "first" || location === "last") {
        return this.$discussion.children().eq(-1).before(view.$element);
      } else {
        return this.$discussion.find('li.user').eq(index).before(view.$element);
      }
    }
  };

  ChatRoom.prototype.sync_user_logged_off = function(e, user, index) {
    if (this.menu === "add_users") {
      this.$discussion.find('li.user').eq(index).remove();
    }
  };

  ChatRoom.prototype.sync_new_convo = function(e, new_convo) {
    var view;
    if (this.menu === "convo_switch") {
      view = new PersistentConversationView(new_convo, this);
      view.render();
      return $('.parley div.controller-view').prepend(view.$element);
    }
  };

  return ChatRoom;

})();

module.exports = ChatRoom;


},{"./app.coffee":19,"./conversation_model.coffee":22,"./message_model.coffee":23,"./message_view.coffee":24,"./persistent_conversation_view.coffee":26,"./templates/chat_room.hbs":27,"./user_view.coffee":35,"hbsfy/runtime":18}],21:[function(require,module,exports){
var ChatRoom, CommandCenter, Conversation, PersistentConversationView, UserView, app, logged_in_template, logged_out_template, profile_template;

app = require('./app.coffee');

UserView = require('./user_view.coffee');

PersistentConversationView = require('./persistent_conversation_view.coffee');

logged_out_template = require('./templates/logged_out.hbs');

logged_in_template = require('./templates/logged_in.hbs');

profile_template = require('./templates/profile.hbs');

Conversation = require('./conversation_model.coffee');

ChatRoom = require('./chat_room_view.coffee');

CommandCenter = (function() {
  function CommandCenter() {
    $('body').append(logged_out_template());
    this.add_user_bar = '<div class="add-user-bar"><a class="cancel">Cancel</a><a class="confirm disabled">Add People</a></div>';
    app.pub_sub.on('user_logged_on', this.sync_user_logged_on.bind(this));
    app.pub_sub.on('user_logged_off', this.sync_user_logged_off.bind(this));
    app.pub_sub.on('new_convo', this.sync_new_convo.bind(this));
    this.persist_view_array = [];
  }

  CommandCenter.prototype.log_in = function() {
    this.$element = $(logged_in_template(app.me));
    $('.parley section.controller').html(this.$element);
    $('.controller-view').hide();
    $('.persistent-bar').on('click', this.toggle_command_center.bind(this));
    $('.parley div.controller-bar a.messages').on('click', this.toggle_persistent_convos.bind(this));
    $('.parley div.controller-bar a.active-users').on('click', this.toggle_current_users.bind(this));
    return $('.parley div.controller-bar a.user-settings').on('click', this.toggle_user_settings.bind(this));
  };

  CommandCenter.prototype.toggle_command_center = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if ($('div.persistent-bar span').hasClass('entypo-up-open-mini')) {
      this.refresh_convo_creation();
      $('div.persistent-bar span').removeClass('entypo-up-open-mini').addClass('entypo-down-open-mini');
    } else {
      if (this.menu === "persistent_convos") {
        this.remove_persist_convo_views();
      }
      $('div.persistent-bar span').removeClass('entypo-down-open-mini').addClass('entypo-up-open-mini');
    }
    return $('.controller-view').toggle();
  };

  CommandCenter.prototype.toggle_current_users = function(e) {
    var user, view, _i, _len, _ref;
    e.preventDefault();
    e.stopPropagation();
    if (this.menu !== "current_users") {
      if (this.menu === "persistent_convos") {
        this.remove_persist_convo_views();
      }
      $('.parley div.controller-view').children().remove();
      $('.parley div.controller-view').append('<input class="search" placeholder="Start  Chat">');
      _ref = app.current_users;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        user = _ref[_i];
        view = new UserView(user, this);
        view.render();
        $('.parley div.controller-view').append(view.$element);
      }
      $('.parley div.controller-view').append(this.add_user_bar);
      this.$element.find('.cancel').on('click', this.refresh_convo_creation.bind(this));
      this.menu = "current_users";
      this.new_convo_params = [];
    }
    $('.controller-view').show();
    if ($('div.persistent-bar span').hasClass('entypo-up-open-mini')) {
      return $('div.persistent-bar span').removeClass('entypo-up-open-mini').addClass('entypo-down-open-mini');
    }
  };

  CommandCenter.prototype.toggle_persistent_convos = function(e) {
    var convo, view, _i, _len, _ref;
    e.preventDefault();
    e.stopPropagation();
    if (this.menu !== "persistent_convos") {
      $(".parley div.controller-view").children().remove();
      _ref = app.conversations;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        convo = _ref[_i];
        if (convo.messages.length > 0) {
          view = new PersistentConversationView(convo, this);
          this.persist_view_array.push(view);
          view.render();
          $('.parley div.controller-view').append(view.$element);
        }
      }
      this.menu = "persistent_convos";
    }
    $('.controller-view').show();
    if ($('div.persistent-bar span').hasClass('entypo-up-open-mini')) {
      return $('div.persistent-bar span').removeClass('entypo-up-open-mini').addClass('entypo-down-open-mini');
    }
  };

  CommandCenter.prototype.toggle_user_settings = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.menu !== "user_settings") {
      if (this.menu === "persistent_convos") {
        this.remove_persist_convo_views();
      }
      $('.parley div.controller-view').children().remove();
      $('.parley div.controller-view').html(profile_template(app.me));
      this.menu = "user_settings";
    }
    $('.controller-view').show();
    if ($('div.persistent-bar span').hasClass('entypo-up-open-mini')) {
      return $('div.persistent-bar span').removeClass('entypo-up-open-mini').addClass('entypo-down-open-mini');
    }
  };

  CommandCenter.prototype.confirm_new_convo_params = function(e) {
    var chat_window, conversation, convo, convo_exists, convo_id, convo_partners_image_urls, persistent_convo, user, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    e.preventDefault();
    e.stopPropagation();
    convo_partners_image_urls = [];
    _ref = this.new_convo_params;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      convo_partners_image_urls.push(user.image_url);
    }
    convo_id = convo_partners_image_urls.concat(app.me.image_url).sort().join();
    _ref1 = app.open_conversations;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      convo = _ref1[_j];
      if (convo_id === convo) {
        return;
      }
    }
    convo_exists = false;
    _ref2 = app.conversations;
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      convo = _ref2[_k];
      if (convo.message_filter === convo_id) {
        convo_exists = true;
        persistent_convo = convo;
      }
    }
    if (convo_exists) {
      chat_window = new ChatRoom(persistent_convo);
      app.open_conversations.push(convo_id);
      return this.refresh_convo_creation();
    } else {
      conversation = new Conversation(this.new_convo_params);
      chat_window = new ChatRoom(conversation);
      app.conversations.push(conversation);
      app.open_conversations.push(convo_id);
      return this.refresh_convo_creation();
    }
  };

  CommandCenter.prototype.refresh_convo_creation = function(e) {
    var user, view, _i, _len, _ref;
    if (e) {
      e.stopPropagation();
    }
    if (this.menu = "persistent_convos") {
      this.remove_persist_convo_views();
    }
    this.menu = "current_users";
    this.new_convo_params = [];
    $('.parley div.controller-view').children().remove();
    $('.parley div.controller-view').append('<input class="search" placeholder="Start  Chat">');
    _ref = app.current_users;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      view = new UserView(user, this);
      view.render();
      $('.parley div.controller-view').append(view.$element);
    }
    $('.parley div.controller-view').append(this.add_user_bar);
    return this.$element.find('.cancel').on('click', this.refresh_convo_creation.bind(this));
  };

  CommandCenter.prototype.sync_user_logged_on = function(e, user, index, location) {
    var view;
    if (this.menu === "current_users") {
      view = new UserView(user, this);
      view.render();
      if (location === "first" || location === "last") {
        return $('.parley div.controller-view').children().eq(-1).before(view.$element);
      } else {
        return $('.parley div.controller-view').find('li.user').eq(index).before(view.$element);
      }
    }
  };

  CommandCenter.prototype.sync_user_logged_off = function(e, user, index) {
    if (this.menu === "current_users") {
      $('.parley div.controller-view').find('li.user').eq(index).remove();
    }
  };

  CommandCenter.prototype.sync_new_convo = function(e, new_convo, index, location) {
    var view;
    if (new_convo.notify) {
      $('.parley div.controller-bar a.messages').addClass('notify');
    }
    if (this.menu === "persistent_convos") {
      view = new PersistentConversationView(new_convo, this);
      view.render();
      return $('.parley div.controller-view').prepend(view.$element);
    }
  };

  CommandCenter.prototype.remove_persist_convo_views = function() {
    var view, _i, _len, _ref;
    _ref = this.persist_view_array;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      view = _ref[_i];
      view.remove();
    }
    return this.persist_view_array.length = 0;
  };

  return CommandCenter;

})();

module.exports = new CommandCenter();


},{"./app.coffee":19,"./chat_room_view.coffee":20,"./conversation_model.coffee":22,"./persistent_conversation_view.coffee":26,"./templates/logged_in.hbs":29,"./templates/logged_out.hbs":30,"./templates/profile.hbs":33,"./user_view.coffee":35}],22:[function(require,module,exports){
var Conversation, app;

app = require('./app.coffee');

Conversation = (function() {
  function Conversation(convo_partners, messages, notify) {
    var first_name, i, user, _i, _len, _ref;
    this.convo_partners = convo_partners;
    this.messages = messages != null ? messages : [];
    this.notify = notify != null ? notify : false;
    this.generate_message_filter();
    this.first_name_list = "";
    this.convo_partners_image_urls = [];
    this.pub_sub = $({});
    _ref = this.convo_partners;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      first_name = user.display_name.match(/^[A-z]+/);
      if ((i + 1) !== this.convo_partners.length) {
        this.first_name_list += "" + first_name + ", ";
        this.convo_partners_image_urls.push(user.image_url);
      } else {
        this.first_name_list += "" + first_name;
        this.convo_partners_image_urls.push(user.image_url);
      }
    }
  }

  Conversation.prototype.add_message = function(message, silent) {
    this.messages.push(message);
    if (!silent) {
      $('.parley div.controller-bar a.messages').addClass('notify');
      this.notify = true;
      return this.pub_sub.trigger('convo_new_message', message);
    }
  };

  Conversation.prototype.generate_message_filter = function() {
    var partner, _i, _len, _ref;
    this.message_filter = [app.me.image_url];
    _ref = this.convo_partners;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      partner = _ref[_i];
      this.message_filter.push(partner.image_url);
    }
    return this.message_filter = this.message_filter.sort().join();
  };

  return Conversation;

})();

module.exports = Conversation;


},{"./app.coffee":19}],23:[function(require,module,exports){
var Message, app;

app = require('./app.coffee');

Message = (function() {
  function Message(recipients, sender, content, image, time_stamp) {
    var id_array, user, _i, _len, _ref;
    this.recipients = recipients;
    this.sender = sender;
    this.content = content;
    this.image = image != null ? image : false;
    this.time_stamp = time_stamp;
    if (!this.time_stamp) {
      this.time_stamp = new Date().toUTCString();
    }
    id_array = [];
    _ref = this.recipients;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      id_array = id_array.concat(user.image_url);
    }
    id_array = id_array.concat(this.sender.image_url);
    this.convo_id = id_array.sort().join();
    this.time_created = new Date(this.time_stamp);
    this.time_since_created = this.calculate_time();
  }

  Message.prototype.calculate_time = function() {
    var current_time, f_date, hours, minute_remainder, minutes, today;
    current_time = new Date();
    minutes = Math.floor((current_time - this.time_created) / 60000);
    if (current_time.getDate() === this.time_created.getDate() && minutes < 1440) {
      today = true;
    }
    hours = Math.floor(minutes / 60);
    minute_remainder = Math.floor(minutes % 60);
    if (minutes < 60) {
      return "" + minutes + " mins ago";
    }
    if (hours < 4) {
      if (minute_remainder === 0) {
        return "" + hours + " hours ago";
      } else {
        return "" + hours + " hour " + minute_remainder + " min ago";
      }
    } else {
      f_date = this.date_formatter();
      if (today) {
        return "" + f_date.hour + ":" + f_date.minutes + " " + f_date.suffix;
      } else {
        return "" + f_date.month + " " + f_date.day + " | " + f_date.hour + ":" + f_date.minutes + " " + f_date.suffix;
      }
    }
  };

  Message.prototype.date_formatter = function() {
    var formated, hours, minutes, new_hour, new_minutes, new_month, suffix;
    switch (this.time_created.getMonth()) {
      case 0:
        new_month = "Jan";
        break;
      case 1:
        new_month = "Feb";
        break;
      case 2:
        new_month = "Mar";
        break;
      case 3:
        new_month = "Apr";
        break;
      case 4:
        new_month = "May";
        break;
      case 5:
        new_month = "Jun";
        break;
      case 6:
        new_month = "Jul";
        break;
      case 7:
        new_month = "Aug";
        break;
      case 8:
        new_month = "Sep";
        break;
      case 9:
        new_month = "Oct";
        break;
      case 10:
        new_month = "Nov";
        break;
      case 11:
        new_month = "Dec";
    }
    hours = this.time_created.getHours();
    if (hours > 12) {
      suffix = "PM";
      new_hour = hours - 12;
    } else {
      suffix = "AM";
      new_hour = hours;
    }
    minutes = this.time_created.getMinutes();
    if (minutes < 10) {
      new_minutes = "0" + minutes;
    } else {
      new_minutes = "" + minutes;
    }
    return formated = {
      month: new_month,
      day: this.time_created.getDate(),
      hour: new_hour,
      minutes: new_minutes,
      suffix: suffix
    };
  };

  return Message;

})();

module.exports = Message;


},{"./app.coffee":19}],24:[function(require,module,exports){
var Handlebars, MessageView, app, message_template;

app = require('./app.coffee');

message_template = require('./templates/message.hbs');

Handlebars = require('hbsfy/runtime');

Handlebars.registerHelper('generate_message_content', function() {
  if (this.image) {
    return new Handlebars.SafeString("<img src='" + this.content + "'>");
  } else {
    return this.content;
  }
});

MessageView = (function() {
  function MessageView(message) {
    this.message = message;
  }

  MessageView.prototype.render = function() {
    if (this.message.sender.image_url === app.me.image_url) {
      return this.$element = $('<li class="self"></li>').append(message_template(this.message));
    } else {
      return this.$element = $('<li class="other"></li>').append(message_template(this.message));
    }
  };

  return MessageView;

})();

module.exports = MessageView;


},{"./app.coffee":19,"./templates/message.hbs":31,"hbsfy/runtime":18}],25:[function(require,module,exports){
var Message, Oauth, User, app;

app = require('./app.coffee');

User = require('./user_model.coffee');

Message = require('./message_model.coffee');

Oauth = (function() {
  function Oauth() {}

  window.sign_in_callback = function(authResult) {
    if (authResult.status.signed_in) {
      gapi.client.load('plus', 'v1', function() {
        var request;
        request = gapi.client.plus.people.get({
          'userId': 'me'
        });
        return request.execute(function(profile) {
          var display_name, image_url;
          display_name = profile.displayName;
          image_url = profile.image.url;
          app.me = new User(display_name, image_url);
          app.server.emit('join', display_name, image_url);
          return app.command_center.log_in();
        });
      });
      return Oauth.prototype.file_upload = function(file, convo_partners, convo_id) {
        return $.ajax({
          url: "https://www.googleapis.com/upload/storage/v1beta2/b/parley-images/o?uploadType=media&name=" + file.name,
          type: "POST",
          data: file,
          contentType: file.type,
          processData: false,
          headers: {
            Authorization: "Bearer " + authResult.access_token
          },
          success: (function(_this) {
            return function(res) {
              var content, convo, new_message, open_convo, _i, _j, _len, _len1, _ref, _ref1, _results;
              content = "https://storage.cloud.google.com/parley-images/" + res.name;
              new_message = new Message(convo_partners, app.me, content, true);
              app.server.emit('message', new_message);
              _ref = app.conversations;
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                convo = _ref[_i];
                if (convo.message_filter === convo_id) {
                  convo.add_message(new_message);
                }
              }
              _ref1 = app.open_conversations;
              _results = [];
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                open_convo = _ref1[_j];
                if (open_convo === convo_id) {
                  _results.push(app.pub_sub.trigger('picture_message'));
                } else {
                  _results.push(void 0);
                }
              }
              return _results;
            };
          })(this)
        });
      };
    } else {
      return console.log("Sign-in state: " + authResult.error);
    }
  };

  return Oauth;

})();

module.exports = new Oauth();


},{"./app.coffee":19,"./message_model.coffee":23,"./user_model.coffee":34}],26:[function(require,module,exports){
var ChatRoom, Handlebars, PersistentConversationView, app, persistent_convo_template;

app = require('./app.coffee');

Handlebars = require('handlebars');

persistent_convo_template = require('./templates/persistent_convo_reg.hbs');

Handlebars = require('hbsfy/runtime');

Handlebars.registerHelper('format_image', function() {
  var image, image_urls, _i, _len, _ref;
  if (this.convo_partners.length < 2) {
    return new Handlebars.SafeString("<img src='" + this.convo_partners_image_urls[0] + "'>");
  } else {
    image_urls = "";
    _ref = this.convo_partners_image_urls;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      image = _ref[_i];
      image_urls = image_urls.concat("<img src='" + image + "'>");
    }
    return new Handlebars.SafeString(image_urls);
  }
});

Handlebars.registerHelper('format_display_name', function() {
  if (this.convo_partners.length < 2) {
    return this.convo_partners[0].display_name;
  } else {
    return this.first_name_list;
  }
});

Handlebars.registerHelper('retrieve_last_message', function() {
  var file_name, last_message, trunc_message;
  last_message = this.messages[this.messages.length - 1];
  if (last_message.image) {
    file_name = last_message.content.replace(/^(https\:\/\/storage\.cloud\.google\.com\/parley-images\/)(.+)/, "$2");
    return "IMAGE MESSAGE: " + file_name;
  } else {
    trunc_message = last_message.content.slice(0, 25);
    return "" + trunc_message + "... ";
  }
});

Handlebars.registerHelper('calculate_last_message_time', function() {
  return this.messages[this.messages.length - 1].calculate_time();
});

PersistentConversationView = (function() {
  function PersistentConversationView(convo, current_view) {
    this.convo = convo;
    this.current_view = current_view;
    this.$element = $('<div class="message existing"></div>');
    if (this.convo.notify) {
      this.$element.addClass('notify');
    }
    this.convo.pub_sub.on("convo_new_message", this.sync_convo_new_message.bind(this));
  }

  PersistentConversationView.prototype.render = function() {
    this.$element.html(persistent_convo_template(this.convo));
    return this.$element.on('click', this.load_convo.bind(this));
  };

  PersistentConversationView.prototype.remove = function() {
    return this.convo.pub_sub.off();
  };

  PersistentConversationView.prototype.load_convo = function() {
    var chat_window, convo_status, new_open_convos, open_convo, _i, _j, _len, _len1, _ref, _ref1;
    convo_status = 'closed';
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      open_convo = _ref[_i];
      if (this.convo.message_filter === open_convo) {
        convo_status = 'open';
      }
    }
    if (this.current_view instanceof ChatRoom) {
      if (convo_status !== 'open' || this.convo.message_filter === this.current_view.convo.message_filter) {
        if (this.convo.notify) {
          this.convo.notify = false;
          this.$element.removeClass('notify');
        }
        new_open_convos = [];
        _ref1 = app.open_conversations;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          open_convo = _ref1[_j];
          if (open_convo !== this.current_view.convo.message_filter) {
            new_open_convos.push(open_convo);
          }
        }
        app.open_conversations = new_open_convos;
        this.current_view.convo = this.convo;
        app.open_conversations.push(this.convo.message_filter);
        this.current_view.render();
        this.current_view.loadPersistentMessages();
        this.current_view.switchmode = false;
      }
    } else {
      if (convo_status !== 'open') {
        if (this.convo.notify) {
          this.convo.notify = false;
          this.$element.removeClass('notify');
        }
        chat_window = new ChatRoom(this.convo);
        app.open_conversations.push(this.convo.message_filter);
      }
    }
    return this.remove_command_center_notification();
  };

  PersistentConversationView.prototype.sync_convo_new_message = function(e, message) {
    this.$element.remove();
    this.render();
    if (message.sender.image_url !== app.me.image_url) {
      this.$element.addClass('notify');
    } else {
      this.$element.removeClass('notify');
    }
    if (this.current_view instanceof ChatRoom) {
      this.current_view.$discussion.prepend(this.$element);
    } else {
      $('.parley div.controller-view').prepend(this.$element);
    }
    return this.remove_command_center_notification();
  };

  PersistentConversationView.prototype.remove_command_center_notification = function() {
    var has_class, view, _i, _len, _ref;
    if (this.current_view.constructor.name === "CommandCenter") {
      has_class = true;
      _ref = this.current_view.persist_view_array;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        view = _ref[_i];
        if (!view.$element.hasClass('notify')) {
          has_class = false;
        }
      }
      if (!has_class) {
        return $('.parley div.controller-bar a.messages').removeClass('notify');
      }
    }
  };

  return PersistentConversationView;

})();

module.exports = PersistentConversationView;

ChatRoom = require('./chat_room_view.coffee');


},{"./app.coffee":19,"./chat_room_view.coffee":20,"./templates/persistent_convo_reg.hbs":32,"handlebars":16,"hbsfy/runtime":18}],27:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "\n<section class=\"conversation\">\n  <div class=\"top-bar\">\n    <a>";
  if (helper = helpers.title_bar_function) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.title_bar_function); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</a>\n    <ul class=\"message-alt\">\n      <li class=\"entypo-minus minify\"></li>\n      <li class=\"entypo-resize-full\"></li>\n      <li class=\"entypo-cancel chat-close\"></li>\n    </ul>\n  </div>\n  <div class=\"message-area\">\n    <div class=\"message-bar\">\n      <ul class=\"additional\">\n        <li><a class=\"entypo-user-add\"></a></li>\n      </ul>\n      <ul class=\"existing\">\n        <li><a class=\"entypo-chat\"></a></li>\n      </ul>\n    </div>\n    <ol class=\"discussion\"></ol>\n    <textarea class=\"send\" maxlength=\"1800\" placeholder=\"Enter Message...\"></textarea>\n    <span>\n      <input class=\"parley_file_upload\" name=\"img_upload\" type=\"file\" />\n    </span>\n    <label class=\"img_upload entypo-camera\"></label>\n  </div>\n</section>";
  return buffer;
  });

},{"hbsfy/runtime":18}],28:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"avatar\">\n  <img src= ";
  if (helper = helpers.image_url) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.image_url); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + " />\n</div>\n<div class=\"content\">\n  <h2>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</h2>\n</div>\n";
  return buffer;
  });

},{"hbsfy/runtime":18}],29:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"persistent-bar\">\n  <img src=\"";
  if (helper = helpers.image_url) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.image_url); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "\" />\n  <a>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "\n    <span class=\"entypo-up-open-mini\"></span>\n  </a>\n  </div>\n<div class=\"controller-view\">\n</div>\n<div class=\"controller-bar\">\n  <ul class=\"utility-bar horizontal-list\">\n    <li>\n      <a class=\"messages\" >\n        <span class=\"entypo-chat\"></span>\n      </a>\n    </li>\n    <li>\n      <a class=\"user-settings\" >\n        <span class=\"fontawesome-cog\"></span>\n      </a>\n    </li>\n    <li>\n      <a class=\"active-users\" >\n        <span class=\"entypo-users\"></span>\n      </a>\n    </li>\n  </ul>\n</div>";
  return buffer;
  });

},{"hbsfy/runtime":18}],30:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<div class=\"parley\">\n  <section class=\"controller\">\n      <div class=\"g-signin login-bar\"\n        data-callback=\"sign_in_callback\"\n        data-clientid=\"1027427116765-9c18ckuo07r5ms0aclbfjsmcpd3jrmtc.apps.googleusercontent.com\"\n        data-cookiepolicy=\"single_host_origin\"\n        data-theme=\"none\"\n        data-scope=\"https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/devstorage.read_write\">\n        <li class=\"btn\">\n          <a class=\"entypo-gplus\"></a>\n        </li>\n        <li class=\"aside\">\n          <a> Sign in with google</a>\n        </li>\n      </div>\n  </section>\n</div>";
  });

},{"hbsfy/runtime":18}],31:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"avatar\">\n  <img src="
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.sender)),stack1 == null || stack1 === false ? stack1 : stack1.image_url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + " />\n</div>\n<div class=\"message status\">\n  <h2>"
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.sender)),stack1 == null || stack1 === false ? stack1 : stack1.display_name)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</h2>\n  <p>";
  if (helper = helpers.generate_message_content) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.generate_message_content); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</p>\n  <a class=\"time\">\n    <span class=\"entypo-clock\">   ";
  if (helper = helpers.time_since_created) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.time_since_created); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n  </a>\n</div>";
  return buffer;
  });

},{"hbsfy/runtime":18}],32:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"avatar\">\n  ";
  if (helper = helpers.format_image) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.format_image); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "\n</div>\n<div class=\"content status entypo-right-open-big\">\n  <h2>";
  if (helper = helpers.format_display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.format_display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</h2>\n  <p>";
  if (helper = helpers.retrieve_last_message) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.retrieve_last_message); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</p>\n  <a class=\"time\">\n    <span class=\"entypo-clock\"> ";
  if (helper = helpers.calculate_last_message_time) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.calculate_last_message_time); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n  </a>\n</div>\n";
  return buffer;
  });

},{"hbsfy/runtime":18}],33:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"default-view\">\n  <figure>\n    <img src=";
  if (helper = helpers.image_url) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.image_url); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + " />\n    <h2>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</h2>\n  </figure>\n</div>";
  return buffer;
  });

},{"hbsfy/runtime":18}],34:[function(require,module,exports){
var User, app;

app = require('./app.coffee');

User = (function() {
  function User(display_name, image_url) {
    this.display_name = display_name;
    this.image_url = image_url;
    this.status = "active";
  }

  return User;

})();

module.exports = User;


},{"./app.coffee":19}],35:[function(require,module,exports){
var Conversation, UserView, app, current_user_template;

app = require('./app.coffee');

Conversation = require('./conversation_model.coffee');

current_user_template = require('./templates/current_user.hbs');

UserView = (function() {
  function UserView(current_user, current_view) {
    var member, _i, _len, _ref;
    this.current_user = current_user;
    this.current_view = current_view;
    this.$element = $("<li class='user'></li>");
    this.$element.on('click', this.user_interact_callback.bind(this));
    if (this.current_view.constructor.name === "ChatRoom") {
      _ref = this.current_view.convo.convo_partners;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        member = _ref[_i];
        if (member.image_url === this.current_user.image_url) {
          this.$element.addClass('disabled');
          this.$element.off();
        }
      }
    }
  }

  UserView.prototype.render = function() {
    return this.$element.html(current_user_template(this.current_user));
  };

  UserView.prototype.user_interact_callback = function() {
    var new_params, user, _i, _len, _ref;
    if (this.$element.hasClass('selected')) {
      new_params = [];
      _ref = this.current_view.new_convo_params;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        user = _ref[_i];
        if (user.image_url !== this.current_user.image_url) {
          new_params.push(user);
        }
      }
      this.current_view.new_convo_params = new_params;
      this.$element.removeClass('selected');
    } else {
      this.current_view.new_convo_params.push(this.current_user);
      this.$element.addClass('selected');
    }
    if (this.current_view.new_convo_params.length > 0) {
      return this.current_view.$element.find('.confirm').removeClass('disabled').off().on('click', this.current_view.confirm_new_convo_params.bind(this.current_view));
    } else {
      return this.current_view.$element.find('.confirm').addClass('disabled').off();
    }
  };

  return UserView;

})();

module.exports = UserView;


},{"./app.coffee":19,"./conversation_model.coffee":22,"./templates/current_user.hbs":28}]},{},[19])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbGliL19lbXB0eS5qcyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy5qcyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy5ydW50aW1lLmpzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2Jhc2UuanMiLCIvVXNlcnMvQ2Fycm9sL1BhcmxleS1KUy9zZXJ2ZXIvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvYXN0LmpzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2UuanMiLCIvVXNlcnMvQ2Fycm9sL1BhcmxleS1KUy9zZXJ2ZXIvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvY29tcGlsZXIuanMiLCIvVXNlcnMvQ2Fycm9sL1BhcmxleS1KUy9zZXJ2ZXIvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvamF2YXNjcmlwdC1jb21waWxlci5qcyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9wYXJzZXIuanMiLCIvVXNlcnMvQ2Fycm9sL1BhcmxleS1KUy9zZXJ2ZXIvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvcHJpbnRlci5qcyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci92aXNpdG9yLmpzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2V4Y2VwdGlvbi5qcyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9ydW50aW1lLmpzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3NhZmUtc3RyaW5nLmpzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3V0aWxzLmpzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaW5kZXguanMiLCIvVXNlcnMvQ2Fycm9sL1BhcmxleS1KUy9zZXJ2ZXIvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL3J1bnRpbWUuanMiLCIvVXNlcnMvQ2Fycm9sL1BhcmxleS1KUy9zZXJ2ZXIvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYnNmeS9ydW50aW1lLmpzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvYXBwLmNvZmZlZSIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL2NoYXRfcm9vbV92aWV3LmNvZmZlZSIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL2NvbW1hbmRfY2VudGVyX3ZpZXcuY29mZmVlIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvY29udmVyc2F0aW9uX21vZGVsLmNvZmZlZSIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL21lc3NhZ2VfbW9kZWwuY29mZmVlIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvbWVzc2FnZV92aWV3LmNvZmZlZSIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL29hdXRoLmNvZmZlZSIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL3BlcnNpc3RlbnRfY29udmVyc2F0aW9uX3ZpZXcuY29mZmVlIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvdGVtcGxhdGVzL2NoYXRfcm9vbS5oYnMiLCIvVXNlcnMvQ2Fycm9sL1BhcmxleS1KUy9zZXJ2ZXIvcGFybGV5LmpzL3NyYy90ZW1wbGF0ZXMvY3VycmVudF91c2VyLmhicyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9sb2dnZWRfaW4uaGJzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvdGVtcGxhdGVzL2xvZ2dlZF9vdXQuaGJzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvdGVtcGxhdGVzL21lc3NhZ2UuaGJzIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvdGVtcGxhdGVzL3BlcnNpc3RlbnRfY29udm9fcmVnLmhicyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9wcm9maWxlLmhicyIsIi9Vc2Vycy9DYXJyb2wvUGFybGV5LUpTL3NlcnZlci9wYXJsZXkuanMvc3JjL3VzZXJfbW9kZWwuY29mZmVlIiwiL1VzZXJzL0NhcnJvbC9QYXJsZXktSlMvc2VydmVyL3BhcmxleS5qcy9zcmMvdXNlcl92aWV3LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzc2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDemVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtB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QUFBOztBQUFBLE1BZ0RNLENBQUMsT0FBUCxHQUFpQixRQWhEakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLG51bGwsIlwidXNlIHN0cmljdFwiO1xuLypnbG9iYWxzIEhhbmRsZWJhcnM6IHRydWUgKi9cbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy5ydW50aW1lXCIpW1wiZGVmYXVsdFwiXTtcblxuLy8gQ29tcGlsZXIgaW1wb3J0c1xudmFyIEFTVCA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvYXN0XCIpW1wiZGVmYXVsdFwiXTtcbnZhciBQYXJzZXIgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2VcIikucGFyc2VyO1xudmFyIHBhcnNlID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9iYXNlXCIpLnBhcnNlO1xudmFyIENvbXBpbGVyID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9jb21waWxlclwiKS5Db21waWxlcjtcbnZhciBjb21waWxlID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9jb21waWxlclwiKS5jb21waWxlO1xudmFyIHByZWNvbXBpbGUgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyXCIpLnByZWNvbXBpbGU7XG52YXIgSmF2YVNjcmlwdENvbXBpbGVyID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9qYXZhc2NyaXB0LWNvbXBpbGVyXCIpW1wiZGVmYXVsdFwiXTtcblxudmFyIF9jcmVhdGUgPSBIYW5kbGViYXJzLmNyZWF0ZTtcbnZhciBjcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGhiID0gX2NyZWF0ZSgpO1xuXG4gIGhiLmNvbXBpbGUgPSBmdW5jdGlvbihpbnB1dCwgb3B0aW9ucykge1xuICAgIHJldHVybiBjb21waWxlKGlucHV0LCBvcHRpb25zLCBoYik7XG4gIH07XG4gIGhiLnByZWNvbXBpbGUgPSBmdW5jdGlvbiAoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gcHJlY29tcGlsZShpbnB1dCwgb3B0aW9ucywgaGIpO1xuICB9O1xuXG4gIGhiLkFTVCA9IEFTVDtcbiAgaGIuQ29tcGlsZXIgPSBDb21waWxlcjtcbiAgaGIuSmF2YVNjcmlwdENvbXBpbGVyID0gSmF2YVNjcmlwdENvbXBpbGVyO1xuICBoYi5QYXJzZXIgPSBQYXJzZXI7XG4gIGhiLnBhcnNlID0gcGFyc2U7XG5cbiAgcmV0dXJuIGhiO1xufTtcblxuSGFuZGxlYmFycyA9IGNyZWF0ZSgpO1xuSGFuZGxlYmFycy5jcmVhdGUgPSBjcmVhdGU7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gSGFuZGxlYmFyczsiLCJcInVzZSBzdHJpY3RcIjtcbi8qZ2xvYmFscyBIYW5kbGViYXJzOiB0cnVlICovXG52YXIgYmFzZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvYmFzZVwiKTtcblxuLy8gRWFjaCBvZiB0aGVzZSBhdWdtZW50IHRoZSBIYW5kbGViYXJzIG9iamVjdC4gTm8gbmVlZCB0byBzZXR1cCBoZXJlLlxuLy8gKFRoaXMgaXMgZG9uZSB0byBlYXNpbHkgc2hhcmUgY29kZSBiZXR3ZWVuIGNvbW1vbmpzIGFuZCBicm93c2UgZW52cylcbnZhciBTYWZlU3RyaW5nID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9zYWZlLXN0cmluZ1wiKVtcImRlZmF1bHRcIl07XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xudmFyIFV0aWxzID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy91dGlsc1wiKTtcbnZhciBydW50aW1lID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9ydW50aW1lXCIpO1xuXG4vLyBGb3IgY29tcGF0aWJpbGl0eSBhbmQgdXNhZ2Ugb3V0c2lkZSBvZiBtb2R1bGUgc3lzdGVtcywgbWFrZSB0aGUgSGFuZGxlYmFycyBvYmplY3QgYSBuYW1lc3BhY2VcbnZhciBjcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGhiID0gbmV3IGJhc2UuSGFuZGxlYmFyc0Vudmlyb25tZW50KCk7XG5cbiAgVXRpbHMuZXh0ZW5kKGhiLCBiYXNlKTtcbiAgaGIuU2FmZVN0cmluZyA9IFNhZmVTdHJpbmc7XG4gIGhiLkV4Y2VwdGlvbiA9IEV4Y2VwdGlvbjtcbiAgaGIuVXRpbHMgPSBVdGlscztcblxuICBoYi5WTSA9IHJ1bnRpbWU7XG4gIGhiLnRlbXBsYXRlID0gZnVuY3Rpb24oc3BlYykge1xuICAgIHJldHVybiBydW50aW1lLnRlbXBsYXRlKHNwZWMsIGhiKTtcbiAgfTtcblxuICByZXR1cm4gaGI7XG59O1xuXG52YXIgSGFuZGxlYmFycyA9IGNyZWF0ZSgpO1xuSGFuZGxlYmFycy5jcmVhdGUgPSBjcmVhdGU7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gSGFuZGxlYmFyczsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBVdGlscyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG5cbnZhciBWRVJTSU9OID0gXCIxLjMuMFwiO1xuZXhwb3J0cy5WRVJTSU9OID0gVkVSU0lPTjt2YXIgQ09NUElMRVJfUkVWSVNJT04gPSA0O1xuZXhwb3J0cy5DT01QSUxFUl9SRVZJU0lPTiA9IENPTVBJTEVSX1JFVklTSU9OO1xudmFyIFJFVklTSU9OX0NIQU5HRVMgPSB7XG4gIDE6ICc8PSAxLjAucmMuMicsIC8vIDEuMC5yYy4yIGlzIGFjdHVhbGx5IHJldjIgYnV0IGRvZXNuJ3QgcmVwb3J0IGl0XG4gIDI6ICc9PSAxLjAuMC1yYy4zJyxcbiAgMzogJz09IDEuMC4wLXJjLjQnLFxuICA0OiAnPj0gMS4wLjAnXG59O1xuZXhwb3J0cy5SRVZJU0lPTl9DSEFOR0VTID0gUkVWSVNJT05fQ0hBTkdFUztcbnZhciBpc0FycmF5ID0gVXRpbHMuaXNBcnJheSxcbiAgICBpc0Z1bmN0aW9uID0gVXRpbHMuaXNGdW5jdGlvbixcbiAgICB0b1N0cmluZyA9IFV0aWxzLnRvU3RyaW5nLFxuICAgIG9iamVjdFR5cGUgPSAnW29iamVjdCBPYmplY3RdJztcblxuZnVuY3Rpb24gSGFuZGxlYmFyc0Vudmlyb25tZW50KGhlbHBlcnMsIHBhcnRpYWxzKSB7XG4gIHRoaXMuaGVscGVycyA9IGhlbHBlcnMgfHwge307XG4gIHRoaXMucGFydGlhbHMgPSBwYXJ0aWFscyB8fCB7fTtcblxuICByZWdpc3RlckRlZmF1bHRIZWxwZXJzKHRoaXMpO1xufVxuXG5leHBvcnRzLkhhbmRsZWJhcnNFbnZpcm9ubWVudCA9IEhhbmRsZWJhcnNFbnZpcm9ubWVudDtIYW5kbGViYXJzRW52aXJvbm1lbnQucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogSGFuZGxlYmFyc0Vudmlyb25tZW50LFxuXG4gIGxvZ2dlcjogbG9nZ2VyLFxuICBsb2c6IGxvZyxcblxuICByZWdpc3RlckhlbHBlcjogZnVuY3Rpb24obmFtZSwgZm4sIGludmVyc2UpIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChuYW1lKSA9PT0gb2JqZWN0VHlwZSkge1xuICAgICAgaWYgKGludmVyc2UgfHwgZm4pIHsgdGhyb3cgbmV3IEV4Y2VwdGlvbignQXJnIG5vdCBzdXBwb3J0ZWQgd2l0aCBtdWx0aXBsZSBoZWxwZXJzJyk7IH1cbiAgICAgIFV0aWxzLmV4dGVuZCh0aGlzLmhlbHBlcnMsIG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaW52ZXJzZSkgeyBmbi5ub3QgPSBpbnZlcnNlOyB9XG4gICAgICB0aGlzLmhlbHBlcnNbbmFtZV0gPSBmbjtcbiAgICB9XG4gIH0sXG5cbiAgcmVnaXN0ZXJQYXJ0aWFsOiBmdW5jdGlvbihuYW1lLCBzdHIpIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChuYW1lKSA9PT0gb2JqZWN0VHlwZSkge1xuICAgICAgVXRpbHMuZXh0ZW5kKHRoaXMucGFydGlhbHMsICBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJ0aWFsc1tuYW1lXSA9IHN0cjtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyRGVmYXVsdEhlbHBlcnMoaW5zdGFuY2UpIHtcbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2hlbHBlck1pc3NpbmcnLCBmdW5jdGlvbihhcmcpIHtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiTWlzc2luZyBoZWxwZXI6ICdcIiArIGFyZyArIFwiJ1wiKTtcbiAgICB9XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdibG9ja0hlbHBlck1pc3NpbmcnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgdmFyIGludmVyc2UgPSBvcHRpb25zLmludmVyc2UgfHwgZnVuY3Rpb24oKSB7fSwgZm4gPSBvcHRpb25zLmZuO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gICAgaWYoY29udGV4dCA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIGZuKHRoaXMpO1xuICAgIH0gZWxzZSBpZihjb250ZXh0ID09PSBmYWxzZSB8fCBjb250ZXh0ID09IG51bGwpIHtcbiAgICAgIHJldHVybiBpbnZlcnNlKHRoaXMpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjb250ZXh0KSkge1xuICAgICAgaWYoY29udGV4dC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiBpbnN0YW5jZS5oZWxwZXJzLmVhY2goY29udGV4dCwgb3B0aW9ucyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gaW52ZXJzZSh0aGlzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZuKGNvbnRleHQpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2VhY2gnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgdmFyIGZuID0gb3B0aW9ucy5mbiwgaW52ZXJzZSA9IG9wdGlvbnMuaW52ZXJzZTtcbiAgICB2YXIgaSA9IDAsIHJldCA9IFwiXCIsIGRhdGE7XG5cbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBpZiAob3B0aW9ucy5kYXRhKSB7XG4gICAgICBkYXRhID0gY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgICB9XG5cbiAgICBpZihjb250ZXh0ICYmIHR5cGVvZiBjb250ZXh0ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGlzQXJyYXkoY29udGV4dCkpIHtcbiAgICAgICAgZm9yKHZhciBqID0gY29udGV4dC5sZW5ndGg7IGk8ajsgaSsrKSB7XG4gICAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIGRhdGEuaW5kZXggPSBpO1xuICAgICAgICAgICAgZGF0YS5maXJzdCA9IChpID09PSAwKTtcbiAgICAgICAgICAgIGRhdGEubGFzdCAgPSAoaSA9PT0gKGNvbnRleHQubGVuZ3RoLTEpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0ID0gcmV0ICsgZm4oY29udGV4dFtpXSwgeyBkYXRhOiBkYXRhIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IodmFyIGtleSBpbiBjb250ZXh0KSB7XG4gICAgICAgICAgaWYoY29udGV4dC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBpZihkYXRhKSB7IFxuICAgICAgICAgICAgICBkYXRhLmtleSA9IGtleTsgXG4gICAgICAgICAgICAgIGRhdGEuaW5kZXggPSBpO1xuICAgICAgICAgICAgICBkYXRhLmZpcnN0ID0gKGkgPT09IDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0ID0gcmV0ICsgZm4oY29udGV4dFtrZXldLCB7ZGF0YTogZGF0YX0pO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGkgPT09IDApe1xuICAgICAgcmV0ID0gaW52ZXJzZSh0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0O1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignaWYnLCBmdW5jdGlvbihjb25kaXRpb25hbCwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNvbmRpdGlvbmFsKSkgeyBjb25kaXRpb25hbCA9IGNvbmRpdGlvbmFsLmNhbGwodGhpcyk7IH1cblxuICAgIC8vIERlZmF1bHQgYmVoYXZpb3IgaXMgdG8gcmVuZGVyIHRoZSBwb3NpdGl2ZSBwYXRoIGlmIHRoZSB2YWx1ZSBpcyB0cnV0aHkgYW5kIG5vdCBlbXB0eS5cbiAgICAvLyBUaGUgYGluY2x1ZGVaZXJvYCBvcHRpb24gbWF5IGJlIHNldCB0byB0cmVhdCB0aGUgY29uZHRpb25hbCBhcyBwdXJlbHkgbm90IGVtcHR5IGJhc2VkIG9uIHRoZVxuICAgIC8vIGJlaGF2aW9yIG9mIGlzRW1wdHkuIEVmZmVjdGl2ZWx5IHRoaXMgZGV0ZXJtaW5lcyBpZiAwIGlzIGhhbmRsZWQgYnkgdGhlIHBvc2l0aXZlIHBhdGggb3IgbmVnYXRpdmUuXG4gICAgaWYgKCghb3B0aW9ucy5oYXNoLmluY2x1ZGVaZXJvICYmICFjb25kaXRpb25hbCkgfHwgVXRpbHMuaXNFbXB0eShjb25kaXRpb25hbCkpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmludmVyc2UodGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmZuKHRoaXMpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ3VubGVzcycsIGZ1bmN0aW9uKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnNbJ2lmJ10uY2FsbCh0aGlzLCBjb25kaXRpb25hbCwge2ZuOiBvcHRpb25zLmludmVyc2UsIGludmVyc2U6IG9wdGlvbnMuZm4sIGhhc2g6IG9wdGlvbnMuaGFzaH0pO1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignd2l0aCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBpZiAoIVV0aWxzLmlzRW1wdHkoY29udGV4dCkpIHJldHVybiBvcHRpb25zLmZuKGNvbnRleHQpO1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignbG9nJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIHZhciBsZXZlbCA9IG9wdGlvbnMuZGF0YSAmJiBvcHRpb25zLmRhdGEubGV2ZWwgIT0gbnVsbCA/IHBhcnNlSW50KG9wdGlvbnMuZGF0YS5sZXZlbCwgMTApIDogMTtcbiAgICBpbnN0YW5jZS5sb2cobGV2ZWwsIGNvbnRleHQpO1xuICB9KTtcbn1cblxudmFyIGxvZ2dlciA9IHtcbiAgbWV0aG9kTWFwOiB7IDA6ICdkZWJ1ZycsIDE6ICdpbmZvJywgMjogJ3dhcm4nLCAzOiAnZXJyb3InIH0sXG5cbiAgLy8gU3RhdGUgZW51bVxuICBERUJVRzogMCxcbiAgSU5GTzogMSxcbiAgV0FSTjogMixcbiAgRVJST1I6IDMsXG4gIGxldmVsOiAzLFxuXG4gIC8vIGNhbiBiZSBvdmVycmlkZGVuIGluIHRoZSBob3N0IGVudmlyb25tZW50XG4gIGxvZzogZnVuY3Rpb24obGV2ZWwsIG9iaikge1xuICAgIGlmIChsb2dnZXIubGV2ZWwgPD0gbGV2ZWwpIHtcbiAgICAgIHZhciBtZXRob2QgPSBsb2dnZXIubWV0aG9kTWFwW2xldmVsXTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY29uc29sZVttZXRob2RdKSB7XG4gICAgICAgIGNvbnNvbGVbbWV0aG9kXS5jYWxsKGNvbnNvbGUsIG9iaik7XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuZXhwb3J0cy5sb2dnZXIgPSBsb2dnZXI7XG5mdW5jdGlvbiBsb2cobGV2ZWwsIG9iaikgeyBsb2dnZXIubG9nKGxldmVsLCBvYmopOyB9XG5cbmV4cG9ydHMubG9nID0gbG9nO3ZhciBjcmVhdGVGcmFtZSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICB2YXIgb2JqID0ge307XG4gIFV0aWxzLmV4dGVuZChvYmosIG9iamVjdCk7XG4gIHJldHVybiBvYmo7XG59O1xuZXhwb3J0cy5jcmVhdGVGcmFtZSA9IGNyZWF0ZUZyYW1lOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xuXG5mdW5jdGlvbiBMb2NhdGlvbkluZm8obG9jSW5mbyl7XG4gIGxvY0luZm8gPSBsb2NJbmZvIHx8IHt9O1xuICB0aGlzLmZpcnN0TGluZSAgID0gbG9jSW5mby5maXJzdF9saW5lO1xuICB0aGlzLmZpcnN0Q29sdW1uID0gbG9jSW5mby5maXJzdF9jb2x1bW47XG4gIHRoaXMubGFzdENvbHVtbiAgPSBsb2NJbmZvLmxhc3RfY29sdW1uO1xuICB0aGlzLmxhc3RMaW5lICAgID0gbG9jSW5mby5sYXN0X2xpbmU7XG59XG5cbnZhciBBU1QgPSB7XG4gIFByb2dyYW1Ob2RlOiBmdW5jdGlvbihzdGF0ZW1lbnRzLCBpbnZlcnNlU3RyaXAsIGludmVyc2UsIGxvY0luZm8pIHtcbiAgICB2YXIgaW52ZXJzZUxvY2F0aW9uSW5mbywgZmlyc3RJbnZlcnNlTm9kZTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgbG9jSW5mbyA9IGludmVyc2U7XG4gICAgICBpbnZlcnNlID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGxvY0luZm8gPSBpbnZlcnNlU3RyaXA7XG4gICAgICBpbnZlcnNlU3RyaXAgPSBudWxsO1xuICAgIH1cblxuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwicHJvZ3JhbVwiO1xuICAgIHRoaXMuc3RhdGVtZW50cyA9IHN0YXRlbWVudHM7XG4gICAgdGhpcy5zdHJpcCA9IHt9O1xuXG4gICAgaWYoaW52ZXJzZSkge1xuICAgICAgZmlyc3RJbnZlcnNlTm9kZSA9IGludmVyc2VbMF07XG4gICAgICBpZiAoZmlyc3RJbnZlcnNlTm9kZSkge1xuICAgICAgICBpbnZlcnNlTG9jYXRpb25JbmZvID0ge1xuICAgICAgICAgIGZpcnN0X2xpbmU6IGZpcnN0SW52ZXJzZU5vZGUuZmlyc3RMaW5lLFxuICAgICAgICAgIGxhc3RfbGluZTogZmlyc3RJbnZlcnNlTm9kZS5sYXN0TGluZSxcbiAgICAgICAgICBsYXN0X2NvbHVtbjogZmlyc3RJbnZlcnNlTm9kZS5sYXN0Q29sdW1uLFxuICAgICAgICAgIGZpcnN0X2NvbHVtbjogZmlyc3RJbnZlcnNlTm9kZS5maXJzdENvbHVtblxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmludmVyc2UgPSBuZXcgQVNULlByb2dyYW1Ob2RlKGludmVyc2UsIGludmVyc2VTdHJpcCwgaW52ZXJzZUxvY2F0aW9uSW5mbyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmludmVyc2UgPSBuZXcgQVNULlByb2dyYW1Ob2RlKGludmVyc2UsIGludmVyc2VTdHJpcCk7XG4gICAgICB9XG4gICAgICB0aGlzLnN0cmlwLnJpZ2h0ID0gaW52ZXJzZVN0cmlwLmxlZnQ7XG4gICAgfSBlbHNlIGlmIChpbnZlcnNlU3RyaXApIHtcbiAgICAgIHRoaXMuc3RyaXAubGVmdCA9IGludmVyc2VTdHJpcC5yaWdodDtcbiAgICB9XG4gIH0sXG5cbiAgTXVzdGFjaGVOb2RlOiBmdW5jdGlvbihyYXdQYXJhbXMsIGhhc2gsIG9wZW4sIHN0cmlwLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJtdXN0YWNoZVwiO1xuICAgIHRoaXMuc3RyaXAgPSBzdHJpcDtcblxuICAgIC8vIE9wZW4gbWF5IGJlIGEgc3RyaW5nIHBhcnNlZCBmcm9tIHRoZSBwYXJzZXIgb3IgYSBwYXNzZWQgYm9vbGVhbiBmbGFnXG4gICAgaWYgKG9wZW4gIT0gbnVsbCAmJiBvcGVuLmNoYXJBdCkge1xuICAgICAgLy8gTXVzdCB1c2UgY2hhckF0IHRvIHN1cHBvcnQgSUUgcHJlLTEwXG4gICAgICB2YXIgZXNjYXBlRmxhZyA9IG9wZW4uY2hhckF0KDMpIHx8IG9wZW4uY2hhckF0KDIpO1xuICAgICAgdGhpcy5lc2NhcGVkID0gZXNjYXBlRmxhZyAhPT0gJ3snICYmIGVzY2FwZUZsYWcgIT09ICcmJztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lc2NhcGVkID0gISFvcGVuO1xuICAgIH1cblxuICAgIGlmIChyYXdQYXJhbXMgaW5zdGFuY2VvZiBBU1QuU2V4cHJOb2RlKSB7XG4gICAgICB0aGlzLnNleHByID0gcmF3UGFyYW1zO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdXBwb3J0IG9sZCBBU1QgQVBJXG4gICAgICB0aGlzLnNleHByID0gbmV3IEFTVC5TZXhwck5vZGUocmF3UGFyYW1zLCBoYXNoKTtcbiAgICB9XG5cbiAgICB0aGlzLnNleHByLmlzUm9vdCA9IHRydWU7XG5cbiAgICAvLyBTdXBwb3J0IG9sZCBBU1QgQVBJIHRoYXQgc3RvcmVkIHRoaXMgaW5mbyBpbiBNdXN0YWNoZU5vZGVcbiAgICB0aGlzLmlkID0gdGhpcy5zZXhwci5pZDtcbiAgICB0aGlzLnBhcmFtcyA9IHRoaXMuc2V4cHIucGFyYW1zO1xuICAgIHRoaXMuaGFzaCA9IHRoaXMuc2V4cHIuaGFzaDtcbiAgICB0aGlzLmVsaWdpYmxlSGVscGVyID0gdGhpcy5zZXhwci5lbGlnaWJsZUhlbHBlcjtcbiAgICB0aGlzLmlzSGVscGVyID0gdGhpcy5zZXhwci5pc0hlbHBlcjtcbiAgfSxcblxuICBTZXhwck5vZGU6IGZ1bmN0aW9uKHJhd1BhcmFtcywgaGFzaCwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuXG4gICAgdGhpcy50eXBlID0gXCJzZXhwclwiO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG5cbiAgICB2YXIgaWQgPSB0aGlzLmlkID0gcmF3UGFyYW1zWzBdO1xuICAgIHZhciBwYXJhbXMgPSB0aGlzLnBhcmFtcyA9IHJhd1BhcmFtcy5zbGljZSgxKTtcblxuICAgIC8vIGEgbXVzdGFjaGUgaXMgYW4gZWxpZ2libGUgaGVscGVyIGlmOlxuICAgIC8vICogaXRzIGlkIGlzIHNpbXBsZSAoYSBzaW5nbGUgcGFydCwgbm90IGB0aGlzYCBvciBgLi5gKVxuICAgIHZhciBlbGlnaWJsZUhlbHBlciA9IHRoaXMuZWxpZ2libGVIZWxwZXIgPSBpZC5pc1NpbXBsZTtcblxuICAgIC8vIGEgbXVzdGFjaGUgaXMgZGVmaW5pdGVseSBhIGhlbHBlciBpZjpcbiAgICAvLyAqIGl0IGlzIGFuIGVsaWdpYmxlIGhlbHBlciwgYW5kXG4gICAgLy8gKiBpdCBoYXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciBvciBoYXNoIHNlZ21lbnRcbiAgICB0aGlzLmlzSGVscGVyID0gZWxpZ2libGVIZWxwZXIgJiYgKHBhcmFtcy5sZW5ndGggfHwgaGFzaCk7XG5cbiAgICAvLyBpZiBhIG11c3RhY2hlIGlzIGFuIGVsaWdpYmxlIGhlbHBlciBidXQgbm90IGEgZGVmaW5pdGVcbiAgICAvLyBoZWxwZXIsIGl0IGlzIGFtYmlndW91cywgYW5kIHdpbGwgYmUgcmVzb2x2ZWQgaW4gYSBsYXRlclxuICAgIC8vIHBhc3Mgb3IgYXQgcnVudGltZS5cbiAgfSxcblxuICBQYXJ0aWFsTm9kZTogZnVuY3Rpb24ocGFydGlhbE5hbWUsIGNvbnRleHQsIHN0cmlwLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlICAgICAgICAgPSBcInBhcnRpYWxcIjtcbiAgICB0aGlzLnBhcnRpYWxOYW1lICA9IHBhcnRpYWxOYW1lO1xuICAgIHRoaXMuY29udGV4dCAgICAgID0gY29udGV4dDtcbiAgICB0aGlzLnN0cmlwID0gc3RyaXA7XG4gIH0sXG5cbiAgQmxvY2tOb2RlOiBmdW5jdGlvbihtdXN0YWNoZSwgcHJvZ3JhbSwgaW52ZXJzZSwgY2xvc2UsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcblxuICAgIGlmKG11c3RhY2hlLnNleHByLmlkLm9yaWdpbmFsICE9PSBjbG9zZS5wYXRoLm9yaWdpbmFsKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKG11c3RhY2hlLnNleHByLmlkLm9yaWdpbmFsICsgXCIgZG9lc24ndCBtYXRjaCBcIiArIGNsb3NlLnBhdGgub3JpZ2luYWwsIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMudHlwZSA9ICdibG9jayc7XG4gICAgdGhpcy5tdXN0YWNoZSA9IG11c3RhY2hlO1xuICAgIHRoaXMucHJvZ3JhbSAgPSBwcm9ncmFtO1xuICAgIHRoaXMuaW52ZXJzZSAgPSBpbnZlcnNlO1xuXG4gICAgdGhpcy5zdHJpcCA9IHtcbiAgICAgIGxlZnQ6IG11c3RhY2hlLnN0cmlwLmxlZnQsXG4gICAgICByaWdodDogY2xvc2Uuc3RyaXAucmlnaHRcbiAgICB9O1xuXG4gICAgKHByb2dyYW0gfHwgaW52ZXJzZSkuc3RyaXAubGVmdCA9IG11c3RhY2hlLnN0cmlwLnJpZ2h0O1xuICAgIChpbnZlcnNlIHx8IHByb2dyYW0pLnN0cmlwLnJpZ2h0ID0gY2xvc2Uuc3RyaXAubGVmdDtcblxuICAgIGlmIChpbnZlcnNlICYmICFwcm9ncmFtKSB7XG4gICAgICB0aGlzLmlzSW52ZXJzZSA9IHRydWU7XG4gICAgfVxuICB9LFxuXG4gIENvbnRlbnROb2RlOiBmdW5jdGlvbihzdHJpbmcsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcImNvbnRlbnRcIjtcbiAgICB0aGlzLnN0cmluZyA9IHN0cmluZztcbiAgfSxcblxuICBIYXNoTm9kZTogZnVuY3Rpb24ocGFpcnMsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcImhhc2hcIjtcbiAgICB0aGlzLnBhaXJzID0gcGFpcnM7XG4gIH0sXG5cbiAgSWROb2RlOiBmdW5jdGlvbihwYXJ0cywgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiSURcIjtcblxuICAgIHZhciBvcmlnaW5hbCA9IFwiXCIsXG4gICAgICAgIGRpZyA9IFtdLFxuICAgICAgICBkZXB0aCA9IDA7XG5cbiAgICBmb3IodmFyIGk9MCxsPXBhcnRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV0ucGFydDtcbiAgICAgIG9yaWdpbmFsICs9IChwYXJ0c1tpXS5zZXBhcmF0b3IgfHwgJycpICsgcGFydDtcblxuICAgICAgaWYgKHBhcnQgPT09IFwiLi5cIiB8fCBwYXJ0ID09PSBcIi5cIiB8fCBwYXJ0ID09PSBcInRoaXNcIikge1xuICAgICAgICBpZiAoZGlnLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiSW52YWxpZCBwYXRoOiBcIiArIG9yaWdpbmFsLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXJ0ID09PSBcIi4uXCIpIHtcbiAgICAgICAgICBkZXB0aCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaXNTY29wZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkaWcucHVzaChwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm9yaWdpbmFsID0gb3JpZ2luYWw7XG4gICAgdGhpcy5wYXJ0cyAgICA9IGRpZztcbiAgICB0aGlzLnN0cmluZyAgID0gZGlnLmpvaW4oJy4nKTtcbiAgICB0aGlzLmRlcHRoICAgID0gZGVwdGg7XG5cbiAgICAvLyBhbiBJRCBpcyBzaW1wbGUgaWYgaXQgb25seSBoYXMgb25lIHBhcnQsIGFuZCB0aGF0IHBhcnQgaXMgbm90XG4gICAgLy8gYC4uYCBvciBgdGhpc2AuXG4gICAgdGhpcy5pc1NpbXBsZSA9IHBhcnRzLmxlbmd0aCA9PT0gMSAmJiAhdGhpcy5pc1Njb3BlZCAmJiBkZXB0aCA9PT0gMDtcblxuICAgIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gdGhpcy5zdHJpbmc7XG4gIH0sXG5cbiAgUGFydGlhbE5hbWVOb2RlOiBmdW5jdGlvbihuYW1lLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJQQVJUSUFMX05BTUVcIjtcbiAgICB0aGlzLm5hbWUgPSBuYW1lLm9yaWdpbmFsO1xuICB9LFxuXG4gIERhdGFOb2RlOiBmdW5jdGlvbihpZCwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiREFUQVwiO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgfSxcblxuICBTdHJpbmdOb2RlOiBmdW5jdGlvbihzdHJpbmcsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIlNUUklOR1wiO1xuICAgIHRoaXMub3JpZ2luYWwgPVxuICAgICAgdGhpcy5zdHJpbmcgPVxuICAgICAgdGhpcy5zdHJpbmdNb2RlVmFsdWUgPSBzdHJpbmc7XG4gIH0sXG5cbiAgSW50ZWdlck5vZGU6IGZ1bmN0aW9uKGludGVnZXIsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIklOVEVHRVJcIjtcbiAgICB0aGlzLm9yaWdpbmFsID1cbiAgICAgIHRoaXMuaW50ZWdlciA9IGludGVnZXI7XG4gICAgdGhpcy5zdHJpbmdNb2RlVmFsdWUgPSBOdW1iZXIoaW50ZWdlcik7XG4gIH0sXG5cbiAgQm9vbGVhbk5vZGU6IGZ1bmN0aW9uKGJvb2wsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIkJPT0xFQU5cIjtcbiAgICB0aGlzLmJvb2wgPSBib29sO1xuICAgIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gYm9vbCA9PT0gXCJ0cnVlXCI7XG4gIH0sXG5cbiAgQ29tbWVudE5vZGU6IGZ1bmN0aW9uKGNvbW1lbnQsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcImNvbW1lbnRcIjtcbiAgICB0aGlzLmNvbW1lbnQgPSBjb21tZW50O1xuICB9XG59O1xuXG4vLyBNdXN0IGJlIGV4cG9ydGVkIGFzIGFuIG9iamVjdCByYXRoZXIgdGhhbiB0aGUgcm9vdCBvZiB0aGUgbW9kdWxlIGFzIHRoZSBqaXNvbiBsZXhlclxuLy8gbW9zdCBtb2RpZnkgdGhlIG9iamVjdCB0byBvcGVyYXRlIHByb3Blcmx5LlxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBBU1Q7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgcGFyc2VyID0gcmVxdWlyZShcIi4vcGFyc2VyXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBBU1QgPSByZXF1aXJlKFwiLi9hc3RcIilbXCJkZWZhdWx0XCJdO1xuXG5leHBvcnRzLnBhcnNlciA9IHBhcnNlcjtcblxuZnVuY3Rpb24gcGFyc2UoaW5wdXQpIHtcbiAgLy8gSnVzdCByZXR1cm4gaWYgYW4gYWxyZWFkeS1jb21waWxlIEFTVCB3YXMgcGFzc2VkIGluLlxuICBpZihpbnB1dC5jb25zdHJ1Y3RvciA9PT0gQVNULlByb2dyYW1Ob2RlKSB7IHJldHVybiBpbnB1dDsgfVxuXG4gIHBhcnNlci55eSA9IEFTVDtcbiAgcmV0dXJuIHBhcnNlci5wYXJzZShpbnB1dCk7XG59XG5cbmV4cG9ydHMucGFyc2UgPSBwYXJzZTsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcblxuZnVuY3Rpb24gQ29tcGlsZXIoKSB7fVxuXG5leHBvcnRzLkNvbXBpbGVyID0gQ29tcGlsZXI7Ly8gdGhlIGZvdW5kSGVscGVyIHJlZ2lzdGVyIHdpbGwgZGlzYW1iaWd1YXRlIGhlbHBlciBsb29rdXAgZnJvbSBmaW5kaW5nIGFcbi8vIGZ1bmN0aW9uIGluIGEgY29udGV4dC4gVGhpcyBpcyBuZWNlc3NhcnkgZm9yIG11c3RhY2hlIGNvbXBhdGliaWxpdHksIHdoaWNoXG4vLyByZXF1aXJlcyB0aGF0IGNvbnRleHQgZnVuY3Rpb25zIGluIGJsb2NrcyBhcmUgZXZhbHVhdGVkIGJ5IGJsb2NrSGVscGVyTWlzc2luZyxcbi8vIGFuZCB0aGVuIHByb2NlZWQgYXMgaWYgdGhlIHJlc3VsdGluZyB2YWx1ZSB3YXMgcHJvdmlkZWQgdG8gYmxvY2tIZWxwZXJNaXNzaW5nLlxuXG5Db21waWxlci5wcm90b3R5cGUgPSB7XG4gIGNvbXBpbGVyOiBDb21waWxlcixcblxuICBkaXNhc3NlbWJsZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9wY29kZXMgPSB0aGlzLm9wY29kZXMsIG9wY29kZSwgb3V0ID0gW10sIHBhcmFtcywgcGFyYW07XG5cbiAgICBmb3IgKHZhciBpPTAsIGw9b3Bjb2Rlcy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBvcGNvZGUgPSBvcGNvZGVzW2ldO1xuXG4gICAgICBpZiAob3Bjb2RlLm9wY29kZSA9PT0gJ0RFQ0xBUkUnKSB7XG4gICAgICAgIG91dC5wdXNoKFwiREVDTEFSRSBcIiArIG9wY29kZS5uYW1lICsgXCI9XCIgKyBvcGNvZGUudmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFyYW1zID0gW107XG4gICAgICAgIGZvciAodmFyIGo9MDsgajxvcGNvZGUuYXJncy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHBhcmFtID0gb3Bjb2RlLmFyZ3Nbal07XG4gICAgICAgICAgaWYgKHR5cGVvZiBwYXJhbSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgcGFyYW0gPSBcIlxcXCJcIiArIHBhcmFtLnJlcGxhY2UoXCJcXG5cIiwgXCJcXFxcblwiKSArIFwiXFxcIlwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJhbXMucHVzaChwYXJhbSk7XG4gICAgICAgIH1cbiAgICAgICAgb3V0LnB1c2gob3Bjb2RlLm9wY29kZSArIFwiIFwiICsgcGFyYW1zLmpvaW4oXCIgXCIpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb3V0LmpvaW4oXCJcXG5cIik7XG4gIH0sXG5cbiAgZXF1YWxzOiBmdW5jdGlvbihvdGhlcikge1xuICAgIHZhciBsZW4gPSB0aGlzLm9wY29kZXMubGVuZ3RoO1xuICAgIGlmIChvdGhlci5vcGNvZGVzLmxlbmd0aCAhPT0gbGVuKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIG9wY29kZSA9IHRoaXMub3Bjb2Rlc1tpXSxcbiAgICAgICAgICBvdGhlck9wY29kZSA9IG90aGVyLm9wY29kZXNbaV07XG4gICAgICBpZiAob3Bjb2RlLm9wY29kZSAhPT0gb3RoZXJPcGNvZGUub3Bjb2RlIHx8IG9wY29kZS5hcmdzLmxlbmd0aCAhPT0gb3RoZXJPcGNvZGUuYXJncy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBvcGNvZGUuYXJncy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAob3Bjb2RlLmFyZ3Nbal0gIT09IG90aGVyT3Bjb2RlLmFyZ3Nbal0pIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZW4gPSB0aGlzLmNoaWxkcmVuLmxlbmd0aDtcbiAgICBpZiAob3RoZXIuY2hpbGRyZW4ubGVuZ3RoICE9PSBsZW4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAoIXRoaXMuY2hpbGRyZW5baV0uZXF1YWxzKG90aGVyLmNoaWxkcmVuW2ldKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG5cbiAgZ3VpZDogMCxcblxuICBjb21waWxlOiBmdW5jdGlvbihwcm9ncmFtLCBvcHRpb25zKSB7XG4gICAgdGhpcy5vcGNvZGVzID0gW107XG4gICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgIHRoaXMuZGVwdGhzID0ge2xpc3Q6IFtdfTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgLy8gVGhlc2UgY2hhbmdlcyB3aWxsIHByb3BhZ2F0ZSB0byB0aGUgb3RoZXIgY29tcGlsZXIgY29tcG9uZW50c1xuICAgIHZhciBrbm93bkhlbHBlcnMgPSB0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzO1xuICAgIHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnMgPSB7XG4gICAgICAnaGVscGVyTWlzc2luZyc6IHRydWUsXG4gICAgICAnYmxvY2tIZWxwZXJNaXNzaW5nJzogdHJ1ZSxcbiAgICAgICdlYWNoJzogdHJ1ZSxcbiAgICAgICdpZic6IHRydWUsXG4gICAgICAndW5sZXNzJzogdHJ1ZSxcbiAgICAgICd3aXRoJzogdHJ1ZSxcbiAgICAgICdsb2cnOiB0cnVlXG4gICAgfTtcbiAgICBpZiAoa25vd25IZWxwZXJzKSB7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIGtub3duSGVscGVycykge1xuICAgICAgICB0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzW25hbWVdID0ga25vd25IZWxwZXJzW25hbWVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmFjY2VwdChwcm9ncmFtKTtcbiAgfSxcblxuICBhY2NlcHQ6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgc3RyaXAgPSBub2RlLnN0cmlwIHx8IHt9LFxuICAgICAgICByZXQ7XG4gICAgaWYgKHN0cmlwLmxlZnQpIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdzdHJpcCcpO1xuICAgIH1cblxuICAgIHJldCA9IHRoaXNbbm9kZS50eXBlXShub2RlKTtcblxuICAgIGlmIChzdHJpcC5yaWdodCkge1xuICAgICAgdGhpcy5vcGNvZGUoJ3N0cmlwJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbiAgfSxcblxuICBwcm9ncmFtOiBmdW5jdGlvbihwcm9ncmFtKSB7XG4gICAgdmFyIHN0YXRlbWVudHMgPSBwcm9ncmFtLnN0YXRlbWVudHM7XG5cbiAgICBmb3IodmFyIGk9MCwgbD1zdGF0ZW1lbnRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHRoaXMuYWNjZXB0KHN0YXRlbWVudHNbaV0pO1xuICAgIH1cbiAgICB0aGlzLmlzU2ltcGxlID0gbCA9PT0gMTtcblxuICAgIHRoaXMuZGVwdGhzLmxpc3QgPSB0aGlzLmRlcHRocy5saXN0LnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgcmV0dXJuIGEgLSBiO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgY29tcGlsZVByb2dyYW06IGZ1bmN0aW9uKHByb2dyYW0pIHtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IHRoaXMuY29tcGlsZXIoKS5jb21waWxlKHByb2dyYW0sIHRoaXMub3B0aW9ucyk7XG4gICAgdmFyIGd1aWQgPSB0aGlzLmd1aWQrKywgZGVwdGg7XG5cbiAgICB0aGlzLnVzZVBhcnRpYWwgPSB0aGlzLnVzZVBhcnRpYWwgfHwgcmVzdWx0LnVzZVBhcnRpYWw7XG5cbiAgICB0aGlzLmNoaWxkcmVuW2d1aWRdID0gcmVzdWx0O1xuXG4gICAgZm9yKHZhciBpPTAsIGw9cmVzdWx0LmRlcHRocy5saXN0Lmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIGRlcHRoID0gcmVzdWx0LmRlcHRocy5saXN0W2ldO1xuXG4gICAgICBpZihkZXB0aCA8IDIpIHsgY29udGludWU7IH1cbiAgICAgIGVsc2UgeyB0aGlzLmFkZERlcHRoKGRlcHRoIC0gMSk7IH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3VpZDtcbiAgfSxcblxuICBibG9jazogZnVuY3Rpb24oYmxvY2spIHtcbiAgICB2YXIgbXVzdGFjaGUgPSBibG9jay5tdXN0YWNoZSxcbiAgICAgICAgcHJvZ3JhbSA9IGJsb2NrLnByb2dyYW0sXG4gICAgICAgIGludmVyc2UgPSBibG9jay5pbnZlcnNlO1xuXG4gICAgaWYgKHByb2dyYW0pIHtcbiAgICAgIHByb2dyYW0gPSB0aGlzLmNvbXBpbGVQcm9ncmFtKHByb2dyYW0pO1xuICAgIH1cblxuICAgIGlmIChpbnZlcnNlKSB7XG4gICAgICBpbnZlcnNlID0gdGhpcy5jb21waWxlUHJvZ3JhbShpbnZlcnNlKTtcbiAgICB9XG5cbiAgICB2YXIgc2V4cHIgPSBtdXN0YWNoZS5zZXhwcjtcbiAgICB2YXIgdHlwZSA9IHRoaXMuY2xhc3NpZnlTZXhwcihzZXhwcik7XG5cbiAgICBpZiAodHlwZSA9PT0gXCJoZWxwZXJcIikge1xuICAgICAgdGhpcy5oZWxwZXJTZXhwcihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSBcInNpbXBsZVwiKSB7XG4gICAgICB0aGlzLnNpbXBsZVNleHByKHNleHByKTtcblxuICAgICAgLy8gbm93IHRoYXQgdGhlIHNpbXBsZSBtdXN0YWNoZSBpcyByZXNvbHZlZCwgd2UgbmVlZCB0b1xuICAgICAgLy8gZXZhbHVhdGUgaXQgYnkgZXhlY3V0aW5nIGBibG9ja0hlbHBlck1pc3NpbmdgXG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIGludmVyc2UpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2VtcHR5SGFzaCcpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2Jsb2NrVmFsdWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hbWJpZ3VvdXNTZXhwcihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSk7XG5cbiAgICAgIC8vIG5vdyB0aGF0IHRoZSBzaW1wbGUgbXVzdGFjaGUgaXMgcmVzb2x2ZWQsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGV2YWx1YXRlIGl0IGJ5IGV4ZWN1dGluZyBgYmxvY2tIZWxwZXJNaXNzaW5nYFxuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdhbWJpZ3VvdXNCbG9ja1ZhbHVlJyk7XG4gICAgfVxuXG4gICAgdGhpcy5vcGNvZGUoJ2FwcGVuZCcpO1xuICB9LFxuXG4gIGhhc2g6IGZ1bmN0aW9uKGhhc2gpIHtcbiAgICB2YXIgcGFpcnMgPSBoYXNoLnBhaXJzLCBwYWlyLCB2YWw7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaEhhc2gnKTtcblxuICAgIGZvcih2YXIgaT0wLCBsPXBhaXJzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHBhaXIgPSBwYWlyc1tpXTtcbiAgICAgIHZhbCAgPSBwYWlyWzFdO1xuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgICBpZih2YWwuZGVwdGgpIHtcbiAgICAgICAgICB0aGlzLmFkZERlcHRoKHZhbC5kZXB0aCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCB2YWwuZGVwdGggfHwgMCk7XG4gICAgICAgIHRoaXMub3Bjb2RlKCdwdXNoU3RyaW5nUGFyYW0nLCB2YWwuc3RyaW5nTW9kZVZhbHVlLCB2YWwudHlwZSk7XG5cbiAgICAgICAgaWYgKHZhbC50eXBlID09PSAnc2V4cHInKSB7XG4gICAgICAgICAgLy8gU3ViZXhwcmVzc2lvbnMgZ2V0IGV2YWx1YXRlZCBhbmQgcGFzc2VkIGluXG4gICAgICAgICAgLy8gaW4gc3RyaW5nIHBhcmFtcyBtb2RlLlxuICAgICAgICAgIHRoaXMuc2V4cHIodmFsKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hY2NlcHQodmFsKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5vcGNvZGUoJ2Fzc2lnblRvSGFzaCcsIHBhaXJbMF0pO1xuICAgIH1cbiAgICB0aGlzLm9wY29kZSgncG9wSGFzaCcpO1xuICB9LFxuXG4gIHBhcnRpYWw6IGZ1bmN0aW9uKHBhcnRpYWwpIHtcbiAgICB2YXIgcGFydGlhbE5hbWUgPSBwYXJ0aWFsLnBhcnRpYWxOYW1lO1xuICAgIHRoaXMudXNlUGFydGlhbCA9IHRydWU7XG5cbiAgICBpZihwYXJ0aWFsLmNvbnRleHQpIHtcbiAgICAgIHRoaXMuSUQocGFydGlhbC5jb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2gnLCAnZGVwdGgwJyk7XG4gICAgfVxuXG4gICAgdGhpcy5vcGNvZGUoJ2ludm9rZVBhcnRpYWwnLCBwYXJ0aWFsTmFtZS5uYW1lKTtcbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gIH0sXG5cbiAgY29udGVudDogZnVuY3Rpb24oY29udGVudCkge1xuICAgIHRoaXMub3Bjb2RlKCdhcHBlbmRDb250ZW50JywgY29udGVudC5zdHJpbmcpO1xuICB9LFxuXG4gIG11c3RhY2hlOiBmdW5jdGlvbihtdXN0YWNoZSkge1xuICAgIHRoaXMuc2V4cHIobXVzdGFjaGUuc2V4cHIpO1xuXG4gICAgaWYobXVzdGFjaGUuZXNjYXBlZCAmJiAhdGhpcy5vcHRpb25zLm5vRXNjYXBlKSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kRXNjYXBlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gICAgfVxuICB9LFxuXG4gIGFtYmlndW91c1NleHByOiBmdW5jdGlvbihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSkge1xuICAgIHZhciBpZCA9IHNleHByLmlkLFxuICAgICAgICBuYW1lID0gaWQucGFydHNbMF0sXG4gICAgICAgIGlzQmxvY2sgPSBwcm9ncmFtICE9IG51bGwgfHwgaW52ZXJzZSAhPSBudWxsO1xuXG4gICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBpZC5kZXB0aCk7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcblxuICAgIHRoaXMub3Bjb2RlKCdpbnZva2VBbWJpZ3VvdXMnLCBuYW1lLCBpc0Jsb2NrKTtcbiAgfSxcblxuICBzaW1wbGVTZXhwcjogZnVuY3Rpb24oc2V4cHIpIHtcbiAgICB2YXIgaWQgPSBzZXhwci5pZDtcblxuICAgIGlmIChpZC50eXBlID09PSAnREFUQScpIHtcbiAgICAgIHRoaXMuREFUQShpZCk7XG4gICAgfSBlbHNlIGlmIChpZC5wYXJ0cy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuSUQoaWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTaW1wbGlmaWVkIElEIGZvciBgdGhpc2BcbiAgICAgIHRoaXMuYWRkRGVwdGgoaWQuZGVwdGgpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBpZC5kZXB0aCk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaENvbnRleHQnKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgncmVzb2x2ZVBvc3NpYmxlTGFtYmRhJyk7XG4gIH0sXG5cbiAgaGVscGVyU2V4cHI6IGZ1bmN0aW9uKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlKSB7XG4gICAgdmFyIHBhcmFtcyA9IHRoaXMuc2V0dXBGdWxsTXVzdGFjaGVQYXJhbXMoc2V4cHIsIHByb2dyYW0sIGludmVyc2UpLFxuICAgICAgICBuYW1lID0gc2V4cHIuaWQucGFydHNbMF07XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmtub3duSGVscGVyc1tuYW1lXSkge1xuICAgICAgdGhpcy5vcGNvZGUoJ2ludm9rZUtub3duSGVscGVyJywgcGFyYW1zLmxlbmd0aCwgbmFtZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzT25seSkge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIllvdSBzcGVjaWZpZWQga25vd25IZWxwZXJzT25seSwgYnV0IHVzZWQgdGhlIHVua25vd24gaGVscGVyIFwiICsgbmFtZSwgc2V4cHIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnaW52b2tlSGVscGVyJywgcGFyYW1zLmxlbmd0aCwgbmFtZSwgc2V4cHIuaXNSb290KTtcbiAgICB9XG4gIH0sXG5cbiAgc2V4cHI6IGZ1bmN0aW9uKHNleHByKSB7XG4gICAgdmFyIHR5cGUgPSB0aGlzLmNsYXNzaWZ5U2V4cHIoc2V4cHIpO1xuXG4gICAgaWYgKHR5cGUgPT09IFwic2ltcGxlXCIpIHtcbiAgICAgIHRoaXMuc2ltcGxlU2V4cHIoc2V4cHIpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJoZWxwZXJcIikge1xuICAgICAgdGhpcy5oZWxwZXJTZXhwcihzZXhwcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYW1iaWd1b3VzU2V4cHIoc2V4cHIpO1xuICAgIH1cbiAgfSxcblxuICBJRDogZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLmFkZERlcHRoKGlkLmRlcHRoKTtcbiAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIGlkLmRlcHRoKTtcblxuICAgIHZhciBuYW1lID0gaWQucGFydHNbMF07XG4gICAgaWYgKCFuYW1lKSB7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaENvbnRleHQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ2xvb2t1cE9uQ29udGV4dCcsIGlkLnBhcnRzWzBdKTtcbiAgICB9XG5cbiAgICBmb3IodmFyIGk9MSwgbD1pZC5wYXJ0cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwJywgaWQucGFydHNbaV0pO1xuICAgIH1cbiAgfSxcblxuICBEQVRBOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgdGhpcy5vcHRpb25zLmRhdGEgPSB0cnVlO1xuICAgIGlmIChkYXRhLmlkLmlzU2NvcGVkIHx8IGRhdGEuaWQuZGVwdGgpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ1Njb3BlZCBkYXRhIHJlZmVyZW5jZXMgYXJlIG5vdCBzdXBwb3J0ZWQ6ICcgKyBkYXRhLm9yaWdpbmFsLCBkYXRhKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgnbG9va3VwRGF0YScpO1xuICAgIHZhciBwYXJ0cyA9IGRhdGEuaWQucGFydHM7XG4gICAgZm9yKHZhciBpPTAsIGw9cGFydHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgdGhpcy5vcGNvZGUoJ2xvb2t1cCcsIHBhcnRzW2ldKTtcbiAgICB9XG4gIH0sXG5cbiAgU1RSSU5HOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICB0aGlzLm9wY29kZSgncHVzaFN0cmluZycsIHN0cmluZy5zdHJpbmcpO1xuICB9LFxuXG4gIElOVEVHRVI6IGZ1bmN0aW9uKGludGVnZXIpIHtcbiAgICB0aGlzLm9wY29kZSgncHVzaExpdGVyYWwnLCBpbnRlZ2VyLmludGVnZXIpO1xuICB9LFxuXG4gIEJPT0xFQU46IGZ1bmN0aW9uKGJvb2wpIHtcbiAgICB0aGlzLm9wY29kZSgncHVzaExpdGVyYWwnLCBib29sLmJvb2wpO1xuICB9LFxuXG4gIGNvbW1lbnQ6IGZ1bmN0aW9uKCkge30sXG5cbiAgLy8gSEVMUEVSU1xuICBvcGNvZGU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB0aGlzLm9wY29kZXMucHVzaCh7IG9wY29kZTogbmFtZSwgYXJnczogW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpIH0pO1xuICB9LFxuXG4gIGRlY2xhcmU6IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgdGhpcy5vcGNvZGVzLnB1c2goeyBvcGNvZGU6ICdERUNMQVJFJywgbmFtZTogbmFtZSwgdmFsdWU6IHZhbHVlIH0pO1xuICB9LFxuXG4gIGFkZERlcHRoOiBmdW5jdGlvbihkZXB0aCkge1xuICAgIGlmKGRlcHRoID09PSAwKSB7IHJldHVybjsgfVxuXG4gICAgaWYoIXRoaXMuZGVwdGhzW2RlcHRoXSkge1xuICAgICAgdGhpcy5kZXB0aHNbZGVwdGhdID0gdHJ1ZTtcbiAgICAgIHRoaXMuZGVwdGhzLmxpc3QucHVzaChkZXB0aCk7XG4gICAgfVxuICB9LFxuXG4gIGNsYXNzaWZ5U2V4cHI6IGZ1bmN0aW9uKHNleHByKSB7XG4gICAgdmFyIGlzSGVscGVyICAgPSBzZXhwci5pc0hlbHBlcjtcbiAgICB2YXIgaXNFbGlnaWJsZSA9IHNleHByLmVsaWdpYmxlSGVscGVyO1xuICAgIHZhciBvcHRpb25zICAgID0gdGhpcy5vcHRpb25zO1xuXG4gICAgLy8gaWYgYW1iaWd1b3VzLCB3ZSBjYW4gcG9zc2libHkgcmVzb2x2ZSB0aGUgYW1iaWd1aXR5IG5vd1xuICAgIGlmIChpc0VsaWdpYmxlICYmICFpc0hlbHBlcikge1xuICAgICAgdmFyIG5hbWUgPSBzZXhwci5pZC5wYXJ0c1swXTtcblxuICAgICAgaWYgKG9wdGlvbnMua25vd25IZWxwZXJzW25hbWVdKSB7XG4gICAgICAgIGlzSGVscGVyID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5rbm93bkhlbHBlcnNPbmx5KSB7XG4gICAgICAgIGlzRWxpZ2libGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaXNIZWxwZXIpIHsgcmV0dXJuIFwiaGVscGVyXCI7IH1cbiAgICBlbHNlIGlmIChpc0VsaWdpYmxlKSB7IHJldHVybiBcImFtYmlndW91c1wiOyB9XG4gICAgZWxzZSB7IHJldHVybiBcInNpbXBsZVwiOyB9XG4gIH0sXG5cbiAgcHVzaFBhcmFtczogZnVuY3Rpb24ocGFyYW1zKSB7XG4gICAgdmFyIGkgPSBwYXJhbXMubGVuZ3RoLCBwYXJhbTtcblxuICAgIHdoaWxlKGktLSkge1xuICAgICAgcGFyYW0gPSBwYXJhbXNbaV07XG5cbiAgICAgIGlmKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgICAgaWYocGFyYW0uZGVwdGgpIHtcbiAgICAgICAgICB0aGlzLmFkZERlcHRoKHBhcmFtLmRlcHRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgcGFyYW0uZGVwdGggfHwgMCk7XG4gICAgICAgIHRoaXMub3Bjb2RlKCdwdXNoU3RyaW5nUGFyYW0nLCBwYXJhbS5zdHJpbmdNb2RlVmFsdWUsIHBhcmFtLnR5cGUpO1xuXG4gICAgICAgIGlmIChwYXJhbS50eXBlID09PSAnc2V4cHInKSB7XG4gICAgICAgICAgLy8gU3ViZXhwcmVzc2lvbnMgZ2V0IGV2YWx1YXRlZCBhbmQgcGFzc2VkIGluXG4gICAgICAgICAgLy8gaW4gc3RyaW5nIHBhcmFtcyBtb2RlLlxuICAgICAgICAgIHRoaXMuc2V4cHIocGFyYW0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzW3BhcmFtLnR5cGVdKHBhcmFtKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc2V0dXBGdWxsTXVzdGFjaGVQYXJhbXM6IGZ1bmN0aW9uKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlKSB7XG4gICAgdmFyIHBhcmFtcyA9IHNleHByLnBhcmFtcztcbiAgICB0aGlzLnB1c2hQYXJhbXMocGFyYW1zKTtcblxuICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIGludmVyc2UpO1xuXG4gICAgaWYgKHNleHByLmhhc2gpIHtcbiAgICAgIHRoaXMuaGFzaChzZXhwci5oYXNoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ2VtcHR5SGFzaCcpO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJhbXM7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHByZWNvbXBpbGUoaW5wdXQsIG9wdGlvbnMsIGVudikge1xuICBpZiAoaW5wdXQgPT0gbnVsbCB8fCAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJyAmJiBpbnB1dC5jb25zdHJ1Y3RvciAhPT0gZW52LkFTVC5Qcm9ncmFtTm9kZSkpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiWW91IG11c3QgcGFzcyBhIHN0cmluZyBvciBIYW5kbGViYXJzIEFTVCB0byBIYW5kbGViYXJzLnByZWNvbXBpbGUuIFlvdSBwYXNzZWQgXCIgKyBpbnB1dCk7XG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKCEoJ2RhdGEnIGluIG9wdGlvbnMpKSB7XG4gICAgb3B0aW9ucy5kYXRhID0gdHJ1ZTtcbiAgfVxuXG4gIHZhciBhc3QgPSBlbnYucGFyc2UoaW5wdXQpO1xuICB2YXIgZW52aXJvbm1lbnQgPSBuZXcgZW52LkNvbXBpbGVyKCkuY29tcGlsZShhc3QsIG9wdGlvbnMpO1xuICByZXR1cm4gbmV3IGVudi5KYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKGVudmlyb25tZW50LCBvcHRpb25zKTtcbn1cblxuZXhwb3J0cy5wcmVjb21waWxlID0gcHJlY29tcGlsZTtmdW5jdGlvbiBjb21waWxlKGlucHV0LCBvcHRpb25zLCBlbnYpIHtcbiAgaWYgKGlucHV0ID09IG51bGwgfHwgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycgJiYgaW5wdXQuY29uc3RydWN0b3IgIT09IGVudi5BU1QuUHJvZ3JhbU5vZGUpKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIllvdSBtdXN0IHBhc3MgYSBzdHJpbmcgb3IgSGFuZGxlYmFycyBBU1QgdG8gSGFuZGxlYmFycy5jb21waWxlLiBZb3UgcGFzc2VkIFwiICsgaW5wdXQpO1xuICB9XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgaWYgKCEoJ2RhdGEnIGluIG9wdGlvbnMpKSB7XG4gICAgb3B0aW9ucy5kYXRhID0gdHJ1ZTtcbiAgfVxuXG4gIHZhciBjb21waWxlZDtcblxuICBmdW5jdGlvbiBjb21waWxlSW5wdXQoKSB7XG4gICAgdmFyIGFzdCA9IGVudi5wYXJzZShpbnB1dCk7XG4gICAgdmFyIGVudmlyb25tZW50ID0gbmV3IGVudi5Db21waWxlcigpLmNvbXBpbGUoYXN0LCBvcHRpb25zKTtcbiAgICB2YXIgdGVtcGxhdGVTcGVjID0gbmV3IGVudi5KYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKGVudmlyb25tZW50LCBvcHRpb25zLCB1bmRlZmluZWQsIHRydWUpO1xuICAgIHJldHVybiBlbnYudGVtcGxhdGUodGVtcGxhdGVTcGVjKTtcbiAgfVxuXG4gIC8vIFRlbXBsYXRlIGlzIG9ubHkgY29tcGlsZWQgb24gZmlyc3QgdXNlIGFuZCBjYWNoZWQgYWZ0ZXIgdGhhdCBwb2ludC5cbiAgcmV0dXJuIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWNvbXBpbGVkKSB7XG4gICAgICBjb21waWxlZCA9IGNvbXBpbGVJbnB1dCgpO1xuICAgIH1cbiAgICByZXR1cm4gY29tcGlsZWQuY2FsbCh0aGlzLCBjb250ZXh0LCBvcHRpb25zKTtcbiAgfTtcbn1cblxuZXhwb3J0cy5jb21waWxlID0gY29tcGlsZTsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBDT01QSUxFUl9SRVZJU0lPTiA9IHJlcXVpcmUoXCIuLi9iYXNlXCIpLkNPTVBJTEVSX1JFVklTSU9OO1xudmFyIFJFVklTSU9OX0NIQU5HRVMgPSByZXF1aXJlKFwiLi4vYmFzZVwiKS5SRVZJU0lPTl9DSEFOR0VTO1xudmFyIGxvZyA9IHJlcXVpcmUoXCIuLi9iYXNlXCIpLmxvZztcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcblxuZnVuY3Rpb24gTGl0ZXJhbCh2YWx1ZSkge1xuICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIEphdmFTY3JpcHRDb21waWxlcigpIHt9XG5cbkphdmFTY3JpcHRDb21waWxlci5wcm90b3R5cGUgPSB7XG4gIC8vIFBVQkxJQyBBUEk6IFlvdSBjYW4gb3ZlcnJpZGUgdGhlc2UgbWV0aG9kcyBpbiBhIHN1YmNsYXNzIHRvIHByb3ZpZGVcbiAgLy8gYWx0ZXJuYXRpdmUgY29tcGlsZWQgZm9ybXMgZm9yIG5hbWUgbG9va3VwIGFuZCBidWZmZXJpbmcgc2VtYW50aWNzXG4gIG5hbWVMb29rdXA6IGZ1bmN0aW9uKHBhcmVudCwgbmFtZSAvKiAsIHR5cGUqLykge1xuICAgIHZhciB3cmFwLFxuICAgICAgICByZXQ7XG4gICAgaWYgKHBhcmVudC5pbmRleE9mKCdkZXB0aCcpID09PSAwKSB7XG4gICAgICB3cmFwID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoL15bMC05XSskLy50ZXN0KG5hbWUpKSB7XG4gICAgICByZXQgPSBwYXJlbnQgKyBcIltcIiArIG5hbWUgKyBcIl1cIjtcbiAgICB9IGVsc2UgaWYgKEphdmFTY3JpcHRDb21waWxlci5pc1ZhbGlkSmF2YVNjcmlwdFZhcmlhYmxlTmFtZShuYW1lKSkge1xuICAgICAgcmV0ID0gcGFyZW50ICsgXCIuXCIgKyBuYW1lO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldCA9IHBhcmVudCArIFwiWydcIiArIG5hbWUgKyBcIiddXCI7XG4gICAgfVxuXG4gICAgaWYgKHdyYXApIHtcbiAgICAgIHJldHVybiAnKCcgKyBwYXJlbnQgKyAnICYmICcgKyByZXQgKyAnKSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXQ7XG4gICAgfVxuICB9LFxuXG4gIGNvbXBpbGVySW5mbzogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJldmlzaW9uID0gQ09NUElMRVJfUkVWSVNJT04sXG4gICAgICAgIHZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tyZXZpc2lvbl07XG4gICAgcmV0dXJuIFwidGhpcy5jb21waWxlckluZm8gPSBbXCIrcmV2aXNpb24rXCIsJ1wiK3ZlcnNpb25zK1wiJ107XFxuXCI7XG4gIH0sXG5cbiAgYXBwZW5kVG9CdWZmZXI6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIGlmICh0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICByZXR1cm4gXCJyZXR1cm4gXCIgKyBzdHJpbmcgKyBcIjtcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYXBwZW5kVG9CdWZmZXI6IHRydWUsXG4gICAgICAgIGNvbnRlbnQ6IHN0cmluZyxcbiAgICAgICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJidWZmZXIgKz0gXCIgKyBzdHJpbmcgKyBcIjtcIjsgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cbiAgaW5pdGlhbGl6ZUJ1ZmZlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMucXVvdGVkU3RyaW5nKFwiXCIpO1xuICB9LFxuXG4gIG5hbWVzcGFjZTogXCJIYW5kbGViYXJzXCIsXG4gIC8vIEVORCBQVUJMSUMgQVBJXG5cbiAgY29tcGlsZTogZnVuY3Rpb24oZW52aXJvbm1lbnQsIG9wdGlvbnMsIGNvbnRleHQsIGFzT2JqZWN0KSB7XG4gICAgdGhpcy5lbnZpcm9ubWVudCA9IGVudmlyb25tZW50O1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICBsb2coJ2RlYnVnJywgdGhpcy5lbnZpcm9ubWVudC5kaXNhc3NlbWJsZSgpICsgXCJcXG5cXG5cIik7XG5cbiAgICB0aGlzLm5hbWUgPSB0aGlzLmVudmlyb25tZW50Lm5hbWU7XG4gICAgdGhpcy5pc0NoaWxkID0gISFjb250ZXh0O1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQgfHwge1xuICAgICAgcHJvZ3JhbXM6IFtdLFxuICAgICAgZW52aXJvbm1lbnRzOiBbXSxcbiAgICAgIGFsaWFzZXM6IHsgfVxuICAgIH07XG5cbiAgICB0aGlzLnByZWFtYmxlKCk7XG5cbiAgICB0aGlzLnN0YWNrU2xvdCA9IDA7XG4gICAgdGhpcy5zdGFja1ZhcnMgPSBbXTtcbiAgICB0aGlzLnJlZ2lzdGVycyA9IHsgbGlzdDogW10gfTtcbiAgICB0aGlzLmhhc2hlcyA9IFtdO1xuICAgIHRoaXMuY29tcGlsZVN0YWNrID0gW107XG4gICAgdGhpcy5pbmxpbmVTdGFjayA9IFtdO1xuXG4gICAgdGhpcy5jb21waWxlQ2hpbGRyZW4oZW52aXJvbm1lbnQsIG9wdGlvbnMpO1xuXG4gICAgdmFyIG9wY29kZXMgPSBlbnZpcm9ubWVudC5vcGNvZGVzLCBvcGNvZGU7XG5cbiAgICB0aGlzLmkgPSAwO1xuXG4gICAgZm9yKHZhciBsPW9wY29kZXMubGVuZ3RoOyB0aGlzLmk8bDsgdGhpcy5pKyspIHtcbiAgICAgIG9wY29kZSA9IG9wY29kZXNbdGhpcy5pXTtcblxuICAgICAgaWYob3Bjb2RlLm9wY29kZSA9PT0gJ0RFQ0xBUkUnKSB7XG4gICAgICAgIHRoaXNbb3Bjb2RlLm5hbWVdID0gb3Bjb2RlLnZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpc1tvcGNvZGUub3Bjb2RlXS5hcHBseSh0aGlzLCBvcGNvZGUuYXJncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc2V0IHRoZSBzdHJpcE5leHQgZmxhZyBpZiBpdCB3YXMgbm90IHNldCBieSB0aGlzIG9wZXJhdGlvbi5cbiAgICAgIGlmIChvcGNvZGUub3Bjb2RlICE9PSB0aGlzLnN0cmlwTmV4dCkge1xuICAgICAgICB0aGlzLnN0cmlwTmV4dCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZsdXNoIGFueSB0cmFpbGluZyBjb250ZW50IHRoYXQgbWlnaHQgYmUgcGVuZGluZy5cbiAgICB0aGlzLnB1c2hTb3VyY2UoJycpO1xuXG4gICAgaWYgKHRoaXMuc3RhY2tTbG90IHx8IHRoaXMuaW5saW5lU3RhY2subGVuZ3RoIHx8IHRoaXMuY29tcGlsZVN0YWNrLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignQ29tcGlsZSBjb21wbGV0ZWQgd2l0aCBjb250ZW50IGxlZnQgb24gc3RhY2snKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jcmVhdGVGdW5jdGlvbkNvbnRleHQoYXNPYmplY3QpO1xuICB9LFxuXG4gIHByZWFtYmxlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3V0ID0gW107XG5cbiAgICBpZiAoIXRoaXMuaXNDaGlsZCkge1xuICAgICAgdmFyIG5hbWVzcGFjZSA9IHRoaXMubmFtZXNwYWNlO1xuXG4gICAgICB2YXIgY29waWVzID0gXCJoZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBcIiArIG5hbWVzcGFjZSArIFwiLmhlbHBlcnMpO1wiO1xuICAgICAgaWYgKHRoaXMuZW52aXJvbm1lbnQudXNlUGFydGlhbCkgeyBjb3BpZXMgPSBjb3BpZXMgKyBcIiBwYXJ0aWFscyA9IHRoaXMubWVyZ2UocGFydGlhbHMsIFwiICsgbmFtZXNwYWNlICsgXCIucGFydGlhbHMpO1wiOyB9XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmRhdGEpIHsgY29waWVzID0gY29waWVzICsgXCIgZGF0YSA9IGRhdGEgfHwge307XCI7IH1cbiAgICAgIG91dC5wdXNoKGNvcGllcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dC5wdXNoKCcnKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuZW52aXJvbm1lbnQuaXNTaW1wbGUpIHtcbiAgICAgIG91dC5wdXNoKFwiLCBidWZmZXIgPSBcIiArIHRoaXMuaW5pdGlhbGl6ZUJ1ZmZlcigpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0LnB1c2goXCJcIik7XG4gICAgfVxuXG4gICAgLy8gdHJhY2sgdGhlIGxhc3QgY29udGV4dCBwdXNoZWQgaW50byBwbGFjZSB0byBhbGxvdyBza2lwcGluZyB0aGVcbiAgICAvLyBnZXRDb250ZXh0IG9wY29kZSB3aGVuIGl0IHdvdWxkIGJlIGEgbm9vcFxuICAgIHRoaXMubGFzdENvbnRleHQgPSAwO1xuICAgIHRoaXMuc291cmNlID0gb3V0O1xuICB9LFxuXG4gIGNyZWF0ZUZ1bmN0aW9uQ29udGV4dDogZnVuY3Rpb24oYXNPYmplY3QpIHtcbiAgICB2YXIgbG9jYWxzID0gdGhpcy5zdGFja1ZhcnMuY29uY2F0KHRoaXMucmVnaXN0ZXJzLmxpc3QpO1xuXG4gICAgaWYobG9jYWxzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuc291cmNlWzFdID0gdGhpcy5zb3VyY2VbMV0gKyBcIiwgXCIgKyBsb2NhbHMuam9pbihcIiwgXCIpO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIG1pbmltaXplciBhbGlhcyBtYXBwaW5nc1xuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICBmb3IgKHZhciBhbGlhcyBpbiB0aGlzLmNvbnRleHQuYWxpYXNlcykge1xuICAgICAgICBpZiAodGhpcy5jb250ZXh0LmFsaWFzZXMuaGFzT3duUHJvcGVydHkoYWxpYXMpKSB7XG4gICAgICAgICAgdGhpcy5zb3VyY2VbMV0gPSB0aGlzLnNvdXJjZVsxXSArICcsICcgKyBhbGlhcyArICc9JyArIHRoaXMuY29udGV4dC5hbGlhc2VzW2FsaWFzXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLnNvdXJjZVsxXSkge1xuICAgICAgdGhpcy5zb3VyY2VbMV0gPSBcInZhciBcIiArIHRoaXMuc291cmNlWzFdLnN1YnN0cmluZygyKSArIFwiO1wiO1xuICAgIH1cblxuICAgIC8vIE1lcmdlIGNoaWxkcmVuXG4gICAgaWYgKCF0aGlzLmlzQ2hpbGQpIHtcbiAgICAgIHRoaXMuc291cmNlWzFdICs9ICdcXG4nICsgdGhpcy5jb250ZXh0LnByb2dyYW1zLmpvaW4oJ1xcbicpICsgJ1xcbic7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICB0aGlzLnB1c2hTb3VyY2UoXCJyZXR1cm4gYnVmZmVyO1wiKTtcbiAgICB9XG5cbiAgICB2YXIgcGFyYW1zID0gdGhpcy5pc0NoaWxkID8gW1wiZGVwdGgwXCIsIFwiZGF0YVwiXSA6IFtcIkhhbmRsZWJhcnNcIiwgXCJkZXB0aDBcIiwgXCJoZWxwZXJzXCIsIFwicGFydGlhbHNcIiwgXCJkYXRhXCJdO1xuXG4gICAgZm9yKHZhciBpPTAsIGw9dGhpcy5lbnZpcm9ubWVudC5kZXB0aHMubGlzdC5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBwYXJhbXMucHVzaChcImRlcHRoXCIgKyB0aGlzLmVudmlyb25tZW50LmRlcHRocy5saXN0W2ldKTtcbiAgICB9XG5cbiAgICAvLyBQZXJmb3JtIGEgc2Vjb25kIHBhc3Mgb3ZlciB0aGUgb3V0cHV0IHRvIG1lcmdlIGNvbnRlbnQgd2hlbiBwb3NzaWJsZVxuICAgIHZhciBzb3VyY2UgPSB0aGlzLm1lcmdlU291cmNlKCk7XG5cbiAgICBpZiAoIXRoaXMuaXNDaGlsZCkge1xuICAgICAgc291cmNlID0gdGhpcy5jb21waWxlckluZm8oKStzb3VyY2U7XG4gICAgfVxuXG4gICAgaWYgKGFzT2JqZWN0KSB7XG4gICAgICBwYXJhbXMucHVzaChzb3VyY2UpO1xuXG4gICAgICByZXR1cm4gRnVuY3Rpb24uYXBwbHkodGhpcywgcGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGZ1bmN0aW9uU291cmNlID0gJ2Z1bmN0aW9uICcgKyAodGhpcy5uYW1lIHx8ICcnKSArICcoJyArIHBhcmFtcy5qb2luKCcsJykgKyAnKSB7XFxuICAnICsgc291cmNlICsgJ30nO1xuICAgICAgbG9nKCdkZWJ1ZycsIGZ1bmN0aW9uU291cmNlICsgXCJcXG5cXG5cIik7XG4gICAgICByZXR1cm4gZnVuY3Rpb25Tb3VyY2U7XG4gICAgfVxuICB9LFxuICBtZXJnZVNvdXJjZTogZnVuY3Rpb24oKSB7XG4gICAgLy8gV0FSTjogV2UgYXJlIG5vdCBoYW5kbGluZyB0aGUgY2FzZSB3aGVyZSBidWZmZXIgaXMgc3RpbGwgcG9wdWxhdGVkIGFzIHRoZSBzb3VyY2Ugc2hvdWxkXG4gICAgLy8gbm90IGhhdmUgYnVmZmVyIGFwcGVuZCBvcGVyYXRpb25zIGFzIHRoZWlyIGZpbmFsIGFjdGlvbi5cbiAgICB2YXIgc291cmNlID0gJycsXG4gICAgICAgIGJ1ZmZlcjtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5zb3VyY2UubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBsaW5lID0gdGhpcy5zb3VyY2VbaV07XG4gICAgICBpZiAobGluZS5hcHBlbmRUb0J1ZmZlcikge1xuICAgICAgICBpZiAoYnVmZmVyKSB7XG4gICAgICAgICAgYnVmZmVyID0gYnVmZmVyICsgJ1xcbiAgICArICcgKyBsaW5lLmNvbnRlbnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYnVmZmVyID0gbGluZS5jb250ZW50O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYnVmZmVyKSB7XG4gICAgICAgICAgc291cmNlICs9ICdidWZmZXIgKz0gJyArIGJ1ZmZlciArICc7XFxuICAnO1xuICAgICAgICAgIGJ1ZmZlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2UgKz0gbGluZSArICdcXG4gICc7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzb3VyY2U7XG4gIH0sXG5cbiAgLy8gW2Jsb2NrVmFsdWVdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHZhbHVlXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmV0dXJuIHZhbHVlIG9mIGJsb2NrSGVscGVyTWlzc2luZ1xuICAvL1xuICAvLyBUaGUgcHVycG9zZSBvZiB0aGlzIG9wY29kZSBpcyB0byB0YWtlIGEgYmxvY2sgb2YgdGhlIGZvcm1cbiAgLy8gYHt7I2Zvb319Li4ue3svZm9vfX1gLCByZXNvbHZlIHRoZSB2YWx1ZSBvZiBgZm9vYCwgYW5kXG4gIC8vIHJlcGxhY2UgaXQgb24gdGhlIHN0YWNrIHdpdGggdGhlIHJlc3VsdCBvZiBwcm9wZXJseVxuICAvLyBpbnZva2luZyBibG9ja0hlbHBlck1pc3NpbmcuXG4gIGJsb2NrVmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLmJsb2NrSGVscGVyTWlzc2luZyA9ICdoZWxwZXJzLmJsb2NrSGVscGVyTWlzc2luZyc7XG5cbiAgICB2YXIgcGFyYW1zID0gW1wiZGVwdGgwXCJdO1xuICAgIHRoaXMuc2V0dXBQYXJhbXMoMCwgcGFyYW1zKTtcblxuICAgIHRoaXMucmVwbGFjZVN0YWNrKGZ1bmN0aW9uKGN1cnJlbnQpIHtcbiAgICAgIHBhcmFtcy5zcGxpY2UoMSwgMCwgY3VycmVudCk7XG4gICAgICByZXR1cm4gXCJibG9ja0hlbHBlck1pc3NpbmcuY2FsbChcIiArIHBhcmFtcy5qb2luKFwiLCBcIikgKyBcIilcIjtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBbYW1iaWd1b3VzQmxvY2tWYWx1ZV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgdmFsdWVcbiAgLy8gQ29tcGlsZXIgdmFsdWUsIGJlZm9yZTogbGFzdEhlbHBlcj12YWx1ZSBvZiBsYXN0IGZvdW5kIGhlbHBlciwgaWYgYW55XG4gIC8vIE9uIHN0YWNrLCBhZnRlciwgaWYgbm8gbGFzdEhlbHBlcjogc2FtZSBhcyBbYmxvY2tWYWx1ZV1cbiAgLy8gT24gc3RhY2ssIGFmdGVyLCBpZiBsYXN0SGVscGVyOiB2YWx1ZVxuICBhbWJpZ3VvdXNCbG9ja1ZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5ibG9ja0hlbHBlck1pc3NpbmcgPSAnaGVscGVycy5ibG9ja0hlbHBlck1pc3NpbmcnO1xuXG4gICAgdmFyIHBhcmFtcyA9IFtcImRlcHRoMFwiXTtcbiAgICB0aGlzLnNldHVwUGFyYW1zKDAsIHBhcmFtcyk7XG5cbiAgICB2YXIgY3VycmVudCA9IHRoaXMudG9wU3RhY2soKTtcbiAgICBwYXJhbXMuc3BsaWNlKDEsIDAsIGN1cnJlbnQpO1xuXG4gICAgdGhpcy5wdXNoU291cmNlKFwiaWYgKCFcIiArIHRoaXMubGFzdEhlbHBlciArIFwiKSB7IFwiICsgY3VycmVudCArIFwiID0gYmxvY2tIZWxwZXJNaXNzaW5nLmNhbGwoXCIgKyBwYXJhbXMuam9pbihcIiwgXCIpICsgXCIpOyB9XCIpO1xuICB9LFxuXG4gIC8vIFthcHBlbmRDb250ZW50XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gQXBwZW5kcyB0aGUgc3RyaW5nIHZhbHVlIG9mIGBjb250ZW50YCB0byB0aGUgY3VycmVudCBidWZmZXJcbiAgYXBwZW5kQ29udGVudDogZnVuY3Rpb24oY29udGVudCkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb250ZW50KSB7XG4gICAgICBjb250ZW50ID0gdGhpcy5wZW5kaW5nQ29udGVudCArIGNvbnRlbnQ7XG4gICAgfVxuICAgIGlmICh0aGlzLnN0cmlwTmV4dCkge1xuICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvXlxccysvLCAnJyk7XG4gICAgfVxuXG4gICAgdGhpcy5wZW5kaW5nQ29udGVudCA9IGNvbnRlbnQ7XG4gIH0sXG5cbiAgLy8gW3N0cmlwXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gUmVtb3ZlcyBhbnkgdHJhaWxpbmcgd2hpdGVzcGFjZSBmcm9tIHRoZSBwcmlvciBjb250ZW50IG5vZGUgYW5kIGZsYWdzXG4gIC8vIHRoZSBuZXh0IG9wZXJhdGlvbiBmb3Igc3RyaXBwaW5nIGlmIGl0IGlzIGEgY29udGVudCBub2RlLlxuICBzdHJpcDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0NvbnRlbnQpIHtcbiAgICAgIHRoaXMucGVuZGluZ0NvbnRlbnQgPSB0aGlzLnBlbmRpbmdDb250ZW50LnJlcGxhY2UoL1xccyskLywgJycpO1xuICAgIH1cbiAgICB0aGlzLnN0cmlwTmV4dCA9ICdzdHJpcCc7XG4gIH0sXG5cbiAgLy8gW2FwcGVuZF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvL1xuICAvLyBDb2VyY2VzIGB2YWx1ZWAgdG8gYSBTdHJpbmcgYW5kIGFwcGVuZHMgaXQgdG8gdGhlIGN1cnJlbnQgYnVmZmVyLlxuICAvL1xuICAvLyBJZiBgdmFsdWVgIGlzIHRydXRoeSwgb3IgMCwgaXQgaXMgY29lcmNlZCBpbnRvIGEgc3RyaW5nIGFuZCBhcHBlbmRlZFxuICAvLyBPdGhlcndpc2UsIHRoZSBlbXB0eSBzdHJpbmcgaXMgYXBwZW5kZWRcbiAgYXBwZW5kOiBmdW5jdGlvbigpIHtcbiAgICAvLyBGb3JjZSBhbnl0aGluZyB0aGF0IGlzIGlubGluZWQgb250byB0aGUgc3RhY2sgc28gd2UgZG9uJ3QgaGF2ZSBkdXBsaWNhdGlvblxuICAgIC8vIHdoZW4gd2UgZXhhbWluZSBsb2NhbFxuICAgIHRoaXMuZmx1c2hJbmxpbmUoKTtcbiAgICB2YXIgbG9jYWwgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgdGhpcy5wdXNoU291cmNlKFwiaWYoXCIgKyBsb2NhbCArIFwiIHx8IFwiICsgbG9jYWwgKyBcIiA9PT0gMCkgeyBcIiArIHRoaXMuYXBwZW5kVG9CdWZmZXIobG9jYWwpICsgXCIgfVwiKTtcbiAgICBpZiAodGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgICAgdGhpcy5wdXNoU291cmNlKFwiZWxzZSB7IFwiICsgdGhpcy5hcHBlbmRUb0J1ZmZlcihcIicnXCIpICsgXCIgfVwiKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gW2FwcGVuZEVzY2FwZWRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gRXNjYXBlIGB2YWx1ZWAgYW5kIGFwcGVuZCBpdCB0byB0aGUgYnVmZmVyXG4gIGFwcGVuZEVzY2FwZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLmVzY2FwZUV4cHJlc3Npb24gPSAndGhpcy5lc2NhcGVFeHByZXNzaW9uJztcblxuICAgIHRoaXMucHVzaFNvdXJjZSh0aGlzLmFwcGVuZFRvQnVmZmVyKFwiZXNjYXBlRXhwcmVzc2lvbihcIiArIHRoaXMucG9wU3RhY2soKSArIFwiKVwiKSk7XG4gIH0sXG5cbiAgLy8gW2dldENvbnRleHRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvLyBDb21waWxlciB2YWx1ZSwgYWZ0ZXI6IGxhc3RDb250ZXh0PWRlcHRoXG4gIC8vXG4gIC8vIFNldCB0aGUgdmFsdWUgb2YgdGhlIGBsYXN0Q29udGV4dGAgY29tcGlsZXIgdmFsdWUgdG8gdGhlIGRlcHRoXG4gIGdldENvbnRleHQ6IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgaWYodGhpcy5sYXN0Q29udGV4dCAhPT0gZGVwdGgpIHtcbiAgICAgIHRoaXMubGFzdENvbnRleHQgPSBkZXB0aDtcbiAgICB9XG4gIH0sXG5cbiAgLy8gW2xvb2t1cE9uQ29udGV4dF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogY3VycmVudENvbnRleHRbbmFtZV0sIC4uLlxuICAvL1xuICAvLyBMb29rcyB1cCB0aGUgdmFsdWUgb2YgYG5hbWVgIG9uIHRoZSBjdXJyZW50IGNvbnRleHQgYW5kIHB1c2hlc1xuICAvLyBpdCBvbnRvIHRoZSBzdGFjay5cbiAgbG9va3VwT25Db250ZXh0OiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdGhpcy5wdXNoKHRoaXMubmFtZUxvb2t1cCgnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dCwgbmFtZSwgJ2NvbnRleHQnKSk7XG4gIH0sXG5cbiAgLy8gW3B1c2hDb250ZXh0XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBjdXJyZW50Q29udGV4dCwgLi4uXG4gIC8vXG4gIC8vIFB1c2hlcyB0aGUgdmFsdWUgb2YgdGhlIGN1cnJlbnQgY29udGV4dCBvbnRvIHRoZSBzdGFjay5cbiAgcHVzaENvbnRleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dCk7XG4gIH0sXG5cbiAgLy8gW3Jlc29sdmVQb3NzaWJsZUxhbWJkYV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc29sdmVkIHZhbHVlLCAuLi5cbiAgLy9cbiAgLy8gSWYgdGhlIGB2YWx1ZWAgaXMgYSBsYW1iZGEsIHJlcGxhY2UgaXQgb24gdGhlIHN0YWNrIGJ5XG4gIC8vIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGxhbWJkYVxuICByZXNvbHZlUG9zc2libGVMYW1iZGE6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLmZ1bmN0aW9uVHlwZSA9ICdcImZ1bmN0aW9uXCInO1xuXG4gICAgdGhpcy5yZXBsYWNlU3RhY2soZnVuY3Rpb24oY3VycmVudCkge1xuICAgICAgcmV0dXJuIFwidHlwZW9mIFwiICsgY3VycmVudCArIFwiID09PSBmdW5jdGlvblR5cGUgPyBcIiArIGN1cnJlbnQgKyBcIi5hcHBseShkZXB0aDApIDogXCIgKyBjdXJyZW50O1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFtsb29rdXBdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiB2YWx1ZVtuYW1lXSwgLi4uXG4gIC8vXG4gIC8vIFJlcGxhY2UgdGhlIHZhbHVlIG9uIHRoZSBzdGFjayB3aXRoIHRoZSByZXN1bHQgb2YgbG9va2luZ1xuICAvLyB1cCBgbmFtZWAgb24gYHZhbHVlYFxuICBsb29rdXA6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB0aGlzLnJlcGxhY2VTdGFjayhmdW5jdGlvbihjdXJyZW50KSB7XG4gICAgICByZXR1cm4gY3VycmVudCArIFwiID09IG51bGwgfHwgXCIgKyBjdXJyZW50ICsgXCIgPT09IGZhbHNlID8gXCIgKyBjdXJyZW50ICsgXCIgOiBcIiArIHRoaXMubmFtZUxvb2t1cChjdXJyZW50LCBuYW1lLCAnY29udGV4dCcpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFtsb29rdXBEYXRhXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBkYXRhLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCB0aGUgZGF0YSBsb29rdXAgb3BlcmF0b3JcbiAgbG9va3VwRGF0YTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCdkYXRhJyk7XG4gIH0sXG5cbiAgLy8gW3B1c2hTdHJpbmdQYXJhbV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogc3RyaW5nLCBjdXJyZW50Q29udGV4dCwgLi4uXG4gIC8vXG4gIC8vIFRoaXMgb3Bjb2RlIGlzIGRlc2lnbmVkIGZvciB1c2UgaW4gc3RyaW5nIG1vZGUsIHdoaWNoXG4gIC8vIHByb3ZpZGVzIHRoZSBzdHJpbmcgdmFsdWUgb2YgYSBwYXJhbWV0ZXIgYWxvbmcgd2l0aCBpdHNcbiAgLy8gZGVwdGggcmF0aGVyIHRoYW4gcmVzb2x2aW5nIGl0IGltbWVkaWF0ZWx5LlxuICBwdXNoU3RyaW5nUGFyYW06IGZ1bmN0aW9uKHN0cmluZywgdHlwZSkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dCk7XG5cbiAgICB0aGlzLnB1c2hTdHJpbmcodHlwZSk7XG5cbiAgICAvLyBJZiBpdCdzIGEgc3ViZXhwcmVzc2lvbiwgdGhlIHN0cmluZyByZXN1bHRcbiAgICAvLyB3aWxsIGJlIHB1c2hlZCBhZnRlciB0aGlzIG9wY29kZS5cbiAgICBpZiAodHlwZSAhPT0gJ3NleHByJykge1xuICAgICAgaWYgKHR5cGVvZiBzdHJpbmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMucHVzaFN0cmluZyhzdHJpbmcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHN0cmluZyk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGVtcHR5SGFzaDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCd7fScpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIHRoaXMucHVzaCgne30nKTsgLy8gaGFzaENvbnRleHRzXG4gICAgICB0aGlzLnB1c2goJ3t9Jyk7IC8vIGhhc2hUeXBlc1xuICAgIH1cbiAgfSxcbiAgcHVzaEhhc2g6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLmhhc2gpIHtcbiAgICAgIHRoaXMuaGFzaGVzLnB1c2godGhpcy5oYXNoKTtcbiAgICB9XG4gICAgdGhpcy5oYXNoID0ge3ZhbHVlczogW10sIHR5cGVzOiBbXSwgY29udGV4dHM6IFtdfTtcbiAgfSxcbiAgcG9wSGFzaDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGhhc2ggPSB0aGlzLmhhc2g7XG4gICAgdGhpcy5oYXNoID0gdGhpcy5oYXNoZXMucG9wKCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgdGhpcy5wdXNoKCd7JyArIGhhc2guY29udGV4dHMuam9pbignLCcpICsgJ30nKTtcbiAgICAgIHRoaXMucHVzaCgneycgKyBoYXNoLnR5cGVzLmpvaW4oJywnKSArICd9Jyk7XG4gICAgfVxuXG4gICAgdGhpcy5wdXNoKCd7XFxuICAgICcgKyBoYXNoLnZhbHVlcy5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgfScpO1xuICB9LFxuXG4gIC8vIFtwdXNoU3RyaW5nXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBxdW90ZWRTdHJpbmcoc3RyaW5nKSwgLi4uXG4gIC8vXG4gIC8vIFB1c2ggYSBxdW90ZWQgdmVyc2lvbiBvZiBgc3RyaW5nYCBvbnRvIHRoZSBzdGFja1xuICBwdXNoU3RyaW5nOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwodGhpcy5xdW90ZWRTdHJpbmcoc3RyaW5nKSk7XG4gIH0sXG5cbiAgLy8gW3B1c2hdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGV4cHIsIC4uLlxuICAvL1xuICAvLyBQdXNoIGFuIGV4cHJlc3Npb24gb250byB0aGUgc3RhY2tcbiAgcHVzaDogZnVuY3Rpb24oZXhwcikge1xuICAgIHRoaXMuaW5saW5lU3RhY2sucHVzaChleHByKTtcbiAgICByZXR1cm4gZXhwcjtcbiAgfSxcblxuICAvLyBbcHVzaExpdGVyYWxdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHZhbHVlLCAuLi5cbiAgLy9cbiAgLy8gUHVzaGVzIGEgdmFsdWUgb250byB0aGUgc3RhY2suIFRoaXMgb3BlcmF0aW9uIHByZXZlbnRzXG4gIC8vIHRoZSBjb21waWxlciBmcm9tIGNyZWF0aW5nIGEgdGVtcG9yYXJ5IHZhcmlhYmxlIHRvIGhvbGRcbiAgLy8gaXQuXG4gIHB1c2hMaXRlcmFsOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh2YWx1ZSk7XG4gIH0sXG5cbiAgLy8gW3B1c2hQcm9ncmFtXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBwcm9ncmFtKGd1aWQpLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCBhIHByb2dyYW0gZXhwcmVzc2lvbiBvbnRvIHRoZSBzdGFjay4gVGhpcyB0YWtlc1xuICAvLyBhIGNvbXBpbGUtdGltZSBndWlkIGFuZCBjb252ZXJ0cyBpdCBpbnRvIGEgcnVudGltZS1hY2Nlc3NpYmxlXG4gIC8vIGV4cHJlc3Npb24uXG4gIHB1c2hQcm9ncmFtOiBmdW5jdGlvbihndWlkKSB7XG4gICAgaWYgKGd1aWQgIT0gbnVsbCkge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHRoaXMucHJvZ3JhbUV4cHJlc3Npb24oZ3VpZCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwobnVsbCk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFtpbnZva2VIZWxwZXJdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHBhcmFtcy4uLiwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzdWx0IG9mIGhlbHBlciBpbnZvY2F0aW9uXG4gIC8vXG4gIC8vIFBvcHMgb2ZmIHRoZSBoZWxwZXIncyBwYXJhbWV0ZXJzLCBpbnZva2VzIHRoZSBoZWxwZXIsXG4gIC8vIGFuZCBwdXNoZXMgdGhlIGhlbHBlcidzIHJldHVybiB2YWx1ZSBvbnRvIHRoZSBzdGFjay5cbiAgLy9cbiAgLy8gSWYgdGhlIGhlbHBlciBpcyBub3QgZm91bmQsIGBoZWxwZXJNaXNzaW5nYCBpcyBjYWxsZWQuXG4gIGludm9rZUhlbHBlcjogZnVuY3Rpb24ocGFyYW1TaXplLCBuYW1lLCBpc1Jvb3QpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5oZWxwZXJNaXNzaW5nID0gJ2hlbHBlcnMuaGVscGVyTWlzc2luZyc7XG4gICAgdGhpcy51c2VSZWdpc3RlcignaGVscGVyJyk7XG5cbiAgICB2YXIgaGVscGVyID0gdGhpcy5sYXN0SGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcihwYXJhbVNpemUsIG5hbWUsIHRydWUpO1xuICAgIHZhciBub25IZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2RlcHRoJyArIHRoaXMubGFzdENvbnRleHQsIG5hbWUsICdjb250ZXh0Jyk7XG5cbiAgICB2YXIgbG9va3VwID0gJ2hlbHBlciA9ICcgKyBoZWxwZXIubmFtZSArICcgfHwgJyArIG5vbkhlbHBlcjtcbiAgICBpZiAoaGVscGVyLnBhcmFtc0luaXQpIHtcbiAgICAgIGxvb2t1cCArPSAnLCcgKyBoZWxwZXIucGFyYW1zSW5pdDtcbiAgICB9XG5cbiAgICB0aGlzLnB1c2goXG4gICAgICAnKCdcbiAgICAgICAgKyBsb29rdXBcbiAgICAgICAgKyAnLGhlbHBlciAnXG4gICAgICAgICAgKyAnPyBoZWxwZXIuY2FsbCgnICsgaGVscGVyLmNhbGxQYXJhbXMgKyAnKSAnXG4gICAgICAgICAgKyAnOiBoZWxwZXJNaXNzaW5nLmNhbGwoJyArIGhlbHBlci5oZWxwZXJNaXNzaW5nUGFyYW1zICsgJykpJyk7XG5cbiAgICAvLyBBbHdheXMgZmx1c2ggc3ViZXhwcmVzc2lvbnMuIFRoaXMgaXMgYm90aCB0byBwcmV2ZW50IHRoZSBjb21wb3VuZGluZyBzaXplIGlzc3VlIHRoYXRcbiAgICAvLyBvY2N1cnMgd2hlbiB0aGUgY29kZSBoYXMgdG8gYmUgZHVwbGljYXRlZCBmb3IgaW5saW5pbmcgYW5kIGFsc28gdG8gcHJldmVudCBlcnJvcnNcbiAgICAvLyBkdWUgdG8gdGhlIGluY29ycmVjdCBvcHRpb25zIG9iamVjdCBiZWluZyBwYXNzZWQgZHVlIHRvIHRoZSBzaGFyZWQgcmVnaXN0ZXIuXG4gICAgaWYgKCFpc1Jvb3QpIHtcbiAgICAgIHRoaXMuZmx1c2hJbmxpbmUoKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gW2ludm9rZUtub3duSGVscGVyXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCBwYXJhbXMuLi4sIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc3VsdCBvZiBoZWxwZXIgaW52b2NhdGlvblxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBpcyB1c2VkIHdoZW4gdGhlIGhlbHBlciBpcyBrbm93biB0byBleGlzdCxcbiAgLy8gc28gYSBgaGVscGVyTWlzc2luZ2AgZmFsbGJhY2sgaXMgbm90IHJlcXVpcmVkLlxuICBpbnZva2VLbm93bkhlbHBlcjogZnVuY3Rpb24ocGFyYW1TaXplLCBuYW1lKSB7XG4gICAgdmFyIGhlbHBlciA9IHRoaXMuc2V0dXBIZWxwZXIocGFyYW1TaXplLCBuYW1lKTtcbiAgICB0aGlzLnB1c2goaGVscGVyLm5hbWUgKyBcIi5jYWxsKFwiICsgaGVscGVyLmNhbGxQYXJhbXMgKyBcIilcIik7XG4gIH0sXG5cbiAgLy8gW2ludm9rZUFtYmlndW91c11cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgZGlzYW1iaWd1YXRpb25cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gaXMgdXNlZCB3aGVuIGFuIGV4cHJlc3Npb24gbGlrZSBge3tmb299fWBcbiAgLy8gaXMgcHJvdmlkZWQsIGJ1dCB3ZSBkb24ndCBrbm93IGF0IGNvbXBpbGUtdGltZSB3aGV0aGVyIGl0XG4gIC8vIGlzIGEgaGVscGVyIG9yIGEgcGF0aC5cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gZW1pdHMgbW9yZSBjb2RlIHRoYW4gdGhlIG90aGVyIG9wdGlvbnMsXG4gIC8vIGFuZCBjYW4gYmUgYXZvaWRlZCBieSBwYXNzaW5nIHRoZSBga25vd25IZWxwZXJzYCBhbmRcbiAgLy8gYGtub3duSGVscGVyc09ubHlgIGZsYWdzIGF0IGNvbXBpbGUtdGltZS5cbiAgaW52b2tlQW1iaWd1b3VzOiBmdW5jdGlvbihuYW1lLCBoZWxwZXJDYWxsKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuZnVuY3Rpb25UeXBlID0gJ1wiZnVuY3Rpb25cIic7XG4gICAgdGhpcy51c2VSZWdpc3RlcignaGVscGVyJyk7XG5cbiAgICB0aGlzLmVtcHR5SGFzaCgpO1xuICAgIHZhciBoZWxwZXIgPSB0aGlzLnNldHVwSGVscGVyKDAsIG5hbWUsIGhlbHBlckNhbGwpO1xuXG4gICAgdmFyIGhlbHBlck5hbWUgPSB0aGlzLmxhc3RIZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2hlbHBlcnMnLCBuYW1lLCAnaGVscGVyJyk7XG5cbiAgICB2YXIgbm9uSGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0LCBuYW1lLCAnY29udGV4dCcpO1xuICAgIHZhciBuZXh0U3RhY2sgPSB0aGlzLm5leHRTdGFjaygpO1xuXG4gICAgaWYgKGhlbHBlci5wYXJhbXNJbml0KSB7XG4gICAgICB0aGlzLnB1c2hTb3VyY2UoaGVscGVyLnBhcmFtc0luaXQpO1xuICAgIH1cbiAgICB0aGlzLnB1c2hTb3VyY2UoJ2lmIChoZWxwZXIgPSAnICsgaGVscGVyTmFtZSArICcpIHsgJyArIG5leHRTdGFjayArICcgPSBoZWxwZXIuY2FsbCgnICsgaGVscGVyLmNhbGxQYXJhbXMgKyAnKTsgfScpO1xuICAgIHRoaXMucHVzaFNvdXJjZSgnZWxzZSB7IGhlbHBlciA9ICcgKyBub25IZWxwZXIgKyAnOyAnICsgbmV4dFN0YWNrICsgJyA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKCcgKyBoZWxwZXIuY2FsbFBhcmFtcyArICcpIDogaGVscGVyOyB9Jyk7XG4gIH0sXG5cbiAgLy8gW2ludm9rZVBhcnRpYWxdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGNvbnRleHQsIC4uLlxuICAvLyBPbiBzdGFjayBhZnRlcjogcmVzdWx0IG9mIHBhcnRpYWwgaW52b2NhdGlvblxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBwb3BzIG9mZiBhIGNvbnRleHQsIGludm9rZXMgYSBwYXJ0aWFsIHdpdGggdGhhdCBjb250ZXh0LFxuICAvLyBhbmQgcHVzaGVzIHRoZSByZXN1bHQgb2YgdGhlIGludm9jYXRpb24gYmFjay5cbiAgaW52b2tlUGFydGlhbDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBwYXJhbXMgPSBbdGhpcy5uYW1lTG9va3VwKCdwYXJ0aWFscycsIG5hbWUsICdwYXJ0aWFsJyksIFwiJ1wiICsgbmFtZSArIFwiJ1wiLCB0aGlzLnBvcFN0YWNrKCksIFwiaGVscGVyc1wiLCBcInBhcnRpYWxzXCJdO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kYXRhKSB7XG4gICAgICBwYXJhbXMucHVzaChcImRhdGFcIik7XG4gICAgfVxuXG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuc2VsZiA9IFwidGhpc1wiO1xuICAgIHRoaXMucHVzaChcInNlbGYuaW52b2tlUGFydGlhbChcIiArIHBhcmFtcy5qb2luKFwiLCBcIikgKyBcIilcIik7XG4gIH0sXG5cbiAgLy8gW2Fzc2lnblRvSGFzaF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIGhhc2gsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGhhc2gsIC4uLlxuICAvL1xuICAvLyBQb3BzIGEgdmFsdWUgYW5kIGhhc2ggb2ZmIHRoZSBzdGFjaywgYXNzaWducyBgaGFzaFtrZXldID0gdmFsdWVgXG4gIC8vIGFuZCBwdXNoZXMgdGhlIGhhc2ggYmFjayBvbnRvIHRoZSBzdGFjay5cbiAgYXNzaWduVG9IYXNoOiBmdW5jdGlvbihrZXkpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLnBvcFN0YWNrKCksXG4gICAgICAgIGNvbnRleHQsXG4gICAgICAgIHR5cGU7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgdHlwZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIGNvbnRleHQgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuXG4gICAgdmFyIGhhc2ggPSB0aGlzLmhhc2g7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGhhc2guY29udGV4dHMucHVzaChcIidcIiArIGtleSArIFwiJzogXCIgKyBjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIGhhc2gudHlwZXMucHVzaChcIidcIiArIGtleSArIFwiJzogXCIgKyB0eXBlKTtcbiAgICB9XG4gICAgaGFzaC52YWx1ZXMucHVzaChcIidcIiArIGtleSArIFwiJzogKFwiICsgdmFsdWUgKyBcIilcIik7XG4gIH0sXG5cbiAgLy8gSEVMUEVSU1xuXG4gIGNvbXBpbGVyOiBKYXZhU2NyaXB0Q29tcGlsZXIsXG5cbiAgY29tcGlsZUNoaWxkcmVuOiBmdW5jdGlvbihlbnZpcm9ubWVudCwgb3B0aW9ucykge1xuICAgIHZhciBjaGlsZHJlbiA9IGVudmlyb25tZW50LmNoaWxkcmVuLCBjaGlsZCwgY29tcGlsZXI7XG5cbiAgICBmb3IodmFyIGk9MCwgbD1jaGlsZHJlbi5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBjaGlsZCA9IGNoaWxkcmVuW2ldO1xuICAgICAgY29tcGlsZXIgPSBuZXcgdGhpcy5jb21waWxlcigpO1xuXG4gICAgICB2YXIgaW5kZXggPSB0aGlzLm1hdGNoRXhpc3RpbmdQcm9ncmFtKGNoaWxkKTtcblxuICAgICAgaWYgKGluZGV4ID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zLnB1c2goJycpOyAgICAgLy8gUGxhY2Vob2xkZXIgdG8gcHJldmVudCBuYW1lIGNvbmZsaWN0cyBmb3IgbmVzdGVkIGNoaWxkcmVuXG4gICAgICAgIGluZGV4ID0gdGhpcy5jb250ZXh0LnByb2dyYW1zLmxlbmd0aDtcbiAgICAgICAgY2hpbGQuaW5kZXggPSBpbmRleDtcbiAgICAgICAgY2hpbGQubmFtZSA9ICdwcm9ncmFtJyArIGluZGV4O1xuICAgICAgICB0aGlzLmNvbnRleHQucHJvZ3JhbXNbaW5kZXhdID0gY29tcGlsZXIuY29tcGlsZShjaGlsZCwgb3B0aW9ucywgdGhpcy5jb250ZXh0KTtcbiAgICAgICAgdGhpcy5jb250ZXh0LmVudmlyb25tZW50c1tpbmRleF0gPSBjaGlsZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoaWxkLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIGNoaWxkLm5hbWUgPSAncHJvZ3JhbScgKyBpbmRleDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIG1hdGNoRXhpc3RpbmdQcm9ncmFtOiBmdW5jdGlvbihjaGlsZCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgZW52aXJvbm1lbnQgPSB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzW2ldO1xuICAgICAgaWYgKGVudmlyb25tZW50ICYmIGVudmlyb25tZW50LmVxdWFscyhjaGlsZCkpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHByb2dyYW1FeHByZXNzaW9uOiBmdW5jdGlvbihndWlkKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuc2VsZiA9IFwidGhpc1wiO1xuXG4gICAgaWYoZ3VpZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gXCJzZWxmLm5vb3BcIjtcbiAgICB9XG5cbiAgICB2YXIgY2hpbGQgPSB0aGlzLmVudmlyb25tZW50LmNoaWxkcmVuW2d1aWRdLFxuICAgICAgICBkZXB0aHMgPSBjaGlsZC5kZXB0aHMubGlzdCwgZGVwdGg7XG5cbiAgICB2YXIgcHJvZ3JhbVBhcmFtcyA9IFtjaGlsZC5pbmRleCwgY2hpbGQubmFtZSwgXCJkYXRhXCJdO1xuXG4gICAgZm9yKHZhciBpPTAsIGwgPSBkZXB0aHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgZGVwdGggPSBkZXB0aHNbaV07XG5cbiAgICAgIGlmKGRlcHRoID09PSAxKSB7IHByb2dyYW1QYXJhbXMucHVzaChcImRlcHRoMFwiKTsgfVxuICAgICAgZWxzZSB7IHByb2dyYW1QYXJhbXMucHVzaChcImRlcHRoXCIgKyAoZGVwdGggLSAxKSk7IH1cbiAgICB9XG5cbiAgICByZXR1cm4gKGRlcHRocy5sZW5ndGggPT09IDAgPyBcInNlbGYucHJvZ3JhbShcIiA6IFwic2VsZi5wcm9ncmFtV2l0aERlcHRoKFwiKSArIHByb2dyYW1QYXJhbXMuam9pbihcIiwgXCIpICsgXCIpXCI7XG4gIH0sXG5cbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uKG5hbWUsIHZhbCkge1xuICAgIHRoaXMudXNlUmVnaXN0ZXIobmFtZSk7XG4gICAgdGhpcy5wdXNoU291cmNlKG5hbWUgKyBcIiA9IFwiICsgdmFsICsgXCI7XCIpO1xuICB9LFxuXG4gIHVzZVJlZ2lzdGVyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYoIXRoaXMucmVnaXN0ZXJzW25hbWVdKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVyc1tuYW1lXSA9IHRydWU7XG4gICAgICB0aGlzLnJlZ2lzdGVycy5saXN0LnB1c2gobmFtZSk7XG4gICAgfVxuICB9LFxuXG4gIHB1c2hTdGFja0xpdGVyYWw6IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5wdXNoKG5ldyBMaXRlcmFsKGl0ZW0pKTtcbiAgfSxcblxuICBwdXNoU291cmNlOiBmdW5jdGlvbihzb3VyY2UpIHtcbiAgICBpZiAodGhpcy5wZW5kaW5nQ29udGVudCkge1xuICAgICAgdGhpcy5zb3VyY2UucHVzaCh0aGlzLmFwcGVuZFRvQnVmZmVyKHRoaXMucXVvdGVkU3RyaW5nKHRoaXMucGVuZGluZ0NvbnRlbnQpKSk7XG4gICAgICB0aGlzLnBlbmRpbmdDb250ZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmIChzb3VyY2UpIHtcbiAgICAgIHRoaXMuc291cmNlLnB1c2goc291cmNlKTtcbiAgICB9XG4gIH0sXG5cbiAgcHVzaFN0YWNrOiBmdW5jdGlvbihpdGVtKSB7XG4gICAgdGhpcy5mbHVzaElubGluZSgpO1xuXG4gICAgdmFyIHN0YWNrID0gdGhpcy5pbmNyU3RhY2soKTtcbiAgICBpZiAoaXRlbSkge1xuICAgICAgdGhpcy5wdXNoU291cmNlKHN0YWNrICsgXCIgPSBcIiArIGl0ZW0gKyBcIjtcIik7XG4gICAgfVxuICAgIHRoaXMuY29tcGlsZVN0YWNrLnB1c2goc3RhY2spO1xuICAgIHJldHVybiBzdGFjaztcbiAgfSxcblxuICByZXBsYWNlU3RhY2s6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHByZWZpeCA9ICcnLFxuICAgICAgICBpbmxpbmUgPSB0aGlzLmlzSW5saW5lKCksXG4gICAgICAgIHN0YWNrLFxuICAgICAgICBjcmVhdGVkU3RhY2ssXG4gICAgICAgIHVzZWRMaXRlcmFsO1xuXG4gICAgLy8gSWYgd2UgYXJlIGN1cnJlbnRseSBpbmxpbmUgdGhlbiB3ZSB3YW50IHRvIG1lcmdlIHRoZSBpbmxpbmUgc3RhdGVtZW50IGludG8gdGhlXG4gICAgLy8gcmVwbGFjZW1lbnQgc3RhdGVtZW50IHZpYSAnLCdcbiAgICBpZiAoaW5saW5lKSB7XG4gICAgICB2YXIgdG9wID0gdGhpcy5wb3BTdGFjayh0cnVlKTtcblxuICAgICAgaWYgKHRvcCBpbnN0YW5jZW9mIExpdGVyYWwpIHtcbiAgICAgICAgLy8gTGl0ZXJhbHMgZG8gbm90IG5lZWQgdG8gYmUgaW5saW5lZFxuICAgICAgICBzdGFjayA9IHRvcC52YWx1ZTtcbiAgICAgICAgdXNlZExpdGVyYWwgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gR2V0IG9yIGNyZWF0ZSB0aGUgY3VycmVudCBzdGFjayBuYW1lIGZvciB1c2UgYnkgdGhlIGlubGluZVxuICAgICAgICBjcmVhdGVkU3RhY2sgPSAhdGhpcy5zdGFja1Nsb3Q7XG4gICAgICAgIHZhciBuYW1lID0gIWNyZWF0ZWRTdGFjayA/IHRoaXMudG9wU3RhY2tOYW1lKCkgOiB0aGlzLmluY3JTdGFjaygpO1xuXG4gICAgICAgIHByZWZpeCA9ICcoJyArIHRoaXMucHVzaChuYW1lKSArICcgPSAnICsgdG9wICsgJyksJztcbiAgICAgICAgc3RhY2sgPSB0aGlzLnRvcFN0YWNrKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YWNrID0gdGhpcy50b3BTdGFjaygpO1xuICAgIH1cblxuICAgIHZhciBpdGVtID0gY2FsbGJhY2suY2FsbCh0aGlzLCBzdGFjayk7XG5cbiAgICBpZiAoaW5saW5lKSB7XG4gICAgICBpZiAoIXVzZWRMaXRlcmFsKSB7XG4gICAgICAgIHRoaXMucG9wU3RhY2soKTtcbiAgICAgIH1cbiAgICAgIGlmIChjcmVhdGVkU3RhY2spIHtcbiAgICAgICAgdGhpcy5zdGFja1Nsb3QtLTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHVzaCgnKCcgKyBwcmVmaXggKyBpdGVtICsgJyknKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUHJldmVudCBtb2RpZmljYXRpb24gb2YgdGhlIGNvbnRleHQgZGVwdGggdmFyaWFibGUuIFRocm91Z2ggcmVwbGFjZVN0YWNrXG4gICAgICBpZiAoIS9ec3RhY2svLnRlc3Qoc3RhY2spKSB7XG4gICAgICAgIHN0YWNrID0gdGhpcy5uZXh0U3RhY2soKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5wdXNoU291cmNlKHN0YWNrICsgXCIgPSAoXCIgKyBwcmVmaXggKyBpdGVtICsgXCIpO1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YWNrO1xuICB9LFxuXG4gIG5leHRTdGFjazogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMucHVzaFN0YWNrKCk7XG4gIH0sXG5cbiAgaW5jclN0YWNrOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnN0YWNrU2xvdCsrO1xuICAgIGlmKHRoaXMuc3RhY2tTbG90ID4gdGhpcy5zdGFja1ZhcnMubGVuZ3RoKSB7IHRoaXMuc3RhY2tWYXJzLnB1c2goXCJzdGFja1wiICsgdGhpcy5zdGFja1Nsb3QpOyB9XG4gICAgcmV0dXJuIHRoaXMudG9wU3RhY2tOYW1lKCk7XG4gIH0sXG4gIHRvcFN0YWNrTmFtZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIFwic3RhY2tcIiArIHRoaXMuc3RhY2tTbG90O1xuICB9LFxuICBmbHVzaElubGluZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGlubGluZVN0YWNrID0gdGhpcy5pbmxpbmVTdGFjaztcbiAgICBpZiAoaW5saW5lU3RhY2subGVuZ3RoKSB7XG4gICAgICB0aGlzLmlubGluZVN0YWNrID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gaW5saW5lU3RhY2subGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gaW5saW5lU3RhY2tbaV07XG4gICAgICAgIGlmIChlbnRyeSBpbnN0YW5jZW9mIExpdGVyYWwpIHtcbiAgICAgICAgICB0aGlzLmNvbXBpbGVTdGFjay5wdXNoKGVudHJ5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnB1c2hTdGFjayhlbnRyeSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGlzSW5saW5lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5pbmxpbmVTdGFjay5sZW5ndGg7XG4gIH0sXG5cbiAgcG9wU3RhY2s6IGZ1bmN0aW9uKHdyYXBwZWQpIHtcbiAgICB2YXIgaW5saW5lID0gdGhpcy5pc0lubGluZSgpLFxuICAgICAgICBpdGVtID0gKGlubGluZSA/IHRoaXMuaW5saW5lU3RhY2sgOiB0aGlzLmNvbXBpbGVTdGFjaykucG9wKCk7XG5cbiAgICBpZiAoIXdyYXBwZWQgJiYgKGl0ZW0gaW5zdGFuY2VvZiBMaXRlcmFsKSkge1xuICAgICAgcmV0dXJuIGl0ZW0udmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghaW5saW5lKSB7XG4gICAgICAgIGlmICghdGhpcy5zdGFja1Nsb3QpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdJbnZhbGlkIHN0YWNrIHBvcCcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhY2tTbG90LS07XG4gICAgICB9XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9XG4gIH0sXG5cbiAgdG9wU3RhY2s6IGZ1bmN0aW9uKHdyYXBwZWQpIHtcbiAgICB2YXIgc3RhY2sgPSAodGhpcy5pc0lubGluZSgpID8gdGhpcy5pbmxpbmVTdGFjayA6IHRoaXMuY29tcGlsZVN0YWNrKSxcbiAgICAgICAgaXRlbSA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xuXG4gICAgaWYgKCF3cmFwcGVkICYmIChpdGVtIGluc3RhbmNlb2YgTGl0ZXJhbCkpIHtcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9XG4gIH0sXG5cbiAgcXVvdGVkU3RyaW5nOiBmdW5jdGlvbihzdHIpIHtcbiAgICByZXR1cm4gJ1wiJyArIHN0clxuICAgICAgLnJlcGxhY2UoL1xcXFwvZywgJ1xcXFxcXFxcJylcbiAgICAgIC5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJylcbiAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcbiAgICAgIC5yZXBsYWNlKC9cXHIvZywgJ1xcXFxyJylcbiAgICAgIC5yZXBsYWNlKC9cXHUyMDI4L2csICdcXFxcdTIwMjgnKSAgIC8vIFBlciBFY21hLTI2MiA3LjMgKyA3LjguNFxuICAgICAgLnJlcGxhY2UoL1xcdTIwMjkvZywgJ1xcXFx1MjAyOScpICsgJ1wiJztcbiAgfSxcblxuICBzZXR1cEhlbHBlcjogZnVuY3Rpb24ocGFyYW1TaXplLCBuYW1lLCBtaXNzaW5nUGFyYW1zKSB7XG4gICAgdmFyIHBhcmFtcyA9IFtdLFxuICAgICAgICBwYXJhbXNJbml0ID0gdGhpcy5zZXR1cFBhcmFtcyhwYXJhbVNpemUsIHBhcmFtcywgbWlzc2luZ1BhcmFtcyk7XG4gICAgdmFyIGZvdW5kSGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdoZWxwZXJzJywgbmFtZSwgJ2hlbHBlcicpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgcGFyYW1zSW5pdDogcGFyYW1zSW5pdCxcbiAgICAgIG5hbWU6IGZvdW5kSGVscGVyLFxuICAgICAgY2FsbFBhcmFtczogW1wiZGVwdGgwXCJdLmNvbmNhdChwYXJhbXMpLmpvaW4oXCIsIFwiKSxcbiAgICAgIGhlbHBlck1pc3NpbmdQYXJhbXM6IG1pc3NpbmdQYXJhbXMgJiYgW1wiZGVwdGgwXCIsIHRoaXMucXVvdGVkU3RyaW5nKG5hbWUpXS5jb25jYXQocGFyYW1zKS5qb2luKFwiLCBcIilcbiAgICB9O1xuICB9LFxuXG4gIHNldHVwT3B0aW9uczogZnVuY3Rpb24ocGFyYW1TaXplLCBwYXJhbXMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IFtdLCBjb250ZXh0cyA9IFtdLCB0eXBlcyA9IFtdLCBwYXJhbSwgaW52ZXJzZSwgcHJvZ3JhbTtcblxuICAgIG9wdGlvbnMucHVzaChcImhhc2g6XCIgKyB0aGlzLnBvcFN0YWNrKCkpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIG9wdGlvbnMucHVzaChcImhhc2hUeXBlczpcIiArIHRoaXMucG9wU3RhY2soKSk7XG4gICAgICBvcHRpb25zLnB1c2goXCJoYXNoQ29udGV4dHM6XCIgKyB0aGlzLnBvcFN0YWNrKCkpO1xuICAgIH1cblxuICAgIGludmVyc2UgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgcHJvZ3JhbSA9IHRoaXMucG9wU3RhY2soKTtcblxuICAgIC8vIEF2b2lkIHNldHRpbmcgZm4gYW5kIGludmVyc2UgaWYgbmVpdGhlciBhcmUgc2V0LiBUaGlzIGFsbG93c1xuICAgIC8vIGhlbHBlcnMgdG8gZG8gYSBjaGVjayBmb3IgYGlmIChvcHRpb25zLmZuKWBcbiAgICBpZiAocHJvZ3JhbSB8fCBpbnZlcnNlKSB7XG4gICAgICBpZiAoIXByb2dyYW0pIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuc2VsZiA9IFwidGhpc1wiO1xuICAgICAgICBwcm9ncmFtID0gXCJzZWxmLm5vb3BcIjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFpbnZlcnNlKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLnNlbGYgPSBcInRoaXNcIjtcbiAgICAgICAgaW52ZXJzZSA9IFwic2VsZi5ub29wXCI7XG4gICAgICB9XG5cbiAgICAgIG9wdGlvbnMucHVzaChcImludmVyc2U6XCIgKyBpbnZlcnNlKTtcbiAgICAgIG9wdGlvbnMucHVzaChcImZuOlwiICsgcHJvZ3JhbSk7XG4gICAgfVxuXG4gICAgZm9yKHZhciBpPTA7IGk8cGFyYW1TaXplOyBpKyspIHtcbiAgICAgIHBhcmFtID0gdGhpcy5wb3BTdGFjaygpO1xuICAgICAgcGFyYW1zLnB1c2gocGFyYW0pO1xuXG4gICAgICBpZih0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICAgIHR5cGVzLnB1c2godGhpcy5wb3BTdGFjaygpKTtcbiAgICAgICAgY29udGV4dHMucHVzaCh0aGlzLnBvcFN0YWNrKCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICBvcHRpb25zLnB1c2goXCJjb250ZXh0czpbXCIgKyBjb250ZXh0cy5qb2luKFwiLFwiKSArIFwiXVwiKTtcbiAgICAgIG9wdGlvbnMucHVzaChcInR5cGVzOltcIiArIHR5cGVzLmpvaW4oXCIsXCIpICsgXCJdXCIpO1xuICAgIH1cblxuICAgIGlmKHRoaXMub3B0aW9ucy5kYXRhKSB7XG4gICAgICBvcHRpb25zLnB1c2goXCJkYXRhOmRhdGFcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH0sXG5cbiAgLy8gdGhlIHBhcmFtcyBhbmQgY29udGV4dHMgYXJndW1lbnRzIGFyZSBwYXNzZWQgaW4gYXJyYXlzXG4gIC8vIHRvIGZpbGwgaW5cbiAgc2V0dXBQYXJhbXM6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgcGFyYW1zLCB1c2VSZWdpc3Rlcikge1xuICAgIHZhciBvcHRpb25zID0gJ3snICsgdGhpcy5zZXR1cE9wdGlvbnMocGFyYW1TaXplLCBwYXJhbXMpLmpvaW4oJywnKSArICd9JztcblxuICAgIGlmICh1c2VSZWdpc3Rlcikge1xuICAgICAgdGhpcy51c2VSZWdpc3Rlcignb3B0aW9ucycpO1xuICAgICAgcGFyYW1zLnB1c2goJ29wdGlvbnMnKTtcbiAgICAgIHJldHVybiAnb3B0aW9ucz0nICsgb3B0aW9ucztcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1zLnB1c2gob3B0aW9ucyk7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICB9XG59O1xuXG52YXIgcmVzZXJ2ZWRXb3JkcyA9IChcbiAgXCJicmVhayBlbHNlIG5ldyB2YXJcIiArXG4gIFwiIGNhc2UgZmluYWxseSByZXR1cm4gdm9pZFwiICtcbiAgXCIgY2F0Y2ggZm9yIHN3aXRjaCB3aGlsZVwiICtcbiAgXCIgY29udGludWUgZnVuY3Rpb24gdGhpcyB3aXRoXCIgK1xuICBcIiBkZWZhdWx0IGlmIHRocm93XCIgK1xuICBcIiBkZWxldGUgaW4gdHJ5XCIgK1xuICBcIiBkbyBpbnN0YW5jZW9mIHR5cGVvZlwiICtcbiAgXCIgYWJzdHJhY3QgZW51bSBpbnQgc2hvcnRcIiArXG4gIFwiIGJvb2xlYW4gZXhwb3J0IGludGVyZmFjZSBzdGF0aWNcIiArXG4gIFwiIGJ5dGUgZXh0ZW5kcyBsb25nIHN1cGVyXCIgK1xuICBcIiBjaGFyIGZpbmFsIG5hdGl2ZSBzeW5jaHJvbml6ZWRcIiArXG4gIFwiIGNsYXNzIGZsb2F0IHBhY2thZ2UgdGhyb3dzXCIgK1xuICBcIiBjb25zdCBnb3RvIHByaXZhdGUgdHJhbnNpZW50XCIgK1xuICBcIiBkZWJ1Z2dlciBpbXBsZW1lbnRzIHByb3RlY3RlZCB2b2xhdGlsZVwiICtcbiAgXCIgZG91YmxlIGltcG9ydCBwdWJsaWMgbGV0IHlpZWxkXCJcbikuc3BsaXQoXCIgXCIpO1xuXG52YXIgY29tcGlsZXJXb3JkcyA9IEphdmFTY3JpcHRDb21waWxlci5SRVNFUlZFRF9XT1JEUyA9IHt9O1xuXG5mb3IodmFyIGk9MCwgbD1yZXNlcnZlZFdvcmRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgY29tcGlsZXJXb3Jkc1tyZXNlcnZlZFdvcmRzW2ldXSA9IHRydWU7XG59XG5cbkphdmFTY3JpcHRDb21waWxlci5pc1ZhbGlkSmF2YVNjcmlwdFZhcmlhYmxlTmFtZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgaWYoIUphdmFTY3JpcHRDb21waWxlci5SRVNFUlZFRF9XT1JEU1tuYW1lXSAmJiAvXlthLXpBLVpfJF1bMC05YS16QS1aXyRdKiQvLnRlc3QobmFtZSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59O1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEphdmFTY3JpcHRDb21waWxlcjsiLCJcInVzZSBzdHJpY3RcIjtcbi8qIGpzaGludCBpZ25vcmU6c3RhcnQgKi9cbi8qIEppc29uIGdlbmVyYXRlZCBwYXJzZXIgKi9cbnZhciBoYW5kbGViYXJzID0gKGZ1bmN0aW9uKCl7XG52YXIgcGFyc2VyID0ge3RyYWNlOiBmdW5jdGlvbiB0cmFjZSgpIHsgfSxcbnl5OiB7fSxcbnN5bWJvbHNfOiB7XCJlcnJvclwiOjIsXCJyb290XCI6MyxcInN0YXRlbWVudHNcIjo0LFwiRU9GXCI6NSxcInByb2dyYW1cIjo2LFwic2ltcGxlSW52ZXJzZVwiOjcsXCJzdGF0ZW1lbnRcIjo4LFwib3BlbkludmVyc2VcIjo5LFwiY2xvc2VCbG9ja1wiOjEwLFwib3BlbkJsb2NrXCI6MTEsXCJtdXN0YWNoZVwiOjEyLFwicGFydGlhbFwiOjEzLFwiQ09OVEVOVFwiOjE0LFwiQ09NTUVOVFwiOjE1LFwiT1BFTl9CTE9DS1wiOjE2LFwic2V4cHJcIjoxNyxcIkNMT1NFXCI6MTgsXCJPUEVOX0lOVkVSU0VcIjoxOSxcIk9QRU5fRU5EQkxPQ0tcIjoyMCxcInBhdGhcIjoyMSxcIk9QRU5cIjoyMixcIk9QRU5fVU5FU0NBUEVEXCI6MjMsXCJDTE9TRV9VTkVTQ0FQRURcIjoyNCxcIk9QRU5fUEFSVElBTFwiOjI1LFwicGFydGlhbE5hbWVcIjoyNixcInBhcnRpYWxfb3B0aW9uMFwiOjI3LFwic2V4cHJfcmVwZXRpdGlvbjBcIjoyOCxcInNleHByX29wdGlvbjBcIjoyOSxcImRhdGFOYW1lXCI6MzAsXCJwYXJhbVwiOjMxLFwiU1RSSU5HXCI6MzIsXCJJTlRFR0VSXCI6MzMsXCJCT09MRUFOXCI6MzQsXCJPUEVOX1NFWFBSXCI6MzUsXCJDTE9TRV9TRVhQUlwiOjM2LFwiaGFzaFwiOjM3LFwiaGFzaF9yZXBldGl0aW9uX3BsdXMwXCI6MzgsXCJoYXNoU2VnbWVudFwiOjM5LFwiSURcIjo0MCxcIkVRVUFMU1wiOjQxLFwiREFUQVwiOjQyLFwicGF0aFNlZ21lbnRzXCI6NDMsXCJTRVBcIjo0NCxcIiRhY2NlcHRcIjowLFwiJGVuZFwiOjF9LFxudGVybWluYWxzXzogezI6XCJlcnJvclwiLDU6XCJFT0ZcIiwxNDpcIkNPTlRFTlRcIiwxNTpcIkNPTU1FTlRcIiwxNjpcIk9QRU5fQkxPQ0tcIiwxODpcIkNMT1NFXCIsMTk6XCJPUEVOX0lOVkVSU0VcIiwyMDpcIk9QRU5fRU5EQkxPQ0tcIiwyMjpcIk9QRU5cIiwyMzpcIk9QRU5fVU5FU0NBUEVEXCIsMjQ6XCJDTE9TRV9VTkVTQ0FQRURcIiwyNTpcIk9QRU5fUEFSVElBTFwiLDMyOlwiU1RSSU5HXCIsMzM6XCJJTlRFR0VSXCIsMzQ6XCJCT09MRUFOXCIsMzU6XCJPUEVOX1NFWFBSXCIsMzY6XCJDTE9TRV9TRVhQUlwiLDQwOlwiSURcIiw0MTpcIkVRVUFMU1wiLDQyOlwiREFUQVwiLDQ0OlwiU0VQXCJ9LFxucHJvZHVjdGlvbnNfOiBbMCxbMywyXSxbMywxXSxbNiwyXSxbNiwzXSxbNiwyXSxbNiwxXSxbNiwxXSxbNiwwXSxbNCwxXSxbNCwyXSxbOCwzXSxbOCwzXSxbOCwxXSxbOCwxXSxbOCwxXSxbOCwxXSxbMTEsM10sWzksM10sWzEwLDNdLFsxMiwzXSxbMTIsM10sWzEzLDRdLFs3LDJdLFsxNywzXSxbMTcsMV0sWzMxLDFdLFszMSwxXSxbMzEsMV0sWzMxLDFdLFszMSwxXSxbMzEsM10sWzM3LDFdLFszOSwzXSxbMjYsMV0sWzI2LDFdLFsyNiwxXSxbMzAsMl0sWzIxLDFdLFs0MywzXSxbNDMsMV0sWzI3LDBdLFsyNywxXSxbMjgsMF0sWzI4LDJdLFsyOSwwXSxbMjksMV0sWzM4LDFdLFszOCwyXV0sXG5wZXJmb3JtQWN0aW9uOiBmdW5jdGlvbiBhbm9ueW1vdXMoeXl0ZXh0LHl5bGVuZyx5eWxpbmVubyx5eSx5eXN0YXRlLCQkLF8kKSB7XG5cbnZhciAkMCA9ICQkLmxlbmd0aCAtIDE7XG5zd2l0Y2ggKHl5c3RhdGUpIHtcbmNhc2UgMTogcmV0dXJuIG5ldyB5eS5Qcm9ncmFtTm9kZSgkJFskMC0xXSwgdGhpcy5fJCk7IFxuYnJlYWs7XG5jYXNlIDI6IHJldHVybiBuZXcgeXkuUHJvZ3JhbU5vZGUoW10sIHRoaXMuXyQpOyBcbmJyZWFrO1xuY2FzZSAzOnRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZShbXSwgJCRbJDAtMV0sICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgNDp0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoJCRbJDAtMl0sICQkWyQwLTFdLCAkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDU6dGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKCQkWyQwLTFdLCAkJFskMF0sIFtdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSA2OnRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDc6dGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKFtdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSA4OnRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZShbXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgOTp0aGlzLiQgPSBbJCRbJDBdXTtcbmJyZWFrO1xuY2FzZSAxMDogJCRbJDAtMV0ucHVzaCgkJFskMF0pOyB0aGlzLiQgPSAkJFskMC0xXTsgXG5icmVhaztcbmNhc2UgMTE6dGhpcy4kID0gbmV3IHl5LkJsb2NrTm9kZSgkJFskMC0yXSwgJCRbJDAtMV0uaW52ZXJzZSwgJCRbJDAtMV0sICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTI6dGhpcy4kID0gbmV3IHl5LkJsb2NrTm9kZSgkJFskMC0yXSwgJCRbJDAtMV0sICQkWyQwLTFdLmludmVyc2UsICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTM6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDE0OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSAxNTp0aGlzLiQgPSBuZXcgeXkuQ29udGVudE5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxNjp0aGlzLiQgPSBuZXcgeXkuQ29tbWVudE5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxNzp0aGlzLiQgPSBuZXcgeXkuTXVzdGFjaGVOb2RlKCQkWyQwLTFdLCBudWxsLCAkJFskMC0yXSwgc3RyaXBGbGFncygkJFskMC0yXSwgJCRbJDBdKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTg6dGhpcy4kID0gbmV3IHl5Lk11c3RhY2hlTm9kZSgkJFskMC0xXSwgbnVsbCwgJCRbJDAtMl0sIHN0cmlwRmxhZ3MoJCRbJDAtMl0sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDE5OnRoaXMuJCA9IHtwYXRoOiAkJFskMC0xXSwgc3RyaXA6IHN0cmlwRmxhZ3MoJCRbJDAtMl0sICQkWyQwXSl9O1xuYnJlYWs7XG5jYXNlIDIwOnRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV0sIG51bGwsICQkWyQwLTJdLCBzdHJpcEZsYWdzKCQkWyQwLTJdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyMTp0aGlzLiQgPSBuZXcgeXkuTXVzdGFjaGVOb2RlKCQkWyQwLTFdLCBudWxsLCAkJFskMC0yXSwgc3RyaXBGbGFncygkJFskMC0yXSwgJCRbJDBdKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjI6dGhpcy4kID0gbmV3IHl5LlBhcnRpYWxOb2RlKCQkWyQwLTJdLCAkJFskMC0xXSwgc3RyaXBGbGFncygkJFskMC0zXSwgJCRbJDBdKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjM6dGhpcy4kID0gc3RyaXBGbGFncygkJFskMC0xXSwgJCRbJDBdKTtcbmJyZWFrO1xuY2FzZSAyNDp0aGlzLiQgPSBuZXcgeXkuU2V4cHJOb2RlKFskJFskMC0yXV0uY29uY2F0KCQkWyQwLTFdKSwgJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyNTp0aGlzLiQgPSBuZXcgeXkuU2V4cHJOb2RlKFskJFskMF1dLCBudWxsLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyNjp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgMjc6dGhpcy4kID0gbmV3IHl5LlN0cmluZ05vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyODp0aGlzLiQgPSBuZXcgeXkuSW50ZWdlck5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyOTp0aGlzLiQgPSBuZXcgeXkuQm9vbGVhbk5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzMDp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgMzE6JCRbJDAtMV0uaXNIZWxwZXIgPSB0cnVlOyB0aGlzLiQgPSAkJFskMC0xXTtcbmJyZWFrO1xuY2FzZSAzMjp0aGlzLiQgPSBuZXcgeXkuSGFzaE5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzMzp0aGlzLiQgPSBbJCRbJDAtMl0sICQkWyQwXV07XG5icmVhaztcbmNhc2UgMzQ6dGhpcy4kID0gbmV3IHl5LlBhcnRpYWxOYW1lTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDM1OnRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTmFtZU5vZGUobmV3IHl5LlN0cmluZ05vZGUoJCRbJDBdLCB0aGlzLl8kKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzY6dGhpcy4kID0gbmV3IHl5LlBhcnRpYWxOYW1lTm9kZShuZXcgeXkuSW50ZWdlck5vZGUoJCRbJDBdLCB0aGlzLl8kKSk7XG5icmVhaztcbmNhc2UgMzc6dGhpcy4kID0gbmV3IHl5LkRhdGFOb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzg6dGhpcy4kID0gbmV3IHl5LklkTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDM5OiAkJFskMC0yXS5wdXNoKHtwYXJ0OiAkJFskMF0sIHNlcGFyYXRvcjogJCRbJDAtMV19KTsgdGhpcy4kID0gJCRbJDAtMl07IFxuYnJlYWs7XG5jYXNlIDQwOnRoaXMuJCA9IFt7cGFydDogJCRbJDBdfV07XG5icmVhaztcbmNhc2UgNDM6dGhpcy4kID0gW107XG5icmVhaztcbmNhc2UgNDQ6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG5jYXNlIDQ3OnRoaXMuJCA9IFskJFskMF1dO1xuYnJlYWs7XG5jYXNlIDQ4OiQkWyQwLTFdLnB1c2goJCRbJDBdKTtcbmJyZWFrO1xufVxufSxcbnRhYmxlOiBbezM6MSw0OjIsNTpbMSwzXSw4OjQsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMTFdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7MTpbM119LHs1OlsxLDE2XSw4OjE3LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDExXSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezE6WzIsMl19LHs1OlsyLDldLDE0OlsyLDldLDE1OlsyLDldLDE2OlsyLDldLDE5OlsyLDldLDIwOlsyLDldLDIyOlsyLDldLDIzOlsyLDldLDI1OlsyLDldfSx7NDoyMCw2OjE4LDc6MTksODo0LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDIxXSwyMDpbMiw4XSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezQ6MjAsNjoyMiw3OjE5LDg6NCw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwyMV0sMjA6WzIsOF0sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHs1OlsyLDEzXSwxNDpbMiwxM10sMTU6WzIsMTNdLDE2OlsyLDEzXSwxOTpbMiwxM10sMjA6WzIsMTNdLDIyOlsyLDEzXSwyMzpbMiwxM10sMjU6WzIsMTNdfSx7NTpbMiwxNF0sMTQ6WzIsMTRdLDE1OlsyLDE0XSwxNjpbMiwxNF0sMTk6WzIsMTRdLDIwOlsyLDE0XSwyMjpbMiwxNF0sMjM6WzIsMTRdLDI1OlsyLDE0XX0sezU6WzIsMTVdLDE0OlsyLDE1XSwxNTpbMiwxNV0sMTY6WzIsMTVdLDE5OlsyLDE1XSwyMDpbMiwxNV0sMjI6WzIsMTVdLDIzOlsyLDE1XSwyNTpbMiwxNV19LHs1OlsyLDE2XSwxNDpbMiwxNl0sMTU6WzIsMTZdLDE2OlsyLDE2XSwxOTpbMiwxNl0sMjA6WzIsMTZdLDIyOlsyLDE2XSwyMzpbMiwxNl0sMjU6WzIsMTZdfSx7MTc6MjMsMjE6MjQsMzA6MjUsNDA6WzEsMjhdLDQyOlsxLDI3XSw0MzoyNn0sezE3OjI5LDIxOjI0LDMwOjI1LDQwOlsxLDI4XSw0MjpbMSwyN10sNDM6MjZ9LHsxNzozMCwyMToyNCwzMDoyNSw0MDpbMSwyOF0sNDI6WzEsMjddLDQzOjI2fSx7MTc6MzEsMjE6MjQsMzA6MjUsNDA6WzEsMjhdLDQyOlsxLDI3XSw0MzoyNn0sezIxOjMzLDI2OjMyLDMyOlsxLDM0XSwzMzpbMSwzNV0sNDA6WzEsMjhdLDQzOjI2fSx7MTpbMiwxXX0sezU6WzIsMTBdLDE0OlsyLDEwXSwxNTpbMiwxMF0sMTY6WzIsMTBdLDE5OlsyLDEwXSwyMDpbMiwxMF0sMjI6WzIsMTBdLDIzOlsyLDEwXSwyNTpbMiwxMF19LHsxMDozNiwyMDpbMSwzN119LHs0OjM4LDg6NCw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwxMV0sMjA6WzIsN10sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHs3OjM5LDg6MTcsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMjFdLDIwOlsyLDZdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7MTc6MjMsMTg6WzEsNDBdLDIxOjI0LDMwOjI1LDQwOlsxLDI4XSw0MjpbMSwyN10sNDM6MjZ9LHsxMDo0MSwyMDpbMSwzN119LHsxODpbMSw0Ml19LHsxODpbMiw0M10sMjQ6WzIsNDNdLDI4OjQzLDMyOlsyLDQzXSwzMzpbMiw0M10sMzQ6WzIsNDNdLDM1OlsyLDQzXSwzNjpbMiw0M10sNDA6WzIsNDNdLDQyOlsyLDQzXX0sezE4OlsyLDI1XSwyNDpbMiwyNV0sMzY6WzIsMjVdfSx7MTg6WzIsMzhdLDI0OlsyLDM4XSwzMjpbMiwzOF0sMzM6WzIsMzhdLDM0OlsyLDM4XSwzNTpbMiwzOF0sMzY6WzIsMzhdLDQwOlsyLDM4XSw0MjpbMiwzOF0sNDQ6WzEsNDRdfSx7MjE6NDUsNDA6WzEsMjhdLDQzOjI2fSx7MTg6WzIsNDBdLDI0OlsyLDQwXSwzMjpbMiw0MF0sMzM6WzIsNDBdLDM0OlsyLDQwXSwzNTpbMiw0MF0sMzY6WzIsNDBdLDQwOlsyLDQwXSw0MjpbMiw0MF0sNDQ6WzIsNDBdfSx7MTg6WzEsNDZdfSx7MTg6WzEsNDddfSx7MjQ6WzEsNDhdfSx7MTg6WzIsNDFdLDIxOjUwLDI3OjQ5LDQwOlsxLDI4XSw0MzoyNn0sezE4OlsyLDM0XSw0MDpbMiwzNF19LHsxODpbMiwzNV0sNDA6WzIsMzVdfSx7MTg6WzIsMzZdLDQwOlsyLDM2XX0sezU6WzIsMTFdLDE0OlsyLDExXSwxNTpbMiwxMV0sMTY6WzIsMTFdLDE5OlsyLDExXSwyMDpbMiwxMV0sMjI6WzIsMTFdLDIzOlsyLDExXSwyNTpbMiwxMV19LHsyMTo1MSw0MDpbMSwyOF0sNDM6MjZ9LHs4OjE3LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDExXSwyMDpbMiwzXSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezQ6NTIsODo0LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDExXSwyMDpbMiw1XSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezE0OlsyLDIzXSwxNTpbMiwyM10sMTY6WzIsMjNdLDE5OlsyLDIzXSwyMDpbMiwyM10sMjI6WzIsMjNdLDIzOlsyLDIzXSwyNTpbMiwyM119LHs1OlsyLDEyXSwxNDpbMiwxMl0sMTU6WzIsMTJdLDE2OlsyLDEyXSwxOTpbMiwxMl0sMjA6WzIsMTJdLDIyOlsyLDEyXSwyMzpbMiwxMl0sMjU6WzIsMTJdfSx7MTQ6WzIsMThdLDE1OlsyLDE4XSwxNjpbMiwxOF0sMTk6WzIsMThdLDIwOlsyLDE4XSwyMjpbMiwxOF0sMjM6WzIsMThdLDI1OlsyLDE4XX0sezE4OlsyLDQ1XSwyMTo1NiwyNDpbMiw0NV0sMjk6NTMsMzA6NjAsMzE6NTQsMzI6WzEsNTddLDMzOlsxLDU4XSwzNDpbMSw1OV0sMzU6WzEsNjFdLDM2OlsyLDQ1XSwzNzo1NSwzODo2MiwzOTo2Myw0MDpbMSw2NF0sNDI6WzEsMjddLDQzOjI2fSx7NDA6WzEsNjVdfSx7MTg6WzIsMzddLDI0OlsyLDM3XSwzMjpbMiwzN10sMzM6WzIsMzddLDM0OlsyLDM3XSwzNTpbMiwzN10sMzY6WzIsMzddLDQwOlsyLDM3XSw0MjpbMiwzN119LHsxNDpbMiwxN10sMTU6WzIsMTddLDE2OlsyLDE3XSwxOTpbMiwxN10sMjA6WzIsMTddLDIyOlsyLDE3XSwyMzpbMiwxN10sMjU6WzIsMTddfSx7NTpbMiwyMF0sMTQ6WzIsMjBdLDE1OlsyLDIwXSwxNjpbMiwyMF0sMTk6WzIsMjBdLDIwOlsyLDIwXSwyMjpbMiwyMF0sMjM6WzIsMjBdLDI1OlsyLDIwXX0sezU6WzIsMjFdLDE0OlsyLDIxXSwxNTpbMiwyMV0sMTY6WzIsMjFdLDE5OlsyLDIxXSwyMDpbMiwyMV0sMjI6WzIsMjFdLDIzOlsyLDIxXSwyNTpbMiwyMV19LHsxODpbMSw2Nl19LHsxODpbMiw0Ml19LHsxODpbMSw2N119LHs4OjE3LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDExXSwyMDpbMiw0XSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezE4OlsyLDI0XSwyNDpbMiwyNF0sMzY6WzIsMjRdfSx7MTg6WzIsNDRdLDI0OlsyLDQ0XSwzMjpbMiw0NF0sMzM6WzIsNDRdLDM0OlsyLDQ0XSwzNTpbMiw0NF0sMzY6WzIsNDRdLDQwOlsyLDQ0XSw0MjpbMiw0NF19LHsxODpbMiw0Nl0sMjQ6WzIsNDZdLDM2OlsyLDQ2XX0sezE4OlsyLDI2XSwyNDpbMiwyNl0sMzI6WzIsMjZdLDMzOlsyLDI2XSwzNDpbMiwyNl0sMzU6WzIsMjZdLDM2OlsyLDI2XSw0MDpbMiwyNl0sNDI6WzIsMjZdfSx7MTg6WzIsMjddLDI0OlsyLDI3XSwzMjpbMiwyN10sMzM6WzIsMjddLDM0OlsyLDI3XSwzNTpbMiwyN10sMzY6WzIsMjddLDQwOlsyLDI3XSw0MjpbMiwyN119LHsxODpbMiwyOF0sMjQ6WzIsMjhdLDMyOlsyLDI4XSwzMzpbMiwyOF0sMzQ6WzIsMjhdLDM1OlsyLDI4XSwzNjpbMiwyOF0sNDA6WzIsMjhdLDQyOlsyLDI4XX0sezE4OlsyLDI5XSwyNDpbMiwyOV0sMzI6WzIsMjldLDMzOlsyLDI5XSwzNDpbMiwyOV0sMzU6WzIsMjldLDM2OlsyLDI5XSw0MDpbMiwyOV0sNDI6WzIsMjldfSx7MTg6WzIsMzBdLDI0OlsyLDMwXSwzMjpbMiwzMF0sMzM6WzIsMzBdLDM0OlsyLDMwXSwzNTpbMiwzMF0sMzY6WzIsMzBdLDQwOlsyLDMwXSw0MjpbMiwzMF19LHsxNzo2OCwyMToyNCwzMDoyNSw0MDpbMSwyOF0sNDI6WzEsMjddLDQzOjI2fSx7MTg6WzIsMzJdLDI0OlsyLDMyXSwzNjpbMiwzMl0sMzk6NjksNDA6WzEsNzBdfSx7MTg6WzIsNDddLDI0OlsyLDQ3XSwzNjpbMiw0N10sNDA6WzIsNDddfSx7MTg6WzIsNDBdLDI0OlsyLDQwXSwzMjpbMiw0MF0sMzM6WzIsNDBdLDM0OlsyLDQwXSwzNTpbMiw0MF0sMzY6WzIsNDBdLDQwOlsyLDQwXSw0MTpbMSw3MV0sNDI6WzIsNDBdLDQ0OlsyLDQwXX0sezE4OlsyLDM5XSwyNDpbMiwzOV0sMzI6WzIsMzldLDMzOlsyLDM5XSwzNDpbMiwzOV0sMzU6WzIsMzldLDM2OlsyLDM5XSw0MDpbMiwzOV0sNDI6WzIsMzldLDQ0OlsyLDM5XX0sezU6WzIsMjJdLDE0OlsyLDIyXSwxNTpbMiwyMl0sMTY6WzIsMjJdLDE5OlsyLDIyXSwyMDpbMiwyMl0sMjI6WzIsMjJdLDIzOlsyLDIyXSwyNTpbMiwyMl19LHs1OlsyLDE5XSwxNDpbMiwxOV0sMTU6WzIsMTldLDE2OlsyLDE5XSwxOTpbMiwxOV0sMjA6WzIsMTldLDIyOlsyLDE5XSwyMzpbMiwxOV0sMjU6WzIsMTldfSx7MzY6WzEsNzJdfSx7MTg6WzIsNDhdLDI0OlsyLDQ4XSwzNjpbMiw0OF0sNDA6WzIsNDhdfSx7NDE6WzEsNzFdfSx7MjE6NTYsMzA6NjAsMzE6NzMsMzI6WzEsNTddLDMzOlsxLDU4XSwzNDpbMSw1OV0sMzU6WzEsNjFdLDQwOlsxLDI4XSw0MjpbMSwyN10sNDM6MjZ9LHsxODpbMiwzMV0sMjQ6WzIsMzFdLDMyOlsyLDMxXSwzMzpbMiwzMV0sMzQ6WzIsMzFdLDM1OlsyLDMxXSwzNjpbMiwzMV0sNDA6WzIsMzFdLDQyOlsyLDMxXX0sezE4OlsyLDMzXSwyNDpbMiwzM10sMzY6WzIsMzNdLDQwOlsyLDMzXX1dLFxuZGVmYXVsdEFjdGlvbnM6IHszOlsyLDJdLDE2OlsyLDFdLDUwOlsyLDQyXX0sXG5wYXJzZUVycm9yOiBmdW5jdGlvbiBwYXJzZUVycm9yKHN0ciwgaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihzdHIpO1xufSxcbnBhcnNlOiBmdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAgIHZhciBzZWxmID0gdGhpcywgc3RhY2sgPSBbMF0sIHZzdGFjayA9IFtudWxsXSwgbHN0YWNrID0gW10sIHRhYmxlID0gdGhpcy50YWJsZSwgeXl0ZXh0ID0gXCJcIiwgeXlsaW5lbm8gPSAwLCB5eWxlbmcgPSAwLCByZWNvdmVyaW5nID0gMCwgVEVSUk9SID0gMiwgRU9GID0gMTtcbiAgICB0aGlzLmxleGVyLnNldElucHV0KGlucHV0KTtcbiAgICB0aGlzLmxleGVyLnl5ID0gdGhpcy55eTtcbiAgICB0aGlzLnl5LmxleGVyID0gdGhpcy5sZXhlcjtcbiAgICB0aGlzLnl5LnBhcnNlciA9IHRoaXM7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmxleGVyLnl5bGxvYyA9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICB0aGlzLmxleGVyLnl5bGxvYyA9IHt9O1xuICAgIHZhciB5eWxvYyA9IHRoaXMubGV4ZXIueXlsbG9jO1xuICAgIGxzdGFjay5wdXNoKHl5bG9jKTtcbiAgICB2YXIgcmFuZ2VzID0gdGhpcy5sZXhlci5vcHRpb25zICYmIHRoaXMubGV4ZXIub3B0aW9ucy5yYW5nZXM7XG4gICAgaWYgKHR5cGVvZiB0aGlzLnl5LnBhcnNlRXJyb3IgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgdGhpcy5wYXJzZUVycm9yID0gdGhpcy55eS5wYXJzZUVycm9yO1xuICAgIGZ1bmN0aW9uIHBvcFN0YWNrKG4pIHtcbiAgICAgICAgc3RhY2subGVuZ3RoID0gc3RhY2subGVuZ3RoIC0gMiAqIG47XG4gICAgICAgIHZzdGFjay5sZW5ndGggPSB2c3RhY2subGVuZ3RoIC0gbjtcbiAgICAgICAgbHN0YWNrLmxlbmd0aCA9IGxzdGFjay5sZW5ndGggLSBuO1xuICAgIH1cbiAgICBmdW5jdGlvbiBsZXgoKSB7XG4gICAgICAgIHZhciB0b2tlbjtcbiAgICAgICAgdG9rZW4gPSBzZWxmLmxleGVyLmxleCgpIHx8IDE7XG4gICAgICAgIGlmICh0eXBlb2YgdG9rZW4gIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgIHRva2VuID0gc2VsZi5zeW1ib2xzX1t0b2tlbl0gfHwgdG9rZW47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH1cbiAgICB2YXIgc3ltYm9sLCBwcmVFcnJvclN5bWJvbCwgc3RhdGUsIGFjdGlvbiwgYSwgciwgeXl2YWwgPSB7fSwgcCwgbGVuLCBuZXdTdGF0ZSwgZXhwZWN0ZWQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgc3RhdGUgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHRoaXMuZGVmYXVsdEFjdGlvbnNbc3RhdGVdKSB7XG4gICAgICAgICAgICBhY3Rpb24gPSB0aGlzLmRlZmF1bHRBY3Rpb25zW3N0YXRlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChzeW1ib2wgPT09IG51bGwgfHwgdHlwZW9mIHN5bWJvbCA9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgc3ltYm9sID0gbGV4KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhY3Rpb24gPSB0YWJsZVtzdGF0ZV0gJiYgdGFibGVbc3RhdGVdW3N5bWJvbF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBhY3Rpb24gPT09IFwidW5kZWZpbmVkXCIgfHwgIWFjdGlvbi5sZW5ndGggfHwgIWFjdGlvblswXSkge1xuICAgICAgICAgICAgdmFyIGVyclN0ciA9IFwiXCI7XG4gICAgICAgICAgICBpZiAoIXJlY292ZXJpbmcpIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAocCBpbiB0YWJsZVtzdGF0ZV0pXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnRlcm1pbmFsc19bcF0gJiYgcCA+IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkLnB1c2goXCInXCIgKyB0aGlzLnRlcm1pbmFsc19bcF0gKyBcIidcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sZXhlci5zaG93UG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyU3RyID0gXCJQYXJzZSBlcnJvciBvbiBsaW5lIFwiICsgKHl5bGluZW5vICsgMSkgKyBcIjpcXG5cIiArIHRoaXMubGV4ZXIuc2hvd1Bvc2l0aW9uKCkgKyBcIlxcbkV4cGVjdGluZyBcIiArIGV4cGVjdGVkLmpvaW4oXCIsIFwiKSArIFwiLCBnb3QgJ1wiICsgKHRoaXMudGVybWluYWxzX1tzeW1ib2xdIHx8IHN5bWJvbCkgKyBcIidcIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlcnJTdHIgPSBcIlBhcnNlIGVycm9yIG9uIGxpbmUgXCIgKyAoeXlsaW5lbm8gKyAxKSArIFwiOiBVbmV4cGVjdGVkIFwiICsgKHN5bWJvbCA9PSAxP1wiZW5kIG9mIGlucHV0XCI6XCInXCIgKyAodGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sKSArIFwiJ1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZUVycm9yKGVyclN0ciwge3RleHQ6IHRoaXMubGV4ZXIubWF0Y2gsIHRva2VuOiB0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wsIGxpbmU6IHRoaXMubGV4ZXIueXlsaW5lbm8sIGxvYzogeXlsb2MsIGV4cGVjdGVkOiBleHBlY3RlZH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChhY3Rpb25bMF0gaW5zdGFuY2VvZiBBcnJheSAmJiBhY3Rpb24ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGFyc2UgRXJyb3I6IG11bHRpcGxlIGFjdGlvbnMgcG9zc2libGUgYXQgc3RhdGU6IFwiICsgc3RhdGUgKyBcIiwgdG9rZW46IFwiICsgc3ltYm9sKTtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKGFjdGlvblswXSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICBzdGFjay5wdXNoKHN5bWJvbCk7XG4gICAgICAgICAgICB2c3RhY2sucHVzaCh0aGlzLmxleGVyLnl5dGV4dCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaCh0aGlzLmxleGVyLnl5bGxvYyk7XG4gICAgICAgICAgICBzdGFjay5wdXNoKGFjdGlvblsxXSk7XG4gICAgICAgICAgICBzeW1ib2wgPSBudWxsO1xuICAgICAgICAgICAgaWYgKCFwcmVFcnJvclN5bWJvbCkge1xuICAgICAgICAgICAgICAgIHl5bGVuZyA9IHRoaXMubGV4ZXIueXlsZW5nO1xuICAgICAgICAgICAgICAgIHl5dGV4dCA9IHRoaXMubGV4ZXIueXl0ZXh0O1xuICAgICAgICAgICAgICAgIHl5bGluZW5vID0gdGhpcy5sZXhlci55eWxpbmVubztcbiAgICAgICAgICAgICAgICB5eWxvYyA9IHRoaXMubGV4ZXIueXlsbG9jO1xuICAgICAgICAgICAgICAgIGlmIChyZWNvdmVyaW5nID4gMClcbiAgICAgICAgICAgICAgICAgICAgcmVjb3ZlcmluZy0tO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzeW1ib2wgPSBwcmVFcnJvclN5bWJvbDtcbiAgICAgICAgICAgICAgICBwcmVFcnJvclN5bWJvbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgbGVuID0gdGhpcy5wcm9kdWN0aW9uc19bYWN0aW9uWzFdXVsxXTtcbiAgICAgICAgICAgIHl5dmFsLiQgPSB2c3RhY2tbdnN0YWNrLmxlbmd0aCAtIGxlbl07XG4gICAgICAgICAgICB5eXZhbC5fJCA9IHtmaXJzdF9saW5lOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIChsZW4gfHwgMSldLmZpcnN0X2xpbmUsIGxhc3RfbGluZTogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAxXS5sYXN0X2xpbmUsIGZpcnN0X2NvbHVtbjogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5maXJzdF9jb2x1bW4sIGxhc3RfY29sdW1uOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIDFdLmxhc3RfY29sdW1ufTtcbiAgICAgICAgICAgIGlmIChyYW5nZXMpIHtcbiAgICAgICAgICAgICAgICB5eXZhbC5fJC5yYW5nZSA9IFtsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIChsZW4gfHwgMSldLnJhbmdlWzBdLCBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIDFdLnJhbmdlWzFdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHIgPSB0aGlzLnBlcmZvcm1BY3Rpb24uY2FsbCh5eXZhbCwgeXl0ZXh0LCB5eWxlbmcsIHl5bGluZW5vLCB0aGlzLnl5LCBhY3Rpb25bMV0sIHZzdGFjaywgbHN0YWNrKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgciAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgIHN0YWNrID0gc3RhY2suc2xpY2UoMCwgLTEgKiBsZW4gKiAyKTtcbiAgICAgICAgICAgICAgICB2c3RhY2sgPSB2c3RhY2suc2xpY2UoMCwgLTEgKiBsZW4pO1xuICAgICAgICAgICAgICAgIGxzdGFjayA9IGxzdGFjay5zbGljZSgwLCAtMSAqIGxlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGFjay5wdXNoKHRoaXMucHJvZHVjdGlvbnNfW2FjdGlvblsxXV1bMF0pO1xuICAgICAgICAgICAgdnN0YWNrLnB1c2goeXl2YWwuJCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaCh5eXZhbC5fJCk7XG4gICAgICAgICAgICBuZXdTdGF0ZSA9IHRhYmxlW3N0YWNrW3N0YWNrLmxlbmd0aCAtIDJdXVtzdGFja1tzdGFjay5sZW5ndGggLSAxXV07XG4gICAgICAgICAgICBzdGFjay5wdXNoKG5ld1N0YXRlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn1cbn07XG5cblxuZnVuY3Rpb24gc3RyaXBGbGFncyhvcGVuLCBjbG9zZSkge1xuICByZXR1cm4ge1xuICAgIGxlZnQ6IG9wZW4uY2hhckF0KDIpID09PSAnficsXG4gICAgcmlnaHQ6IGNsb3NlLmNoYXJBdCgwKSA9PT0gJ34nIHx8IGNsb3NlLmNoYXJBdCgxKSA9PT0gJ34nXG4gIH07XG59XG5cbi8qIEppc29uIGdlbmVyYXRlZCBsZXhlciAqL1xudmFyIGxleGVyID0gKGZ1bmN0aW9uKCl7XG52YXIgbGV4ZXIgPSAoe0VPRjoxLFxucGFyc2VFcnJvcjpmdW5jdGlvbiBwYXJzZUVycm9yKHN0ciwgaGFzaCkge1xuICAgICAgICBpZiAodGhpcy55eS5wYXJzZXIpIHtcbiAgICAgICAgICAgIHRoaXMueXkucGFyc2VyLnBhcnNlRXJyb3Ioc3RyLCBoYXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihzdHIpO1xuICAgICAgICB9XG4gICAgfSxcbnNldElucHV0OmZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICB0aGlzLl9pbnB1dCA9IGlucHV0O1xuICAgICAgICB0aGlzLl9tb3JlID0gdGhpcy5fbGVzcyA9IHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnl5bGluZW5vID0gdGhpcy55eWxlbmcgPSAwO1xuICAgICAgICB0aGlzLnl5dGV4dCA9IHRoaXMubWF0Y2hlZCA9IHRoaXMubWF0Y2ggPSAnJztcbiAgICAgICAgdGhpcy5jb25kaXRpb25TdGFjayA9IFsnSU5JVElBTCddO1xuICAgICAgICB0aGlzLnl5bGxvYyA9IHtmaXJzdF9saW5lOjEsZmlyc3RfY29sdW1uOjAsbGFzdF9saW5lOjEsbGFzdF9jb2x1bW46MH07XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB0aGlzLnl5bGxvYy5yYW5nZSA9IFswLDBdO1xuICAgICAgICB0aGlzLm9mZnNldCA9IDA7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5pbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjaCA9IHRoaXMuX2lucHV0WzBdO1xuICAgICAgICB0aGlzLnl5dGV4dCArPSBjaDtcbiAgICAgICAgdGhpcy55eWxlbmcrKztcbiAgICAgICAgdGhpcy5vZmZzZXQrKztcbiAgICAgICAgdGhpcy5tYXRjaCArPSBjaDtcbiAgICAgICAgdGhpcy5tYXRjaGVkICs9IGNoO1xuICAgICAgICB2YXIgbGluZXMgPSBjaC5tYXRjaCgvKD86XFxyXFxuP3xcXG4pLiovZyk7XG4gICAgICAgIGlmIChsaW5lcykge1xuICAgICAgICAgICAgdGhpcy55eWxpbmVubysrO1xuICAgICAgICAgICAgdGhpcy55eWxsb2MubGFzdF9saW5lKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5sYXN0X2NvbHVtbisrO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB0aGlzLnl5bGxvYy5yYW5nZVsxXSsrO1xuXG4gICAgICAgIHRoaXMuX2lucHV0ID0gdGhpcy5faW5wdXQuc2xpY2UoMSk7XG4gICAgICAgIHJldHVybiBjaDtcbiAgICB9LFxudW5wdXQ6ZnVuY3Rpb24gKGNoKSB7XG4gICAgICAgIHZhciBsZW4gPSBjaC5sZW5ndGg7XG4gICAgICAgIHZhciBsaW5lcyA9IGNoLnNwbGl0KC8oPzpcXHJcXG4/fFxcbikvZyk7XG5cbiAgICAgICAgdGhpcy5faW5wdXQgPSBjaCArIHRoaXMuX2lucHV0O1xuICAgICAgICB0aGlzLnl5dGV4dCA9IHRoaXMueXl0ZXh0LnN1YnN0cigwLCB0aGlzLnl5dGV4dC5sZW5ndGgtbGVuLTEpO1xuICAgICAgICAvL3RoaXMueXlsZW5nIC09IGxlbjtcbiAgICAgICAgdGhpcy5vZmZzZXQgLT0gbGVuO1xuICAgICAgICB2YXIgb2xkTGluZXMgPSB0aGlzLm1hdGNoLnNwbGl0KC8oPzpcXHJcXG4/fFxcbikvZyk7XG4gICAgICAgIHRoaXMubWF0Y2ggPSB0aGlzLm1hdGNoLnN1YnN0cigwLCB0aGlzLm1hdGNoLmxlbmd0aC0xKTtcbiAgICAgICAgdGhpcy5tYXRjaGVkID0gdGhpcy5tYXRjaGVkLnN1YnN0cigwLCB0aGlzLm1hdGNoZWQubGVuZ3RoLTEpO1xuXG4gICAgICAgIGlmIChsaW5lcy5sZW5ndGgtMSkgdGhpcy55eWxpbmVubyAtPSBsaW5lcy5sZW5ndGgtMTtcbiAgICAgICAgdmFyIHIgPSB0aGlzLnl5bGxvYy5yYW5nZTtcblxuICAgICAgICB0aGlzLnl5bGxvYyA9IHtmaXJzdF9saW5lOiB0aGlzLnl5bGxvYy5maXJzdF9saW5lLFxuICAgICAgICAgIGxhc3RfbGluZTogdGhpcy55eWxpbmVubysxLFxuICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uLFxuICAgICAgICAgIGxhc3RfY29sdW1uOiBsaW5lcyA/XG4gICAgICAgICAgICAgIChsaW5lcy5sZW5ndGggPT09IG9sZExpbmVzLmxlbmd0aCA/IHRoaXMueXlsbG9jLmZpcnN0X2NvbHVtbiA6IDApICsgb2xkTGluZXNbb2xkTGluZXMubGVuZ3RoIC0gbGluZXMubGVuZ3RoXS5sZW5ndGggLSBsaW5lc1swXS5sZW5ndGg6XG4gICAgICAgICAgICAgIHRoaXMueXlsbG9jLmZpcnN0X2NvbHVtbiAtIGxlblxuICAgICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3JbMF0sIHJbMF0gKyB0aGlzLnl5bGVuZyAtIGxlbl07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbm1vcmU6ZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9tb3JlID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbmxlc3M6ZnVuY3Rpb24gKG4pIHtcbiAgICAgICAgdGhpcy51bnB1dCh0aGlzLm1hdGNoLnNsaWNlKG4pKTtcbiAgICB9LFxucGFzdElucHV0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHBhc3QgPSB0aGlzLm1hdGNoZWQuc3Vic3RyKDAsIHRoaXMubWF0Y2hlZC5sZW5ndGggLSB0aGlzLm1hdGNoLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiAocGFzdC5sZW5ndGggPiAyMCA/ICcuLi4nOicnKSArIHBhc3Quc3Vic3RyKC0yMCkucmVwbGFjZSgvXFxuL2csIFwiXCIpO1xuICAgIH0sXG51cGNvbWluZ0lucHV0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5leHQgPSB0aGlzLm1hdGNoO1xuICAgICAgICBpZiAobmV4dC5sZW5ndGggPCAyMCkge1xuICAgICAgICAgICAgbmV4dCArPSB0aGlzLl9pbnB1dC5zdWJzdHIoMCwgMjAtbmV4dC5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAobmV4dC5zdWJzdHIoMCwyMCkrKG5leHQubGVuZ3RoID4gMjAgPyAnLi4uJzonJykpLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxuc2hvd1Bvc2l0aW9uOmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHByZSA9IHRoaXMucGFzdElucHV0KCk7XG4gICAgICAgIHZhciBjID0gbmV3IEFycmF5KHByZS5sZW5ndGggKyAxKS5qb2luKFwiLVwiKTtcbiAgICAgICAgcmV0dXJuIHByZSArIHRoaXMudXBjb21pbmdJbnB1dCgpICsgXCJcXG5cIiArIGMrXCJeXCI7XG4gICAgfSxcbm5leHQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5kb25lKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5FT0Y7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLl9pbnB1dCkgdGhpcy5kb25lID0gdHJ1ZTtcblxuICAgICAgICB2YXIgdG9rZW4sXG4gICAgICAgICAgICBtYXRjaCxcbiAgICAgICAgICAgIHRlbXBNYXRjaCxcbiAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgY29sLFxuICAgICAgICAgICAgbGluZXM7XG4gICAgICAgIGlmICghdGhpcy5fbW9yZSkge1xuICAgICAgICAgICAgdGhpcy55eXRleHQgPSAnJztcbiAgICAgICAgICAgIHRoaXMubWF0Y2ggPSAnJztcbiAgICAgICAgfVxuICAgICAgICB2YXIgcnVsZXMgPSB0aGlzLl9jdXJyZW50UnVsZXMoKTtcbiAgICAgICAgZm9yICh2YXIgaT0wO2kgPCBydWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGVtcE1hdGNoID0gdGhpcy5faW5wdXQubWF0Y2godGhpcy5ydWxlc1tydWxlc1tpXV0pO1xuICAgICAgICAgICAgaWYgKHRlbXBNYXRjaCAmJiAoIW1hdGNoIHx8IHRlbXBNYXRjaFswXS5sZW5ndGggPiBtYXRjaFswXS5sZW5ndGgpKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2ggPSB0ZW1wTWF0Y2g7XG4gICAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5vcHRpb25zLmZsZXgpIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgbGluZXMgPSBtYXRjaFswXS5tYXRjaCgvKD86XFxyXFxuP3xcXG4pLiovZyk7XG4gICAgICAgICAgICBpZiAobGluZXMpIHRoaXMueXlsaW5lbm8gKz0gbGluZXMubGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy55eWxsb2MgPSB7Zmlyc3RfbGluZTogdGhpcy55eWxsb2MubGFzdF9saW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdF9saW5lOiB0aGlzLnl5bGluZW5vKzEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBmaXJzdF9jb2x1bW46IHRoaXMueXlsbG9jLmxhc3RfY29sdW1uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdF9jb2x1bW46IGxpbmVzID8gbGluZXNbbGluZXMubGVuZ3RoLTFdLmxlbmd0aC1saW5lc1tsaW5lcy5sZW5ndGgtMV0ubWF0Y2goL1xccj9cXG4/LylbMF0ubGVuZ3RoIDogdGhpcy55eWxsb2MubGFzdF9jb2x1bW4gKyBtYXRjaFswXS5sZW5ndGh9O1xuICAgICAgICAgICAgdGhpcy55eXRleHQgKz0gbWF0Y2hbMF07XG4gICAgICAgICAgICB0aGlzLm1hdGNoICs9IG1hdGNoWzBdO1xuICAgICAgICAgICAgdGhpcy5tYXRjaGVzID0gbWF0Y2g7XG4gICAgICAgICAgICB0aGlzLnl5bGVuZyA9IHRoaXMueXl0ZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy55eWxsb2MucmFuZ2UgPSBbdGhpcy5vZmZzZXQsIHRoaXMub2Zmc2V0ICs9IHRoaXMueXlsZW5nXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX21vcmUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2lucHV0ID0gdGhpcy5faW5wdXQuc2xpY2UobWF0Y2hbMF0ubGVuZ3RoKTtcbiAgICAgICAgICAgIHRoaXMubWF0Y2hlZCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIHRva2VuID0gdGhpcy5wZXJmb3JtQWN0aW9uLmNhbGwodGhpcywgdGhpcy55eSwgdGhpcywgcnVsZXNbaW5kZXhdLHRoaXMuY29uZGl0aW9uU3RhY2tbdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGgtMV0pO1xuICAgICAgICAgICAgaWYgKHRoaXMuZG9uZSAmJiB0aGlzLl9pbnB1dCkgdGhpcy5kb25lID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodG9rZW4pIHJldHVybiB0b2tlbjtcbiAgICAgICAgICAgIGVsc2UgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9pbnB1dCA9PT0gXCJcIikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VFcnJvcignTGV4aWNhbCBlcnJvciBvbiBsaW5lICcrKHRoaXMueXlsaW5lbm8rMSkrJy4gVW5yZWNvZ25pemVkIHRleHQuXFxuJyt0aGlzLnNob3dQb3NpdGlvbigpLFxuICAgICAgICAgICAgICAgICAgICB7dGV4dDogXCJcIiwgdG9rZW46IG51bGwsIGxpbmU6IHRoaXMueXlsaW5lbm99KTtcbiAgICAgICAgfVxuICAgIH0sXG5sZXg6ZnVuY3Rpb24gbGV4KCkge1xuICAgICAgICB2YXIgciA9IHRoaXMubmV4dCgpO1xuICAgICAgICBpZiAodHlwZW9mIHIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxleCgpO1xuICAgICAgICB9XG4gICAgfSxcbmJlZ2luOmZ1bmN0aW9uIGJlZ2luKGNvbmRpdGlvbikge1xuICAgICAgICB0aGlzLmNvbmRpdGlvblN0YWNrLnB1c2goY29uZGl0aW9uKTtcbiAgICB9LFxucG9wU3RhdGU6ZnVuY3Rpb24gcG9wU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvblN0YWNrLnBvcCgpO1xuICAgIH0sXG5fY3VycmVudFJ1bGVzOmZ1bmN0aW9uIF9jdXJyZW50UnVsZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvbnNbdGhpcy5jb25kaXRpb25TdGFja1t0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aC0xXV0ucnVsZXM7XG4gICAgfSxcbnRvcFN0YXRlOmZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2tbdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGgtMl07XG4gICAgfSxcbnB1c2hTdGF0ZTpmdW5jdGlvbiBiZWdpbihjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5iZWdpbihjb25kaXRpb24pO1xuICAgIH19KTtcbmxleGVyLm9wdGlvbnMgPSB7fTtcbmxleGVyLnBlcmZvcm1BY3Rpb24gPSBmdW5jdGlvbiBhbm9ueW1vdXMoeXkseXlfLCRhdm9pZGluZ19uYW1lX2NvbGxpc2lvbnMsWVlfU1RBUlQpIHtcblxuXG5mdW5jdGlvbiBzdHJpcChzdGFydCwgZW5kKSB7XG4gIHJldHVybiB5eV8ueXl0ZXh0ID0geXlfLnl5dGV4dC5zdWJzdHIoc3RhcnQsIHl5Xy55eWxlbmctZW5kKTtcbn1cblxuXG52YXIgWVlTVEFURT1ZWV9TVEFSVFxuc3dpdGNoKCRhdm9pZGluZ19uYW1lX2NvbGxpc2lvbnMpIHtcbmNhc2UgMDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoeXlfLnl5dGV4dC5zbGljZSgtMikgPT09IFwiXFxcXFxcXFxcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cmlwKDAsMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iZWdpbihcIm11XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYoeXlfLnl5dGV4dC5zbGljZSgtMSkgPT09IFwiXFxcXFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyaXAoMCwxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJlZ2luKFwiZW11XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmVnaW4oXCJtdVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZih5eV8ueXl0ZXh0KSByZXR1cm4gMTQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSAxOnJldHVybiAxNDtcbmJyZWFrO1xuY2FzZSAyOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvcFN0YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAxNDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuYnJlYWs7XG5jYXNlIDM6c3RyaXAoMCw0KTsgdGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMTU7XG5icmVhaztcbmNhc2UgNDpyZXR1cm4gMzU7XG5icmVhaztcbmNhc2UgNTpyZXR1cm4gMzY7XG5icmVhaztcbmNhc2UgNjpyZXR1cm4gMjU7XG5icmVhaztcbmNhc2UgNzpyZXR1cm4gMTY7XG5icmVhaztcbmNhc2UgODpyZXR1cm4gMjA7XG5icmVhaztcbmNhc2UgOTpyZXR1cm4gMTk7XG5icmVhaztcbmNhc2UgMTA6cmV0dXJuIDE5O1xuYnJlYWs7XG5jYXNlIDExOnJldHVybiAyMztcbmJyZWFrO1xuY2FzZSAxMjpyZXR1cm4gMjI7XG5icmVhaztcbmNhc2UgMTM6dGhpcy5wb3BTdGF0ZSgpOyB0aGlzLmJlZ2luKCdjb20nKTtcbmJyZWFrO1xuY2FzZSAxNDpzdHJpcCgzLDUpOyB0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAxNTtcbmJyZWFrO1xuY2FzZSAxNTpyZXR1cm4gMjI7XG5icmVhaztcbmNhc2UgMTY6cmV0dXJuIDQxO1xuYnJlYWs7XG5jYXNlIDE3OnJldHVybiA0MDtcbmJyZWFrO1xuY2FzZSAxODpyZXR1cm4gNDA7XG5icmVhaztcbmNhc2UgMTk6cmV0dXJuIDQ0O1xuYnJlYWs7XG5jYXNlIDIwOi8vIGlnbm9yZSB3aGl0ZXNwYWNlXG5icmVhaztcbmNhc2UgMjE6dGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMjQ7XG5icmVhaztcbmNhc2UgMjI6dGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMTg7XG5icmVhaztcbmNhc2UgMjM6eXlfLnl5dGV4dCA9IHN0cmlwKDEsMikucmVwbGFjZSgvXFxcXFwiL2csJ1wiJyk7IHJldHVybiAzMjtcbmJyZWFrO1xuY2FzZSAyNDp5eV8ueXl0ZXh0ID0gc3RyaXAoMSwyKS5yZXBsYWNlKC9cXFxcJy9nLFwiJ1wiKTsgcmV0dXJuIDMyO1xuYnJlYWs7XG5jYXNlIDI1OnJldHVybiA0MjtcbmJyZWFrO1xuY2FzZSAyNjpyZXR1cm4gMzQ7XG5icmVhaztcbmNhc2UgMjc6cmV0dXJuIDM0O1xuYnJlYWs7XG5jYXNlIDI4OnJldHVybiAzMztcbmJyZWFrO1xuY2FzZSAyOTpyZXR1cm4gNDA7XG5icmVhaztcbmNhc2UgMzA6eXlfLnl5dGV4dCA9IHN0cmlwKDEsMik7IHJldHVybiA0MDtcbmJyZWFrO1xuY2FzZSAzMTpyZXR1cm4gJ0lOVkFMSUQnO1xuYnJlYWs7XG5jYXNlIDMyOnJldHVybiA1O1xuYnJlYWs7XG59XG59O1xubGV4ZXIucnVsZXMgPSBbL14oPzpbXlxceDAwXSo/KD89KFxce1xceykpKS8sL14oPzpbXlxceDAwXSspLywvXig/OlteXFx4MDBdezIsfT8oPz0oXFx7XFx7fFxcXFxcXHtcXHt8XFxcXFxcXFxcXHtcXHt8JCkpKS8sL14oPzpbXFxzXFxTXSo/LS1cXH1cXH0pLywvXig/OlxcKCkvLC9eKD86XFwpKS8sL14oPzpcXHtcXHsofik/PikvLC9eKD86XFx7XFx7KH4pPyMpLywvXig/Olxce1xceyh+KT9cXC8pLywvXig/Olxce1xceyh+KT9cXF4pLywvXig/Olxce1xceyh+KT9cXHMqZWxzZVxcYikvLC9eKD86XFx7XFx7KH4pP1xceykvLC9eKD86XFx7XFx7KH4pPyYpLywvXig/Olxce1xceyEtLSkvLC9eKD86XFx7XFx7IVtcXHNcXFNdKj9cXH1cXH0pLywvXig/Olxce1xceyh+KT8pLywvXig/Oj0pLywvXig/OlxcLlxcLikvLC9eKD86XFwuKD89KFs9fn1cXHNcXC8uKV0pKSkvLC9eKD86W1xcLy5dKS8sL14oPzpcXHMrKS8sL14oPzpcXH0ofik/XFx9XFx9KS8sL14oPzoofik/XFx9XFx9KS8sL14oPzpcIihcXFxcW1wiXXxbXlwiXSkqXCIpLywvXig/OicoXFxcXFsnXXxbXiddKSonKS8sL14oPzpAKS8sL14oPzp0cnVlKD89KFt+fVxccyldKSkpLywvXig/OmZhbHNlKD89KFt+fVxccyldKSkpLywvXig/Oi0/WzAtOV0rKD89KFt+fVxccyldKSkpLywvXig/OihbXlxccyFcIiMlLSxcXC5cXC87LT5AXFxbLVxcXmBcXHstfl0rKD89KFs9fn1cXHNcXC8uKV0pKSkpLywvXig/OlxcW1teXFxdXSpcXF0pLywvXig/Oi4pLywvXig/OiQpL107XG5sZXhlci5jb25kaXRpb25zID0ge1wibXVcIjp7XCJydWxlc1wiOls0LDUsNiw3LDgsOSwxMCwxMSwxMiwxMywxNCwxNSwxNiwxNywxOCwxOSwyMCwyMSwyMiwyMywyNCwyNSwyNiwyNywyOCwyOSwzMCwzMSwzMl0sXCJpbmNsdXNpdmVcIjpmYWxzZX0sXCJlbXVcIjp7XCJydWxlc1wiOlsyXSxcImluY2x1c2l2ZVwiOmZhbHNlfSxcImNvbVwiOntcInJ1bGVzXCI6WzNdLFwiaW5jbHVzaXZlXCI6ZmFsc2V9LFwiSU5JVElBTFwiOntcInJ1bGVzXCI6WzAsMSwzMl0sXCJpbmNsdXNpdmVcIjp0cnVlfX07XG5yZXR1cm4gbGV4ZXI7fSkoKVxucGFyc2VyLmxleGVyID0gbGV4ZXI7XG5mdW5jdGlvbiBQYXJzZXIgKCkgeyB0aGlzLnl5ID0ge307IH1QYXJzZXIucHJvdG90eXBlID0gcGFyc2VyO3BhcnNlci5QYXJzZXIgPSBQYXJzZXI7XG5yZXR1cm4gbmV3IFBhcnNlcjtcbn0pKCk7ZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBoYW5kbGViYXJzO1xuLyoganNoaW50IGlnbm9yZTplbmQgKi8iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBWaXNpdG9yID0gcmVxdWlyZShcIi4vdmlzaXRvclwiKVtcImRlZmF1bHRcIl07XG5cbmZ1bmN0aW9uIHByaW50KGFzdCkge1xuICByZXR1cm4gbmV3IFByaW50VmlzaXRvcigpLmFjY2VwdChhc3QpO1xufVxuXG5leHBvcnRzLnByaW50ID0gcHJpbnQ7ZnVuY3Rpb24gUHJpbnRWaXNpdG9yKCkge1xuICB0aGlzLnBhZGRpbmcgPSAwO1xufVxuXG5leHBvcnRzLlByaW50VmlzaXRvciA9IFByaW50VmlzaXRvcjtQcmludFZpc2l0b3IucHJvdG90eXBlID0gbmV3IFZpc2l0b3IoKTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wYWQgPSBmdW5jdGlvbihzdHJpbmcsIG5ld2xpbmUpIHtcbiAgdmFyIG91dCA9IFwiXCI7XG5cbiAgZm9yKHZhciBpPTAsbD10aGlzLnBhZGRpbmc7IGk8bDsgaSsrKSB7XG4gICAgb3V0ID0gb3V0ICsgXCIgIFwiO1xuICB9XG5cbiAgb3V0ID0gb3V0ICsgc3RyaW5nO1xuXG4gIGlmKG5ld2xpbmUgIT09IGZhbHNlKSB7IG91dCA9IG91dCArIFwiXFxuXCI7IH1cbiAgcmV0dXJuIG91dDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUucHJvZ3JhbSA9IGZ1bmN0aW9uKHByb2dyYW0pIHtcbiAgdmFyIG91dCA9IFwiXCIsXG4gICAgICBzdGF0ZW1lbnRzID0gcHJvZ3JhbS5zdGF0ZW1lbnRzLFxuICAgICAgaSwgbDtcblxuICBmb3IoaT0wLCBsPXN0YXRlbWVudHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KHN0YXRlbWVudHNbaV0pO1xuICB9XG5cbiAgdGhpcy5wYWRkaW5nLS07XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuYmxvY2sgPSBmdW5jdGlvbihibG9jaykge1xuICB2YXIgb3V0ID0gXCJcIjtcblxuICBvdXQgPSBvdXQgKyB0aGlzLnBhZChcIkJMT0NLOlwiKTtcbiAgdGhpcy5wYWRkaW5nKys7XG4gIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KGJsb2NrLm11c3RhY2hlKTtcbiAgaWYgKGJsb2NrLnByb2dyYW0pIHtcbiAgICBvdXQgPSBvdXQgKyB0aGlzLnBhZChcIlBST0dSQU06XCIpO1xuICAgIHRoaXMucGFkZGluZysrO1xuICAgIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KGJsb2NrLnByb2dyYW0pO1xuICAgIHRoaXMucGFkZGluZy0tO1xuICB9XG4gIGlmIChibG9jay5pbnZlcnNlKSB7XG4gICAgaWYgKGJsb2NrLnByb2dyYW0pIHsgdGhpcy5wYWRkaW5nKys7IH1cbiAgICBvdXQgPSBvdXQgKyB0aGlzLnBhZChcInt7Xn19XCIpO1xuICAgIHRoaXMucGFkZGluZysrO1xuICAgIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KGJsb2NrLmludmVyc2UpO1xuICAgIHRoaXMucGFkZGluZy0tO1xuICAgIGlmIChibG9jay5wcm9ncmFtKSB7IHRoaXMucGFkZGluZy0tOyB9XG4gIH1cbiAgdGhpcy5wYWRkaW5nLS07XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuc2V4cHIgPSBmdW5jdGlvbihzZXhwcikge1xuICB2YXIgcGFyYW1zID0gc2V4cHIucGFyYW1zLCBwYXJhbVN0cmluZ3MgPSBbXSwgaGFzaDtcblxuICBmb3IodmFyIGk9MCwgbD1wYXJhbXMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgIHBhcmFtU3RyaW5ncy5wdXNoKHRoaXMuYWNjZXB0KHBhcmFtc1tpXSkpO1xuICB9XG5cbiAgcGFyYW1zID0gXCJbXCIgKyBwYXJhbVN0cmluZ3Muam9pbihcIiwgXCIpICsgXCJdXCI7XG5cbiAgaGFzaCA9IHNleHByLmhhc2ggPyBcIiBcIiArIHRoaXMuYWNjZXB0KHNleHByLmhhc2gpIDogXCJcIjtcblxuICByZXR1cm4gdGhpcy5hY2NlcHQoc2V4cHIuaWQpICsgXCIgXCIgKyBwYXJhbXMgKyBoYXNoO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5tdXN0YWNoZSA9IGZ1bmN0aW9uKG11c3RhY2hlKSB7XG4gIHJldHVybiB0aGlzLnBhZChcInt7IFwiICsgdGhpcy5hY2NlcHQobXVzdGFjaGUuc2V4cHIpICsgXCIgfX1cIik7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLnBhcnRpYWwgPSBmdW5jdGlvbihwYXJ0aWFsKSB7XG4gIHZhciBjb250ZW50ID0gdGhpcy5hY2NlcHQocGFydGlhbC5wYXJ0aWFsTmFtZSk7XG4gIGlmKHBhcnRpYWwuY29udGV4dCkgeyBjb250ZW50ID0gY29udGVudCArIFwiIFwiICsgdGhpcy5hY2NlcHQocGFydGlhbC5jb250ZXh0KTsgfVxuICByZXR1cm4gdGhpcy5wYWQoXCJ7ez4gXCIgKyBjb250ZW50ICsgXCIgfX1cIik7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLmhhc2ggPSBmdW5jdGlvbihoYXNoKSB7XG4gIHZhciBwYWlycyA9IGhhc2gucGFpcnM7XG4gIHZhciBqb2luZWRQYWlycyA9IFtdLCBsZWZ0LCByaWdodDtcblxuICBmb3IodmFyIGk9MCwgbD1wYWlycy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgbGVmdCA9IHBhaXJzW2ldWzBdO1xuICAgIHJpZ2h0ID0gdGhpcy5hY2NlcHQocGFpcnNbaV1bMV0pO1xuICAgIGpvaW5lZFBhaXJzLnB1c2goIGxlZnQgKyBcIj1cIiArIHJpZ2h0ICk7XG4gIH1cblxuICByZXR1cm4gXCJIQVNIe1wiICsgam9pbmVkUGFpcnMuam9pbihcIiwgXCIpICsgXCJ9XCI7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLlNUUklORyA9IGZ1bmN0aW9uKHN0cmluZykge1xuICByZXR1cm4gJ1wiJyArIHN0cmluZy5zdHJpbmcgKyAnXCInO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5JTlRFR0VSID0gZnVuY3Rpb24oaW50ZWdlcikge1xuICByZXR1cm4gXCJJTlRFR0VSe1wiICsgaW50ZWdlci5pbnRlZ2VyICsgXCJ9XCI7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLkJPT0xFQU4gPSBmdW5jdGlvbihib29sKSB7XG4gIHJldHVybiBcIkJPT0xFQU57XCIgKyBib29sLmJvb2wgKyBcIn1cIjtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuSUQgPSBmdW5jdGlvbihpZCkge1xuICB2YXIgcGF0aCA9IGlkLnBhcnRzLmpvaW4oXCIvXCIpO1xuICBpZihpZC5wYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgcmV0dXJuIFwiUEFUSDpcIiArIHBhdGg7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFwiSUQ6XCIgKyBwYXRoO1xuICB9XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLlBBUlRJQUxfTkFNRSA9IGZ1bmN0aW9uKHBhcnRpYWxOYW1lKSB7XG4gICAgcmV0dXJuIFwiUEFSVElBTDpcIiArIHBhcnRpYWxOYW1lLm5hbWU7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLkRBVEEgPSBmdW5jdGlvbihkYXRhKSB7XG4gIHJldHVybiBcIkBcIiArIHRoaXMuYWNjZXB0KGRhdGEuaWQpO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5jb250ZW50ID0gZnVuY3Rpb24oY29udGVudCkge1xuICByZXR1cm4gdGhpcy5wYWQoXCJDT05URU5UWyAnXCIgKyBjb250ZW50LnN0cmluZyArIFwiJyBdXCIpO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5jb21tZW50ID0gZnVuY3Rpb24oY29tbWVudCkge1xuICByZXR1cm4gdGhpcy5wYWQoXCJ7eyEgJ1wiICsgY29tbWVudC5jb21tZW50ICsgXCInIH19XCIpO1xufTsiLCJcInVzZSBzdHJpY3RcIjtcbmZ1bmN0aW9uIFZpc2l0b3IoKSB7fVxuXG5WaXNpdG9yLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFZpc2l0b3IsXG5cbiAgYWNjZXB0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gdGhpc1tvYmplY3QudHlwZV0ob2JqZWN0KTtcbiAgfVxufTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBWaXNpdG9yOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgZXJyb3JQcm9wcyA9IFsnZGVzY3JpcHRpb24nLCAnZmlsZU5hbWUnLCAnbGluZU51bWJlcicsICdtZXNzYWdlJywgJ25hbWUnLCAnbnVtYmVyJywgJ3N0YWNrJ107XG5cbmZ1bmN0aW9uIEV4Y2VwdGlvbihtZXNzYWdlLCBub2RlKSB7XG4gIHZhciBsaW5lO1xuICBpZiAobm9kZSAmJiBub2RlLmZpcnN0TGluZSkge1xuICAgIGxpbmUgPSBub2RlLmZpcnN0TGluZTtcblxuICAgIG1lc3NhZ2UgKz0gJyAtICcgKyBsaW5lICsgJzonICsgbm9kZS5maXJzdENvbHVtbjtcbiAgfVxuXG4gIHZhciB0bXAgPSBFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IuY2FsbCh0aGlzLCBtZXNzYWdlKTtcblxuICAvLyBVbmZvcnR1bmF0ZWx5IGVycm9ycyBhcmUgbm90IGVudW1lcmFibGUgaW4gQ2hyb21lIChhdCBsZWFzdCksIHNvIGBmb3IgcHJvcCBpbiB0bXBgIGRvZXNuJ3Qgd29yay5cbiAgZm9yICh2YXIgaWR4ID0gMDsgaWR4IDwgZXJyb3JQcm9wcy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgdGhpc1tlcnJvclByb3BzW2lkeF1dID0gdG1wW2Vycm9yUHJvcHNbaWR4XV07XG4gIH1cblxuICBpZiAobGluZSkge1xuICAgIHRoaXMubGluZU51bWJlciA9IGxpbmU7XG4gICAgdGhpcy5jb2x1bW4gPSBub2RlLmZpcnN0Q29sdW1uO1xuICB9XG59XG5cbkV4Y2VwdGlvbi5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBFeGNlcHRpb247IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgVXRpbHMgPSByZXF1aXJlKFwiLi91dGlsc1wiKTtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xudmFyIENPTVBJTEVSX1JFVklTSU9OID0gcmVxdWlyZShcIi4vYmFzZVwiKS5DT01QSUxFUl9SRVZJU0lPTjtcbnZhciBSRVZJU0lPTl9DSEFOR0VTID0gcmVxdWlyZShcIi4vYmFzZVwiKS5SRVZJU0lPTl9DSEFOR0VTO1xuXG5mdW5jdGlvbiBjaGVja1JldmlzaW9uKGNvbXBpbGVySW5mbykge1xuICB2YXIgY29tcGlsZXJSZXZpc2lvbiA9IGNvbXBpbGVySW5mbyAmJiBjb21waWxlckluZm9bMF0gfHwgMSxcbiAgICAgIGN1cnJlbnRSZXZpc2lvbiA9IENPTVBJTEVSX1JFVklTSU9OO1xuXG4gIGlmIChjb21waWxlclJldmlzaW9uICE9PSBjdXJyZW50UmV2aXNpb24pIHtcbiAgICBpZiAoY29tcGlsZXJSZXZpc2lvbiA8IGN1cnJlbnRSZXZpc2lvbikge1xuICAgICAgdmFyIHJ1bnRpbWVWZXJzaW9ucyA9IFJFVklTSU9OX0NIQU5HRVNbY3VycmVudFJldmlzaW9uXSxcbiAgICAgICAgICBjb21waWxlclZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tjb21waWxlclJldmlzaW9uXTtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUZW1wbGF0ZSB3YXMgcHJlY29tcGlsZWQgd2l0aCBhbiBvbGRlciB2ZXJzaW9uIG9mIEhhbmRsZWJhcnMgdGhhbiB0aGUgY3VycmVudCBydW50aW1lLiBcIitcbiAgICAgICAgICAgIFwiUGxlYXNlIHVwZGF0ZSB5b3VyIHByZWNvbXBpbGVyIHRvIGEgbmV3ZXIgdmVyc2lvbiAoXCIrcnVudGltZVZlcnNpb25zK1wiKSBvciBkb3duZ3JhZGUgeW91ciBydW50aW1lIHRvIGFuIG9sZGVyIHZlcnNpb24gKFwiK2NvbXBpbGVyVmVyc2lvbnMrXCIpLlwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIHRoZSBlbWJlZGRlZCB2ZXJzaW9uIGluZm8gc2luY2UgdGhlIHJ1bnRpbWUgZG9lc24ndCBrbm93IGFib3V0IHRoaXMgcmV2aXNpb24geWV0XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGVtcGxhdGUgd2FzIHByZWNvbXBpbGVkIHdpdGggYSBuZXdlciB2ZXJzaW9uIG9mIEhhbmRsZWJhcnMgdGhhbiB0aGUgY3VycmVudCBydW50aW1lLiBcIitcbiAgICAgICAgICAgIFwiUGxlYXNlIHVwZGF0ZSB5b3VyIHJ1bnRpbWUgdG8gYSBuZXdlciB2ZXJzaW9uIChcIitjb21waWxlckluZm9bMV0rXCIpLlwiKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0cy5jaGVja1JldmlzaW9uID0gY2hlY2tSZXZpc2lvbjsvLyBUT0RPOiBSZW1vdmUgdGhpcyBsaW5lIGFuZCBicmVhayB1cCBjb21waWxlUGFydGlhbFxuXG5mdW5jdGlvbiB0ZW1wbGF0ZSh0ZW1wbGF0ZVNwZWMsIGVudikge1xuICBpZiAoIWVudikge1xuICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJObyBlbnZpcm9ubWVudCBwYXNzZWQgdG8gdGVtcGxhdGVcIik7XG4gIH1cblxuICAvLyBOb3RlOiBVc2luZyBlbnYuVk0gcmVmZXJlbmNlcyByYXRoZXIgdGhhbiBsb2NhbCB2YXIgcmVmZXJlbmNlcyB0aHJvdWdob3V0IHRoaXMgc2VjdGlvbiB0byBhbGxvd1xuICAvLyBmb3IgZXh0ZXJuYWwgdXNlcnMgdG8gb3ZlcnJpZGUgdGhlc2UgYXMgcHN1ZWRvLXN1cHBvcnRlZCBBUElzLlxuICB2YXIgaW52b2tlUGFydGlhbFdyYXBwZXIgPSBmdW5jdGlvbihwYXJ0aWFsLCBuYW1lLCBjb250ZXh0LCBoZWxwZXJzLCBwYXJ0aWFscywgZGF0YSkge1xuICAgIHZhciByZXN1bHQgPSBlbnYuVk0uaW52b2tlUGFydGlhbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIGlmIChyZXN1bHQgIT0gbnVsbCkgeyByZXR1cm4gcmVzdWx0OyB9XG5cbiAgICBpZiAoZW52LmNvbXBpbGUpIHtcbiAgICAgIHZhciBvcHRpb25zID0geyBoZWxwZXJzOiBoZWxwZXJzLCBwYXJ0aWFsczogcGFydGlhbHMsIGRhdGE6IGRhdGEgfTtcbiAgICAgIHBhcnRpYWxzW25hbWVdID0gZW52LmNvbXBpbGUocGFydGlhbCwgeyBkYXRhOiBkYXRhICE9PSB1bmRlZmluZWQgfSwgZW52KTtcbiAgICAgIHJldHVybiBwYXJ0aWFsc1tuYW1lXShjb250ZXh0LCBvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRoZSBwYXJ0aWFsIFwiICsgbmFtZSArIFwiIGNvdWxkIG5vdCBiZSBjb21waWxlZCB3aGVuIHJ1bm5pbmcgaW4gcnVudGltZS1vbmx5IG1vZGVcIik7XG4gICAgfVxuICB9O1xuXG4gIC8vIEp1c3QgYWRkIHdhdGVyXG4gIHZhciBjb250YWluZXIgPSB7XG4gICAgZXNjYXBlRXhwcmVzc2lvbjogVXRpbHMuZXNjYXBlRXhwcmVzc2lvbixcbiAgICBpbnZva2VQYXJ0aWFsOiBpbnZva2VQYXJ0aWFsV3JhcHBlcixcbiAgICBwcm9ncmFtczogW10sXG4gICAgcHJvZ3JhbTogZnVuY3Rpb24oaSwgZm4sIGRhdGEpIHtcbiAgICAgIHZhciBwcm9ncmFtV3JhcHBlciA9IHRoaXMucHJvZ3JhbXNbaV07XG4gICAgICBpZihkYXRhKSB7XG4gICAgICAgIHByb2dyYW1XcmFwcGVyID0gcHJvZ3JhbShpLCBmbiwgZGF0YSk7XG4gICAgICB9IGVsc2UgaWYgKCFwcm9ncmFtV3JhcHBlcikge1xuICAgICAgICBwcm9ncmFtV3JhcHBlciA9IHRoaXMucHJvZ3JhbXNbaV0gPSBwcm9ncmFtKGksIGZuKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwcm9ncmFtV3JhcHBlcjtcbiAgICB9LFxuICAgIG1lcmdlOiBmdW5jdGlvbihwYXJhbSwgY29tbW9uKSB7XG4gICAgICB2YXIgcmV0ID0gcGFyYW0gfHwgY29tbW9uO1xuXG4gICAgICBpZiAocGFyYW0gJiYgY29tbW9uICYmIChwYXJhbSAhPT0gY29tbW9uKSkge1xuICAgICAgICByZXQgPSB7fTtcbiAgICAgICAgVXRpbHMuZXh0ZW5kKHJldCwgY29tbW9uKTtcbiAgICAgICAgVXRpbHMuZXh0ZW5kKHJldCwgcGFyYW0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9LFxuICAgIHByb2dyYW1XaXRoRGVwdGg6IGVudi5WTS5wcm9ncmFtV2l0aERlcHRoLFxuICAgIG5vb3A6IGVudi5WTS5ub29wLFxuICAgIGNvbXBpbGVySW5mbzogbnVsbFxuICB9O1xuXG4gIHJldHVybiBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIG5hbWVzcGFjZSA9IG9wdGlvbnMucGFydGlhbCA/IG9wdGlvbnMgOiBlbnYsXG4gICAgICAgIGhlbHBlcnMsXG4gICAgICAgIHBhcnRpYWxzO1xuXG4gICAgaWYgKCFvcHRpb25zLnBhcnRpYWwpIHtcbiAgICAgIGhlbHBlcnMgPSBvcHRpb25zLmhlbHBlcnM7XG4gICAgICBwYXJ0aWFscyA9IG9wdGlvbnMucGFydGlhbHM7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSB0ZW1wbGF0ZVNwZWMuY2FsbChcbiAgICAgICAgICBjb250YWluZXIsXG4gICAgICAgICAgbmFtZXNwYWNlLCBjb250ZXh0LFxuICAgICAgICAgIGhlbHBlcnMsXG4gICAgICAgICAgcGFydGlhbHMsXG4gICAgICAgICAgb3B0aW9ucy5kYXRhKTtcblxuICAgIGlmICghb3B0aW9ucy5wYXJ0aWFsKSB7XG4gICAgICBlbnYuVk0uY2hlY2tSZXZpc2lvbihjb250YWluZXIuY29tcGlsZXJJbmZvKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnRzLnRlbXBsYXRlID0gdGVtcGxhdGU7ZnVuY3Rpb24gcHJvZ3JhbVdpdGhEZXB0aChpLCBmbiwgZGF0YSAvKiwgJGRlcHRoICovKSB7XG4gIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcblxuICB2YXIgcHJvZyA9IGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBbY29udGV4dCwgb3B0aW9ucy5kYXRhIHx8IGRhdGFdLmNvbmNhdChhcmdzKSk7XG4gIH07XG4gIHByb2cucHJvZ3JhbSA9IGk7XG4gIHByb2cuZGVwdGggPSBhcmdzLmxlbmd0aDtcbiAgcmV0dXJuIHByb2c7XG59XG5cbmV4cG9ydHMucHJvZ3JhbVdpdGhEZXB0aCA9IHByb2dyYW1XaXRoRGVwdGg7ZnVuY3Rpb24gcHJvZ3JhbShpLCBmbiwgZGF0YSkge1xuICB2YXIgcHJvZyA9IGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHJldHVybiBmbihjb250ZXh0LCBvcHRpb25zLmRhdGEgfHwgZGF0YSk7XG4gIH07XG4gIHByb2cucHJvZ3JhbSA9IGk7XG4gIHByb2cuZGVwdGggPSAwO1xuICByZXR1cm4gcHJvZztcbn1cblxuZXhwb3J0cy5wcm9ncmFtID0gcHJvZ3JhbTtmdW5jdGlvbiBpbnZva2VQYXJ0aWFsKHBhcnRpYWwsIG5hbWUsIGNvbnRleHQsIGhlbHBlcnMsIHBhcnRpYWxzLCBkYXRhKSB7XG4gIHZhciBvcHRpb25zID0geyBwYXJ0aWFsOiB0cnVlLCBoZWxwZXJzOiBoZWxwZXJzLCBwYXJ0aWFsczogcGFydGlhbHMsIGRhdGE6IGRhdGEgfTtcblxuICBpZihwYXJ0aWFsID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGhlIHBhcnRpYWwgXCIgKyBuYW1lICsgXCIgY291bGQgbm90IGJlIGZvdW5kXCIpO1xuICB9IGVsc2UgaWYocGFydGlhbCBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIHBhcnRpYWwoY29udGV4dCwgb3B0aW9ucyk7XG4gIH1cbn1cblxuZXhwb3J0cy5pbnZva2VQYXJ0aWFsID0gaW52b2tlUGFydGlhbDtmdW5jdGlvbiBub29wKCkgeyByZXR1cm4gXCJcIjsgfVxuXG5leHBvcnRzLm5vb3AgPSBub29wOyIsIlwidXNlIHN0cmljdFwiO1xuLy8gQnVpbGQgb3V0IG91ciBiYXNpYyBTYWZlU3RyaW5nIHR5cGVcbmZ1bmN0aW9uIFNhZmVTdHJpbmcoc3RyaW5nKSB7XG4gIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xufVxuXG5TYWZlU3RyaW5nLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJcIiArIHRoaXMuc3RyaW5nO1xufTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBTYWZlU3RyaW5nOyIsIlwidXNlIHN0cmljdFwiO1xuLypqc2hpbnQgLVcwMDQgKi9cbnZhciBTYWZlU3RyaW5nID0gcmVxdWlyZShcIi4vc2FmZS1zdHJpbmdcIilbXCJkZWZhdWx0XCJdO1xuXG52YXIgZXNjYXBlID0ge1xuICBcIiZcIjogXCImYW1wO1wiLFxuICBcIjxcIjogXCImbHQ7XCIsXG4gIFwiPlwiOiBcIiZndDtcIixcbiAgJ1wiJzogXCImcXVvdDtcIixcbiAgXCInXCI6IFwiJiN4Mjc7XCIsXG4gIFwiYFwiOiBcIiYjeDYwO1wiXG59O1xuXG52YXIgYmFkQ2hhcnMgPSAvWyY8PlwiJ2BdL2c7XG52YXIgcG9zc2libGUgPSAvWyY8PlwiJ2BdLztcblxuZnVuY3Rpb24gZXNjYXBlQ2hhcihjaHIpIHtcbiAgcmV0dXJuIGVzY2FwZVtjaHJdIHx8IFwiJmFtcDtcIjtcbn1cblxuZnVuY3Rpb24gZXh0ZW5kKG9iaiwgdmFsdWUpIHtcbiAgZm9yKHZhciBrZXkgaW4gdmFsdWUpIHtcbiAgICBpZihPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIGtleSkpIHtcbiAgICAgIG9ialtrZXldID0gdmFsdWVba2V5XTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0cy5leHRlbmQgPSBleHRlbmQ7dmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbmV4cG9ydHMudG9TdHJpbmcgPSB0b1N0cmluZztcbi8vIFNvdXJjZWQgZnJvbSBsb2Rhc2hcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXN0aWVqcy9sb2Rhc2gvYmxvYi9tYXN0ZXIvTElDRU5TRS50eHRcbnZhciBpc0Z1bmN0aW9uID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJztcbn07XG4vLyBmYWxsYmFjayBmb3Igb2xkZXIgdmVyc2lvbnMgb2YgQ2hyb21lIGFuZCBTYWZhcmlcbmlmIChpc0Z1bmN0aW9uKC94LykpIHtcbiAgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbiAgfTtcbn1cbnZhciBpc0Z1bmN0aW9uO1xuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpID8gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IEFycmF5XScgOiBmYWxzZTtcbn07XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBlc2NhcGVFeHByZXNzaW9uKHN0cmluZykge1xuICAvLyBkb24ndCBlc2NhcGUgU2FmZVN0cmluZ3MsIHNpbmNlIHRoZXkncmUgYWxyZWFkeSBzYWZlXG4gIGlmIChzdHJpbmcgaW5zdGFuY2VvZiBTYWZlU3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy50b1N0cmluZygpO1xuICB9IGVsc2UgaWYgKCFzdHJpbmcgJiYgc3RyaW5nICE9PSAwKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cblxuICAvLyBGb3JjZSBhIHN0cmluZyBjb252ZXJzaW9uIGFzIHRoaXMgd2lsbCBiZSBkb25lIGJ5IHRoZSBhcHBlbmQgcmVnYXJkbGVzcyBhbmRcbiAgLy8gdGhlIHJlZ2V4IHRlc3Qgd2lsbCBkbyB0aGlzIHRyYW5zcGFyZW50bHkgYmVoaW5kIHRoZSBzY2VuZXMsIGNhdXNpbmcgaXNzdWVzIGlmXG4gIC8vIGFuIG9iamVjdCdzIHRvIHN0cmluZyBoYXMgZXNjYXBlZCBjaGFyYWN0ZXJzIGluIGl0LlxuICBzdHJpbmcgPSBcIlwiICsgc3RyaW5nO1xuXG4gIGlmKCFwb3NzaWJsZS50ZXN0KHN0cmluZykpIHsgcmV0dXJuIHN0cmluZzsgfVxuICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoYmFkQ2hhcnMsIGVzY2FwZUNoYXIpO1xufVxuXG5leHBvcnRzLmVzY2FwZUV4cHJlc3Npb24gPSBlc2NhcGVFeHByZXNzaW9uO2Z1bmN0aW9uIGlzRW1wdHkodmFsdWUpIHtcbiAgaWYgKCF2YWx1ZSAmJiB2YWx1ZSAhPT0gMCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnRzLmlzRW1wdHkgPSBpc0VtcHR5OyIsIi8vIFVTQUdFOlxuLy8gdmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYW5kbGViYXJzJyk7XG5cbi8vIHZhciBsb2NhbCA9IGhhbmRsZWJhcnMuY3JlYXRlKCk7XG5cbnZhciBoYW5kbGViYXJzID0gcmVxdWlyZSgnLi4vZGlzdC9janMvaGFuZGxlYmFycycpW1wiZGVmYXVsdFwiXTtcblxuaGFuZGxlYmFycy5WaXNpdG9yID0gcmVxdWlyZSgnLi4vZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci92aXNpdG9yJylbXCJkZWZhdWx0XCJdO1xuXG52YXIgcHJpbnRlciA9IHJlcXVpcmUoJy4uL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvcHJpbnRlcicpO1xuaGFuZGxlYmFycy5QcmludFZpc2l0b3IgPSBwcmludGVyLlByaW50VmlzaXRvcjtcbmhhbmRsZWJhcnMucHJpbnQgPSBwcmludGVyLnByaW50O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZWJhcnM7XG5cbi8vIFB1Ymxpc2ggYSBOb2RlLmpzIHJlcXVpcmUoKSBoYW5kbGVyIGZvciAuaGFuZGxlYmFycyBhbmQgLmhicyBmaWxlc1xuaWYgKHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJyAmJiByZXF1aXJlLmV4dGVuc2lvbnMpIHtcbiAgdmFyIGV4dGVuc2lvbiA9IGZ1bmN0aW9uKG1vZHVsZSwgZmlsZW5hbWUpIHtcbiAgICB2YXIgZnMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgdmFyIHRlbXBsYXRlU3RyaW5nID0gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCBcInV0ZjhcIik7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBoYW5kbGViYXJzLmNvbXBpbGUodGVtcGxhdGVTdHJpbmcpO1xuICB9O1xuICByZXF1aXJlLmV4dGVuc2lvbnNbXCIuaGFuZGxlYmFyc1wiXSA9IGV4dGVuc2lvbjtcbiAgcmVxdWlyZS5leHRlbnNpb25zW1wiLmhic1wiXSA9IGV4dGVuc2lvbjtcbn1cbiIsIi8vIENyZWF0ZSBhIHNpbXBsZSBwYXRoIGFsaWFzIHRvIGFsbG93IGJyb3dzZXJpZnkgdG8gcmVzb2x2ZVxuLy8gdGhlIHJ1bnRpbWUgb24gYSBzdXBwb3J0ZWQgcGF0aC5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kaXN0L2Nqcy9oYW5kbGViYXJzLnJ1bnRpbWUnKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImhhbmRsZWJhcnMvcnVudGltZVwiKVtcImRlZmF1bHRcIl07XG4iLCJvYmplY3QgPSB7fVxubW9kdWxlLmV4cG9ydHMgPSBvYmplY3RcblxuXG4jIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI1xuIyMjICAgUEFSTEVZLkpTIENIQVQgTElCUkFSWSBFWFRST0RJTkFJUkUgICAjIyNcbiMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG5cblxuIyMgdGhpcyBpcyB0aGUgY29udHJ1Y3RvciBmb3IgdGhlIGdsb2JhbCBvYmplY3QgdGhhdCB3aGVuIGluaXRpYWxpemVkXG4jIyBleGVjdXRlcyBhbGwgbmVjY2VzYXJ5IG9wZXJhdGlvbnMgdG8gZ2V0IHRoaXMgdHJhaW4gbW92aW5nLlxuY2xhc3MgQXBwXG5cbiAgY29uc3RydWN0b3I6IC0+XG4gICAgQGN1cnJlbnRfdXNlcnMgPSBbXVxuICAgIEBvcGVuX2NvbnZlcnNhdGlvbnMgPSBbXVxuICAgIEBjb252ZXJzYXRpb25zID0gW11cblxuICAgICMjIGR1bW15IG9iamVjdCB1c2VkIGZvciBwdWIvc3ViXG4gICAgQHB1Yl9zdWIgPSAkKHt9KVxuXG4gICAgIyMgaW5zZXJ0IHNjcmlwdCBmb3Igc29ja2V0LmlvIGNvbm5lY3Rpb25zXG4gICAgZG8gLT5cbiAgICAgIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpXG4gICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnXG4gICAgICBzY3JpcHQuYXN5bmMgPSB0cnVlXG4gICAgICBzY3JpcHQuc3JjID0gXCIvc29ja2V0LmlvL3NvY2tldC5pby5qc1wiXG4gICAgICBzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdXG4gICAgICBzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHNjcmlwdCwgcylcblxuICAgICMjIGluc2VydCBzY3JpcHQgZm9yIGdvb2dsZSBwbHVzIHNpZ25pblxuICAgIGRvIC0+XG4gICAgICBwbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpXG4gICAgICBwby50eXBlID0gJ3RleHQvamF2YXNjcmlwdCdcbiAgICAgIHBvLmFzeW5jID0gdHJ1ZVxuICAgICAgcG8uc3JjID0gJ2h0dHBzOi8vYXBpcy5nb29nbGUuY29tL2pzL2NsaWVudDpwbHVzb25lLmpzJ1xuICAgICAgcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXVxuICAgICAgcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShwbywgcylcblxuICAgICMjIGZvciBzZXR0aW5nIGFuZCBjbGVhcmluZyBicm93c2VyIHRhYiBhbGVydHNcbiAgICBAdGl0bGVfbm90aWZpY2F0aW9uID1cbiAgICAgICAgICAgICAgICAgICAgICBub3RpZmllZDogZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICBwYWdlX3RpdGxlOiAkKCdodG1sIHRpdGxlJykuaHRtbCgpXG4gICAgIyMgbGlzdGVuIGZvciBwZXJzaXN0ZW50IGNvbnZlcnNhdGlvbnMgZnJvbSB0aGUgc2VydmVyIG9uIGxvYWQuXG4gICAgIyMgd2lsbCBiZSBzZW50IGluIG9uZSBhdCBhIHRpbWUgZnJvbSByZWRpcyBvbiBsb2FkLlxuICAgIEBzZXJ2ZXIub24gJ3BlcnNpc3RlbnRfY29udm8nLCBAbG9hZF9wZXJzaXN0ZW50X2NvbnZvLmJpbmQodGhpcylcbiAgICAjIyBsaXN0ZW5zIGZvciBtZXNzYWdlcyBzZW5kIHRvIGNsb3NlZCBjb252ZXJzYXRpb25zIG9yIG5ldyBjb252ZXJzYXRpb25zXG4gICAgQHNlcnZlci5vbiAnbWVzc2FnZScsIEB1cGRhdGVfcGVyc2lzdGVudF9jb252b3MuYmluZCh0aGlzKVxuXG4gICAgIyMgbGlzdGVucyBmb3IgY3VycmVudCB1c2VycyBhcnJheSBmcm9tIHNlcnZlclxuICAgIEBzZXJ2ZXIub24gJ2N1cnJlbnRfdXNlcnMnLCBAbG9hZF9jdXJyZW50X3VzZXJzLmJpbmQodGhpcylcbiAgICBAc2VydmVyLm9uICd1c2VyX2xvZ2dlZF9vbicsIEB1c2VyX2xvZ2dlZF9vbi5iaW5kKHRoaXMpXG4gICAgQHNlcnZlci5vbiAndXNlcl9sb2dnZWRfb2ZmJywgQHVzZXJfbG9nZ2VkX29mZi5iaW5kKHRoaXMpXG5cbiAgc2VydmVyOiBpby5jb25uZWN0KCd3c3M6Ly8nICsgd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lKVxuXG5cbiAgbG9hZF9wZXJzaXN0ZW50X2NvbnZvOiAoY29udm9fcGFydG5lcnMsIG1lc3NhZ2VzKSAtPlxuICAgIHBhcnNlZF9tZXNzYWdlcyA9IFtdXG4gICAgcGFyc2VkX2NvbnZvX3BhcnRuZXJzID0gW11cbiAgICBmb3IgcGFydG5lciBpbiBjb252b19wYXJ0bmVyc1xuICAgICAgbmV3X3BhcnRuZXIgPSBuZXcgVXNlcihwYXJ0bmVyLmRpc3BsYXlfbmFtZSwgcGFydG5lci5pbWFnZV91cmwpXG4gICAgICBwYXJzZWRfY29udm9fcGFydG5lcnMucHVzaChuZXdfcGFydG5lcilcbiAgICBmb3IgbWVzc2FnZSBpbiBtZXNzYWdlc1xuICAgICAgcGFyc2VkID0gSlNPTi5wYXJzZShtZXNzYWdlKVxuICAgICAgbmV3X21lc3NhZ2UgPSBuZXcgTWVzc2FnZShwYXJzZWQucmVjaXBpZW50cywgcGFyc2VkLnNlbmRlciwgcGFyc2VkLmNvbnRlbnQsIHBhcnNlZC5pbWFnZSwgcGFyc2VkLnRpbWVfc3RhbXApXG4gICAgICBwYXJzZWRfbWVzc2FnZXMucHVzaChuZXdfbWVzc2FnZSlcblxuICAgICMjIGNyZWF0ZSBuZXcgY29udmVyc2F0aW9uIG9iamVjdCBmcm9tIHBlcnNpc3RlbnQgY29udmVyc2F0aW9uIGluZm9cbiAgICBuZXdfY29udm8gPSBuZXcgQ29udmVyc2F0aW9uKHBhcnNlZF9jb252b19wYXJ0bmVycywgcGFyc2VkX21lc3NhZ2VzKVxuICAgIEBzb3J0X2luY29taW5nX2NvbnZvKG5ld19jb252bylcblxuICBzb3J0X2luY29taW5nX2NvbnZvOiAobmV3X2NvbnZvKSAtPlxuICAgICMjIHNvcnQgY29udm9zIGFzIHRoZXkgY29tZSBpbiBieSB0aW1lIG9mIGxhc3QgbWVzc2FnZVxuICAgIGlmIEBjb252ZXJzYXRpb25zLmxlbmd0aCBpcyAwXG4gICAgICBAY29udmVyc2F0aW9ucy5wdXNoKG5ld19jb252bylcbiAgICAgIHJldHVyblxuICAgIGZvciBjb252bywgaSBpbiBAY29udmVyc2F0aW9uc1xuICAgICAgaWYgY29udm8ubWVzc2FnZXNbY29udm8ubWVzc2FnZXMubGVuZ3RoIC0gMV0udGltZV9zdGFtcCA8IG5ld19jb252by5tZXNzYWdlc1tuZXdfY29udm8ubWVzc2FnZXMubGVuZ3RoIC0gMV0udGltZV9zdGFtcFxuICAgICAgICBAY29udmVyc2F0aW9ucy5zcGxpY2UoaSwgMCwgbmV3X2NvbnZvKVxuICAgICAgICByZXR1cm5cbiAgICAgIGlmIGkgaXMgQGNvbnZlcnNhdGlvbnMubGVuZ3RoIC0gMVxuICAgICAgICBAY29udmVyc2F0aW9ucy5wdXNoKG5ld19jb252bylcbiAgICAgICAgcmV0dXJuXG5cblxuICB1cGRhdGVfcGVyc2lzdGVudF9jb252b3M6IChtZXNzYWdlKSAtPlxuICAgIGNvbnNvbGUubG9nKCdnb29kYnllIScpXG4gICAgIyMgZmluZCBpZiBjb252byBleGlzdHNcbiAgICBmb3IgY29udm8sIGkgaW4gQGNvbnZlcnNhdGlvbnNcbiAgICAgIGlmIGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIG1lc3NhZ2UuY29udm9faWRcbiAgICAgICAgY29ycmVzX2NvbnZvID0gY29udm9cbiAgICAgICAgaW5kZXggPSBpXG5cbiAgICBuZXdfbWVzc2FnZSA9IG5ldyBNZXNzYWdlKG1lc3NhZ2UucmVjaXBpZW50cywgbWVzc2FnZS5zZW5kZXIsIG1lc3NhZ2UuY29udGVudCwgbWVzc2FnZS5pbWFnZSwgbWVzc2FnZS50aW1lX3N0YW1wKVxuICAgICMjIGlmIGNvbnZvIGV4aXN0c1xuICAgIGlmIGNvcnJlc19jb252b1xuICAgICAgQGNvbnZlcnNhdGlvbnMuc3BsaWNlKGluZGV4LDEpXG4gICAgICBAY29udmVyc2F0aW9ucy51bnNoaWZ0KGNvcnJlc19jb252bylcbiAgICAgIGNvcnJlc19jb252by5hZGRfbWVzc2FnZShuZXdfbWVzc2FnZSlcbiAgICBlbHNlXG4gICAgICAjIyBsb2dpYyB0byBleHRyYWN0IGluZm8gZnJvbSBtZXNzYWdlIHRvIGNyZWF0ZSBuZXcgY29udm9cbiAgICAgIGNvbnZvX21lbWJlcnNfaWRzID0gbmV3X21lc3NhZ2UuY29udm9faWQuc3BsaXQoJywnKVxuICAgICAgY29udm9fcGFydG5lcl9pZHMgPSBbXVxuICAgICAgIyMgcmVtb3ZlIHNlbGYgZnJvbSBhcnJheSB0byBjb25zdHJ1Y3QgY29udm8gcGFydG5lcnNcbiAgICAgIGZvciB1c2VyX2lkIGluIGNvbnZvX21lbWJlcnNfaWRzXG4gICAgICAgIGlmIHVzZXJfaWQgaXNudCBAbWUuaW1hZ2VfdXJsXG4gICAgICAgICAgY29udm9fcGFydG5lcl9pZHMucHVzaCh1c2VyX2lkKVxuXG4gICAgICAjIyB1c2UgaWRzIHRvIGdyYWIgZnVsbCBvYmplY3RzIGZvciBjb252byBwYXJ0bmVyc1xuICAgICAgY29udm9fcGFydG5lcnMgPSBbXVxuICAgICAgZm9yIHVzZXJfaWQgaW4gY29udm9fcGFydG5lcl9pZHNcbiAgICAgICAgZm9yIG9ubGluZV91c2VyIGluIEBjdXJyZW50X3VzZXJzXG4gICAgICAgICAgaWYgdXNlcl9pZCBpcyBvbmxpbmVfdXNlci5pbWFnZV91cmxcbiAgICAgICAgICAgIGNvbnZvX3BhcnRuZXJzLnB1c2gob25saW5lX3VzZXIpXG5cbiAgICAgICMjIGNyZWF0ZSBuZXcgY29udm8gYW5kIGFkZCBtZXNzYWdlXG4gICAgICBuZXdfY29udm8gPSBuZXcgQ29udmVyc2F0aW9uKGNvbnZvX3BhcnRuZXJzLCBbXSwgdHJ1ZSlcbiAgICAgIG5ld19jb252by5hZGRfbWVzc2FnZShuZXdfbWVzc2FnZSwgdHJ1ZSlcbiAgICAgIEBjb252ZXJzYXRpb25zLnVuc2hpZnQobmV3X2NvbnZvKVxuICAgICAgQHB1Yl9zdWIudHJpZ2dlcignbmV3X2NvbnZvJywgbmV3X2NvbnZvKVxuXG5cbiAgbG9hZF9jdXJyZW50X3VzZXJzOiAobG9nZ2VkX29uKSAtPlxuICAgICMjIHNvcnQgaW4gYWxwaGF0YmV0aWNhbCBvcmRlciBieSBkaXNwbGF5IG5hbWUgYmVmb3JlIHJlbmRlcmluZy5cbiAgICBsb2dnZWRfb24gPSBsb2dnZWRfb24uc29ydCAoYSxiKSAtPlxuICAgICAgaWYgYS5kaXNwbGF5X25hbWUgPiBiLmRpc3BsYXlfbmFtZSB0aGVuIHJldHVybiAxXG4gICAgICBpZiBhLmRpc3BsYXlfbmFtZSA8IGIuZGlzcGxheV9uYW1lIHRoZW4gcmV0dXJuIC0xXG4gICAgICByZXR1cm4gMFxuICAgICMjIHJlY2lldmVzIGN1cnJlbnQgdXNlcnMgZnJvbSBzZXJ2ZXIgb24gbG9naW5cbiAgICBmb3IgdXNlciBpbiBsb2dnZWRfb25cbiAgICAgIG5ld191c2VyID0gbmV3IFVzZXIodXNlci5kaXNwbGF5X25hbWUsIHVzZXIuaW1hZ2VfdXJsKVxuICAgICAgQGN1cnJlbnRfdXNlcnMucHVzaChuZXdfdXNlcilcbiAgICB1c2Vyc19zYW5zX21lID0gW11cbiAgICBmb3IgdXNlciBpbiBAY3VycmVudF91c2Vyc1xuICAgICAgaWYgdXNlci5pbWFnZV91cmwgaXNudCBAbWUuaW1hZ2VfdXJsXG4gICAgICAgIHVzZXJzX3NhbnNfbWUucHVzaCh1c2VyKVxuICAgIEBjdXJyZW50X3VzZXJzID0gdXNlcnNfc2Fuc19tZVxuXG4gIHVzZXJfbG9nZ2VkX29uOiAoZGlzcGxheV9uYW1lLCBpbWFnZV91cmwpIC0+XG4gICAgbmV3X3VzZXIgPSBuZXcgVXNlcihkaXNwbGF5X25hbWUsIGltYWdlX3VybClcbiAgICBpZiBAY3VycmVudF91c2Vycy5sZW5ndGggaXMgMFxuICAgICAgQGN1cnJlbnRfdXNlcnMucHVzaChuZXdfdXNlcilcbiAgICAgIEBwdWJfc3ViLnRyaWdnZXIoJ3VzZXJfbG9nZ2VkX29uJyxbbmV3X3VzZXIsIDAsIFwiZmlyc3RcIl0pXG4gICAgICByZXR1cm5cbiAgICBmb3IgdXNlciwgaSBpbiBAY3VycmVudF91c2Vyc1xuICAgICAgaWYgdXNlci5kaXNwbGF5X25hbWUgPiBuZXdfdXNlci5kaXNwbGF5X25hbWVcbiAgICAgICAgQGN1cnJlbnRfdXNlcnMuc3BsaWNlKGksIDAsIG5ld191c2VyKVxuICAgICAgICBAcHViX3N1Yi50cmlnZ2VyKCd1c2VyX2xvZ2dlZF9vbicsIFtuZXdfdXNlciwgaV0pXG4gICAgICAgIHJldHVyblxuICAgICAgaWYgaSBpcyBAY3VycmVudF91c2Vycy5sZW5ndGggLSAxXG4gICAgICAgIEBjdXJyZW50X3VzZXJzLnB1c2gobmV3X3VzZXIpXG4gICAgICAgIEBwdWJfc3ViLnRyaWdnZXIoJ3VzZXJfbG9nZ2VkX29uJyxbbmV3X3VzZXIsIGkgKyAxLCBcImxhc3RcIl0pXG4gIHVzZXJfbG9nZ2VkX29mZjogKGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsKSAtPlxuICAgIG5ld19vbmxpbmVfdXNlcnMgPSBbXVxuICAgIGZvciB1c2VyLCBpIGluIEBjdXJyZW50X3VzZXJzXG4gICAgICBpZiBpbWFnZV91cmwgaXNudCB1c2VyLmltYWdlX3VybFxuICAgICAgICBuZXdfb25saW5lX3VzZXJzLnB1c2godXNlcilcbiAgICAgIGVsc2VcbiAgICAgICAgQHB1Yl9zdWIudHJpZ2dlcigndXNlcl9sb2dnZWRfb2ZmJywgW3VzZXIsIGldKVxuICAgIEBjdXJyZW50X3VzZXJzID0gbmV3X29ubGluZV91c2Vyc1xuXG5cbiMjIFNBVElTRklFUyBDSVJDVUxBUiBERVBFTkRBTkNZIEZPUiBCUk9XU0VSSUZZIEJVTkRMSU5HXG5wYXJsZXkgPSBuZXcgQXBwKClcblxubW9kdWxlLmV4cG9ydHMgPSBwYXJsZXlcblxuIyMgTE9BRCBDT01NQU5EQ0VOVEVSIEFORCBPQVVUSCBUTyBTVEFSVCBBUFBcbm9hdXRoID0gcmVxdWlyZSgnLi9vYXV0aC5jb2ZmZWUnKVxuY29tbWFuZF9jZW50ZXIgPSByZXF1aXJlKCcuL2NvbW1hbmRfY2VudGVyX3ZpZXcuY29mZmVlJylcbkNvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uX21vZGVsLmNvZmZlZScpXG5Vc2VyID0gcmVxdWlyZSgnLi91c2VyX21vZGVsLmNvZmZlZScpXG5NZXNzYWdlID0gcmVxdWlyZSgnLi9tZXNzYWdlX21vZGVsLmNvZmZlZScpXG5BcHAucHJvdG90eXBlLmNvbW1hbmRfY2VudGVyID0gY29tbWFuZF9jZW50ZXJcbkFwcC5wcm90b3R5cGUub2F1dGggPSBvYXV0aFxuXG5cblxuXG4iLCJhcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZV9tb2RlbC5jb2ZmZWUnKVxuTWVzc2FnZVZpZXcgPSByZXF1aXJlKCcuL21lc3NhZ2Vfdmlldy5jb2ZmZWUnKVxuQ29udmVyc2F0aW9uID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb25fbW9kZWwuY29mZmVlJylcblVzZXJWaWV3ID0gcmVxdWlyZSgnLi91c2VyX3ZpZXcuY29mZmVlJylcblBlcnNpc3RlbnRDb252ZXJzYXRpb25WaWV3ID0gcmVxdWlyZSgnLi9wZXJzaXN0ZW50X2NvbnZlcnNhdGlvbl92aWV3LmNvZmZlZScpXG5jaGF0X3Jvb21fdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9jaGF0X3Jvb20uaGJzJylcbkhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYnNmeS9ydW50aW1lJylcbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgJ3RpdGxlX2Jhcl9mdW5jdGlvbicsIC0+XG4gIGlmIEBjb252b19wYXJ0bmVycy5sZW5ndGggPCAyXG4gICAgQGNvbnZvX3BhcnRuZXJzWzBdLmRpc3BsYXlfbmFtZVxuICBlbHNlXG4gICAgQGZpcnN0X25hbWVfbGlzdFxuXG5cblxuIyMgY29uc3RydWN0b3IgZm9yIG9iamVjdCBjb250YWluaW5nIHRlbXBsYXRlIGFuZCB1c2VyXG4jIyBpbnRlcmFjdGlvbiBsb2dpYyBmb3IgZWFjaCBvcGVuIGNoYXQgd2luZG93LlxuIyMgd2F0Y2hlcyBhIGNvbnZlcnNhdGlvbiBtb2RlbC5cbmNsYXNzIENoYXRSb29tXG5cbiAgY29uc3RydWN0b3I6IChAY29udm8pIC0+XG4gICAgQCRlbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cInBhcmxleVwiPjwvZGl2PicpXG4gICAgQHJlbmRlcigpXG4gICAgJCgnYm9keScpLmFwcGVuZChAJGVsZW1lbnQpXG4gICAgQGxvYWRQZXJzaXN0ZW50TWVzc2FnZXMoKVxuXG4gICAgQHB1YnN1Yl9saXN0ZW5lcnMgPVxuICAgICAgICAgICAgICAgICAgICAndXNlcl9sb2dnZWRfb24nOiBAc3luY191c2VyX2xvZ2dlZF9vbi5iaW5kKHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICd1c2VyX2xvZ2dlZF9vZmYnOiBAc3luY191c2VyX2xvZ2dlZF9vZmYuYmluZCh0aGlzKVxuICAgICAgICAgICAgICAgICAgICAnbmV3X2NvbnZvJzogQHN5bmNfbmV3X2NvbnZvLmJpbmQodGhpcylcbiAgICAgICAgICAgICAgICAgICAgJ3BpY3R1cmVfbWVzc2FnZSc6IEByZW5kZXJEaXNjdXNzaW9uLmJpbmQodGhpcylcblxuICAgIEBzb2NrZXRfbGlzdGVuZXJzID1cbiAgICAgICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBAbWVzc2FnZV9jYWxsYmFjay5iaW5kKHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICd1c2VyX29mZmxpbmUnOiBAdXNlcl9vZmZsaW5lX2NhbGxiYWNrLmJpbmQodGhpcylcbiAgICAgICAgICAgICAgICAgICAgJ3R5cGluZ19ub3RpZmljYXRpb24nOiBAdHlwaW5nX25vdGlmaWNhdGlvbl9jYWxsYmFjay5iaW5kKHRoaXMpXG5cbiAgICBmb3IgcHJvcCwgdmFsdWUgb2YgQHB1YnN1Yl9saXN0ZW5lcnNcbiAgICAgIGFwcC5wdWJfc3ViLm9uKHByb3AsdmFsdWUpXG5cbiAgICBmb3IgcHJvcCwgdmFsdWUgb2YgQHNvY2tldF9saXN0ZW5lcnNcbiAgICAgIGFwcC5zZXJ2ZXIub24ocHJvcCwgdmFsdWUpXG5cbiAgICAjIyBmb3IgYWRkIHVzZXJzIHZpZXdcbiAgICBAYWRkX3VzZXJfYmFyID0gJzxkaXYgY2xhc3M9XCJhZGQtdXNlci1iYXJcIj48YSBjbGFzcz1cImNhbmNlbFwiPkNhbmNlbDwvYT48YSBjbGFzcz1cImNvbmZpcm0gZGlzYWJsZWRcIj5BZGQgUGVvcGxlPC9hPjwvZGl2PidcblxuXG5cbiAgbWVzc2FnZV9jYWxsYmFjazogKG1lc3NhZ2UpIC0+XG4gICAgaWYgQGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIG1lc3NhZ2UuY29udm9faWRcbiAgICAgIG5ld19tZXNzYWdlID0gbmV3IE1lc3NhZ2UobWVzc2FnZS5yZWNpcGllbnRzLCBtZXNzYWdlLnNlbmRlciwgbWVzc2FnZS5jb250ZW50LCBtZXNzYWdlLmltYWdlLCBtZXNzYWdlLnRpbWVfc3RhbXApXG5cbiAgICAgIEBjb252by5hZGRfbWVzc2FnZShuZXdfbWVzc2FnZSwgdHJ1ZSlcbiAgICAgIGlmIEBtZW51IGlzIFwiY2hhdFwiXG4gICAgICAgIEByZW5kZXJEaXNjdXNzaW9uKClcbiAgICAgICAgQCRlbGVtZW50LmZpbmQoJy50b3AtYmFyJykuYWRkQ2xhc3MoJ25ldy1tZXNzYWdlJylcbiAgICAgICAgQHRpdGxlQWxlcnQoKVxuXG4gIHVzZXJfb2ZmbGluZV9jYWxsYmFjazogLT5cbiAgICBpZiBAbWVudSBpcyBcImNoYXRcIlxuICAgICAgbWVzc2FnZSA9IG5ldyBNZXNzYWdlKCBhcHAubWUsIHtpbWFnZV91cmw6J2h0dHA6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3BhcmxleS1hc3NldHMvc2VydmVyX25ldHdvcmsucG5nJ30sIFwiVGhpcyB1c2VyIGlzIG5vIGxvbmdlciBvbmxpbmVcIiwgZmFsc2UsIG5ldyBEYXRlKCkgKVxuICAgICAgQGNvbnZvLmFkZF9tZXNzYWdlKG1lc3NhZ2UpXG4gICAgICBAcmVuZGVyRGlzY3Vzc2lvbigpXG5cbiAgdHlwaW5nX25vdGlmaWNhdGlvbl9jYWxsYmFjazogKGNvbnZvX2lkLCB0eXBpc3QsIGJvb2wpIC0+XG4gICAgaWYgQG1lbnUgaXMgXCJjaGF0XCJcbiAgICAgIGlmIGNvbnZvX2lkIGlzIEBjb252by5tZXNzYWdlX2ZpbHRlclxuICAgICAgICBpZiBib29sXG4gICAgICAgICAgaWYgQCRkaXNjdXNzaW9uLmZpbmQoJy5pbmNvbWluZycpLmxlbmd0aCBpcyAwXG4gICAgICAgICAgICB0eXBpbmdfbm90aWZpY2F0aW9uID0gXCI8bGkgY2xhc3M9J2luY29taW5nJz48ZGl2IGNsYXNzPSdhdmF0YXInPjxpbWcgc3JjPScje3R5cGlzdC5pbWFnZV91cmx9Jy8+PC9kaXY+PGRpdiBjbGFzcz0nbWVzc2FnZXMnPjxwPiN7dHlwaXN0LmRpc3BsYXlfbmFtZX0gaXMgdHlwaW5nLi4uPC9wPjwvZGl2PjwvbGk+XCJcbiAgICAgICAgICAgIEAkZGlzY3Vzc2lvbi5hcHBlbmQodHlwaW5nX25vdGlmaWNhdGlvbilcbiAgICAgICAgICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIEAkZGlzY3Vzc2lvbi5maW5kKCcuaW5jb21pbmcnKS5yZW1vdmUoKVxuICAgICAgICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlKClcblxuICBzd2l0Y2hfdG9fcGVyc2lzdGVudF9jb252bzogKGUpIC0+XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIGlmIEBtZW51IGlzbnQgXCJjb252b19zd2l0Y2hcIlxuICAgICAgQCRkaXNjdXNzaW9uLmNoaWxkcmVuKCkucmVtb3ZlKClcbiAgICAgIEAkZWxlbWVudC5maW5kKCd0ZXh0YXJlYS5zZW5kJykucmVtb3ZlKClcbiAgICAgIEAkZWxlbWVudC5maW5kKCcubWlycm9yZGl2JykucmVtb3ZlKClcbiAgICAgIEAkZWxlbWVudC5maW5kKCcucGFybGV5X2ZpbGVfdXBsb2FkJykucmVtb3ZlKClcbiAgICAgIEAkZWxlbWVudC5maW5kKCdsYWJlbC5pbWdfdXBsb2FkJykucmVtb3ZlKClcbiAgICAgIGZvciBjb252byBpbiBhcHAuY29udmVyc2F0aW9uc1xuICAgICAgICBpZiBjb252by5tZXNzYWdlcy5sZW5ndGggPiAwXG4gICAgICAgICAgdmlldyA9IG5ldyBQZXJzaXN0ZW50Q29udmVyc2F0aW9uVmlldyhjb252bywgdGhpcylcbiAgICAgICAgICB2aWV3LnJlbmRlcigpXG4gICAgICAgICAgQCRkaXNjdXNzaW9uLmFwcGVuZCh2aWV3LiRlbGVtZW50KVxuICAgICAgQG1lbnUgPSBcImNvbnZvX3N3aXRjaFwiXG4gICAgZWxzZVxuICAgICAgQHJlbmRlcigpXG4gICAgICBAbG9hZFBlcnNpc3RlbnRNZXNzYWdlcygpXG5cblxuICBhZGRfdXNlcnNfdG9fY29udm86IChlKSAtPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIEBtZW51ID0gXCJhZGRfdXNlcnNcIlxuICAgIEBuZXdfY29udm9fcGFyYW1zID0gW11cbiAgICBAJGRpc2N1c3Npb24uY2hpbGRyZW4oKS5yZW1vdmUoKVxuICAgIEAkZGlzY3Vzc2lvbi5hcHBlbmQoJzxpbnB1dCBjbGFzcz1cInNlYXJjaFwiIHBsYWNlaG9sZGVyPVwiQWRkIFBlb3BsZVwiPicpXG4gICAgZm9yIHVzZXIgaW4gYXBwLmN1cnJlbnRfdXNlcnNcbiAgICAgIHZpZXcgPSBuZXcgVXNlclZpZXcodXNlciwgdGhpcylcbiAgICAgIHZpZXcucmVuZGVyKClcbiAgICAgIEAkZGlzY3Vzc2lvbi5hcHBlbmQodmlldy4kZWxlbWVudClcbiAgICBAJGRpc2N1c3Npb24uYXBwZW5kKEBhZGRfdXNlcl9iYXIpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5jYW5jZWwnKS5vbiAnY2xpY2snLCBAY2FuY2VsX2FkZF91c2Vycy5iaW5kKHRoaXMpXG5cbiAgY2FuY2VsX2FkZF91c2VyczogKGUpIC0+XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgQHJlbmRlcigpXG4gICAgQGxvYWRQZXJzaXN0ZW50TWVzc2FnZXMoKVxuICAgIEBuZXdfY29udm9fcGFyYW1zID0gW11cblxuICBjb25maXJtX25ld19jb252b19wYXJhbXM6IChlKSAtPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICMjIGFkZHMgZXhpc3RpbmcgY29udm8gbWVtYmVycyB0byBuZXcgY29udm8gcGFyYW1zIHRvIGdldCBuZXcga2V5XG4gICAgbmV3X2NvbnZvX3BhcnRuZXJzID0gQGNvbnZvLmNvbnZvX3BhcnRuZXJzXG4gICAgY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscyA9IEBjb252by5tZXNzYWdlX2ZpbHRlci5zcGxpdCgnLCcpXG4gICAgZm9yIHVzZXIgaW4gQG5ld19jb252b19wYXJhbXNcbiAgICAgIGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMucHVzaCh1c2VyLmltYWdlX3VybClcbiAgICAgIG5ld19jb252b19wYXJ0bmVycy5wdXNoKHVzZXIpXG4gICAgY29udm9faWQgPSBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzLnNvcnQoKS5qb2luKClcbiAgICAjIyBjaGVjayB0byBtYWtlIHN1cmUgY29udm8gaXMgbm90IGFscmVhZHkgb3BlblxuICAgIGZvciBjb252byBpbiBhcHAub3Blbl9jb252ZXJzYXRpb25zXG4gICAgICBpZiBjb252b19pZCBpcyBjb252b1xuICAgICAgICByZXR1cm5cbiAgICAjI2NoZWNrIHRvIHNlZSBpZiBwZXJzaXN0ZW50IGNvbnZvIGV4aXN0cyB3aXRoIGdyb3VwIGlmIHNvIGxvYWQgZnJvbSB0aGF0XG4gICAgY29udm9fZXhpc3RzID0gZmFsc2VcbiAgICBmb3IgY29udm8gaW4gYXBwLmNvbnZlcnNhdGlvbnNcbiAgICAgIGlmIGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIGNvbnZvX2lkXG4gICAgICAgIGNvbnZvX2V4aXN0cyA9IHRydWVcbiAgICAgICAgcGVyc2lzdGVudF9jb252byA9IGNvbnZvXG4gICAgaWYgY29udm9fZXhpc3RzXG4gICAgICBAY29udm8gPSBwZXJzaXN0ZW50X2NvbnZvXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG4gICAgZWxzZVxuICAgICAgIyMgY3JlYXRlIG5ldyBjb252ZXJzYXRpb24gY29uc2lzdGluZyBvZiBzZWxlY3RlZCB1c2VycyBhZGRlZCB0byBleGlzdGluZyBjb252byBtZW1iZXJzXG4gICAgICBjb252ZXJzYXRpb24gPSBuZXcgQ29udmVyc2F0aW9uKG5ld19jb252b19wYXJ0bmVycylcbiAgICAgIEBjb252byA9IGNvbnZlcnNhdGlvblxuICAgICAgYXBwLmNvbnZlcnNhdGlvbnMucHVzaChjb252ZXJzYXRpb24pXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5hZGQtdXNlci1iYXInKS5yZW1vdmUoKVxuICAgIEByZW5kZXIoKVxuICAgIEBsb2FkUGVyc2lzdGVudE1lc3NhZ2VzKClcbiAgICBAbmV3X2NvbnZvX3BhcmFtcyA9IFtdXG5cbiAgcmVuZGVyOiAtPlxuICAgIEBtZW51ID0gXCJjaGF0XCJcbiAgICBAJGVsZW1lbnQuY2hpbGRyZW4oKS5yZW1vdmUoKVxuICAgIEAkZWxlbWVudC5odG1sKGNoYXRfcm9vbV90ZW1wbGF0ZShAY29udm8pKVxuICAgIEAkZGlzY3Vzc2lvbiA9IEAkZWxlbWVudC5maW5kKCcuZGlzY3Vzc2lvbicpXG5cbiAgICAjIyBjcmVhdGUgYW5kIGFwcGVuZCBoaWRkZW4gZGl2IGZvciBtZXNzYWdlIGlucHV0IHJlc2l6aW5nXG4gICAgQCRtaXJyb3JfZGl2ID0gJChcIjxkaXYgY2xhc3M9J21pcnJvcmRpdic+PC9kaXY+XCIpXG4gICAgQCRlbGVtZW50LmZpbmQoJ3NlY3Rpb24uY29udmVyc2F0aW9uIC5tZXNzYWdlLWFyZWEnKS5hcHBlbmQgQCRtaXJyb3JfZGl2XG4gICAgQGhpZGRlbl9kaXZfaGVpZ2h0ID0gQCRlbGVtZW50LmZpbmQoJy5taXJyb3JkaXYnKS5jc3MoJ2hlaWdodCcpXG5cbiAgICAjIyBjcmVhdGUgdmFyaWFibGUgZm9yIGZpbGV1cGxvYWQgdG8gYWRkIGFuZCByZW1vdmVcbiAgICBAJGZpbGVfdXBsb2FkID0gQCRlbGVtZW50LmZpbmQoJ2xhYmVsLmltZ191cGxvYWQnKVxuXG4gICAgIyMgTElTVEVORVJTIEZPUiBVU0VSIElOVEVSQUNUSU9OIFdJVEggQ0hBVCBXSU5ET1dcbiAgICBAJGVsZW1lbnQuZmluZCgnLmNoYXQtY2xvc2UnKS5vbiAnY2xpY2snLCBAY2xvc2VXaW5kb3cuYmluZCh0aGlzKVxuICAgIEAkZWxlbWVudC5maW5kKCcuZW50eXBvLXVzZXItYWRkJykub24gJ2NsaWNrJywgQGFkZF91c2Vyc190b19jb252by5iaW5kKHRoaXMpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5lbnR5cG8tY2hhdCcpLm9uICdjbGljaycsIEBzd2l0Y2hfdG9fcGVyc2lzdGVudF9jb252by5iaW5kKHRoaXMpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub24gJ2tleXByZXNzJywgQHNlbmRPbkVudGVyLmJpbmQodGhpcylcbiAgICBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS5vbiAna2V5dXAnLCBAZW1pdFR5cGluZ05vdGlmaWNhdGlvbi5iaW5kKHRoaXMpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub24gJ2tleXVwJywgQGdyb3dfbWVzc2FnZV9maWVsZC5iaW5kKHRoaXMpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub24gJ2tleXVwJywgQHRvZ2dsZV9maWxlX3VwbG9hZF9idXR0b24uYmluZCh0aGlzKVxuICAgIEAkZWxlbWVudC5maW5kKCcudG9wLWJhciwgbWluaWZ5ICcpLm9uICdjbGljaycsIEB0b2dnbGVDaGF0LmJpbmQodGhpcylcbiAgICBAJGVsZW1lbnQub24gJ2NsaWNrJywgQHJlbW92ZU5vdGlmaWNhdGlvbnMuYmluZCh0aGlzKVxuICAgIEAkZWxlbWVudC5maW5kKCdpbnB1dC5wYXJsZXlfZmlsZV91cGxvYWQnKS5vbiAnY2hhbmdlJywgQGZpbGVfdXBsb2FkLmJpbmQodGhpcylcblxuICByZW5kZXJEaXNjdXNzaW9uOiAtPlxuICAgIG5ld19tZXNzYWdlID0gQGNvbnZvLm1lc3NhZ2VzLnNsaWNlKC0xKVswXVxuICAgIEBhcHBlbmRNZXNzYWdlKG5ld19tZXNzYWdlKVxuICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlKClcblxuICBhcHBlbmRNZXNzYWdlOiAobWVzc2FnZSktPlxuICAgIG1lc3NhZ2VfdmlldyA9IG5ldyBNZXNzYWdlVmlldyhtZXNzYWdlKVxuICAgIG1lc3NhZ2Vfdmlldy5yZW5kZXIoKVxuICAgIEAkZGlzY3Vzc2lvbi5hcHBlbmQobWVzc2FnZV92aWV3LiRlbGVtZW50KVxuXG4gIHNjcm9sbFRvTGFzdE1lc3NhZ2U6IC0+XG4gICAgQCRkaXNjdXNzaW9uLnNjcm9sbFRvcCggQCRkaXNjdXNzaW9uLmZpbmQoJ2xpOmxhc3QtY2hpbGQnKS5vZmZzZXQoKS50b3AgKyBAJGRpc2N1c3Npb24uc2Nyb2xsVG9wKCkgKVxuXG4gIGxvYWRQZXJzaXN0ZW50TWVzc2FnZXM6IC0+XG4gICAgZm9yIG1lc3NhZ2UgaW4gQGNvbnZvLm1lc3NhZ2VzXG4gICAgICBAYXBwZW5kTWVzc2FnZShtZXNzYWdlKVxuICAgIGlmIEBjb252by5tZXNzYWdlcy5sZW5ndGggPiAwXG4gICAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG5cbiAgc2VuZE9uRW50ZXI6IChlKS0+XG4gICAgaWYgZS53aGljaCBpcyAxM1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBAc2VuZE1lc3NhZ2UoKVxuICAgICAgQHJlbW92ZU5vdGlmaWNhdGlvbnMoKVxuXG4gIHNlbmRNZXNzYWdlOiAtPlxuICAgIG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSBAY29udm8uY29udm9fcGFydG5lcnMsIGFwcC5tZSwgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykudmFsKClcbiAgICBAY29udm8uYWRkX21lc3NhZ2UobWVzc2FnZSwgdHJ1ZSlcbiAgICBAcmVuZGVyRGlzY3Vzc2lvbigpXG4gICAgY29uc29sZS5sb2coJ2hlbGxvJylcbiAgICBhcHAuc2VydmVyLmVtaXQgJ21lc3NhZ2UnLCBtZXNzYWdlXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykudmFsKCcnKVxuICAgIEBlbWl0VHlwaW5nTm90aWZpY2F0aW9uKClcblxuICB0b2dnbGVDaGF0OiAoZSkgLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBAJGVsZW1lbnQuZmluZCgnLm1lc3NhZ2UtYXJlYScpLnRvZ2dsZSgpXG4gICAgaWYgQCRkaXNjdXNzaW9uLmF0dHIoJ2Rpc3BsYXknKSBpcyBub3QgXCJub25lXCJcbiAgICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlXG5cbiAgY2xvc2VXaW5kb3c6IChlKSAtPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICAjIyByZW1vdmUgZnJvbSBvcGVuIGNvbnZvc1xuICAgIG5ld19vcGVuX2NvbnZvcyA9IFtdXG4gICAgZm9yIG9wZW5fY29udm8gaW4gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgICAgaWYgb3Blbl9jb252byBpc250IEBjb252by5tZXNzYWdlX2ZpbHRlclxuICAgICAgICBuZXdfb3Blbl9jb252b3MucHVzaChvcGVuX2NvbnZvKVxuICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMgPSBuZXdfb3Blbl9jb252b3NcblxuICAgICMjIHJlbW92ZSBhbGwgbGlzdGVuZXJzIGZvciBnYXJiYWdlIGNvbGxlY3Rpb25cbiAgICBmb3IgcHJvcCwgdmFsdWUgb2YgQHNvY2tldF9saXN0ZW5lcnNcbiAgICAgIGFwcC5zZXJ2ZXIucmVtb3ZlTGlzdGVuZXIocHJvcCx2YWx1ZSlcbiAgICBhcHAucHViX3N1Yi5vZmYoKVxuICAgIEAkZWxlbWVudC5yZW1vdmUoKVxuXG4gIHJlbW92ZU5vdGlmaWNhdGlvbnM6IChlKSAtPlxuICAgIEAkZWxlbWVudC5maW5kKCcudG9wLWJhcicpLnJlbW92ZUNsYXNzKCduZXctbWVzc2FnZScpXG4gICAgaWYgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5ub3RpZmllZFxuICAgICAgQGNsZWFyVGl0bGVOb3RpZmljYXRpb24oKVxuXG4gIGVtaXRUeXBpbmdOb3RpZmljYXRpb246IChlKSAtPlxuICAgIGlmIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLnZhbCgpIGlzbnQgXCJcIlxuICAgICAgYXBwLnNlcnZlci5lbWl0ICd1c2VyX3R5cGluZycsIEBjb252by5jb252b19wYXJ0bmVyc19pbWFnZV91cmxzLCBhcHAubWUsIHRydWVcbiAgICBlbHNlXG4gICAgICBhcHAuc2VydmVyLmVtaXQgJ3VzZXJfdHlwaW5nJywgQGNvbnZvLmNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMsIGFwcC5tZSwgZmFsc2VcblxuICBjbGVhclRpdGxlTm90aWZpY2F0aW9uOiAtPlxuICAgIGFwcC5jbGVhcl9hbGVydCgpXG4gICAgJCgnaHRtbCB0aXRsZScpLmh0bWwoIGFwcC50aXRsZV9ub3RpZmljYXRpb24ucGFnZV90aXRsZSApXG4gICAgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5ub3RpZmllZCA9IGZhbHNlXG5cbiAgdGl0bGVBbGVydDogLT5cbiAgICBpZiBub3QgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5ub3RpZmllZFxuICAgICAgc2VuZGVyX25hbWUgPSBAY29udm8ubWVzc2FnZXNbQGNvbnZvLm1lc3NhZ2VzLmxlbmd0aCAtIDFdLnNlbmRlci5kaXNwbGF5X25hbWVcbiAgICAgIGFsZXJ0ID0gXCJQZW5kaW5nICoqICN7c2VuZGVyX25hbWV9XCJcbiAgICAgIHNldEFsZXJ0ID0gLT5cbiAgICAgICAgaWYgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5wYWdlX3RpdGxlIGlzICQoJ2h0bWwgdGl0bGUnKS5odG1sKClcbiAgICAgICAgICAkKCdodG1sIHRpdGxlJykuaHRtbChhbGVydClcbiAgICAgICAgZWxzZVxuICAgICAgICAgICQoJ2h0bWwgdGl0bGUnKS5odG1sKCBhcHAudGl0bGVfbm90aWZpY2F0aW9uLnBhZ2VfdGl0bGUpXG5cbiAgICAgIHRpdGxlX2FsZXJ0ID0gc2V0SW50ZXJ2YWwoc2V0QWxlcnQsIDIyMDApXG5cbiAgICAgIGFwcC5jbGVhcl9hbGVydCA9IC0+XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGl0bGVfYWxlcnQpXG5cbiAgICAgIGFwcC50aXRsZV9ub3RpZmljYXRpb24ubm90aWZpZWQgPSB0cnVlXG5cbiAgZmlsZV91cGxvYWQ6IC0+XG4gICAgY29uc29sZS5sb2coJ2hlYXIgY2xpY2snKVxuICAgIGZpbGUgPSBAJGVsZW1lbnQuZmluZCgnLnBhcmxleV9maWxlX3VwbG9hZCcpLmdldCgwKS5maWxlc1swXVxuICAgIGFwcC5vYXV0aC5maWxlX3VwbG9hZCBmaWxlLCBAY29udm8uY29udm9fcGFydG5lcnMsIEBjb252by5tZXNzYWdlX2ZpbHRlclxuXG4gIGdyb3dfbWVzc2FnZV9maWVsZDogLT5cbiAgICAkdHh0ID0gQCRlbGVtZW50LmZpbmQoJ3RleHRhcmVhLnNlbmQnKVxuICAgIGNvbnRlbnQgPSAkdHh0LnZhbCgpXG4gICAgYWRqdXN0ZWRfY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvXFxuL2csIFwiPGJyPlwiKVxuICAgIEAkbWlycm9yX2Rpdi5odG1sKGFkanVzdGVkX2NvbnRlbnQpXG4gICAgQGhpZGRlbl9kaXZfaGVpZ2h0ID0gQCRtaXJyb3JfZGl2LmNzcygnaGVpZ2h0JylcbiAgICBpZiBAaGlkZGVuX2Rpdl9oZWlnaHQgaXNudCAkdHh0LmNzcygnaGVpZ2h0JylcbiAgICAgICR0eHQuY3NzKCdoZWlnaHQnLCBAaGlkZGVuX2Rpdl9oZWlnaHQpXG5cblxuICB0b2dnbGVfZmlsZV91cGxvYWRfYnV0dG9uOiAtPlxuICAgICMjIHJlbW92ZSBpY29uIGZvciBmaWxlIHVwbG9hZFxuICAgIGlmIEAkZWxlbWVudC5maW5kKCd0ZXh0YXJlYS5zZW5kJykudmFsKCkgaXNudCBcIlwiXG4gICAgICBpZiBAJGVsZW1lbnQuZmluZCgnbGFiZWwuaW1nX3VwbG9hZCcpLmxlbmd0aCBpcyAxXG4gICAgICAgIEAkZWxlbWVudC5maW5kKCdsYWJlbC5pbWdfdXBsb2FkJykucmVtb3ZlKClcbiAgICBlbHNlXG4gICAgICBpZiBAJGVsZW1lbnQuZmluZCgnbGFiZWwuaW1nX3VwbG9hZCcpLmxlbmd0aCBpcyAwXG4gICAgICAgIEAkZWxlbWVudC5maW5kKCdzZWN0aW9uLmNvbnZlcnNhdGlvbicpLmFwcGVuZChAJGZpbGVfdXBsb2FkKVxuICAgICAgICBAJGVsZW1lbnQuZmluZCgnaW5wdXQucGFybGV5X2ZpbGVfdXBsb2FkJykub24gJ2NoYW5nZScsIEBmaWxlX3VwbG9hZC5iaW5kKHRoaXMpXG5cbiAgc3luY191c2VyX2xvZ2dlZF9vbjogKGUsIHVzZXIsIGluZGV4LCBsb2NhdGlvbikgLT5cblxuXG4gICAgaWYgQG1lbnUgaXMgXCJhZGRfdXNlcnNcIlxuICAgICAgdmlldyA9IG5ldyBVc2VyVmlldyh1c2VyLCB0aGlzKVxuICAgICAgdmlldy5yZW5kZXIoKVxuICAgICAgaWYgbG9jYXRpb24gaXMgXCJmaXJzdFwiIG9yIGxvY2F0aW9uIGlzIFwibGFzdFwiXG5cbiAgICAgICAgQCRkaXNjdXNzaW9uLmNoaWxkcmVuKCkuZXEoLTEpLmJlZm9yZSh2aWV3LiRlbGVtZW50KVxuICAgICAgZWxzZVxuXG4gICAgICAgIEAkZGlzY3Vzc2lvbi5maW5kKCdsaS51c2VyJykuZXEoaW5kZXgpLmJlZm9yZSh2aWV3LiRlbGVtZW50KVxuXG4gIHN5bmNfdXNlcl9sb2dnZWRfb2ZmOiAoZSwgdXNlciwgaW5kZXgpIC0+XG4gICAgaWYgQG1lbnUgaXMgXCJhZGRfdXNlcnNcIlxuICAgICAgQCRkaXNjdXNzaW9uLmZpbmQoJ2xpLnVzZXInKS5lcShpbmRleCkucmVtb3ZlKClcbiAgICAgIHJldHVyblxuXG4gIHN5bmNfbmV3X2NvbnZvOiAoZSwgbmV3X2NvbnZvKSAtPlxuICAgIGlmIEBtZW51IGlzIFwiY29udm9fc3dpdGNoXCJcbiAgICAgIHZpZXcgPSBuZXcgUGVyc2lzdGVudENvbnZlcnNhdGlvblZpZXcobmV3X2NvbnZvLCB0aGlzKVxuICAgICAgdmlldy5yZW5kZXIoKVxuICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykucHJlcGVuZCh2aWV3LiRlbGVtZW50KVxuXG5cbm1vZHVsZS5leHBvcnRzID0gQ2hhdFJvb21cbiIsImFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5Vc2VyVmlldyA9IHJlcXVpcmUoJy4vdXNlcl92aWV3LmNvZmZlZScpXG5QZXJzaXN0ZW50Q29udmVyc2F0aW9uVmlldyA9IHJlcXVpcmUoJy4vcGVyc2lzdGVudF9jb252ZXJzYXRpb25fdmlldy5jb2ZmZWUnKVxubG9nZ2VkX291dF90ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdGVtcGxhdGVzL2xvZ2dlZF9vdXQuaGJzJylcbmxvZ2dlZF9pbl90ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdGVtcGxhdGVzL2xvZ2dlZF9pbi5oYnMnKVxucHJvZmlsZV90ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdGVtcGxhdGVzL3Byb2ZpbGUuaGJzJylcbkNvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uX21vZGVsLmNvZmZlZScpXG5DaGF0Um9vbSA9IHJlcXVpcmUoJy4vY2hhdF9yb29tX3ZpZXcuY29mZmVlJylcblxuXG5cbiMgQ29udHJvbCBQYW5lbCBmb3IgUGFybGV5LmpzXG4jIFRoaXMgaXMgdGhlIG9ubHkgdmlldyB0aGF0IGNhbm5vdCBiZSByZW1vdmVkLlxuIyBJdCBpcyB0aGUgaHViIGZvciBhbGwgaW50ZXJhY3Rpb24uXG5jbGFzcyBDb21tYW5kQ2VudGVyXG4gIGNvbnN0cnVjdG9yOiAtPlxuXG4gICAgIyMgR0VUIFRISU5HUyBHT0lOR1xuICAgICQoJ2JvZHknKS5hcHBlbmQgbG9nZ2VkX291dF90ZW1wbGF0ZSgpXG4gICAgQGFkZF91c2VyX2JhciA9ICc8ZGl2IGNsYXNzPVwiYWRkLXVzZXItYmFyXCI+PGEgY2xhc3M9XCJjYW5jZWxcIj5DYW5jZWw8L2E+PGEgY2xhc3M9XCJjb25maXJtIGRpc2FibGVkXCI+QWRkIFBlb3BsZTwvYT48L2Rpdj4nXG5cbiAgICAjIyBwdWJfc3ViIGZvciBjb21tYW5kIGNlbnRlciBzeW5jXG4gICAgYXBwLnB1Yl9zdWIub24gJ3VzZXJfbG9nZ2VkX29uJywgQHN5bmNfdXNlcl9sb2dnZWRfb24uYmluZCh0aGlzKVxuICAgIGFwcC5wdWJfc3ViLm9uICd1c2VyX2xvZ2dlZF9vZmYnLCBAc3luY191c2VyX2xvZ2dlZF9vZmYuYmluZCh0aGlzKVxuICAgIGFwcC5wdWJfc3ViLm9uICduZXdfY29udm8nLCBAc3luY19uZXdfY29udm8uYmluZCh0aGlzKVxuXG4gICAgIyMgdmFyaWFibGVzIGZvciBrZWVwaW5nIHRyYWNrIG9mIHZpZXdzIHRvIHJlbW92ZSBsaXN0ZW5lcnNcbiAgICBAcGVyc2lzdF92aWV3X2FycmF5ID0gW11cbiAgbG9nX2luOiAtPlxuICAgIEAkZWxlbWVudCA9ICQobG9nZ2VkX2luX3RlbXBsYXRlKGFwcC5tZSkpXG4gICAgJCgnLnBhcmxleSBzZWN0aW9uLmNvbnRyb2xsZXInKS5odG1sKEAkZWxlbWVudClcbiAgICAkKCcuY29udHJvbGxlci12aWV3JykuaGlkZSgpXG4gICAgJCgnLnBlcnNpc3RlbnQtYmFyJykub24gJ2NsaWNrJywgQHRvZ2dsZV9jb21tYW5kX2NlbnRlci5iaW5kKHRoaXMpXG4gICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci1iYXIgYS5tZXNzYWdlcycpLm9uICdjbGljaycsIEB0b2dnbGVfcGVyc2lzdGVudF9jb252b3MuYmluZCh0aGlzKVxuICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItYmFyIGEuYWN0aXZlLXVzZXJzJykub24gJ2NsaWNrJywgQHRvZ2dsZV9jdXJyZW50X3VzZXJzLmJpbmQodGhpcylcbiAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLWJhciBhLnVzZXItc2V0dGluZ3MnKS5vbiAnY2xpY2snLCBAdG9nZ2xlX3VzZXJfc2V0dGluZ3MuYmluZCh0aGlzKVxuXG4gIHRvZ2dsZV9jb21tYW5kX2NlbnRlcjogKGUpLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgaWYgJCgnZGl2LnBlcnNpc3RlbnQtYmFyIHNwYW4nKS5oYXNDbGFzcygnZW50eXBvLXVwLW9wZW4tbWluaScpXG4gICAgICBAcmVmcmVzaF9jb252b19jcmVhdGlvbigpXG4gICAgICAkKCdkaXYucGVyc2lzdGVudC1iYXIgc3BhbicpLnJlbW92ZUNsYXNzKCdlbnR5cG8tdXAtb3Blbi1taW5pJylcbiAgICAgIC5hZGRDbGFzcygnZW50eXBvLWRvd24tb3Blbi1taW5pJylcbiAgICBlbHNlXG4gICAgICBpZiBAbWVudSBpcyBcInBlcnNpc3RlbnRfY29udm9zXCJcbiAgICAgICAgQHJlbW92ZV9wZXJzaXN0X2NvbnZvX3ZpZXdzKClcbiAgICAgICQoJ2Rpdi5wZXJzaXN0ZW50LWJhciBzcGFuJykucmVtb3ZlQ2xhc3MoJ2VudHlwby1kb3duLW9wZW4tbWluaScpXG4gICAgICAuYWRkQ2xhc3MoJ2VudHlwby11cC1vcGVuLW1pbmknKVxuICAgICQoJy5jb250cm9sbGVyLXZpZXcnKS50b2dnbGUoKVxuXG5cblxuICB0b2dnbGVfY3VycmVudF91c2VyczogKGUpLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgaWYgQG1lbnUgaXNudCBcImN1cnJlbnRfdXNlcnNcIlxuICAgICAgaWYgQG1lbnUgaXMgXCJwZXJzaXN0ZW50X2NvbnZvc1wiXG4gICAgICAgIEByZW1vdmVfcGVyc2lzdF9jb252b192aWV3cygpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5hcHBlbmQoJzxpbnB1dCBjbGFzcz1cInNlYXJjaFwiIHBsYWNlaG9sZGVyPVwiU3RhcnQgIENoYXRcIj4nKVxuXG4gICAgICBmb3IgdXNlciBpbiBhcHAuY3VycmVudF91c2Vyc1xuICAgICAgICB2aWV3ID0gbmV3IFVzZXJWaWV3KHVzZXIsIHRoaXMpXG4gICAgICAgIHZpZXcucmVuZGVyKClcbiAgICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuYXBwZW5kKHZpZXcuJGVsZW1lbnQpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5hcHBlbmQoQGFkZF91c2VyX2JhcilcbiAgICAgIEAkZWxlbWVudC5maW5kKCcuY2FuY2VsJykub24gJ2NsaWNrJywgQHJlZnJlc2hfY29udm9fY3JlYXRpb24uYmluZCh0aGlzKVxuICAgICAgQG1lbnUgPSBcImN1cnJlbnRfdXNlcnNcIlxuICAgICAgQG5ld19jb252b19wYXJhbXMgPSBbXVxuICAgICQoJy5jb250cm9sbGVyLXZpZXcnKS5zaG93KClcbiAgICBpZiAkKCdkaXYucGVyc2lzdGVudC1iYXIgc3BhbicpLmhhc0NsYXNzKCdlbnR5cG8tdXAtb3Blbi1taW5pJylcbiAgICAgICQoJ2Rpdi5wZXJzaXN0ZW50LWJhciBzcGFuJykucmVtb3ZlQ2xhc3MoJ2VudHlwby11cC1vcGVuLW1pbmknKVxuICAgICAgLmFkZENsYXNzKCdlbnR5cG8tZG93bi1vcGVuLW1pbmknKVxuXG5cbiAgdG9nZ2xlX3BlcnNpc3RlbnRfY29udm9zOiAoZSktPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICBpZiBAbWVudSBpc250IFwicGVyc2lzdGVudF9jb252b3NcIlxuICAgICAgJChcIi5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlld1wiKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgICBmb3IgY29udm8gaW4gYXBwLmNvbnZlcnNhdGlvbnNcbiAgICAgICAgaWYgY29udm8ubWVzc2FnZXMubGVuZ3RoID4gMFxuICAgICAgICAgIHZpZXcgPSBuZXcgUGVyc2lzdGVudENvbnZlcnNhdGlvblZpZXcoY29udm8sIHRoaXMpXG4gICAgICAgICAgQHBlcnNpc3Rfdmlld19hcnJheS5wdXNoKHZpZXcpXG4gICAgICAgICAgdmlldy5yZW5kZXIoKVxuICAgICAgICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmFwcGVuZCh2aWV3LiRlbGVtZW50KVxuICAgICAgQG1lbnUgPSBcInBlcnNpc3RlbnRfY29udm9zXCJcbiAgICAkKCcuY29udHJvbGxlci12aWV3Jykuc2hvdygpXG4gICAgaWYgJCgnZGl2LnBlcnNpc3RlbnQtYmFyIHNwYW4nKS5oYXNDbGFzcygnZW50eXBvLXVwLW9wZW4tbWluaScpXG4gICAgICAkKCdkaXYucGVyc2lzdGVudC1iYXIgc3BhbicpLnJlbW92ZUNsYXNzKCdlbnR5cG8tdXAtb3Blbi1taW5pJylcbiAgICAgIC5hZGRDbGFzcygnZW50eXBvLWRvd24tb3Blbi1taW5pJylcblxuXG5cblxuICB0b2dnbGVfdXNlcl9zZXR0aW5nczogKGUpLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgaWYgQG1lbnUgaXNudCBcInVzZXJfc2V0dGluZ3NcIlxuICAgICAgaWYgQG1lbnUgaXMgXCJwZXJzaXN0ZW50X2NvbnZvc1wiXG4gICAgICAgIEByZW1vdmVfcGVyc2lzdF9jb252b192aWV3cygpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5odG1sKHByb2ZpbGVfdGVtcGxhdGUoYXBwLm1lKSlcbiAgICAgIEBtZW51ID0gXCJ1c2VyX3NldHRpbmdzXCJcbiAgICAkKCcuY29udHJvbGxlci12aWV3Jykuc2hvdygpXG4gICAgaWYgJCgnZGl2LnBlcnNpc3RlbnQtYmFyIHNwYW4nKS5oYXNDbGFzcygnZW50eXBvLXVwLW9wZW4tbWluaScpXG4gICAgICAkKCdkaXYucGVyc2lzdGVudC1iYXIgc3BhbicpLnJlbW92ZUNsYXNzKCdlbnR5cG8tdXAtb3Blbi1taW5pJylcbiAgICAgIC5hZGRDbGFzcygnZW50eXBvLWRvd24tb3Blbi1taW5pJylcblxuICBjb25maXJtX25ld19jb252b19wYXJhbXM6IChlKSAtPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICAjIyBidWlsZHMgY29udm8gYmFzZWQgb24gbmV3IGNvbnZvIHBhcmFtcyBwcm9wZXJ0eVxuICAgIGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMgPSBbXVxuICAgIGZvciB1c2VyIGluIEBuZXdfY29udm9fcGFyYW1zXG4gICAgICBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzLnB1c2godXNlci5pbWFnZV91cmwpXG4gICAgY29udm9faWQgPSBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzLmNvbmNhdChhcHAubWUuaW1hZ2VfdXJsKS5zb3J0KCkuam9pbigpXG4gICAgIyMgY2hlY2sgdG8gbWFrZSBzdXJlIGNvbnZvIGlzbid0IGFscmVhZHkgb3BlblxuICAgIGZvciBjb252byBpbiBhcHAub3Blbl9jb252ZXJzYXRpb25zXG4gICAgICBpZiBjb252b19pZCBpcyBjb252b1xuICAgICAgICByZXR1cm5cbiAgICAjIyBjaGVjayB0byBzZWUgaWYgcGVyc2lzdGVudCBjb252byBleGlzdHMgd2l0aCB0aGUgZ3JvdXBcbiAgICBjb252b19leGlzdHMgPSBmYWxzZVxuICAgIGZvciBjb252byBpbiBhcHAuY29udmVyc2F0aW9uc1xuICAgICAgaWYgY29udm8ubWVzc2FnZV9maWx0ZXIgaXMgY29udm9faWRcbiAgICAgICAgY29udm9fZXhpc3RzID0gdHJ1ZVxuICAgICAgICBwZXJzaXN0ZW50X2NvbnZvID0gY29udm9cbiAgICBpZiBjb252b19leGlzdHNcbiAgICAgIGNoYXRfd2luZG93ID0gbmV3IENoYXRSb29tKHBlcnNpc3RlbnRfY29udm8pXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG4gICAgICBAcmVmcmVzaF9jb252b19jcmVhdGlvbigpXG4gICAgZWxzZVxuICAgICAgIyMgY3JlYXRlIG5ldyBjb252ZXJzYXRpb24gd2l0aCBzZWxlY3RlZCBncm91cCBtZW1iZXJzXG4gICAgICBjb252ZXJzYXRpb24gPSBuZXcgQ29udmVyc2F0aW9uKEBuZXdfY29udm9fcGFyYW1zKVxuICAgICAgY2hhdF93aW5kb3cgPSBuZXcgQ2hhdFJvb20oY29udmVyc2F0aW9uKVxuICAgICAgYXBwLmNvbnZlcnNhdGlvbnMucHVzaChjb252ZXJzYXRpb24pXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG4gICAgICBAcmVmcmVzaF9jb252b19jcmVhdGlvbigpXG5cbiAgcmVmcmVzaF9jb252b19jcmVhdGlvbjogKGUpIC0+XG4gICAgaWYgZVxuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIGlmIEBtZW51ID0gXCJwZXJzaXN0ZW50X2NvbnZvc1wiXG4gICAgICBAcmVtb3ZlX3BlcnNpc3RfY29udm9fdmlld3MoKVxuICAgIEBtZW51ID0gXCJjdXJyZW50X3VzZXJzXCJcbiAgICBAbmV3X2NvbnZvX3BhcmFtcyA9IFtdXG4gICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuY2hpbGRyZW4oKS5yZW1vdmUoKVxuICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmFwcGVuZCgnPGlucHV0IGNsYXNzPVwic2VhcmNoXCIgcGxhY2Vob2xkZXI9XCJTdGFydCAgQ2hhdFwiPicpXG4gICAgZm9yIHVzZXIgaW4gYXBwLmN1cnJlbnRfdXNlcnNcbiAgICAgIHZpZXcgPSBuZXcgVXNlclZpZXcodXNlciwgdGhpcylcbiAgICAgIHZpZXcucmVuZGVyKClcbiAgICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmFwcGVuZCh2aWV3LiRlbGVtZW50KVxuICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmFwcGVuZChAYWRkX3VzZXJfYmFyKVxuICAgIEAkZWxlbWVudC5maW5kKCcuY2FuY2VsJykub24gJ2NsaWNrJywgQHJlZnJlc2hfY29udm9fY3JlYXRpb24uYmluZCh0aGlzKVxuXG4gIHN5bmNfdXNlcl9sb2dnZWRfb246IChlLCB1c2VyLCBpbmRleCwgbG9jYXRpb24pIC0+XG4gICAgaWYgQG1lbnUgaXMgXCJjdXJyZW50X3VzZXJzXCJcbiAgICAgIHZpZXcgPSBuZXcgVXNlclZpZXcodXNlciwgdGhpcylcbiAgICAgIHZpZXcucmVuZGVyKClcbiAgICAgIGlmIGxvY2F0aW9uIGlzIFwiZmlyc3RcIiBvciBsb2NhdGlvbiBpcyBcImxhc3RcIlxuICAgICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLmVxKC0xKS5iZWZvcmUodmlldy4kZWxlbWVudClcbiAgICAgIGVsc2VcbiAgICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuZmluZCgnbGkudXNlcicpLmVxKGluZGV4KS5iZWZvcmUodmlldy4kZWxlbWVudClcblxuICBzeW5jX3VzZXJfbG9nZ2VkX29mZjogKGUsIHVzZXIsIGluZGV4KSAtPlxuICAgIGlmIEBtZW51IGlzIFwiY3VycmVudF91c2Vyc1wiXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5maW5kKCdsaS51c2VyJykuZXEoaW5kZXgpLnJlbW92ZSgpXG4gICAgICByZXR1cm5cblxuICBzeW5jX25ld19jb252bzogKGUsIG5ld19jb252bywgaW5kZXgsIGxvY2F0aW9uKSAtPlxuXG4gICAgaWYgbmV3X2NvbnZvLm5vdGlmeVxuICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci1iYXIgYS5tZXNzYWdlcycpLmFkZENsYXNzKCdub3RpZnknKVxuICAgIGlmIEBtZW51IGlzIFwicGVyc2lzdGVudF9jb252b3NcIlxuICAgICAgdmlldyA9IG5ldyBQZXJzaXN0ZW50Q29udmVyc2F0aW9uVmlldyhuZXdfY29udm8sIHRoaXMpXG4gICAgICB2aWV3LnJlbmRlcigpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5wcmVwZW5kKHZpZXcuJGVsZW1lbnQpXG5cbiAgcmVtb3ZlX3BlcnNpc3RfY29udm9fdmlld3M6IC0+XG4gICAgZm9yIHZpZXcgaW4gQHBlcnNpc3Rfdmlld19hcnJheVxuICAgICAgdmlldy5yZW1vdmUoKVxuICAgIEBwZXJzaXN0X3ZpZXdfYXJyYXkubGVuZ3RoID0gMFxuXG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBDb21tYW5kQ2VudGVyKClcblxuIiwiYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcblxuIyMgY29uc3RydWN0b3IgZm9yIGNvbnZlcnNhdGlvbnMgb2JqZWN0cyB0aGF0IHJlcHJlc2VudCBhbGwgcmVsZXZhbnRcbiMjIGRhdGEgYW5kIGxvZ2ljIHBlcnRhaW5pbmcgdG8gbWFuYWdpbmcgYSBjb252ZXJzYXRpb25cbiMjIGluY2x1ZGluZyBhIGNvbGxlY3Rpb24gb2YgbWVzc2FnZSBvYmplY3RzLlxuY2xhc3MgQ29udmVyc2F0aW9uXG5cbiAgY29uc3RydWN0b3I6IChAY29udm9fcGFydG5lcnMsIEBtZXNzYWdlcz1bXSwgQG5vdGlmeT1mYWxzZSkgLT5cbiAgICBAZ2VuZXJhdGVfbWVzc2FnZV9maWx0ZXIoKVxuICAgIEBmaXJzdF9uYW1lX2xpc3QgPSBcIlwiXG4gICAgQGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMgPSBbXVxuXG4gICAgIyMgZHVtbXkgb2JqZWN0IGZvciBwdWIvc3ViXG4gICAgQHB1Yl9zdWIgPSAkKHt9KVxuXG4gICAgZm9yIHVzZXIsIGkgaW4gQGNvbnZvX3BhcnRuZXJzXG4gICAgICBmaXJzdF9uYW1lID0gdXNlci5kaXNwbGF5X25hbWUubWF0Y2goL15bQS16XSsvKVxuICAgICAgaWYgKGkgKyAxKSBpc250IEBjb252b19wYXJ0bmVycy5sZW5ndGhcbiAgICAgICAgQGZpcnN0X25hbWVfbGlzdCArPSBcIiN7Zmlyc3RfbmFtZX0sIFwiXG4gICAgICAgIEBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzLnB1c2godXNlci5pbWFnZV91cmwpXG4gICAgICBlbHNlXG4gICAgICAgIEBmaXJzdF9uYW1lX2xpc3QgKz0gXCIje2ZpcnN0X25hbWV9XCJcbiAgICAgICAgQGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMucHVzaCh1c2VyLmltYWdlX3VybClcblxuICBhZGRfbWVzc2FnZTogKG1lc3NhZ2UsIHNpbGVudCkgLT5cbiAgICBAbWVzc2FnZXMucHVzaCBtZXNzYWdlXG4gICAgaWYgbm90IHNpbGVudFxuICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci1iYXIgYS5tZXNzYWdlcycpLmFkZENsYXNzKCdub3RpZnknKVxuICAgICAgQG5vdGlmeSA9IHRydWVcbiAgICAgIEBwdWJfc3ViLnRyaWdnZXIoJ2NvbnZvX25ld19tZXNzYWdlJywgbWVzc2FnZSlcblxuXG4gIGdlbmVyYXRlX21lc3NhZ2VfZmlsdGVyOiAtPlxuICAgIEBtZXNzYWdlX2ZpbHRlciA9IFthcHAubWUuaW1hZ2VfdXJsXVxuICAgIGZvciBwYXJ0bmVyIGluIEBjb252b19wYXJ0bmVyc1xuICAgICAgQG1lc3NhZ2VfZmlsdGVyLnB1c2ggcGFydG5lci5pbWFnZV91cmxcbiAgICBAbWVzc2FnZV9maWx0ZXIgPSBAbWVzc2FnZV9maWx0ZXIuc29ydCgpLmpvaW4oKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnNhdGlvblxuIiwiYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcblxuIyMgY29uc3RydWN0b3IgZm9yIG9iamVjdCB0aGF0IGNvbnRhaW5zIGFsbCBsb2dpYyBhbmQgZGF0YVxuIyMgYXNzb2NpYXRlZCB3aXRoIGluZGl2aWR1YWwgbWVzc2FnZXNcblxuY2xhc3MgTWVzc2FnZVxuXG4gIGNvbnN0cnVjdG9yOiAoQHJlY2lwaWVudHMsIEBzZW5kZXIsIEBjb250ZW50LCBAaW1hZ2U9ZmFsc2UsIEB0aW1lX3N0YW1wKSAtPlxuICAgIGlmIG5vdCBAdGltZV9zdGFtcFxuICAgICAgQHRpbWVfc3RhbXAgPSBuZXcgRGF0ZSgpLnRvVVRDU3RyaW5nKClcbiAgICBpZF9hcnJheSA9IFtdXG4gICAgZm9yIHVzZXIgaW4gQHJlY2lwaWVudHNcbiAgICAgIGlkX2FycmF5ID0gaWRfYXJyYXkuY29uY2F0KHVzZXIuaW1hZ2VfdXJsKVxuICAgIGlkX2FycmF5ID0gaWRfYXJyYXkuY29uY2F0KEBzZW5kZXIuaW1hZ2VfdXJsKVxuICAgIEBjb252b19pZCA9IGlkX2FycmF5LnNvcnQoKS5qb2luKClcbiAgICBAdGltZV9jcmVhdGVkID0gbmV3IERhdGUoQHRpbWVfc3RhbXApXG4gICAgQHRpbWVfc2luY2VfY3JlYXRlZCA9IEBjYWxjdWxhdGVfdGltZSgpXG5cbiAgY2FsY3VsYXRlX3RpbWU6IC0+XG4gICAgY3VycmVudF90aW1lID0gbmV3IERhdGUoKVxuICAgICMjIENvbnZlcnQgdG8gbWludXRlc1xuICAgIG1pbnV0ZXMgPSBNYXRoLmZsb29yKChjdXJyZW50X3RpbWUgLSBAdGltZV9jcmVhdGVkKSAvIDYwMDAwIClcbiAgICAjIyBkZXRlcm1pbmUgaWYgdG9kYXlcbiAgICBpZiBjdXJyZW50X3RpbWUuZ2V0RGF0ZSgpIGlzIEB0aW1lX2NyZWF0ZWQuZ2V0RGF0ZSgpIGFuZCBtaW51dGVzIDwgMTQ0MFxuICAgICAgdG9kYXkgPSB0cnVlXG4gICAgIyMgQ29udmVydCB0byBob3Vyc1xuICAgIGhvdXJzID0gTWF0aC5mbG9vcigobWludXRlcyAvIDYwICkpXG4gICAgbWludXRlX3JlbWFpbmRlciA9IE1hdGguZmxvb3IoKG1pbnV0ZXMgJSA2MCApKVxuICAgICMjIGZvcm1hdCBtZXNzYWdlXG4gICAgaWYgbWludXRlcyA8IDYwXG4gICAgICByZXR1cm4gXCIje21pbnV0ZXN9IG1pbnMgYWdvXCJcbiAgICBpZiBob3VycyA8IDRcbiAgICAgIGlmIG1pbnV0ZV9yZW1haW5kZXIgaXMgMFxuICAgICAgICByZXR1cm4gXCIje2hvdXJzfSBob3VycyBhZ29cIlxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gXCIje2hvdXJzfSBob3VyICN7bWludXRlX3JlbWFpbmRlcn0gbWluIGFnb1wiXG4gICAgZWxzZVxuICAgICAgIyMgbG9uZyB0ZXJtIG1lc3NhZ2UgZm9ybWF0XG4gICAgICBmX2RhdGUgPSBAZGF0ZV9mb3JtYXR0ZXIoKVxuICAgICAgaWYgdG9kYXlcbiAgICAgICAgcmV0dXJuIFwiI3tmX2RhdGUuaG91cn06I3tmX2RhdGUubWludXRlc30gI3tmX2RhdGUuc3VmZml4fVwiXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBcIiN7Zl9kYXRlLm1vbnRofSAje2ZfZGF0ZS5kYXl9IHwgI3tmX2RhdGUuaG91cn06I3tmX2RhdGUubWludXRlc30gI3tmX2RhdGUuc3VmZml4fVwiXG5cbiAgZGF0ZV9mb3JtYXR0ZXI6IC0+XG4gICAgIyMgZm9ybWF0cyBkYXRlIGZvciBAdGltZV9lbGFwc2VkIGZ1bmN0aW9uXG5cbiAgICBzd2l0Y2ggQHRpbWVfY3JlYXRlZC5nZXRNb250aCgpXG4gICAgICB3aGVuIDAgdGhlbiBuZXdfbW9udGggPSBcIkphblwiXG4gICAgICB3aGVuIDEgdGhlbiBuZXdfbW9udGggPSBcIkZlYlwiXG4gICAgICB3aGVuIDIgdGhlbiBuZXdfbW9udGggPSBcIk1hclwiXG4gICAgICB3aGVuIDMgdGhlbiBuZXdfbW9udGggPSBcIkFwclwiXG4gICAgICB3aGVuIDQgdGhlbiBuZXdfbW9udGggPSBcIk1heVwiXG4gICAgICB3aGVuIDUgdGhlbiBuZXdfbW9udGggPSBcIkp1blwiXG4gICAgICB3aGVuIDYgdGhlbiBuZXdfbW9udGggPSBcIkp1bFwiXG4gICAgICB3aGVuIDcgdGhlbiBuZXdfbW9udGggPSBcIkF1Z1wiXG4gICAgICB3aGVuIDggdGhlbiBuZXdfbW9udGggPSBcIlNlcFwiXG4gICAgICB3aGVuIDkgdGhlbiBuZXdfbW9udGggPSBcIk9jdFwiXG4gICAgICB3aGVuIDEwIHRoZW4gbmV3X21vbnRoID0gXCJOb3ZcIlxuICAgICAgd2hlbiAxMSB0aGVuIG5ld19tb250aCA9IFwiRGVjXCJcblxuICAgIGhvdXJzID0gQHRpbWVfY3JlYXRlZC5nZXRIb3VycygpXG4gICAgaWYgaG91cnMgPiAxMlxuICAgICAgc3VmZml4ID0gXCJQTVwiXG4gICAgICBuZXdfaG91ciA9IGhvdXJzIC0gMTJcbiAgICBlbHNlXG4gICAgICBzdWZmaXggPSBcIkFNXCJcbiAgICAgIG5ld19ob3VyID0gaG91cnNcblxuICAgIG1pbnV0ZXMgPSBAdGltZV9jcmVhdGVkLmdldE1pbnV0ZXMoKVxuICAgIGlmIG1pbnV0ZXMgPCAxMFxuICAgICAgbmV3X21pbnV0ZXMgPSBcIjAje21pbnV0ZXN9XCJcbiAgICBlbHNlXG4gICAgICBuZXdfbWludXRlcyA9IFwiI3ttaW51dGVzfVwiXG5cbiAgICBmb3JtYXRlZCA9XG4gICAgICBtb250aDogbmV3X21vbnRoXG4gICAgICBkYXk6IEB0aW1lX2NyZWF0ZWQuZ2V0RGF0ZSgpXG4gICAgICBob3VyOiBuZXdfaG91clxuICAgICAgbWludXRlczogbmV3X21pbnV0ZXNcbiAgICAgIHN1ZmZpeDogc3VmZml4XG5cbm1vZHVsZS5leHBvcnRzID0gTWVzc2FnZVxuXG5cbiIsIlxuYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcbm1lc3NhZ2VfdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9tZXNzYWdlLmhicycpXG5IYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpXG4jIyBIQU5ETEVCQVIgSEVMUEVSIEZVTkNUSU9OIEZPUiBDQUxDVUxBVElORyBUSU1FIFNJTkNFIE1FU1NBR0UgQ1JFQVRJT05cbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgJ2dlbmVyYXRlX21lc3NhZ2VfY29udGVudCcsIC0+XG4gIGlmIEBpbWFnZVxuICAgIG5ldyBIYW5kbGViYXJzLlNhZmVTdHJpbmcoXCI8aW1nIHNyYz0nXCIgKyBAY29udGVudCArIFwiJz5cIilcbiAgZWxzZVxuICAgIEBjb250ZW50XG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgdGhhdCBjb250YWlucyB0ZW1wbGF0ZSBkYXRhXG4jIyBhbmQgaW50ZXJhY3Rpb24gbG9naWMgZm9yIGluZGl2aWR1YWwgbWVzc2FnZSBtb2RlbHNcbmNsYXNzIE1lc3NhZ2VWaWV3XG5cbiAgY29uc3RydWN0b3I6IChAbWVzc2FnZSkgLT5cblxuXG4gIHJlbmRlcjogLT5cbiAgICAjIyByZW5kZXJzIHRlbXBsYXRlIGRpZmZlcmVudGx5IGlmIHVzZXIgaXMgc2VuZGluZyBvciByZWNpZXZpbmcgdGhlIG1lc3NhZ2VcbiAgICBpZiBAbWVzc2FnZS5zZW5kZXIuaW1hZ2VfdXJsIGlzIGFwcC5tZS5pbWFnZV91cmxcbiAgICAgIEAkZWxlbWVudCA9ICQoJzxsaSBjbGFzcz1cInNlbGZcIj48L2xpPicpLmFwcGVuZChtZXNzYWdlX3RlbXBsYXRlKEBtZXNzYWdlKSlcbiAgICBlbHNlXG4gICAgICBAJGVsZW1lbnQgPSAkKCc8bGkgY2xhc3M9XCJvdGhlclwiPjwvbGk+JykuYXBwZW5kKG1lc3NhZ2VfdGVtcGxhdGUoQG1lc3NhZ2UpKVxuXG5tb2R1bGUuZXhwb3J0cyA9IE1lc3NhZ2VWaWV3IiwiXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuVXNlciA9IHJlcXVpcmUoJy4vdXNlcl9tb2RlbC5jb2ZmZWUnKVxuTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZV9tb2RlbC5jb2ZmZWUnKVxuXG5cbiMjIEFsbCBsb2dpYyByZWxhdGluZyB0byBsb2dpbmcgaW4gdGhyb3VnaCBHb29nbGUgUGx1cyBPYXV0aFxuIyMgYW5kIGFueSBsb2dpYyB1c2VkIGZvciByZXRyaWV2aW5nIGluZm9ybWF0aW9uIHJlcXVpcmluZyBhbiBhY2Nlc3MgdG9rZW4uXG5jbGFzcyBPYXV0aFxuXG4gIGNvbnN0cnVjdG9yOiAtPlxuXG4gIHdpbmRvdy5zaWduX2luX2NhbGxiYWNrID0gKGF1dGhSZXN1bHQpID0+XG4gICAgaWYgYXV0aFJlc3VsdC5zdGF0dXMuc2lnbmVkX2luXG4gICAgICAjIyB1cGRhdGUgdGhlIGFwcCB0byByZWZsZWN0IHRoZSB1c2VyIGlzIHNpZ25lZCBpbi5cbiAgICAgIGdhcGkuY2xpZW50LmxvYWQgJ3BsdXMnLCAndjEnLCA9PlxuICAgICAgICByZXF1ZXN0ID0gZ2FwaS5jbGllbnQucGx1cy5wZW9wbGUuZ2V0KHsndXNlcklkJzogJ21lJ30pXG4gICAgICAgIHJlcXVlc3QuZXhlY3V0ZSAocHJvZmlsZSkgPT5cbiAgICAgICAgICBkaXNwbGF5X25hbWUgPSBwcm9maWxlLmRpc3BsYXlOYW1lXG4gICAgICAgICAgaW1hZ2VfdXJsID0gcHJvZmlsZS5pbWFnZS51cmxcbiAgICAgICAgICBhcHAubWUgPSBuZXcgVXNlciBkaXNwbGF5X25hbWUsIGltYWdlX3VybFxuICAgICAgICAgIGFwcC5zZXJ2ZXIuZW1pdCgnam9pbicsIGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsKVxuICAgICAgICAgIGFwcC5jb21tYW5kX2NlbnRlci5sb2dfaW4oKVxuICAgICAgT2F1dGgucHJvdG90eXBlLmZpbGVfdXBsb2FkID0gKGZpbGUsIGNvbnZvX3BhcnRuZXJzLCBjb252b19pZCkgLT5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICB1cmw6IFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vdXBsb2FkL3N0b3JhZ2UvdjFiZXRhMi9iL3BhcmxleS1pbWFnZXMvbz91cGxvYWRUeXBlPW1lZGlhJm5hbWU9I3tmaWxlLm5hbWV9XCJcbiAgICAgICAgICB0eXBlOiBcIlBPU1RcIlxuICAgICAgICAgIGRhdGE6IGZpbGVcbiAgICAgICAgICBjb250ZW50VHlwZTogZmlsZS50eXBlXG4gICAgICAgICAgcHJvY2Vzc0RhdGE6IGZhbHNlXG4gICAgICAgICAgaGVhZGVyczpcbiAgICAgICAgICAgIEF1dGhvcml6YXRpb246IFwiQmVhcmVyICN7YXV0aFJlc3VsdC5hY2Nlc3NfdG9rZW59XCJcbiAgICAgICAgICBzdWNjZXNzOiAocmVzKSA9PlxuICAgICAgICAgICAgY29udGVudCA9IFwiaHR0cHM6Ly9zdG9yYWdlLmNsb3VkLmdvb2dsZS5jb20vcGFybGV5LWltYWdlcy8je3Jlcy5uYW1lfVwiXG4gICAgICAgICAgICBuZXdfbWVzc2FnZSA9IG5ldyBNZXNzYWdlIGNvbnZvX3BhcnRuZXJzLCBhcHAubWUsIGNvbnRlbnQsIHRydWVcbiAgICAgICAgICAgIGFwcC5zZXJ2ZXIuZW1pdCAnbWVzc2FnZScsIG5ld19tZXNzYWdlXG4gICAgICAgICAgICBmb3IgY29udm8gaW4gYXBwLmNvbnZlcnNhdGlvbnNcbiAgICAgICAgICAgICAgaWYgY29udm8ubWVzc2FnZV9maWx0ZXIgaXMgY29udm9faWRcbiAgICAgICAgICAgICAgICBjb252by5hZGRfbWVzc2FnZShuZXdfbWVzc2FnZSlcbiAgICAgICAgICAgIGZvciBvcGVuX2NvbnZvIGluIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnNcbiAgICAgICAgICAgICAgaWYgb3Blbl9jb252byBpcyBjb252b19pZFxuICAgICAgICAgICAgICAgIGFwcC5wdWJfc3ViLnRyaWdnZXIoJ3BpY3R1cmVfbWVzc2FnZScpXG4gICAgICAgIH0pXG4gICAgZWxzZVxuICAgICAgIyMgbG9naW4gdW5zdWNjZXNzZnVsIGxvZyBlcnJvciB0byB0aGUgY29uc29sZVxuICAgICAgIyNQb3NzaWJsZSBlcnJvciB2YWx1ZXM6XG4gICAgICAjI1widXNlcl9zaWduZWRfb3V0XCIgLSBVc2VyIGlzIHNpZ25lZC1vdXRcbiAgICAgICMjXCJhY2Nlc3NfZGVuaWVkXCIgLSBVc2VyIGRlbmllZCBhY2Nlc3MgdG8geW91ciBhcHBcbiAgICAgICMjXCJpbW1lZGlhdGVfZmFpbGVkXCIgLSBDb3VsZCBub3QgYXV0b21hdGljYWxseSBsb2cgaW4gdGhlIHVzZXJcbiAgICAgIGNvbnNvbGUubG9nKFwiU2lnbi1pbiBzdGF0ZTogI3thdXRoUmVzdWx0LmVycm9yfVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBPYXV0aCgpIiwiYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcbkhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYW5kbGViYXJzJylcbnBlcnNpc3RlbnRfY29udm9fdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9wZXJzaXN0ZW50X2NvbnZvX3JlZy5oYnMnKVxuSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKVxuXG4jIyBIQU5ETEVCQVJTIEhFTFBFUiBGVU5DVElPTlMgRk9SIFBFUlNJU1RFTlQgTUVTU0FHRSBURU1QTEFURVxuSGFuZGxlYmFycy5yZWdpc3RlckhlbHBlciAnZm9ybWF0X2ltYWdlJywgLT5cbiAgaWYgQGNvbnZvX3BhcnRuZXJzLmxlbmd0aCA8IDJcbiAgIG5ldyBIYW5kbGViYXJzLlNhZmVTdHJpbmcoXCI8aW1nIHNyYz0nXCIgKyBAY29udm9fcGFydG5lcnNfaW1hZ2VfdXJsc1swXSArIFwiJz5cIilcbiAgZWxzZVxuICAgIGltYWdlX3VybHMgPSBcIlwiXG4gICAgZm9yIGltYWdlIGluIEBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzXG4gICAgICBpbWFnZV91cmxzID0gaW1hZ2VfdXJscy5jb25jYXQoXCI8aW1nIHNyYz0nXCIgKyBpbWFnZSArIFwiJz5cIilcbiAgICBuZXcgSGFuZGxlYmFycy5TYWZlU3RyaW5nKGltYWdlX3VybHMpXG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgJ2Zvcm1hdF9kaXNwbGF5X25hbWUnLCAtPlxuICBpZiBAY29udm9fcGFydG5lcnMubGVuZ3RoIDwgMlxuICAgIEBjb252b19wYXJ0bmVyc1swXS5kaXNwbGF5X25hbWVcbiAgZWxzZVxuICAgIEBmaXJzdF9uYW1lX2xpc3RcblxuSGFuZGxlYmFycy5yZWdpc3RlckhlbHBlciAncmV0cmlldmVfbGFzdF9tZXNzYWdlJywgLT5cbiAgbGFzdF9tZXNzYWdlID0gQG1lc3NhZ2VzW0BtZXNzYWdlcy5sZW5ndGggLSAxXVxuICBpZiBsYXN0X21lc3NhZ2UuaW1hZ2VcbiAgICBmaWxlX25hbWUgPSBsYXN0X21lc3NhZ2UuY29udGVudC5yZXBsYWNlKC9eKGh0dHBzXFw6XFwvXFwvc3RvcmFnZVxcLmNsb3VkXFwuZ29vZ2xlXFwuY29tXFwvcGFybGV5LWltYWdlc1xcLykoLispLywgXCIkMlwiKVxuICAgIHJldHVybiBcIklNQUdFIE1FU1NBR0U6ICN7ZmlsZV9uYW1lfVwiXG4gIGVsc2VcbiAgICB0cnVuY19tZXNzYWdlID0gbGFzdF9tZXNzYWdlLmNvbnRlbnQuc2xpY2UoMCwgMjUpXG4gICAgcmV0dXJuIFwiI3t0cnVuY19tZXNzYWdlfS4uLiBcIlxuXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyICdjYWxjdWxhdGVfbGFzdF9tZXNzYWdlX3RpbWUnLCAtPlxuICB0aGlzLm1lc3NhZ2VzW3RoaXMubWVzc2FnZXMubGVuZ3RoIC0gMV0uY2FsY3VsYXRlX3RpbWUoKVxuXG4jIyBUaGlzIGlzIHRoZSBjb25zdHJ1Y3RvciBmb3IgZWFjaCBwZXJzaXN0ZW50IG1lc3NhZ2UgaW4gdGhlIGxpc3Qgdmlld1xuIyMgaXQgY29udGFpbnMgdGhlIHRlbXBsYXRlIGFuZGxvZ2ljIGZvciByZW5kZXJpbmcgdGhlIGxpc3QgdGhhdCBhcHBlYXJzIGluXG4jIyBib3RoIHRoZSBjaGF0IHdpbmRvdyBhbmQgY29tbWFuZCBjZW50ZXIgdmlld3MgYW5kIHRoZSBjb3JyZXNwb25kaW5nIHVzZXIgaW50ZXJhY3Rpb24gbG9naWMuXG5jbGFzcyBQZXJzaXN0ZW50Q29udmVyc2F0aW9uVmlld1xuXG4gIGNvbnN0cnVjdG9yOiAoQGNvbnZvLCBAY3VycmVudF92aWV3KSAtPlxuICAgIEAkZWxlbWVudCA9ICQoJzxkaXYgY2xhc3M9XCJtZXNzYWdlIGV4aXN0aW5nXCI+PC9kaXY+JylcbiAgICBpZiBAY29udm8ubm90aWZ5XG4gICAgICBAJGVsZW1lbnQuYWRkQ2xhc3MoJ25vdGlmeScpXG5cbiAgICAjI3B1Yi9zdWIgYmluZGluZ3MgZm9yIGR5bmFtaWMgRE9NIHVwZGF0aW5nXG4gICAgQGNvbnZvLnB1Yl9zdWIub24gXCJjb252b19uZXdfbWVzc2FnZVwiLCBAc3luY19jb252b19uZXdfbWVzc2FnZS5iaW5kKHRoaXMpXG5cblxuICByZW5kZXI6IC0+XG4gICAgQCRlbGVtZW50Lmh0bWwocGVyc2lzdGVudF9jb252b190ZW1wbGF0ZShAY29udm8pKVxuICAgIEAkZWxlbWVudC5vbiAnY2xpY2snLCBAbG9hZF9jb252by5iaW5kKHRoaXMpXG5cbiAgcmVtb3ZlOiAtPlxuICAgIEBjb252by5wdWJfc3ViLm9mZigpXG5cblxuICBsb2FkX2NvbnZvOiAtPlxuICAgICMjIGlmIGNvbnZvIGlzbid0IG9wZW4gbG9hZCBuZXcgY2hhdCB3aW5kb3cgd2l0aCBjb252b1xuICAgIGNvbnZvX3N0YXR1cyA9ICdjbG9zZWQnXG4gICAgZm9yIG9wZW5fY29udm8gaW4gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgICAgaWYgQGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIG9wZW5fY29udm9cbiAgICAgICAgY29udm9fc3RhdHVzID0gJ29wZW4nXG5cbiAgICBpZiBAY3VycmVudF92aWV3IGluc3RhbmNlb2YgQ2hhdFJvb21cblxuICAgICAgaWYgY29udm9fc3RhdHVzIGlzbnQgJ29wZW4nIG9yIEBjb252by5tZXNzYWdlX2ZpbHRlciBpcyBAY3VycmVudF92aWV3LmNvbnZvLm1lc3NhZ2VfZmlsdGVyXG5cbiAgICAgICAgIyMgcmVtb3ZlIGN1cnJlbnQgY29udmVyc2F0aW9uIGZyb20gb3BlbiBjb252ZXJzYXRpb25cblxuICAgICAgICBpZiBAY29udm8ubm90aWZ5XG4gICAgICAgICAgQGNvbnZvLm5vdGlmeSA9IGZhbHNlXG4gICAgICAgICAgQCRlbGVtZW50LnJlbW92ZUNsYXNzKCdub3RpZnknKVxuICAgICAgICBuZXdfb3Blbl9jb252b3MgPSBbXVxuICAgICAgICBmb3Igb3Blbl9jb252byBpbiBhcHAub3Blbl9jb252ZXJzYXRpb25zXG4gICAgICAgICAgaWYgb3Blbl9jb252byBpc250IEBjdXJyZW50X3ZpZXcuY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgICAgICAgIG5ld19vcGVuX2NvbnZvcy5wdXNoKG9wZW5fY29udm8pXG4gICAgICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMgPSBuZXdfb3Blbl9jb252b3NcblxuICAgICAgICBAY3VycmVudF92aWV3LmNvbnZvID0gQGNvbnZvXG4gICAgICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMucHVzaChAY29udm8ubWVzc2FnZV9maWx0ZXIpXG4gICAgICAgIEBjdXJyZW50X3ZpZXcucmVuZGVyKClcbiAgICAgICAgQGN1cnJlbnRfdmlldy5sb2FkUGVyc2lzdGVudE1lc3NhZ2VzKClcbiAgICAgICAgQGN1cnJlbnRfdmlldy5zd2l0Y2htb2RlID0gZmFsc2VcblxuICAgIGVsc2VcbiAgICAgIGlmIGNvbnZvX3N0YXR1cyBpc250ICdvcGVuJ1xuICAgICAgICBpZiBAY29udm8ubm90aWZ5XG4gICAgICAgICAgQGNvbnZvLm5vdGlmeSA9IGZhbHNlXG4gICAgICAgICAgQCRlbGVtZW50LnJlbW92ZUNsYXNzKCdub3RpZnknKVxuICAgICAgICAjIGlmIGNvbnZvX3N0YXR1cyBpc250ICdvcGVuJ1xuICAgICAgICBjaGF0X3dpbmRvdyA9IG5ldyBDaGF0Um9vbShAY29udm8pXG4gICAgICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMucHVzaChAY29udm8ubWVzc2FnZV9maWx0ZXIpXG5cbiAgICBAcmVtb3ZlX2NvbW1hbmRfY2VudGVyX25vdGlmaWNhdGlvbigpXG5cbiAgc3luY19jb252b19uZXdfbWVzc2FnZTogKGUsIG1lc3NhZ2UpLT5cblxuICAgIEAkZWxlbWVudC5yZW1vdmUoKVxuICAgIEByZW5kZXIoKVxuICAgIGlmIG1lc3NhZ2Uuc2VuZGVyLmltYWdlX3VybCBpc250IGFwcC5tZS5pbWFnZV91cmxcbiAgICAgIEAkZWxlbWVudC5hZGRDbGFzcygnbm90aWZ5JylcbiAgICBlbHNlXG4gICAgICBAJGVsZW1lbnQucmVtb3ZlQ2xhc3MoJ25vdGlmeScpXG4gICAgaWYgQGN1cnJlbnRfdmlldyBpbnN0YW5jZW9mIENoYXRSb29tXG4gICAgICBAY3VycmVudF92aWV3LiRkaXNjdXNzaW9uLnByZXBlbmQoQCRlbGVtZW50KVxuICAgIGVsc2VcbiAgICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLnByZXBlbmQoQCRlbGVtZW50KVxuICAgIEByZW1vdmVfY29tbWFuZF9jZW50ZXJfbm90aWZpY2F0aW9uKClcblxuICByZW1vdmVfY29tbWFuZF9jZW50ZXJfbm90aWZpY2F0aW9uOiAtPlxuICAgICMjIHJlbW92ZXMgbm90aWZpY2F0aW9uIGZyb20gY29tbWFuZCBjZW50ZXIgYmFyIGlmIGFsbCBtZXNzYWdlcyBhcmUgcmVhZFxuICAgIGlmIEBjdXJyZW50X3ZpZXcuY29uc3RydWN0b3IubmFtZSBpcyBcIkNvbW1hbmRDZW50ZXJcIlxuICAgICAgaGFzX2NsYXNzID0gdHJ1ZVxuICAgICAgZm9yIHZpZXcgaW4gQGN1cnJlbnRfdmlldy5wZXJzaXN0X3ZpZXdfYXJyYXlcbiAgICAgICAgaWYgbm90IHZpZXcuJGVsZW1lbnQuaGFzQ2xhc3MoJ25vdGlmeScpXG4gICAgICAgICAgaGFzX2NsYXNzID0gZmFsc2VcbiAgICAgIGlmIG5vdCBoYXNfY2xhc3NcbiAgICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci1iYXIgYS5tZXNzYWdlcycpLnJlbW92ZUNsYXNzKCdub3RpZnknKVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBQZXJzaXN0ZW50Q29udmVyc2F0aW9uVmlld1xuXG5DaGF0Um9vbSA9IHJlcXVpcmUoJy4vY2hhdF9yb29tX3ZpZXcuY29mZmVlJykiLCIvLyBoYnNmeSBjb21waWxlZCBIYW5kbGViYXJzIHRlbXBsYXRlXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKTtcbm1vZHVsZS5leHBvcnRzID0gSGFuZGxlYmFycy50ZW1wbGF0ZShmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgaGVscGVyLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbjtcblxuXG4gIGJ1ZmZlciArPSBcIlxcbjxzZWN0aW9uIGNsYXNzPVxcXCJjb252ZXJzYXRpb25cXFwiPlxcbiAgPGRpdiBjbGFzcz1cXFwidG9wLWJhclxcXCI+XFxuICAgIDxhPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy50aXRsZV9iYXJfZnVuY3Rpb24pIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAudGl0bGVfYmFyX2Z1bmN0aW9uKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIjwvYT5cXG4gICAgPHVsIGNsYXNzPVxcXCJtZXNzYWdlLWFsdFxcXCI+XFxuICAgICAgPGxpIGNsYXNzPVxcXCJlbnR5cG8tbWludXMgbWluaWZ5XFxcIj48L2xpPlxcbiAgICAgIDxsaSBjbGFzcz1cXFwiZW50eXBvLXJlc2l6ZS1mdWxsXFxcIj48L2xpPlxcbiAgICAgIDxsaSBjbGFzcz1cXFwiZW50eXBvLWNhbmNlbCBjaGF0LWNsb3NlXFxcIj48L2xpPlxcbiAgICA8L3VsPlxcbiAgPC9kaXY+XFxuICA8ZGl2IGNsYXNzPVxcXCJtZXNzYWdlLWFyZWFcXFwiPlxcbiAgICA8ZGl2IGNsYXNzPVxcXCJtZXNzYWdlLWJhclxcXCI+XFxuICAgICAgPHVsIGNsYXNzPVxcXCJhZGRpdGlvbmFsXFxcIj5cXG4gICAgICAgIDxsaT48YSBjbGFzcz1cXFwiZW50eXBvLXVzZXItYWRkXFxcIj48L2E+PC9saT5cXG4gICAgICA8L3VsPlxcbiAgICAgIDx1bCBjbGFzcz1cXFwiZXhpc3RpbmdcXFwiPlxcbiAgICAgICAgPGxpPjxhIGNsYXNzPVxcXCJlbnR5cG8tY2hhdFxcXCI+PC9hPjwvbGk+XFxuICAgICAgPC91bD5cXG4gICAgPC9kaXY+XFxuICAgIDxvbCBjbGFzcz1cXFwiZGlzY3Vzc2lvblxcXCI+PC9vbD5cXG4gICAgPHRleHRhcmVhIGNsYXNzPVxcXCJzZW5kXFxcIiBtYXhsZW5ndGg9XFxcIjE4MDBcXFwiIHBsYWNlaG9sZGVyPVxcXCJFbnRlciBNZXNzYWdlLi4uXFxcIj48L3RleHRhcmVhPlxcbiAgICA8c3Bhbj5cXG4gICAgICA8aW5wdXQgY2xhc3M9XFxcInBhcmxleV9maWxlX3VwbG9hZFxcXCIgbmFtZT1cXFwiaW1nX3VwbG9hZFxcXCIgdHlwZT1cXFwiZmlsZVxcXCIgLz5cXG4gICAgPC9zcGFuPlxcbiAgICA8bGFiZWwgY2xhc3M9XFxcImltZ191cGxvYWQgZW50eXBvLWNhbWVyYVxcXCI+PC9sYWJlbD5cXG4gIDwvZGl2Plxcbjwvc2VjdGlvbj5cIjtcbiAgcmV0dXJuIGJ1ZmZlcjtcbiAgfSk7XG4iLCIvLyBoYnNmeSBjb21waWxlZCBIYW5kbGViYXJzIHRlbXBsYXRlXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKTtcbm1vZHVsZS5leHBvcnRzID0gSGFuZGxlYmFycy50ZW1wbGF0ZShmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgaGVscGVyLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbjtcblxuXG4gIGJ1ZmZlciArPSBcIjxkaXYgY2xhc3M9XFxcImF2YXRhclxcXCI+XFxuICA8aW1nIHNyYz0gXCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmltYWdlX3VybCkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5pbWFnZV91cmwpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiIC8+XFxuPC9kaXY+XFxuPGRpdiBjbGFzcz1cXFwiY29udGVudFxcXCI+XFxuICA8aDI+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmRpc3BsYXlfbmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5kaXNwbGF5X25hbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9oMj5cXG48L2Rpdj5cXG5cIjtcbiAgcmV0dXJuIGJ1ZmZlcjtcbiAgfSk7XG4iLCIvLyBoYnNmeSBjb21waWxlZCBIYW5kbGViYXJzIHRlbXBsYXRlXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKTtcbm1vZHVsZS5leHBvcnRzID0gSGFuZGxlYmFycy50ZW1wbGF0ZShmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgaGVscGVyLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbjtcblxuXG4gIGJ1ZmZlciArPSBcIjxkaXYgY2xhc3M9XFxcInBlcnNpc3RlbnQtYmFyXFxcIj5cXG4gIDxpbWcgc3JjPVxcXCJcIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuaW1hZ2VfdXJsKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmltYWdlX3VybCk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCJcXFwiIC8+XFxuICA8YT5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuZGlzcGxheV9uYW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmRpc3BsYXlfbmFtZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCJcXG4gICAgPHNwYW4gY2xhc3M9XFxcImVudHlwby11cC1vcGVuLW1pbmlcXFwiPjwvc3Bhbj5cXG4gIDwvYT5cXG4gIDwvZGl2PlxcbjxkaXYgY2xhc3M9XFxcImNvbnRyb2xsZXItdmlld1xcXCI+XFxuPC9kaXY+XFxuPGRpdiBjbGFzcz1cXFwiY29udHJvbGxlci1iYXJcXFwiPlxcbiAgPHVsIGNsYXNzPVxcXCJ1dGlsaXR5LWJhciBob3Jpem9udGFsLWxpc3RcXFwiPlxcbiAgICA8bGk+XFxuICAgICAgPGEgY2xhc3M9XFxcIm1lc3NhZ2VzXFxcIiA+XFxuICAgICAgICA8c3BhbiBjbGFzcz1cXFwiZW50eXBvLWNoYXRcXFwiPjwvc3Bhbj5cXG4gICAgICA8L2E+XFxuICAgIDwvbGk+XFxuICAgIDxsaT5cXG4gICAgICA8YSBjbGFzcz1cXFwidXNlci1zZXR0aW5nc1xcXCIgPlxcbiAgICAgICAgPHNwYW4gY2xhc3M9XFxcImZvbnRhd2Vzb21lLWNvZ1xcXCI+PC9zcGFuPlxcbiAgICAgIDwvYT5cXG4gICAgPC9saT5cXG4gICAgPGxpPlxcbiAgICAgIDxhIGNsYXNzPVxcXCJhY3RpdmUtdXNlcnNcXFwiID5cXG4gICAgICAgIDxzcGFuIGNsYXNzPVxcXCJlbnR5cG8tdXNlcnNcXFwiPjwvc3Bhbj5cXG4gICAgICA8L2E+XFxuICAgIDwvbGk+XFxuICA8L3VsPlxcbjwvZGl2PlwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICBcblxuXG4gIHJldHVybiBcIjxkaXYgY2xhc3M9XFxcInBhcmxleVxcXCI+XFxuICA8c2VjdGlvbiBjbGFzcz1cXFwiY29udHJvbGxlclxcXCI+XFxuICAgICAgPGRpdiBjbGFzcz1cXFwiZy1zaWduaW4gbG9naW4tYmFyXFxcIlxcbiAgICAgICAgZGF0YS1jYWxsYmFjaz1cXFwic2lnbl9pbl9jYWxsYmFja1xcXCJcXG4gICAgICAgIGRhdGEtY2xpZW50aWQ9XFxcIjEwMjc0MjcxMTY3NjUtOWMxOGNrdW8wN3I1bXMwYWNsYmZqc21jcGQzanJtdGMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb21cXFwiXFxuICAgICAgICBkYXRhLWNvb2tpZXBvbGljeT1cXFwic2luZ2xlX2hvc3Rfb3JpZ2luXFxcIlxcbiAgICAgICAgZGF0YS10aGVtZT1cXFwibm9uZVxcXCJcXG4gICAgICAgIGRhdGEtc2NvcGU9XFxcImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvcGx1cy5sb2dpbiBodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2RldnN0b3JhZ2UucmVhZF93cml0ZVxcXCI+XFxuICAgICAgICA8bGkgY2xhc3M9XFxcImJ0blxcXCI+XFxuICAgICAgICAgIDxhIGNsYXNzPVxcXCJlbnR5cG8tZ3BsdXNcXFwiPjwvYT5cXG4gICAgICAgIDwvbGk+XFxuICAgICAgICA8bGkgY2xhc3M9XFxcImFzaWRlXFxcIj5cXG4gICAgICAgICAgPGE+IFNpZ24gaW4gd2l0aCBnb29nbGU8L2E+XFxuICAgICAgICA8L2xpPlxcbiAgICAgIDwvZGl2PlxcbiAgPC9zZWN0aW9uPlxcbjwvZGl2PlwiO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwiYXZhdGFyXFxcIj5cXG4gIDxpbWcgc3JjPVwiXG4gICAgKyBlc2NhcGVFeHByZXNzaW9uKCgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zZW5kZXIpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLmltYWdlX3VybCkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKSlcbiAgICArIFwiIC8+XFxuPC9kaXY+XFxuPGRpdiBjbGFzcz1cXFwibWVzc2FnZSBzdGF0dXNcXFwiPlxcbiAgPGgyPlwiXG4gICAgKyBlc2NhcGVFeHByZXNzaW9uKCgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zZW5kZXIpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLmRpc3BsYXlfbmFtZSkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKSlcbiAgICArIFwiPC9oMj5cXG4gIDxwPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5nZW5lcmF0ZV9tZXNzYWdlX2NvbnRlbnQpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuZ2VuZXJhdGVfbWVzc2FnZV9jb250ZW50KTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIjwvcD5cXG4gIDxhIGNsYXNzPVxcXCJ0aW1lXFxcIj5cXG4gICAgPHNwYW4gY2xhc3M9XFxcImVudHlwby1jbG9ja1xcXCI+ICAgXCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLnRpbWVfc2luY2VfY3JlYXRlZCkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC50aW1lX3NpbmNlX2NyZWF0ZWQpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9zcGFuPlxcbiAgPC9hPlxcbjwvZGl2PlwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwiYXZhdGFyXFxcIj5cXG4gIFwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5mb3JtYXRfaW1hZ2UpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuZm9ybWF0X2ltYWdlKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIlxcbjwvZGl2PlxcbjxkaXYgY2xhc3M9XFxcImNvbnRlbnQgc3RhdHVzIGVudHlwby1yaWdodC1vcGVuLWJpZ1xcXCI+XFxuICA8aDI+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmZvcm1hdF9kaXNwbGF5X25hbWUpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuZm9ybWF0X2Rpc3BsYXlfbmFtZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L2gyPlxcbiAgPHA+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLnJldHJpZXZlX2xhc3RfbWVzc2FnZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5yZXRyaWV2ZV9sYXN0X21lc3NhZ2UpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9wPlxcbiAgPGEgY2xhc3M9XFxcInRpbWVcXFwiPlxcbiAgICA8c3BhbiBjbGFzcz1cXFwiZW50eXBvLWNsb2NrXFxcIj4gXCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmNhbGN1bGF0ZV9sYXN0X21lc3NhZ2VfdGltZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5jYWxjdWxhdGVfbGFzdF9tZXNzYWdlX3RpbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9zcGFuPlxcbiAgPC9hPlxcbjwvZGl2PlxcblwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwiZGVmYXVsdC12aWV3XFxcIj5cXG4gIDxmaWd1cmU+XFxuICAgIDxpbWcgc3JjPVwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5pbWFnZV91cmwpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuaW1hZ2VfdXJsKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIiAvPlxcbiAgICA8aDI+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmRpc3BsYXlfbmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5kaXNwbGF5X25hbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9oMj5cXG4gIDwvZmlndXJlPlxcbjwvZGl2PlwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIlxuYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcblxuIyNjb25zdHJ1Y3RvciBmb3Igb2JqZWN0IHRoYXQgaG9sZHMgYWxsXG4jI2RhdGEgYW5kIGxvZ2ljIHJlbGF0ZWQgdG8gZWFjaCB1c2VyXG5cbmNsYXNzIFVzZXJcblxuICBjb25zdHJ1Y3RvcjogKEBkaXNwbGF5X25hbWUsIEBpbWFnZV91cmwpIC0+XG4gICAgIyMgYWN0aXZlLCBpZGxlLCBhd2F5LCBvciBETkRcbiAgICBAc3RhdHVzID0gXCJhY3RpdmVcIlxuXG5cbm1vZHVsZS5leHBvcnRzID0gVXNlciIsIlxuYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcbkNvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uX21vZGVsLmNvZmZlZScpXG5jdXJyZW50X3VzZXJfdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9jdXJyZW50X3VzZXIuaGJzJylcblxuIyMgVGhpcyBpcyB0aGUgY29uc3RydWN0b3IgZm9yIGVhY2ggbGlzdCBpdGVtY29ycmVzcG9uZGluZyB0byBsb2dnZWRcbiMjIG9uIHVzZXJzIGRpc3BsYXllZCBpbiB0aGUgbG9nZ2VkIG9uIHVzZXJzIGxpc3Qgb24gYm90aFxuIyMgY29tbWFuZCBjZW50ZXIgYW5kIGNoYXQgd2luZG93IHZpZXdzLlxuY2xhc3MgVXNlclZpZXdcblxuICBjb25zdHJ1Y3RvcjogKEBjdXJyZW50X3VzZXIsIEBjdXJyZW50X3ZpZXcpIC0+XG4gICAgQCRlbGVtZW50ID0gJChcIjxsaSBjbGFzcz0ndXNlcic+PC9saT5cIilcbiAgICBAJGVsZW1lbnQub24gJ2NsaWNrJywgQHVzZXJfaW50ZXJhY3RfY2FsbGJhY2suYmluZCh0aGlzKVxuXG4gICAgIyMgY2hlY2tzIGlmIHVzZXIgaXMgYWxyZWFkeSBpbiBjdXJyZW50IGNvbnZlcnNhdGlvbiBzbyB0aGF0IHVzZXIgY2Fubm90IGJlIGFkZGVkIHR3aWNlLlxuICAgIGlmIEBjdXJyZW50X3ZpZXcuY29uc3RydWN0b3IubmFtZSBpcyBcIkNoYXRSb29tXCJcbiAgICAgIGZvciBtZW1iZXIgaW4gQGN1cnJlbnRfdmlldy5jb252by5jb252b19wYXJ0bmVyc1xuICAgICAgICBpZiBtZW1iZXIuaW1hZ2VfdXJsIGlzIEBjdXJyZW50X3VzZXIuaW1hZ2VfdXJsXG4gICAgICAgICAgQCRlbGVtZW50LmFkZENsYXNzKCdkaXNhYmxlZCcpXG4gICAgICAgICAgQCRlbGVtZW50Lm9mZigpXG5cblxuICByZW5kZXI6IC0+XG4gICAgQCRlbGVtZW50Lmh0bWwoY3VycmVudF91c2VyX3RlbXBsYXRlKEBjdXJyZW50X3VzZXIpKVxuXG5cblxuICB1c2VyX2ludGVyYWN0X2NhbGxiYWNrOiAtPlxuICAgICMjIGFkZC9yZW1vdmUgdXNlciBpbiBuZXcgY29udm8gYnVpbGQgcGFyYW1zIGxvY2F0ZWQgaW4gYm90aCBjbWQgY2VudGVyIGFuZCBjaGF0IHdpbmRvd3MuXG4gICAgICBpZiBAJGVsZW1lbnQuaGFzQ2xhc3MoJ3NlbGVjdGVkJylcbiAgICAgICAgbmV3X3BhcmFtcyA9IFtdXG4gICAgICAgIGZvciB1c2VyIGluIEBjdXJyZW50X3ZpZXcubmV3X2NvbnZvX3BhcmFtc1xuICAgICAgICAgIGlmIHVzZXIuaW1hZ2VfdXJsIGlzbnQgQGN1cnJlbnRfdXNlci5pbWFnZV91cmxcbiAgICAgICAgICAgIG5ld19wYXJhbXMucHVzaCh1c2VyKVxuICAgICAgICBAY3VycmVudF92aWV3Lm5ld19jb252b19wYXJhbXMgPSBuZXdfcGFyYW1zXG4gICAgICAgIEAkZWxlbWVudC5yZW1vdmVDbGFzcygnc2VsZWN0ZWQnKVxuICAgICAgZWxzZVxuICAgICAgICBAY3VycmVudF92aWV3Lm5ld19jb252b19wYXJhbXMucHVzaChAY3VycmVudF91c2VyKVxuICAgICAgICBAJGVsZW1lbnQuYWRkQ2xhc3MoJ3NlbGVjdGVkJylcbiAgICAgICMjIGhhbmRsZSBjb25maXJtIGJ1dHRvbiBET00gY2xhc3Mgc3R5aW5nIGFuZCBhZGRpbmcvcmVtb3ZpbmcgbGlzdGVuZXJcblxuICAgICAgaWYgQGN1cnJlbnRfdmlldy5uZXdfY29udm9fcGFyYW1zLmxlbmd0aCA+IDBcblxuICAgICAgICBAY3VycmVudF92aWV3LiRlbGVtZW50LmZpbmQoJy5jb25maXJtJykucmVtb3ZlQ2xhc3MoJ2Rpc2FibGVkJykub2ZmKClcbiAgICAgICAgLm9uICdjbGljaycsIEBjdXJyZW50X3ZpZXcuY29uZmlybV9uZXdfY29udm9fcGFyYW1zLmJpbmQoQGN1cnJlbnRfdmlldylcbiAgICAgIGVsc2VcbiAgICAgICAgQGN1cnJlbnRfdmlldy4kZWxlbWVudC5maW5kKCcuY29uZmlybScpLmFkZENsYXNzKCdkaXNhYmxlZCcpLm9mZigpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBVc2VyVmlldyJdfQ==
