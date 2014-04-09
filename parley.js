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
var App, Conversation, User, command_center, oauth, object, parley;

object = {};

module.exports = object;


/*   PARLEY.JS CHAT LIBRARY EXTRODINAIRE */

App = (function() {
  function App() {
    this.current_users = [];
    this.open_conversations = [];
    this.conversations = [];
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
    this.server.on('persistent_convo', this.load_persistent_convo.bind(this));
    this.server.on('current_users', this.load_current_users.bind(this));
    this.server.on('user_logged_on', this.user_logged_on.bind(this));
    this.server.on('user_logged_off', this.user_logged_off.bind(this));
  }

  App.prototype.server = io.connect('wss://' + window.location.hostname);

  App.prototype.load_persistent_convo = function(convo_key, messages) {
    var convo, convo_members, id, _i, _len;
    convo_members = convo_key.split(',');
    for (_i = 0, _len = convo_members.length; _i < _len; _i++) {
      id = convo_members[_i];
      if (id !== this.app.me.image_url) {
        convo_partners += id;
      }
    }
    convo = new Conversation(convo_partners, messages);
    return this.conversations.push(convo);
  };

  App.prototype.load_current_users = function(logged_on) {
    var i, user, _i, _len, _ref, _results;
    this.current_users = logged_on;
    _ref = this.current_users;
    _results = [];
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      if (user.image_url === this.me.image_url) {
        _results.push(this.current_users.splice(i, 1));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  App.prototype.user_logged_on = function(display_name, image_url) {
    var user;
    user = new User(display_name, image_url);
    return this.current_users.push(user);
  };

  App.prototype.user_logged_off = function(display_name, image_url) {
    var user, _i, _len, _ref, _results;
    _ref = this.current_users;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      if (image_url === user.image_url) {
        _results.push(this.current_users.splice(i, 1));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  return App;

})();

parley = new App();

module.exports = parley;

oauth = require('./oauth.coffee');

command_center = require('./command_center_view.coffee');

Conversation = require('./conversation_model.coffee');

User = require('./user_model.coffee');

App.prototype.command_center = command_center;

App.prototype.oauth = oauth;


},{"./command_center_view.coffee":21,"./conversation_model.coffee":22,"./oauth.coffee":25,"./user_model.coffee":34}],20:[function(require,module,exports){
var ChatRoom, Conversation, Message, MessageView, app, chat_room_template;

app = require('./app.coffee');

Message = require('./message_model.coffee');

MessageView = require('./message_view.coffee');

Conversation = require('./conversation_model.coffee');

chat_room_template = require('./templates/chat_room.hbs');

ChatRoom = (function() {
  function ChatRoom(convo) {
    this.convo = convo;
    console.log("i'm here!!");
    console.log(app);
    this.render();
    $('body').append(this.$element);
    console.log("now I'm Here");
    app.server.on('message', this.message_callback.bind(this));
    app.server.on('user_offline', this.user_offline_callback.bind(this));
    app.server.on('typing_notification', this.typing_notification_callback.bind(this));
    this.$element.find('.chat-close').on('click', this.closeWindow);
    this.$element.find('.send').on('keypress', this.sendOnEnter);
    this.$element.find('.send').on('keyup', this.emitTypingNotification);
    this.$element.find('.top-bar, minify ').on('click', this.toggleChat);
    this.$element.on('click', this.removeNotifications);
    this.$discussion.find('.parley_file_upload').on('change', this.file_upload);
    console.log("way down here");
  }

  ChatRoom.prototype.message_callback = function(message) {
    this.convo.add_message(message);
    this.renderDiscussion();
    this.$element.find('.top-bar').addClass('new-message');
    return this.titleAlert();
  };

  ChatRoom.prototype.user_offline_callback = function() {
    var message;
    message = new Message(app.me, 'http://storage.googleapis.com/parley-assets/server_network.png', "This user is no longer online", new Date());
    this.convo.add_message(message);
    return this.renderDiscussion();
  };

  ChatRoom.prototype.typing_notification_callback = function(convo_key, typist, bool) {
    var typing_notification;
    if (convo_key === this.convo.message_filter) {
      if (bool) {
        if (this.$discussion.find('.incoming').length === 0) {
          typing_notification = "<li class='incoming'><div class='avatar'><img src='" + typist.image_url + "'/></div><div class='messages'><p>" + typist.display_name + " is typing...</p></div></li>";
          that.$('.discussion').append(typingNotification);
          this.$discussion.append(typing_notification);
          return this.scrollToLastMessage();
        }
      } else {
        this.$discussion.find('.incoming').remove();
        return this.scrollToLastMessage();
      }
    }
  };

  ChatRoom.prototype.add_member = function(new_user) {
    var convo, new_convo_group, new_convo_partners, _i, _len, _ref;
    new_convo_partners = this.convo.convo_partners.concat(new_user);
    new_convo_group = new Conversation(new_convo_partners);
    app.conversations.push(new_convo_group);
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      convo = _ref[_i];
      if (convo === this.convo.message_filter) {
        app.open_conversations.splice(i, 1);
      }
    }
    app.open_conversations.push(new_convo_group.message_filter);
    this.convo = new_convo_group;
    return this.render();
  };

  ChatRoom.prototype.render = function() {
    this.$element = $(chat_room_template(this.convo));
    return this.$discussion = this.$element.find('.discussion');
  };

  ChatRoom.prototype.renderDiscussion = function() {
    var new_message;
    new_message = this.convo.messages.slice(-1)[0];
    this.appendMessage(new_message);
    return this.scrollToLastMessage();
  };

  ChatRoom.prototype.appendMessage = function(message) {
    var message_view;
    message_view = new MesssageView(message);
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
    if (this.messages.length > 0) {
      return this.scrollToLastMessage();
    }
  };

  ChatRoom.prototype.sendOnEnter = function(e) {
    if (e.keyCode === 13) {
      this.sendMessage();
      return this.removeNotifications();
    }
  };

  ChatRoom.prototype.sendMessage = function() {
    var message;
    message = new Message(this.convo.convo_partners, app.me, this.$element.find('.send').val());
    this.messages.add(send);
    this.renderDiscussion();
    app.server.emit('mesage', message);
    this.$discussion.find('.send').val('');
    return this.emitTypingNotification();
  };

  ChatRoom.prototype.toggle_convo = function(e) {
    e.preventDefault();
    this.$discussion.toggle();
    if (this.$discussion.attr('display') === !"none") {
      return this.scrollToLastMessage;
    }
  };

  ChatRoom.prototype.closeWindow = function(e) {
    e.preventDefault();
    e.stopPropagation();
    app.server.removeAllListeners();
    this.$element.find('.chat-close').off();
    this.$element.find('.send').off();
    this.$element.find('.send').off();
    this.$element.find('.top-bar').off();
    this.$element.off();
    this.$discussion.off();
    this.$element.remove();
    return delete this;
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
    app.clearAlert();
    $('html title').html(app.title_notification.page_title);
    return app.title_notification.notified = false;
  };

  ChatRoom.prototype.titleAlert = function() {
    var alert, sender_name, setAlert, title_alert;
    if (!app.title_notification.notified) {
      sender_name = this.convo.messages[-1].sender.display_name;
      alert = "Pending ** " + sender_name;
      setAlert = function() {
        if ($('html title').html() === app.title_notification.page_title) {
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
    file = this.$discussion.find('.picture_upload').get(0).files[0];
    return app.oauth.file_upload(file, this.convo.convo_partners_image_urls, app.me.image_url);
  };

  return ChatRoom;

})();

module.exports = ChatRoom;


},{"./app.coffee":19,"./conversation_model.coffee":22,"./message_model.coffee":23,"./message_view.coffee":24,"./templates/chat_room.hbs":27}],21:[function(require,module,exports){
var CommandCenter, PersistentConversationView, UserView, app, logged_in_template, logged_out_template, profile_template;

app = require('./app.coffee');

UserView = require('./user_view.coffee');

PersistentConversationView = require('./persistent_conversation_view.coffee');

logged_out_template = require('./templates/logged_out.hbs');

logged_in_template = require('./templates/logged_in.hbs');

profile_template = require('./templates/profile.hbs');

CommandCenter = (function() {
  function CommandCenter() {
    this.menu = "default";
    $('body').append(logged_out_template());
    $("ul.login-bar").hide();
    $('.parley .persistent-bar.logged-out').on('click', function(e) {
      return $('ul.login-bar').toggle();
    });
  }

  CommandCenter.prototype.log_in = function() {
    $(".parley .persistent-bar.logged_out").off();
    this.$element = $(logged_in_template(app.me));
    $('.parley section.controller').html(this.$element);
    $('.parley div.controller-bar a.messages').on('click', this.toggle_persistent_convos.bind(this));
    $('.parley div.controller-bar a.active-users').on('click', this.toggle_current_users.bind(this));
    return $('.parley div.controller-bar a.user-settings').on('click', this.toggle_user_settings.bind(this));
  };

  CommandCenter.prototype.toggle_command_center = function(e) {
    e.preventDefault();
    if (logged_out) {
      return $(".persistent-bar.logged-out").on("click", function() {
        $("#log-click").toggle();
        return $("ul.login-bar").slideToggle();
      });
    } else {
      return $(function() {
        return $('.persistent-bar').on('click', function() {
          return $('.controller-view').toggle();
        });
      });
    }
  };

  CommandCenter.prototype.toggle_current_users = function(e) {
    var user, view, _i, _len, _ref;
    e.preventDefault();
    if (this.menu !== "current_users") {
      $('.parley div.controller-view').children().remove();
      _ref = app.current_users;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        user = _ref[_i];
        view = new UserView(user);
        view.render();
        $('.parley div.controller-view').append(view.$element);
      }
      return this.menu = "current_users";
    } else {
      $('.parley div.controller-view').children().remove();
      $('.parley div.controller-view').html(profile_template(app.me));
      return this.menu = "default";
    }
  };

  CommandCenter.prototype.toggle_persistent_convos = function(e) {
    var convo, view, _i, _len, _ref;
    e.preventDefault();
    if (this.menu !== "persistent_convos") {
      $(".parley div.controller-view").children().remove();
      _ref = app.conversations;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        convo = _ref[_i];
        view = new PersistentConversationView(convo);
        view.render();
        $('.parley div.controller-view').append(view.$element);
      }
      return this.menu = "persistent_convos";
    } else {
      $('.parley div.controller-view').children().remove();
      $('.parley div.controller-view').html(profile_template(app.me));
      return this.menu = "default";
    }
  };

  CommandCenter.prototype.toggle_user_settings = function() {};

  return CommandCenter;

})();

module.exports = new CommandCenter();


},{"./app.coffee":19,"./persistent_conversation_view.coffee":26,"./templates/logged_in.hbs":29,"./templates/logged_out.hbs":30,"./templates/profile.hbs":33,"./user_view.coffee":35}],22:[function(require,module,exports){
var Conversation, app;

app = require('./app.coffee');

Conversation = (function() {
  function Conversation(convo_partners, messages) {
    var first_name, i, user, _i, _len, _ref;
    this.convo_partners = convo_partners;
    this.messages = messages != null ? messages : [];
    this.generate_message_filter();
    this.first_name_list = "";
    this.convo_partners_image_urls = [];
    _ref = this.convo_partners;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      first_name = user.display_name.match(/^[A-z]+/);
      if (i !== this.convo_partners.length) {
        this.first_name_list += "" + first_name + ", ";
        this.convo_partners_image_urls += user.image_url;
      } else {
        this.first_name_list += "" + first_name;
        this.convo_partners_image_urls += user.image_url;
      }
    }
  }

  Conversation.prototype.add_message = function(message) {
    return this.messages.push(message);
  };

  Conversation.prototype.generate_message_filter = function() {
    var partner, _i, _len, _ref;
    this.message_filter = [app.me.image_url];
    _ref = this.convo_partners;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      partner = _ref[_i];
      this.message_filter.push(partner.image_url);
    }
    return this.message_filter.sort().join();
  };

  return Conversation;

})();

module.exports = Conversation;


},{"./app.coffee":19}],23:[function(require,module,exports){
var Message, app;

app = require('./app.coffee');

Message = (function() {
  function Message(recipients, sender, content, time_stamp) {
    this.recipients = recipients;
    this.sender = sender;
    this.content = content;
    this.time_stamp = time_stamp;
    if (!this.time_stamp) {
      this.time_stamp = new Date().toUTCString();
    }
    this.convo_id = this.recipients.concat(this.sender).sort().join();
    this.time_created = new Date(this.time_stamp);
  }

  Message.prototype.time_elapsed = function() {
    var f_date, hours, minute_remainder, minutes, today;
    this.current_time = new Date();
    minutes = Math.floor((current_time - time_created) / 60000);
    if (current_time.getDate() === time_created.getDate() && minutes < 1440) {
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

Handlebars.registerHelper('calculate_time', function() {
  return this.time_elapsed();
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
      return Oauth.file_upload = function(file, rIDs, sID) {
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
              var image_src, message, msg;
              image_src = "https://storage.cloud.google.com/parley-images/" + res.name;
              msg = "<img src=" + image_src + " />";
              app.server.emit('message', msg, rIDs, sID);
              message = new Message(rIDs, sID, msg);
              _this.convo.messages.add_message(message);
              return _this.render();
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
var ChatRoom, Handlebars, PersistentConversationView, app, persistent_convo_reg;

app = require('./app.coffee');

ChatRoom = require('./chat_room_view.coffee');

Handlebars = require('handlebars');

persistent_convo_reg = require('./templates/persistent_convo_reg.hbs');

Handlebars = require('hbsfy/runtime');

Handlebars.registerHelper('retrieve_image', function() {
  return this.convo_partners_image_urls[0];
});

Handlebars.registerHelper('retrieve_last_message', function() {
  return this.messages[-1].content;
});

Handlebars.registerHelper('calculate_last_message_time', function() {
  return this.messages[-1].time_elapsed();
});

PersistentConversationView = (function() {
  function PersistentConversationView(convo) {
    this.convo = convo;
    this.$element.on('click', this.load_convo);
    ({
      render: function() {
        return this.$element = $(persistent_convo_reg(this.convo));
      },
      load_convo: function() {
        var chat_window, convo_status, _i, _len, _ref;
        convo_status = 'closed';
        _ref = app.open_conversations;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          convo = _ref[_i];
          if (this.convo.message_filter === convo.message_filter) {
            convo_status = 'open';
          }
        }
        if (convo_status !== 'open') {
          chat_window = new ChatRoom(this.convo);
          app.open_conversations.push(this.convo.message_filter);
          if (!this.$element.parent()[0].hasClass('controller-view')) {
            return this.$element.parents('div.parley').remove();
          }
        }
      }
    });
  }

  return PersistentConversationView;

})();

module.exports = PersistentConversationView;


},{"./app.coffee":19,"./chat_room_view.coffee":20,"./templates/persistent_convo_reg.hbs":32,"handlebars":16,"hbsfy/runtime":18}],27:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"parley\">\n  <section class=\"conversation\">\n    <div class=\"top-bar\">\n      <a>";
  if (helper = helpers.first_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.first_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</a>\n      <ul class=\"message-alt\">\n        <li class=\"entypo-minus minify\"></li>\n        <li class=\"entypo-resize-full\"></li>\n        <li class=\"entypo-cancel chat-close\"></li>\n      </ul>\n    </div>\n    <div class=\"message-bar\">\n      <ul class=\"additional\">\n        <li><a class=\"entypo-user-add\"></a></li>\n        <li><a class=\"fontawesome-facetime-video\"></a></li>\n      </ul>\n      <ul class=\"existing\">\n        <li><a class=\"entypo-chat\"></a></li>\n      </ul>\n    </div>\n    <ol class=\"discussion\"></ol>\n    <textarea class=\"grw send\" placeholder=\"Enter Message...\"></textarea>\n    <label class=\"img_upload entypo-camera\">\n      <span>\n        <input class=\"parley_file_upload\" name=\"img_upload\" type=\"file\" /></label>\n      </span>\n  </section>\n</div>";
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


  buffer += "<div class=\"controller-view\">\n  <div class=\"default-view\">\n    <figure>\n      <img src=";
  if (helper = helpers.image_url) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.image_url); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + " />\n      <h2>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</h2>\n    </figure>\n  </div>\n</div>\n<div class=\"controller-bar\">\n  <ul class=\"utility-bar horizontal-list\">\n    <li>\n      <a class=\"messages\" href=\"#\">\n        <span class=\"entypo-chat\"></span>\n      </a>\n    </li>\n    <li>\n      <a class=\"active-users\" href=\"#\">\n        <span class=\"entypo-users\"></span>\n      </a>\n    </li>\n    <li>\n      <a class=\"user-settings\" href=\"#\">\n        <span class=\"fontawesome-cog\"></span>\n      </a>\n    </li>\n  </ul>\n  <div class=\"persistent-bar\">\n    <a>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</a>\n    <span class=\"fontawesome-reorder\"></span>\n  </div>\n</div>";
  return buffer;
  });

},{"hbsfy/runtime":18}],30:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<div class=\"parley\">\n  <section class=\"controller\">\n    <div class=\"controller-view\">\n      <div class=\"g-signin login-bar\"\n        data-callback=\"sign_in_callback\"\n        data-clientid=\"1027427116765-9c18ckuo07r5ms0aclbfjsmcpd3jrmtc.apps.googleusercontent.com\"\n        data-cookiepolicy=\"single_host_origin\"\n        data-theme=\"none\"\n        data-scope=\"https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/devstorage.read_write\">\n        <li class=\"btn\">\n          <a class=\"entypo-gplus\"></a>\n        </li>\n        <li class=\"aside\">\n          <a> Sign in with google</a>\n        </li>\n      </div>\n    </div>\n    <div class=\"persistent-bar logged-out\">\n      <a id=\"log-click\"> click here to login!</a>\n      <span class=\"fontawesome-reorder\"></span>\n    </div>\n  </section>\n</div>";
  });

},{"hbsfy/runtime":18}],31:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"avatar\">\n  <img src= "
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.sender)),stack1 == null || stack1 === false ? stack1 : stack1.image_url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "/>\n<div class=\"message status\">\n  <h2>"
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.sender)),stack1 == null || stack1 === false ? stack1 : stack1.display_name)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</h2>\n  <p>";
  if (helper = helpers.content) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.content); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</p>\n  <a class=\"time\">\n    <span class=\"entypo-clock\">";
  if (helper = helpers.calculate_time) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.calculate_time); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
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


  buffer += "<div class=\"message existing\">\n  <div class=\"avatar\">\n    <img src=";
  if (helper = helpers.retrieve_image) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.retrieve_image); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + " />\n  </div>\n  <div class=\"content status entypo-right-open-big\">\n    <h2>"
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.convo_partner)),stack1 == null || stack1 === false ? stack1 : stack1.display_name)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</h2>\n    <p>";
  if (helper = helpers.retrieve_last_message) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.retrieve_last_message); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</p>\n    <a class=\"time\">\n      <span class=\"entypo-clock\"> ";
  if (helper = helpers.calculate_last_message_time) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.calculate_last_message_time); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n    </a>\n  </div>\n</div>";
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
var ChatRoom, Conversation, UserView, app, current_user_template;

app = require('./app.coffee');

ChatRoom = require('./chat_room_view.coffee');

Conversation = require('./conversation_model.coffee');

current_user_template = require('./templates/current_user.hbs');

UserView = (function() {
  function UserView(current_user, chat_room) {
    this.current_user = current_user;
    this.chat_room = chat_room;
    this.$element = $("<li class='user'></li>");
    this.$element.on('click', this.user_interact_callback.bind(this));
  }

  UserView.prototype.render = function() {
    return this.$element.html(current_user_template(this.current_user));
  };

  UserView.prototype.user_interact_callback = function() {
    if (this.$element.parent().hasClass('controller-view')) {
      return this.open_conversation();
    } else {
      return this.chat_room.add_member(this.current_user);
    }
  };

  UserView.prototype.open_conversation = function() {
    var chat_window, conversation, convo, convo_exists, convo_key, _i, _j, _len, _len1, _ref, _ref1;
    convo_key = [app.me.image_url, this.current_user.image_url].sort().join();
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      convo = _ref[_i];
      if (convo_key === convo.message_filter) {
        return;
      }
    }
    convo_exists = false;
    _ref1 = app.conversations;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      convo = _ref1[_j];
      if (convo.message_filter === convo_key) {
        convo_exists = true;
        convo = convo;
      }
    }
    if (convo_exists) {
      chat_window = new ChatRoom(convo);
      return app.open_conversations.push(convo_key);
    } else {
      conversation = new Conversation([this.current_user]);
      chat_window = new ChatRoom(conversation);
      app.conversations.push(conversation);
      return app.open_conversations.push(convo_key);
    }
  };

  return UserView;

})();

module.exports = UserView;


},{"./app.coffee":19,"./chat_room_view.coffee":20,"./conversation_model.coffee":22,"./templates/current_user.hbs":28}]},{},[19])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMucnVudGltZS5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9iYXNlLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2FzdC5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9iYXNlLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2phdmFzY3JpcHQtY29tcGlsZXIuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvcGFyc2VyLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3ByaW50ZXIuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvdmlzaXRvci5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9leGNlcHRpb24uanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvcnVudGltZS5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9zYWZlLXN0cmluZy5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy91dGlscy5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2luZGV4LmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9ydW50aW1lLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGJzZnkvcnVudGltZS5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL2FwcC5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9jaGF0X3Jvb21fdmlldy5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9jb21tYW5kX2NlbnRlcl92aWV3LmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL2NvbnZlcnNhdGlvbl9tb2RlbC5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9tZXNzYWdlX21vZGVsLmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL21lc3NhZ2Vfdmlldy5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9vYXV0aC5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9wZXJzaXN0ZW50X2NvbnZlcnNhdGlvbl92aWV3LmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9jaGF0X3Jvb20uaGJzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9zcmMvdGVtcGxhdGVzL2N1cnJlbnRfdXNlci5oYnMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy90ZW1wbGF0ZXMvbG9nZ2VkX2luLmhicyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9sb2dnZWRfb3V0LmhicyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9tZXNzYWdlLmhicyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9wZXJzaXN0ZW50X2NvbnZvX3JlZy5oYnMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy90ZW1wbGF0ZXMvcHJvZmlsZS5oYnMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy91c2VyX21vZGVsLmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3VzZXJfdmlldy5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25MQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3NkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3plQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTs7QUNEQSxJQUFBLDhEQUFBOztBQUFBLE1BQUEsR0FBUyxFQUFULENBQUE7O0FBQUEsTUFDTSxDQUFDLE9BQVAsR0FBaUIsTUFEakIsQ0FBQTs7QUFLQTtBQUFBLDJDQUxBOztBQUFBO0FBYWUsRUFBQSxhQUFBLEdBQUE7QUFDWCxJQUFBLElBQUMsQ0FBQSxh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aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIixudWxsLCJcInVzZSBzdHJpY3RcIjtcbi8qZ2xvYmFscyBIYW5kbGViYXJzOiB0cnVlICovXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMucnVudGltZVwiKVtcImRlZmF1bHRcIl07XG5cbi8vIENvbXBpbGVyIGltcG9ydHNcbnZhciBBU1QgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2FzdFwiKVtcImRlZmF1bHRcIl07XG52YXIgUGFyc2VyID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9iYXNlXCIpLnBhcnNlcjtcbnZhciBwYXJzZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvYmFzZVwiKS5wYXJzZTtcbnZhciBDb21waWxlciA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvY29tcGlsZXJcIikuQ29tcGlsZXI7XG52YXIgY29tcGlsZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvY29tcGlsZXJcIikuY29tcGlsZTtcbnZhciBwcmVjb21waWxlID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9jb21waWxlclwiKS5wcmVjb21waWxlO1xudmFyIEphdmFTY3JpcHRDb21waWxlciA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvamF2YXNjcmlwdC1jb21waWxlclwiKVtcImRlZmF1bHRcIl07XG5cbnZhciBfY3JlYXRlID0gSGFuZGxlYmFycy5jcmVhdGU7XG52YXIgY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBoYiA9IF9jcmVhdGUoKTtcblxuICBoYi5jb21waWxlID0gZnVuY3Rpb24oaW5wdXQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gY29tcGlsZShpbnB1dCwgb3B0aW9ucywgaGIpO1xuICB9O1xuICBoYi5wcmVjb21waWxlID0gZnVuY3Rpb24gKGlucHV0LCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHByZWNvbXBpbGUoaW5wdXQsIG9wdGlvbnMsIGhiKTtcbiAgfTtcblxuICBoYi5BU1QgPSBBU1Q7XG4gIGhiLkNvbXBpbGVyID0gQ29tcGlsZXI7XG4gIGhiLkphdmFTY3JpcHRDb21waWxlciA9IEphdmFTY3JpcHRDb21waWxlcjtcbiAgaGIuUGFyc2VyID0gUGFyc2VyO1xuICBoYi5wYXJzZSA9IHBhcnNlO1xuXG4gIHJldHVybiBoYjtcbn07XG5cbkhhbmRsZWJhcnMgPSBjcmVhdGUoKTtcbkhhbmRsZWJhcnMuY3JlYXRlID0gY3JlYXRlO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEhhbmRsZWJhcnM7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmdsb2JhbHMgSGFuZGxlYmFyczogdHJ1ZSAqL1xudmFyIGJhc2UgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2Jhc2VcIik7XG5cbi8vIEVhY2ggb2YgdGhlc2UgYXVnbWVudCB0aGUgSGFuZGxlYmFycyBvYmplY3QuIE5vIG5lZWQgdG8gc2V0dXAgaGVyZS5cbi8vIChUaGlzIGlzIGRvbmUgdG8gZWFzaWx5IHNoYXJlIGNvZGUgYmV0d2VlbiBjb21tb25qcyBhbmQgYnJvd3NlIGVudnMpXG52YXIgU2FmZVN0cmluZyA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvc2FmZS1zdHJpbmdcIilbXCJkZWZhdWx0XCJdO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBVdGlscyA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvdXRpbHNcIik7XG52YXIgcnVudGltZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvcnVudGltZVwiKTtcblxuLy8gRm9yIGNvbXBhdGliaWxpdHkgYW5kIHVzYWdlIG91dHNpZGUgb2YgbW9kdWxlIHN5c3RlbXMsIG1ha2UgdGhlIEhhbmRsZWJhcnMgb2JqZWN0IGEgbmFtZXNwYWNlXG52YXIgY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBoYiA9IG5ldyBiYXNlLkhhbmRsZWJhcnNFbnZpcm9ubWVudCgpO1xuXG4gIFV0aWxzLmV4dGVuZChoYiwgYmFzZSk7XG4gIGhiLlNhZmVTdHJpbmcgPSBTYWZlU3RyaW5nO1xuICBoYi5FeGNlcHRpb24gPSBFeGNlcHRpb247XG4gIGhiLlV0aWxzID0gVXRpbHM7XG5cbiAgaGIuVk0gPSBydW50aW1lO1xuICBoYi50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHNwZWMpIHtcbiAgICByZXR1cm4gcnVudGltZS50ZW1wbGF0ZShzcGVjLCBoYik7XG4gIH07XG5cbiAgcmV0dXJuIGhiO1xufTtcblxudmFyIEhhbmRsZWJhcnMgPSBjcmVhdGUoKTtcbkhhbmRsZWJhcnMuY3JlYXRlID0gY3JlYXRlO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEhhbmRsZWJhcnM7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgVXRpbHMgPSByZXF1aXJlKFwiLi91dGlsc1wiKTtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xuXG52YXIgVkVSU0lPTiA9IFwiMS4zLjBcIjtcbmV4cG9ydHMuVkVSU0lPTiA9IFZFUlNJT047dmFyIENPTVBJTEVSX1JFVklTSU9OID0gNDtcbmV4cG9ydHMuQ09NUElMRVJfUkVWSVNJT04gPSBDT01QSUxFUl9SRVZJU0lPTjtcbnZhciBSRVZJU0lPTl9DSEFOR0VTID0ge1xuICAxOiAnPD0gMS4wLnJjLjInLCAvLyAxLjAucmMuMiBpcyBhY3R1YWxseSByZXYyIGJ1dCBkb2Vzbid0IHJlcG9ydCBpdFxuICAyOiAnPT0gMS4wLjAtcmMuMycsXG4gIDM6ICc9PSAxLjAuMC1yYy40JyxcbiAgNDogJz49IDEuMC4wJ1xufTtcbmV4cG9ydHMuUkVWSVNJT05fQ0hBTkdFUyA9IFJFVklTSU9OX0NIQU5HRVM7XG52YXIgaXNBcnJheSA9IFV0aWxzLmlzQXJyYXksXG4gICAgaXNGdW5jdGlvbiA9IFV0aWxzLmlzRnVuY3Rpb24sXG4gICAgdG9TdHJpbmcgPSBVdGlscy50b1N0cmluZyxcbiAgICBvYmplY3RUeXBlID0gJ1tvYmplY3QgT2JqZWN0XSc7XG5cbmZ1bmN0aW9uIEhhbmRsZWJhcnNFbnZpcm9ubWVudChoZWxwZXJzLCBwYXJ0aWFscykge1xuICB0aGlzLmhlbHBlcnMgPSBoZWxwZXJzIHx8IHt9O1xuICB0aGlzLnBhcnRpYWxzID0gcGFydGlhbHMgfHwge307XG5cbiAgcmVnaXN0ZXJEZWZhdWx0SGVscGVycyh0aGlzKTtcbn1cblxuZXhwb3J0cy5IYW5kbGViYXJzRW52aXJvbm1lbnQgPSBIYW5kbGViYXJzRW52aXJvbm1lbnQ7SGFuZGxlYmFyc0Vudmlyb25tZW50LnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IEhhbmRsZWJhcnNFbnZpcm9ubWVudCxcblxuICBsb2dnZXI6IGxvZ2dlcixcbiAgbG9nOiBsb2csXG5cbiAgcmVnaXN0ZXJIZWxwZXI6IGZ1bmN0aW9uKG5hbWUsIGZuLCBpbnZlcnNlKSB7XG4gICAgaWYgKHRvU3RyaW5nLmNhbGwobmFtZSkgPT09IG9iamVjdFR5cGUpIHtcbiAgICAgIGlmIChpbnZlcnNlIHx8IGZuKSB7IHRocm93IG5ldyBFeGNlcHRpb24oJ0FyZyBub3Qgc3VwcG9ydGVkIHdpdGggbXVsdGlwbGUgaGVscGVycycpOyB9XG4gICAgICBVdGlscy5leHRlbmQodGhpcy5oZWxwZXJzLCBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGludmVyc2UpIHsgZm4ubm90ID0gaW52ZXJzZTsgfVxuICAgICAgdGhpcy5oZWxwZXJzW25hbWVdID0gZm47XG4gICAgfVxuICB9LFxuXG4gIHJlZ2lzdGVyUGFydGlhbDogZnVuY3Rpb24obmFtZSwgc3RyKSB7XG4gICAgaWYgKHRvU3RyaW5nLmNhbGwobmFtZSkgPT09IG9iamVjdFR5cGUpIHtcbiAgICAgIFV0aWxzLmV4dGVuZCh0aGlzLnBhcnRpYWxzLCAgbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGFydGlhbHNbbmFtZV0gPSBzdHI7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiByZWdpc3RlckRlZmF1bHRIZWxwZXJzKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdoZWxwZXJNaXNzaW5nJywgZnVuY3Rpb24oYXJnKSB7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIk1pc3NpbmcgaGVscGVyOiAnXCIgKyBhcmcgKyBcIidcIik7XG4gICAgfVxuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignYmxvY2tIZWxwZXJNaXNzaW5nJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIHZhciBpbnZlcnNlID0gb3B0aW9ucy5pbnZlcnNlIHx8IGZ1bmN0aW9uKCkge30sIGZuID0gb3B0aW9ucy5mbjtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGNvbnRleHQpKSB7IGNvbnRleHQgPSBjb250ZXh0LmNhbGwodGhpcyk7IH1cblxuICAgIGlmKGNvbnRleHQgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBmbih0aGlzKTtcbiAgICB9IGVsc2UgaWYoY29udGV4dCA9PT0gZmFsc2UgfHwgY29udGV4dCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gaW52ZXJzZSh0aGlzKTtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkoY29udGV4dCkpIHtcbiAgICAgIGlmKGNvbnRleHQubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gaW5zdGFuY2UuaGVscGVycy5lYWNoKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGludmVyc2UodGhpcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmbihjb250ZXh0KTtcbiAgICB9XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdlYWNoJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIHZhciBmbiA9IG9wdGlvbnMuZm4sIGludmVyc2UgPSBvcHRpb25zLmludmVyc2U7XG4gICAgdmFyIGkgPSAwLCByZXQgPSBcIlwiLCBkYXRhO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGF0YSkge1xuICAgICAgZGF0YSA9IGNyZWF0ZUZyYW1lKG9wdGlvbnMuZGF0YSk7XG4gICAgfVxuXG4gICAgaWYoY29udGV4dCAmJiB0eXBlb2YgY29udGV4dCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChpc0FycmF5KGNvbnRleHQpKSB7XG4gICAgICAgIGZvcih2YXIgaiA9IGNvbnRleHQubGVuZ3RoOyBpPGo7IGkrKykge1xuICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBkYXRhLmluZGV4ID0gaTtcbiAgICAgICAgICAgIGRhdGEuZmlyc3QgPSAoaSA9PT0gMCk7XG4gICAgICAgICAgICBkYXRhLmxhc3QgID0gKGkgPT09IChjb250ZXh0Lmxlbmd0aC0xKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldCA9IHJldCArIGZuKGNvbnRleHRbaV0sIHsgZGF0YTogZGF0YSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gY29udGV4dCkge1xuICAgICAgICAgIGlmKGNvbnRleHQuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgaWYoZGF0YSkgeyBcbiAgICAgICAgICAgICAgZGF0YS5rZXkgPSBrZXk7IFxuICAgICAgICAgICAgICBkYXRhLmluZGV4ID0gaTtcbiAgICAgICAgICAgICAgZGF0YS5maXJzdCA9IChpID09PSAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldCA9IHJldCArIGZuKGNvbnRleHRba2V5XSwge2RhdGE6IGRhdGF9KTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihpID09PSAwKXtcbiAgICAgIHJldCA9IGludmVyc2UodGhpcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2lmJywgZnVuY3Rpb24oY29uZGl0aW9uYWwsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjb25kaXRpb25hbCkpIHsgY29uZGl0aW9uYWwgPSBjb25kaXRpb25hbC5jYWxsKHRoaXMpOyB9XG5cbiAgICAvLyBEZWZhdWx0IGJlaGF2aW9yIGlzIHRvIHJlbmRlciB0aGUgcG9zaXRpdmUgcGF0aCBpZiB0aGUgdmFsdWUgaXMgdHJ1dGh5IGFuZCBub3QgZW1wdHkuXG4gICAgLy8gVGhlIGBpbmNsdWRlWmVyb2Agb3B0aW9uIG1heSBiZSBzZXQgdG8gdHJlYXQgdGhlIGNvbmR0aW9uYWwgYXMgcHVyZWx5IG5vdCBlbXB0eSBiYXNlZCBvbiB0aGVcbiAgICAvLyBiZWhhdmlvciBvZiBpc0VtcHR5LiBFZmZlY3RpdmVseSB0aGlzIGRldGVybWluZXMgaWYgMCBpcyBoYW5kbGVkIGJ5IHRoZSBwb3NpdGl2ZSBwYXRoIG9yIG5lZ2F0aXZlLlxuICAgIGlmICgoIW9wdGlvbnMuaGFzaC5pbmNsdWRlWmVybyAmJiAhY29uZGl0aW9uYWwpIHx8IFV0aWxzLmlzRW1wdHkoY29uZGl0aW9uYWwpKSB7XG4gICAgICByZXR1cm4gb3B0aW9ucy5pbnZlcnNlKHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gb3B0aW9ucy5mbih0aGlzKTtcbiAgICB9XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCd1bmxlc3MnLCBmdW5jdGlvbihjb25kaXRpb25hbCwgb3B0aW9ucykge1xuICAgIHJldHVybiBpbnN0YW5jZS5oZWxwZXJzWydpZiddLmNhbGwodGhpcywgY29uZGl0aW9uYWwsIHtmbjogb3B0aW9ucy5pbnZlcnNlLCBpbnZlcnNlOiBvcHRpb25zLmZuLCBoYXNoOiBvcHRpb25zLmhhc2h9KTtcbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ3dpdGgnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gICAgaWYgKCFVdGlscy5pc0VtcHR5KGNvbnRleHQpKSByZXR1cm4gb3B0aW9ucy5mbihjb250ZXh0KTtcbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2xvZycsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgbGV2ZWwgPSBvcHRpb25zLmRhdGEgJiYgb3B0aW9ucy5kYXRhLmxldmVsICE9IG51bGwgPyBwYXJzZUludChvcHRpb25zLmRhdGEubGV2ZWwsIDEwKSA6IDE7XG4gICAgaW5zdGFuY2UubG9nKGxldmVsLCBjb250ZXh0KTtcbiAgfSk7XG59XG5cbnZhciBsb2dnZXIgPSB7XG4gIG1ldGhvZE1hcDogeyAwOiAnZGVidWcnLCAxOiAnaW5mbycsIDI6ICd3YXJuJywgMzogJ2Vycm9yJyB9LFxuXG4gIC8vIFN0YXRlIGVudW1cbiAgREVCVUc6IDAsXG4gIElORk86IDEsXG4gIFdBUk46IDIsXG4gIEVSUk9SOiAzLFxuICBsZXZlbDogMyxcblxuICAvLyBjYW4gYmUgb3ZlcnJpZGRlbiBpbiB0aGUgaG9zdCBlbnZpcm9ubWVudFxuICBsb2c6IGZ1bmN0aW9uKGxldmVsLCBvYmopIHtcbiAgICBpZiAobG9nZ2VyLmxldmVsIDw9IGxldmVsKSB7XG4gICAgICB2YXIgbWV0aG9kID0gbG9nZ2VyLm1ldGhvZE1hcFtsZXZlbF07XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIGNvbnNvbGVbbWV0aG9kXSkge1xuICAgICAgICBjb25zb2xlW21ldGhvZF0uY2FsbChjb25zb2xlLCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcbmV4cG9ydHMubG9nZ2VyID0gbG9nZ2VyO1xuZnVuY3Rpb24gbG9nKGxldmVsLCBvYmopIHsgbG9nZ2VyLmxvZyhsZXZlbCwgb2JqKTsgfVxuXG5leHBvcnRzLmxvZyA9IGxvZzt2YXIgY3JlYXRlRnJhbWUgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgdmFyIG9iaiA9IHt9O1xuICBVdGlscy5leHRlbmQob2JqLCBvYmplY3QpO1xuICByZXR1cm4gb2JqO1xufTtcbmV4cG9ydHMuY3JlYXRlRnJhbWUgPSBjcmVhdGVGcmFtZTsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcblxuZnVuY3Rpb24gTG9jYXRpb25JbmZvKGxvY0luZm8pe1xuICBsb2NJbmZvID0gbG9jSW5mbyB8fCB7fTtcbiAgdGhpcy5maXJzdExpbmUgICA9IGxvY0luZm8uZmlyc3RfbGluZTtcbiAgdGhpcy5maXJzdENvbHVtbiA9IGxvY0luZm8uZmlyc3RfY29sdW1uO1xuICB0aGlzLmxhc3RDb2x1bW4gID0gbG9jSW5mby5sYXN0X2NvbHVtbjtcbiAgdGhpcy5sYXN0TGluZSAgICA9IGxvY0luZm8ubGFzdF9saW5lO1xufVxuXG52YXIgQVNUID0ge1xuICBQcm9ncmFtTm9kZTogZnVuY3Rpb24oc3RhdGVtZW50cywgaW52ZXJzZVN0cmlwLCBpbnZlcnNlLCBsb2NJbmZvKSB7XG4gICAgdmFyIGludmVyc2VMb2NhdGlvbkluZm8sIGZpcnN0SW52ZXJzZU5vZGU7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICAgIGxvY0luZm8gPSBpbnZlcnNlO1xuICAgICAgaW52ZXJzZSA9IG51bGw7XG4gICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgICBsb2NJbmZvID0gaW52ZXJzZVN0cmlwO1xuICAgICAgaW52ZXJzZVN0cmlwID0gbnVsbDtcbiAgICB9XG5cbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcInByb2dyYW1cIjtcbiAgICB0aGlzLnN0YXRlbWVudHMgPSBzdGF0ZW1lbnRzO1xuICAgIHRoaXMuc3RyaXAgPSB7fTtcblxuICAgIGlmKGludmVyc2UpIHtcbiAgICAgIGZpcnN0SW52ZXJzZU5vZGUgPSBpbnZlcnNlWzBdO1xuICAgICAgaWYgKGZpcnN0SW52ZXJzZU5vZGUpIHtcbiAgICAgICAgaW52ZXJzZUxvY2F0aW9uSW5mbyA9IHtcbiAgICAgICAgICBmaXJzdF9saW5lOiBmaXJzdEludmVyc2VOb2RlLmZpcnN0TGluZSxcbiAgICAgICAgICBsYXN0X2xpbmU6IGZpcnN0SW52ZXJzZU5vZGUubGFzdExpbmUsXG4gICAgICAgICAgbGFzdF9jb2x1bW46IGZpcnN0SW52ZXJzZU5vZGUubGFzdENvbHVtbixcbiAgICAgICAgICBmaXJzdF9jb2x1bW46IGZpcnN0SW52ZXJzZU5vZGUuZmlyc3RDb2x1bW5cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5pbnZlcnNlID0gbmV3IEFTVC5Qcm9ncmFtTm9kZShpbnZlcnNlLCBpbnZlcnNlU3RyaXAsIGludmVyc2VMb2NhdGlvbkluZm8pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5pbnZlcnNlID0gbmV3IEFTVC5Qcm9ncmFtTm9kZShpbnZlcnNlLCBpbnZlcnNlU3RyaXApO1xuICAgICAgfVxuICAgICAgdGhpcy5zdHJpcC5yaWdodCA9IGludmVyc2VTdHJpcC5sZWZ0O1xuICAgIH0gZWxzZSBpZiAoaW52ZXJzZVN0cmlwKSB7XG4gICAgICB0aGlzLnN0cmlwLmxlZnQgPSBpbnZlcnNlU3RyaXAucmlnaHQ7XG4gICAgfVxuICB9LFxuXG4gIE11c3RhY2hlTm9kZTogZnVuY3Rpb24ocmF3UGFyYW1zLCBoYXNoLCBvcGVuLCBzdHJpcCwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwibXVzdGFjaGVcIjtcbiAgICB0aGlzLnN0cmlwID0gc3RyaXA7XG5cbiAgICAvLyBPcGVuIG1heSBiZSBhIHN0cmluZyBwYXJzZWQgZnJvbSB0aGUgcGFyc2VyIG9yIGEgcGFzc2VkIGJvb2xlYW4gZmxhZ1xuICAgIGlmIChvcGVuICE9IG51bGwgJiYgb3Blbi5jaGFyQXQpIHtcbiAgICAgIC8vIE11c3QgdXNlIGNoYXJBdCB0byBzdXBwb3J0IElFIHByZS0xMFxuICAgICAgdmFyIGVzY2FwZUZsYWcgPSBvcGVuLmNoYXJBdCgzKSB8fCBvcGVuLmNoYXJBdCgyKTtcbiAgICAgIHRoaXMuZXNjYXBlZCA9IGVzY2FwZUZsYWcgIT09ICd7JyAmJiBlc2NhcGVGbGFnICE9PSAnJic7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZXNjYXBlZCA9ICEhb3BlbjtcbiAgICB9XG5cbiAgICBpZiAocmF3UGFyYW1zIGluc3RhbmNlb2YgQVNULlNleHByTm9kZSkge1xuICAgICAgdGhpcy5zZXhwciA9IHJhd1BhcmFtcztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU3VwcG9ydCBvbGQgQVNUIEFQSVxuICAgICAgdGhpcy5zZXhwciA9IG5ldyBBU1QuU2V4cHJOb2RlKHJhd1BhcmFtcywgaGFzaCk7XG4gICAgfVxuXG4gICAgdGhpcy5zZXhwci5pc1Jvb3QgPSB0cnVlO1xuXG4gICAgLy8gU3VwcG9ydCBvbGQgQVNUIEFQSSB0aGF0IHN0b3JlZCB0aGlzIGluZm8gaW4gTXVzdGFjaGVOb2RlXG4gICAgdGhpcy5pZCA9IHRoaXMuc2V4cHIuaWQ7XG4gICAgdGhpcy5wYXJhbXMgPSB0aGlzLnNleHByLnBhcmFtcztcbiAgICB0aGlzLmhhc2ggPSB0aGlzLnNleHByLmhhc2g7XG4gICAgdGhpcy5lbGlnaWJsZUhlbHBlciA9IHRoaXMuc2V4cHIuZWxpZ2libGVIZWxwZXI7XG4gICAgdGhpcy5pc0hlbHBlciA9IHRoaXMuc2V4cHIuaXNIZWxwZXI7XG4gIH0sXG5cbiAgU2V4cHJOb2RlOiBmdW5jdGlvbihyYXdQYXJhbXMsIGhhc2gsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcblxuICAgIHRoaXMudHlwZSA9IFwic2V4cHJcIjtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuXG4gICAgdmFyIGlkID0gdGhpcy5pZCA9IHJhd1BhcmFtc1swXTtcbiAgICB2YXIgcGFyYW1zID0gdGhpcy5wYXJhbXMgPSByYXdQYXJhbXMuc2xpY2UoMSk7XG5cbiAgICAvLyBhIG11c3RhY2hlIGlzIGFuIGVsaWdpYmxlIGhlbHBlciBpZjpcbiAgICAvLyAqIGl0cyBpZCBpcyBzaW1wbGUgKGEgc2luZ2xlIHBhcnQsIG5vdCBgdGhpc2Agb3IgYC4uYClcbiAgICB2YXIgZWxpZ2libGVIZWxwZXIgPSB0aGlzLmVsaWdpYmxlSGVscGVyID0gaWQuaXNTaW1wbGU7XG5cbiAgICAvLyBhIG11c3RhY2hlIGlzIGRlZmluaXRlbHkgYSBoZWxwZXIgaWY6XG4gICAgLy8gKiBpdCBpcyBhbiBlbGlnaWJsZSBoZWxwZXIsIGFuZFxuICAgIC8vICogaXQgaGFzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIgb3IgaGFzaCBzZWdtZW50XG4gICAgdGhpcy5pc0hlbHBlciA9IGVsaWdpYmxlSGVscGVyICYmIChwYXJhbXMubGVuZ3RoIHx8IGhhc2gpO1xuXG4gICAgLy8gaWYgYSBtdXN0YWNoZSBpcyBhbiBlbGlnaWJsZSBoZWxwZXIgYnV0IG5vdCBhIGRlZmluaXRlXG4gICAgLy8gaGVscGVyLCBpdCBpcyBhbWJpZ3VvdXMsIGFuZCB3aWxsIGJlIHJlc29sdmVkIGluIGEgbGF0ZXJcbiAgICAvLyBwYXNzIG9yIGF0IHJ1bnRpbWUuXG4gIH0sXG5cbiAgUGFydGlhbE5vZGU6IGZ1bmN0aW9uKHBhcnRpYWxOYW1lLCBjb250ZXh0LCBzdHJpcCwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSAgICAgICAgID0gXCJwYXJ0aWFsXCI7XG4gICAgdGhpcy5wYXJ0aWFsTmFtZSAgPSBwYXJ0aWFsTmFtZTtcbiAgICB0aGlzLmNvbnRleHQgICAgICA9IGNvbnRleHQ7XG4gICAgdGhpcy5zdHJpcCA9IHN0cmlwO1xuICB9LFxuXG4gIEJsb2NrTm9kZTogZnVuY3Rpb24obXVzdGFjaGUsIHByb2dyYW0sIGludmVyc2UsIGNsb3NlLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG5cbiAgICBpZihtdXN0YWNoZS5zZXhwci5pZC5vcmlnaW5hbCAhPT0gY2xvc2UucGF0aC5vcmlnaW5hbCkge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihtdXN0YWNoZS5zZXhwci5pZC5vcmlnaW5hbCArIFwiIGRvZXNuJ3QgbWF0Y2ggXCIgKyBjbG9zZS5wYXRoLm9yaWdpbmFsLCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLnR5cGUgPSAnYmxvY2snO1xuICAgIHRoaXMubXVzdGFjaGUgPSBtdXN0YWNoZTtcbiAgICB0aGlzLnByb2dyYW0gID0gcHJvZ3JhbTtcbiAgICB0aGlzLmludmVyc2UgID0gaW52ZXJzZTtcblxuICAgIHRoaXMuc3RyaXAgPSB7XG4gICAgICBsZWZ0OiBtdXN0YWNoZS5zdHJpcC5sZWZ0LFxuICAgICAgcmlnaHQ6IGNsb3NlLnN0cmlwLnJpZ2h0XG4gICAgfTtcblxuICAgIChwcm9ncmFtIHx8IGludmVyc2UpLnN0cmlwLmxlZnQgPSBtdXN0YWNoZS5zdHJpcC5yaWdodDtcbiAgICAoaW52ZXJzZSB8fCBwcm9ncmFtKS5zdHJpcC5yaWdodCA9IGNsb3NlLnN0cmlwLmxlZnQ7XG5cbiAgICBpZiAoaW52ZXJzZSAmJiAhcHJvZ3JhbSkge1xuICAgICAgdGhpcy5pc0ludmVyc2UgPSB0cnVlO1xuICAgIH1cbiAgfSxcblxuICBDb250ZW50Tm9kZTogZnVuY3Rpb24oc3RyaW5nLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJjb250ZW50XCI7XG4gICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gIH0sXG5cbiAgSGFzaE5vZGU6IGZ1bmN0aW9uKHBhaXJzLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJoYXNoXCI7XG4gICAgdGhpcy5wYWlycyA9IHBhaXJzO1xuICB9LFxuXG4gIElkTm9kZTogZnVuY3Rpb24ocGFydHMsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIklEXCI7XG5cbiAgICB2YXIgb3JpZ2luYWwgPSBcIlwiLFxuICAgICAgICBkaWcgPSBbXSxcbiAgICAgICAgZGVwdGggPSAwO1xuXG4gICAgZm9yKHZhciBpPTAsbD1wYXJ0cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICB2YXIgcGFydCA9IHBhcnRzW2ldLnBhcnQ7XG4gICAgICBvcmlnaW5hbCArPSAocGFydHNbaV0uc2VwYXJhdG9yIHx8ICcnKSArIHBhcnQ7XG5cbiAgICAgIGlmIChwYXJ0ID09PSBcIi4uXCIgfHwgcGFydCA9PT0gXCIuXCIgfHwgcGFydCA9PT0gXCJ0aGlzXCIpIHtcbiAgICAgICAgaWYgKGRpZy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIkludmFsaWQgcGF0aDogXCIgKyBvcmlnaW5hbCwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSBpZiAocGFydCA9PT0gXCIuLlwiKSB7XG4gICAgICAgICAgZGVwdGgrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmlzU2NvcGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGlnLnB1c2gocGFydCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vcmlnaW5hbCA9IG9yaWdpbmFsO1xuICAgIHRoaXMucGFydHMgICAgPSBkaWc7XG4gICAgdGhpcy5zdHJpbmcgICA9IGRpZy5qb2luKCcuJyk7XG4gICAgdGhpcy5kZXB0aCAgICA9IGRlcHRoO1xuXG4gICAgLy8gYW4gSUQgaXMgc2ltcGxlIGlmIGl0IG9ubHkgaGFzIG9uZSBwYXJ0LCBhbmQgdGhhdCBwYXJ0IGlzIG5vdFxuICAgIC8vIGAuLmAgb3IgYHRoaXNgLlxuICAgIHRoaXMuaXNTaW1wbGUgPSBwYXJ0cy5sZW5ndGggPT09IDEgJiYgIXRoaXMuaXNTY29wZWQgJiYgZGVwdGggPT09IDA7XG5cbiAgICB0aGlzLnN0cmluZ01vZGVWYWx1ZSA9IHRoaXMuc3RyaW5nO1xuICB9LFxuXG4gIFBhcnRpYWxOYW1lTm9kZTogZnVuY3Rpb24obmFtZSwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiUEFSVElBTF9OQU1FXCI7XG4gICAgdGhpcy5uYW1lID0gbmFtZS5vcmlnaW5hbDtcbiAgfSxcblxuICBEYXRhTm9kZTogZnVuY3Rpb24oaWQsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIkRBVEFcIjtcbiAgICB0aGlzLmlkID0gaWQ7XG4gIH0sXG5cbiAgU3RyaW5nTm9kZTogZnVuY3Rpb24oc3RyaW5nLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJTVFJJTkdcIjtcbiAgICB0aGlzLm9yaWdpbmFsID1cbiAgICAgIHRoaXMuc3RyaW5nID1cbiAgICAgIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gc3RyaW5nO1xuICB9LFxuXG4gIEludGVnZXJOb2RlOiBmdW5jdGlvbihpbnRlZ2VyLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJJTlRFR0VSXCI7XG4gICAgdGhpcy5vcmlnaW5hbCA9XG4gICAgICB0aGlzLmludGVnZXIgPSBpbnRlZ2VyO1xuICAgIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gTnVtYmVyKGludGVnZXIpO1xuICB9LFxuXG4gIEJvb2xlYW5Ob2RlOiBmdW5jdGlvbihib29sLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJCT09MRUFOXCI7XG4gICAgdGhpcy5ib29sID0gYm9vbDtcbiAgICB0aGlzLnN0cmluZ01vZGVWYWx1ZSA9IGJvb2wgPT09IFwidHJ1ZVwiO1xuICB9LFxuXG4gIENvbW1lbnROb2RlOiBmdW5jdGlvbihjb21tZW50LCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJjb21tZW50XCI7XG4gICAgdGhpcy5jb21tZW50ID0gY29tbWVudDtcbiAgfVxufTtcblxuLy8gTXVzdCBiZSBleHBvcnRlZCBhcyBhbiBvYmplY3QgcmF0aGVyIHRoYW4gdGhlIHJvb3Qgb2YgdGhlIG1vZHVsZSBhcyB0aGUgamlzb24gbGV4ZXJcbi8vIG1vc3QgbW9kaWZ5IHRoZSBvYmplY3QgdG8gb3BlcmF0ZSBwcm9wZXJseS5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gQVNUOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIHBhcnNlciA9IHJlcXVpcmUoXCIuL3BhcnNlclwiKVtcImRlZmF1bHRcIl07XG52YXIgQVNUID0gcmVxdWlyZShcIi4vYXN0XCIpW1wiZGVmYXVsdFwiXTtcblxuZXhwb3J0cy5wYXJzZXIgPSBwYXJzZXI7XG5cbmZ1bmN0aW9uIHBhcnNlKGlucHV0KSB7XG4gIC8vIEp1c3QgcmV0dXJuIGlmIGFuIGFscmVhZHktY29tcGlsZSBBU1Qgd2FzIHBhc3NlZCBpbi5cbiAgaWYoaW5wdXQuY29uc3RydWN0b3IgPT09IEFTVC5Qcm9ncmFtTm9kZSkgeyByZXR1cm4gaW5wdXQ7IH1cblxuICBwYXJzZXIueXkgPSBBU1Q7XG4gIHJldHVybiBwYXJzZXIucGFyc2UoaW5wdXQpO1xufVxuXG5leHBvcnRzLnBhcnNlID0gcGFyc2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4uL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG5cbmZ1bmN0aW9uIENvbXBpbGVyKCkge31cblxuZXhwb3J0cy5Db21waWxlciA9IENvbXBpbGVyOy8vIHRoZSBmb3VuZEhlbHBlciByZWdpc3RlciB3aWxsIGRpc2FtYmlndWF0ZSBoZWxwZXIgbG9va3VwIGZyb20gZmluZGluZyBhXG4vLyBmdW5jdGlvbiBpbiBhIGNvbnRleHQuIFRoaXMgaXMgbmVjZXNzYXJ5IGZvciBtdXN0YWNoZSBjb21wYXRpYmlsaXR5LCB3aGljaFxuLy8gcmVxdWlyZXMgdGhhdCBjb250ZXh0IGZ1bmN0aW9ucyBpbiBibG9ja3MgYXJlIGV2YWx1YXRlZCBieSBibG9ja0hlbHBlck1pc3NpbmcsXG4vLyBhbmQgdGhlbiBwcm9jZWVkIGFzIGlmIHRoZSByZXN1bHRpbmcgdmFsdWUgd2FzIHByb3ZpZGVkIHRvIGJsb2NrSGVscGVyTWlzc2luZy5cblxuQ29tcGlsZXIucHJvdG90eXBlID0ge1xuICBjb21waWxlcjogQ29tcGlsZXIsXG5cbiAgZGlzYXNzZW1ibGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvcGNvZGVzID0gdGhpcy5vcGNvZGVzLCBvcGNvZGUsIG91dCA9IFtdLCBwYXJhbXMsIHBhcmFtO1xuXG4gICAgZm9yICh2YXIgaT0wLCBsPW9wY29kZXMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgb3Bjb2RlID0gb3Bjb2Rlc1tpXTtcblxuICAgICAgaWYgKG9wY29kZS5vcGNvZGUgPT09ICdERUNMQVJFJykge1xuICAgICAgICBvdXQucHVzaChcIkRFQ0xBUkUgXCIgKyBvcGNvZGUubmFtZSArIFwiPVwiICsgb3Bjb2RlLnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcmFtcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBqPTA7IGo8b3Bjb2RlLmFyZ3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBwYXJhbSA9IG9wY29kZS5hcmdzW2pdO1xuICAgICAgICAgIGlmICh0eXBlb2YgcGFyYW0gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHBhcmFtID0gXCJcXFwiXCIgKyBwYXJhbS5yZXBsYWNlKFwiXFxuXCIsIFwiXFxcXG5cIikgKyBcIlxcXCJcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGFyYW1zLnB1c2gocGFyYW0pO1xuICAgICAgICB9XG4gICAgICAgIG91dC5wdXNoKG9wY29kZS5vcGNvZGUgKyBcIiBcIiArIHBhcmFtcy5qb2luKFwiIFwiKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dC5qb2luKFwiXFxuXCIpO1xuICB9LFxuXG4gIGVxdWFsczogZnVuY3Rpb24ob3RoZXIpIHtcbiAgICB2YXIgbGVuID0gdGhpcy5vcGNvZGVzLmxlbmd0aDtcbiAgICBpZiAob3RoZXIub3Bjb2Rlcy5sZW5ndGggIT09IGxlbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBvcGNvZGUgPSB0aGlzLm9wY29kZXNbaV0sXG4gICAgICAgICAgb3RoZXJPcGNvZGUgPSBvdGhlci5vcGNvZGVzW2ldO1xuICAgICAgaWYgKG9wY29kZS5vcGNvZGUgIT09IG90aGVyT3Bjb2RlLm9wY29kZSB8fCBvcGNvZGUuYXJncy5sZW5ndGggIT09IG90aGVyT3Bjb2RlLmFyZ3MubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgb3Bjb2RlLmFyZ3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKG9wY29kZS5hcmdzW2pdICE9PSBvdGhlck9wY29kZS5hcmdzW2pdKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGVuID0gdGhpcy5jaGlsZHJlbi5sZW5ndGg7XG4gICAgaWYgKG90aGVyLmNoaWxkcmVuLmxlbmd0aCAhPT0gbGVuKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgaWYgKCF0aGlzLmNoaWxkcmVuW2ldLmVxdWFscyhvdGhlci5jaGlsZHJlbltpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuXG4gIGd1aWQ6IDAsXG5cbiAgY29tcGlsZTogZnVuY3Rpb24ocHJvZ3JhbSwgb3B0aW9ucykge1xuICAgIHRoaXMub3Bjb2RlcyA9IFtdO1xuICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICB0aGlzLmRlcHRocyA9IHtsaXN0OiBbXX07XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgIC8vIFRoZXNlIGNoYW5nZXMgd2lsbCBwcm9wYWdhdGUgdG8gdGhlIG90aGVyIGNvbXBpbGVyIGNvbXBvbmVudHNcbiAgICB2YXIga25vd25IZWxwZXJzID0gdGhpcy5vcHRpb25zLmtub3duSGVscGVycztcbiAgICB0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzID0ge1xuICAgICAgJ2hlbHBlck1pc3NpbmcnOiB0cnVlLFxuICAgICAgJ2Jsb2NrSGVscGVyTWlzc2luZyc6IHRydWUsXG4gICAgICAnZWFjaCc6IHRydWUsXG4gICAgICAnaWYnOiB0cnVlLFxuICAgICAgJ3VubGVzcyc6IHRydWUsXG4gICAgICAnd2l0aCc6IHRydWUsXG4gICAgICAnbG9nJzogdHJ1ZVxuICAgIH07XG4gICAgaWYgKGtub3duSGVscGVycykge1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBrbm93bkhlbHBlcnMpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLmtub3duSGVscGVyc1tuYW1lXSA9IGtub3duSGVscGVyc1tuYW1lXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hY2NlcHQocHJvZ3JhbSk7XG4gIH0sXG5cbiAgYWNjZXB0OiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0cmlwID0gbm9kZS5zdHJpcCB8fCB7fSxcbiAgICAgICAgcmV0O1xuICAgIGlmIChzdHJpcC5sZWZ0KSB7XG4gICAgICB0aGlzLm9wY29kZSgnc3RyaXAnKTtcbiAgICB9XG5cbiAgICByZXQgPSB0aGlzW25vZGUudHlwZV0obm9kZSk7XG5cbiAgICBpZiAoc3RyaXAucmlnaHQpIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdzdHJpcCcpO1xuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cbiAgcHJvZ3JhbTogZnVuY3Rpb24ocHJvZ3JhbSkge1xuICAgIHZhciBzdGF0ZW1lbnRzID0gcHJvZ3JhbS5zdGF0ZW1lbnRzO1xuXG4gICAgZm9yKHZhciBpPTAsIGw9c3RhdGVtZW50cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICB0aGlzLmFjY2VwdChzdGF0ZW1lbnRzW2ldKTtcbiAgICB9XG4gICAgdGhpcy5pc1NpbXBsZSA9IGwgPT09IDE7XG5cbiAgICB0aGlzLmRlcHRocy5saXN0ID0gdGhpcy5kZXB0aHMubGlzdC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiBhIC0gYjtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIGNvbXBpbGVQcm9ncmFtOiBmdW5jdGlvbihwcm9ncmFtKSB7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyB0aGlzLmNvbXBpbGVyKCkuY29tcGlsZShwcm9ncmFtLCB0aGlzLm9wdGlvbnMpO1xuICAgIHZhciBndWlkID0gdGhpcy5ndWlkKyssIGRlcHRoO1xuXG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdGhpcy51c2VQYXJ0aWFsIHx8IHJlc3VsdC51c2VQYXJ0aWFsO1xuXG4gICAgdGhpcy5jaGlsZHJlbltndWlkXSA9IHJlc3VsdDtcblxuICAgIGZvcih2YXIgaT0wLCBsPXJlc3VsdC5kZXB0aHMubGlzdC5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBkZXB0aCA9IHJlc3VsdC5kZXB0aHMubGlzdFtpXTtcblxuICAgICAgaWYoZGVwdGggPCAyKSB7IGNvbnRpbnVlOyB9XG4gICAgICBlbHNlIHsgdGhpcy5hZGREZXB0aChkZXB0aCAtIDEpOyB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGd1aWQ7XG4gIH0sXG5cbiAgYmxvY2s6IGZ1bmN0aW9uKGJsb2NrKSB7XG4gICAgdmFyIG11c3RhY2hlID0gYmxvY2subXVzdGFjaGUsXG4gICAgICAgIHByb2dyYW0gPSBibG9jay5wcm9ncmFtLFxuICAgICAgICBpbnZlcnNlID0gYmxvY2suaW52ZXJzZTtcblxuICAgIGlmIChwcm9ncmFtKSB7XG4gICAgICBwcm9ncmFtID0gdGhpcy5jb21waWxlUHJvZ3JhbShwcm9ncmFtKTtcbiAgICB9XG5cbiAgICBpZiAoaW52ZXJzZSkge1xuICAgICAgaW52ZXJzZSA9IHRoaXMuY29tcGlsZVByb2dyYW0oaW52ZXJzZSk7XG4gICAgfVxuXG4gICAgdmFyIHNleHByID0gbXVzdGFjaGUuc2V4cHI7XG4gICAgdmFyIHR5cGUgPSB0aGlzLmNsYXNzaWZ5U2V4cHIoc2V4cHIpO1xuXG4gICAgaWYgKHR5cGUgPT09IFwiaGVscGVyXCIpIHtcbiAgICAgIHRoaXMuaGVscGVyU2V4cHIoc2V4cHIsIHByb2dyYW0sIGludmVyc2UpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJzaW1wbGVcIikge1xuICAgICAgdGhpcy5zaW1wbGVTZXhwcihzZXhwcik7XG5cbiAgICAgIC8vIG5vdyB0aGF0IHRoZSBzaW1wbGUgbXVzdGFjaGUgaXMgcmVzb2x2ZWQsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGV2YWx1YXRlIGl0IGJ5IGV4ZWN1dGluZyBgYmxvY2tIZWxwZXJNaXNzaW5nYFxuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdibG9ja1ZhbHVlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYW1iaWd1b3VzU2V4cHIoc2V4cHIsIHByb2dyYW0sIGludmVyc2UpO1xuXG4gICAgICAvLyBub3cgdGhhdCB0aGUgc2ltcGxlIG11c3RhY2hlIGlzIHJlc29sdmVkLCB3ZSBuZWVkIHRvXG4gICAgICAvLyBldmFsdWF0ZSBpdCBieSBleGVjdXRpbmcgYGJsb2NrSGVscGVyTWlzc2luZ2BcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgaW52ZXJzZSk7XG4gICAgICB0aGlzLm9wY29kZSgnZW1wdHlIYXNoJyk7XG4gICAgICB0aGlzLm9wY29kZSgnYW1iaWd1b3VzQmxvY2tWYWx1ZScpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdhcHBlbmQnKTtcbiAgfSxcblxuICBoYXNoOiBmdW5jdGlvbihoYXNoKSB7XG4gICAgdmFyIHBhaXJzID0gaGFzaC5wYWlycywgcGFpciwgdmFsO1xuXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hIYXNoJyk7XG5cbiAgICBmb3IodmFyIGk9MCwgbD1wYWlycy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBwYWlyID0gcGFpcnNbaV07XG4gICAgICB2YWwgID0gcGFpclsxXTtcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgICAgaWYodmFsLmRlcHRoKSB7XG4gICAgICAgICAgdGhpcy5hZGREZXB0aCh2YWwuZGVwdGgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgdmFsLmRlcHRoIHx8IDApO1xuICAgICAgICB0aGlzLm9wY29kZSgncHVzaFN0cmluZ1BhcmFtJywgdmFsLnN0cmluZ01vZGVWYWx1ZSwgdmFsLnR5cGUpO1xuXG4gICAgICAgIGlmICh2YWwudHlwZSA9PT0gJ3NleHByJykge1xuICAgICAgICAgIC8vIFN1YmV4cHJlc3Npb25zIGdldCBldmFsdWF0ZWQgYW5kIHBhc3NlZCBpblxuICAgICAgICAgIC8vIGluIHN0cmluZyBwYXJhbXMgbW9kZS5cbiAgICAgICAgICB0aGlzLnNleHByKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWNjZXB0KHZhbCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMub3Bjb2RlKCdhc3NpZ25Ub0hhc2gnLCBwYWlyWzBdKTtcbiAgICB9XG4gICAgdGhpcy5vcGNvZGUoJ3BvcEhhc2gnKTtcbiAgfSxcblxuICBwYXJ0aWFsOiBmdW5jdGlvbihwYXJ0aWFsKSB7XG4gICAgdmFyIHBhcnRpYWxOYW1lID0gcGFydGlhbC5wYXJ0aWFsTmFtZTtcbiAgICB0aGlzLnVzZVBhcnRpYWwgPSB0cnVlO1xuXG4gICAgaWYocGFydGlhbC5jb250ZXh0KSB7XG4gICAgICB0aGlzLklEKHBhcnRpYWwuY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoJywgJ2RlcHRoMCcpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdpbnZva2VQYXJ0aWFsJywgcGFydGlhbE5hbWUubmFtZSk7XG4gICAgdGhpcy5vcGNvZGUoJ2FwcGVuZCcpO1xuICB9LFxuXG4gIGNvbnRlbnQ6IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kQ29udGVudCcsIGNvbnRlbnQuc3RyaW5nKTtcbiAgfSxcblxuICBtdXN0YWNoZTogZnVuY3Rpb24obXVzdGFjaGUpIHtcbiAgICB0aGlzLnNleHByKG11c3RhY2hlLnNleHByKTtcblxuICAgIGlmKG11c3RhY2hlLmVzY2FwZWQgJiYgIXRoaXMub3B0aW9ucy5ub0VzY2FwZSkge1xuICAgICAgdGhpcy5vcGNvZGUoJ2FwcGVuZEVzY2FwZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ2FwcGVuZCcpO1xuICAgIH1cbiAgfSxcblxuICBhbWJpZ3VvdXNTZXhwcjogZnVuY3Rpb24oc2V4cHIsIHByb2dyYW0sIGludmVyc2UpIHtcbiAgICB2YXIgaWQgPSBzZXhwci5pZCxcbiAgICAgICAgbmFtZSA9IGlkLnBhcnRzWzBdLFxuICAgICAgICBpc0Jsb2NrID0gcHJvZ3JhbSAhPSBudWxsIHx8IGludmVyc2UgIT0gbnVsbDtcblxuICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgaWQuZGVwdGgpO1xuXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgaW52ZXJzZSk7XG5cbiAgICB0aGlzLm9wY29kZSgnaW52b2tlQW1iaWd1b3VzJywgbmFtZSwgaXNCbG9jayk7XG4gIH0sXG5cbiAgc2ltcGxlU2V4cHI6IGZ1bmN0aW9uKHNleHByKSB7XG4gICAgdmFyIGlkID0gc2V4cHIuaWQ7XG5cbiAgICBpZiAoaWQudHlwZSA9PT0gJ0RBVEEnKSB7XG4gICAgICB0aGlzLkRBVEEoaWQpO1xuICAgIH0gZWxzZSBpZiAoaWQucGFydHMubGVuZ3RoKSB7XG4gICAgICB0aGlzLklEKGlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU2ltcGxpZmllZCBJRCBmb3IgYHRoaXNgXG4gICAgICB0aGlzLmFkZERlcHRoKGlkLmRlcHRoKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgaWQuZGVwdGgpO1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hDb250ZXh0Jyk7XG4gICAgfVxuXG4gICAgdGhpcy5vcGNvZGUoJ3Jlc29sdmVQb3NzaWJsZUxhbWJkYScpO1xuICB9LFxuXG4gIGhlbHBlclNleHByOiBmdW5jdGlvbihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSkge1xuICAgIHZhciBwYXJhbXMgPSB0aGlzLnNldHVwRnVsbE11c3RhY2hlUGFyYW1zKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlKSxcbiAgICAgICAgbmFtZSA9IHNleHByLmlkLnBhcnRzWzBdO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0pIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdpbnZva2VLbm93bkhlbHBlcicsIHBhcmFtcy5sZW5ndGgsIG5hbWUpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmtub3duSGVscGVyc09ubHkpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJZb3Ugc3BlY2lmaWVkIGtub3duSGVscGVyc09ubHksIGJ1dCB1c2VkIHRoZSB1bmtub3duIGhlbHBlciBcIiArIG5hbWUsIHNleHByKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ2ludm9rZUhlbHBlcicsIHBhcmFtcy5sZW5ndGgsIG5hbWUsIHNleHByLmlzUm9vdCk7XG4gICAgfVxuICB9LFxuXG4gIHNleHByOiBmdW5jdGlvbihzZXhwcikge1xuICAgIHZhciB0eXBlID0gdGhpcy5jbGFzc2lmeVNleHByKHNleHByKTtcblxuICAgIGlmICh0eXBlID09PSBcInNpbXBsZVwiKSB7XG4gICAgICB0aGlzLnNpbXBsZVNleHByKHNleHByKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwiaGVscGVyXCIpIHtcbiAgICAgIHRoaXMuaGVscGVyU2V4cHIoc2V4cHIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFtYmlndW91c1NleHByKHNleHByKTtcbiAgICB9XG4gIH0sXG5cbiAgSUQ6IGZ1bmN0aW9uKGlkKSB7XG4gICAgdGhpcy5hZGREZXB0aChpZC5kZXB0aCk7XG4gICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBpZC5kZXB0aCk7XG5cbiAgICB2YXIgbmFtZSA9IGlkLnBhcnRzWzBdO1xuICAgIGlmICghbmFtZSkge1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hDb250ZXh0Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdsb29rdXBPbkNvbnRleHQnLCBpZC5wYXJ0c1swXSk7XG4gICAgfVxuXG4gICAgZm9yKHZhciBpPTEsIGw9aWQucGFydHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgdGhpcy5vcGNvZGUoJ2xvb2t1cCcsIGlkLnBhcnRzW2ldKTtcbiAgICB9XG4gIH0sXG5cbiAgREFUQTogZnVuY3Rpb24oZGF0YSkge1xuICAgIHRoaXMub3B0aW9ucy5kYXRhID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5pZC5pc1Njb3BlZCB8fCBkYXRhLmlkLmRlcHRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdTY29wZWQgZGF0YSByZWZlcmVuY2VzIGFyZSBub3Qgc3VwcG9ydGVkOiAnICsgZGF0YS5vcmlnaW5hbCwgZGF0YSk7XG4gICAgfVxuXG4gICAgdGhpcy5vcGNvZGUoJ2xvb2t1cERhdGEnKTtcbiAgICB2YXIgcGFydHMgPSBkYXRhLmlkLnBhcnRzO1xuICAgIGZvcih2YXIgaT0wLCBsPXBhcnRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdsb29rdXAnLCBwYXJ0c1tpXSk7XG4gICAgfVxuICB9LFxuXG4gIFNUUklORzogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hTdHJpbmcnLCBzdHJpbmcuc3RyaW5nKTtcbiAgfSxcblxuICBJTlRFR0VSOiBmdW5jdGlvbihpbnRlZ2VyKSB7XG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hMaXRlcmFsJywgaW50ZWdlci5pbnRlZ2VyKTtcbiAgfSxcblxuICBCT09MRUFOOiBmdW5jdGlvbihib29sKSB7XG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hMaXRlcmFsJywgYm9vbC5ib29sKTtcbiAgfSxcblxuICBjb21tZW50OiBmdW5jdGlvbigpIHt9LFxuXG4gIC8vIEhFTFBFUlNcbiAgb3Bjb2RlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdGhpcy5vcGNvZGVzLnB1c2goeyBvcGNvZGU6IG5hbWUsIGFyZ3M6IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSB9KTtcbiAgfSxcblxuICBkZWNsYXJlOiBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIHRoaXMub3Bjb2Rlcy5wdXNoKHsgb3Bjb2RlOiAnREVDTEFSRScsIG5hbWU6IG5hbWUsIHZhbHVlOiB2YWx1ZSB9KTtcbiAgfSxcblxuICBhZGREZXB0aDogZnVuY3Rpb24oZGVwdGgpIHtcbiAgICBpZihkZXB0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuICAgIGlmKCF0aGlzLmRlcHRoc1tkZXB0aF0pIHtcbiAgICAgIHRoaXMuZGVwdGhzW2RlcHRoXSA9IHRydWU7XG4gICAgICB0aGlzLmRlcHRocy5saXN0LnB1c2goZGVwdGgpO1xuICAgIH1cbiAgfSxcblxuICBjbGFzc2lmeVNleHByOiBmdW5jdGlvbihzZXhwcikge1xuICAgIHZhciBpc0hlbHBlciAgID0gc2V4cHIuaXNIZWxwZXI7XG4gICAgdmFyIGlzRWxpZ2libGUgPSBzZXhwci5lbGlnaWJsZUhlbHBlcjtcbiAgICB2YXIgb3B0aW9ucyAgICA9IHRoaXMub3B0aW9ucztcblxuICAgIC8vIGlmIGFtYmlndW91cywgd2UgY2FuIHBvc3NpYmx5IHJlc29sdmUgdGhlIGFtYmlndWl0eSBub3dcbiAgICBpZiAoaXNFbGlnaWJsZSAmJiAhaXNIZWxwZXIpIHtcbiAgICAgIHZhciBuYW1lID0gc2V4cHIuaWQucGFydHNbMF07XG5cbiAgICAgIGlmIChvcHRpb25zLmtub3duSGVscGVyc1tuYW1lXSkge1xuICAgICAgICBpc0hlbHBlciA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG9wdGlvbnMua25vd25IZWxwZXJzT25seSkge1xuICAgICAgICBpc0VsaWdpYmxlID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGlzSGVscGVyKSB7IHJldHVybiBcImhlbHBlclwiOyB9XG4gICAgZWxzZSBpZiAoaXNFbGlnaWJsZSkgeyByZXR1cm4gXCJhbWJpZ3VvdXNcIjsgfVxuICAgIGVsc2UgeyByZXR1cm4gXCJzaW1wbGVcIjsgfVxuICB9LFxuXG4gIHB1c2hQYXJhbXM6IGZ1bmN0aW9uKHBhcmFtcykge1xuICAgIHZhciBpID0gcGFyYW1zLmxlbmd0aCwgcGFyYW07XG5cbiAgICB3aGlsZShpLS0pIHtcbiAgICAgIHBhcmFtID0gcGFyYW1zW2ldO1xuXG4gICAgICBpZih0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICAgIGlmKHBhcmFtLmRlcHRoKSB7XG4gICAgICAgICAgdGhpcy5hZGREZXB0aChwYXJhbS5kZXB0aCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIHBhcmFtLmRlcHRoIHx8IDApO1xuICAgICAgICB0aGlzLm9wY29kZSgncHVzaFN0cmluZ1BhcmFtJywgcGFyYW0uc3RyaW5nTW9kZVZhbHVlLCBwYXJhbS50eXBlKTtcblxuICAgICAgICBpZiAocGFyYW0udHlwZSA9PT0gJ3NleHByJykge1xuICAgICAgICAgIC8vIFN1YmV4cHJlc3Npb25zIGdldCBldmFsdWF0ZWQgYW5kIHBhc3NlZCBpblxuICAgICAgICAgIC8vIGluIHN0cmluZyBwYXJhbXMgbW9kZS5cbiAgICAgICAgICB0aGlzLnNleHByKHBhcmFtKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpc1twYXJhbS50eXBlXShwYXJhbSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHNldHVwRnVsbE11c3RhY2hlUGFyYW1zOiBmdW5jdGlvbihzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSkge1xuICAgIHZhciBwYXJhbXMgPSBzZXhwci5wYXJhbXM7XG4gICAgdGhpcy5wdXNoUGFyYW1zKHBhcmFtcyk7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcblxuICAgIGlmIChzZXhwci5oYXNoKSB7XG4gICAgICB0aGlzLmhhc2goc2V4cHIuaGFzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyYW1zO1xuICB9XG59O1xuXG5mdW5jdGlvbiBwcmVjb21waWxlKGlucHV0LCBvcHRpb25zLCBlbnYpIHtcbiAgaWYgKGlucHV0ID09IG51bGwgfHwgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycgJiYgaW5wdXQuY29uc3RydWN0b3IgIT09IGVudi5BU1QuUHJvZ3JhbU5vZGUpKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIllvdSBtdXN0IHBhc3MgYSBzdHJpbmcgb3IgSGFuZGxlYmFycyBBU1QgdG8gSGFuZGxlYmFycy5wcmVjb21waWxlLiBZb3UgcGFzc2VkIFwiICsgaW5wdXQpO1xuICB9XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICghKCdkYXRhJyBpbiBvcHRpb25zKSkge1xuICAgIG9wdGlvbnMuZGF0YSA9IHRydWU7XG4gIH1cblxuICB2YXIgYXN0ID0gZW52LnBhcnNlKGlucHV0KTtcbiAgdmFyIGVudmlyb25tZW50ID0gbmV3IGVudi5Db21waWxlcigpLmNvbXBpbGUoYXN0LCBvcHRpb25zKTtcbiAgcmV0dXJuIG5ldyBlbnYuSmF2YVNjcmlwdENvbXBpbGVyKCkuY29tcGlsZShlbnZpcm9ubWVudCwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydHMucHJlY29tcGlsZSA9IHByZWNvbXBpbGU7ZnVuY3Rpb24gY29tcGlsZShpbnB1dCwgb3B0aW9ucywgZW52KSB7XG4gIGlmIChpbnB1dCA9PSBudWxsIHx8ICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnICYmIGlucHV0LmNvbnN0cnVjdG9yICE9PSBlbnYuQVNULlByb2dyYW1Ob2RlKSkge1xuICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJZb3UgbXVzdCBwYXNzIGEgc3RyaW5nIG9yIEhhbmRsZWJhcnMgQVNUIHRvIEhhbmRsZWJhcnMuY29tcGlsZS4gWW91IHBhc3NlZCBcIiArIGlucHV0KTtcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIGlmICghKCdkYXRhJyBpbiBvcHRpb25zKSkge1xuICAgIG9wdGlvbnMuZGF0YSA9IHRydWU7XG4gIH1cblxuICB2YXIgY29tcGlsZWQ7XG5cbiAgZnVuY3Rpb24gY29tcGlsZUlucHV0KCkge1xuICAgIHZhciBhc3QgPSBlbnYucGFyc2UoaW5wdXQpO1xuICAgIHZhciBlbnZpcm9ubWVudCA9IG5ldyBlbnYuQ29tcGlsZXIoKS5jb21waWxlKGFzdCwgb3B0aW9ucyk7XG4gICAgdmFyIHRlbXBsYXRlU3BlYyA9IG5ldyBlbnYuSmF2YVNjcmlwdENvbXBpbGVyKCkuY29tcGlsZShlbnZpcm9ubWVudCwgb3B0aW9ucywgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICByZXR1cm4gZW52LnRlbXBsYXRlKHRlbXBsYXRlU3BlYyk7XG4gIH1cblxuICAvLyBUZW1wbGF0ZSBpcyBvbmx5IGNvbXBpbGVkIG9uIGZpcnN0IHVzZSBhbmQgY2FjaGVkIGFmdGVyIHRoYXQgcG9pbnQuXG4gIHJldHVybiBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgaWYgKCFjb21waWxlZCkge1xuICAgICAgY29tcGlsZWQgPSBjb21waWxlSW5wdXQoKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBpbGVkLmNhbGwodGhpcywgY29udGV4dCwgb3B0aW9ucyk7XG4gIH07XG59XG5cbmV4cG9ydHMuY29tcGlsZSA9IGNvbXBpbGU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgQ09NUElMRVJfUkVWSVNJT04gPSByZXF1aXJlKFwiLi4vYmFzZVwiKS5DT01QSUxFUl9SRVZJU0lPTjtcbnZhciBSRVZJU0lPTl9DSEFOR0VTID0gcmVxdWlyZShcIi4uL2Jhc2VcIikuUkVWSVNJT05fQ0hBTkdFUztcbnZhciBsb2cgPSByZXF1aXJlKFwiLi4vYmFzZVwiKS5sb2c7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4uL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG5cbmZ1bmN0aW9uIExpdGVyYWwodmFsdWUpIHtcbiAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5mdW5jdGlvbiBKYXZhU2NyaXB0Q29tcGlsZXIoKSB7fVxuXG5KYXZhU2NyaXB0Q29tcGlsZXIucHJvdG90eXBlID0ge1xuICAvLyBQVUJMSUMgQVBJOiBZb3UgY2FuIG92ZXJyaWRlIHRoZXNlIG1ldGhvZHMgaW4gYSBzdWJjbGFzcyB0byBwcm92aWRlXG4gIC8vIGFsdGVybmF0aXZlIGNvbXBpbGVkIGZvcm1zIGZvciBuYW1lIGxvb2t1cCBhbmQgYnVmZmVyaW5nIHNlbWFudGljc1xuICBuYW1lTG9va3VwOiBmdW5jdGlvbihwYXJlbnQsIG5hbWUgLyogLCB0eXBlKi8pIHtcbiAgICB2YXIgd3JhcCxcbiAgICAgICAgcmV0O1xuICAgIGlmIChwYXJlbnQuaW5kZXhPZignZGVwdGgnKSA9PT0gMCkge1xuICAgICAgd3JhcCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKC9eWzAtOV0rJC8udGVzdChuYW1lKSkge1xuICAgICAgcmV0ID0gcGFyZW50ICsgXCJbXCIgKyBuYW1lICsgXCJdXCI7XG4gICAgfSBlbHNlIGlmIChKYXZhU2NyaXB0Q29tcGlsZXIuaXNWYWxpZEphdmFTY3JpcHRWYXJpYWJsZU5hbWUobmFtZSkpIHtcbiAgICAgIHJldCA9IHBhcmVudCArIFwiLlwiICsgbmFtZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICByZXQgPSBwYXJlbnQgKyBcIlsnXCIgKyBuYW1lICsgXCInXVwiO1xuICAgIH1cblxuICAgIGlmICh3cmFwKSB7XG4gICAgICByZXR1cm4gJygnICsgcGFyZW50ICsgJyAmJiAnICsgcmV0ICsgJyknO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH1cbiAgfSxcblxuICBjb21waWxlckluZm86IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXZpc2lvbiA9IENPTVBJTEVSX1JFVklTSU9OLFxuICAgICAgICB2ZXJzaW9ucyA9IFJFVklTSU9OX0NIQU5HRVNbcmV2aXNpb25dO1xuICAgIHJldHVybiBcInRoaXMuY29tcGlsZXJJbmZvID0gW1wiK3JldmlzaW9uK1wiLCdcIit2ZXJzaW9ucytcIiddO1xcblwiO1xuICB9LFxuXG4gIGFwcGVuZFRvQnVmZmVyOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgICAgcmV0dXJuIFwicmV0dXJuIFwiICsgc3RyaW5nICsgXCI7XCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFwcGVuZFRvQnVmZmVyOiB0cnVlLFxuICAgICAgICBjb250ZW50OiBzdHJpbmcsXG4gICAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHsgcmV0dXJuIFwiYnVmZmVyICs9IFwiICsgc3RyaW5nICsgXCI7XCI7IH1cbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG4gIGluaXRpYWxpemVCdWZmZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnF1b3RlZFN0cmluZyhcIlwiKTtcbiAgfSxcblxuICBuYW1lc3BhY2U6IFwiSGFuZGxlYmFyc1wiLFxuICAvLyBFTkQgUFVCTElDIEFQSVxuXG4gIGNvbXBpbGU6IGZ1bmN0aW9uKGVudmlyb25tZW50LCBvcHRpb25zLCBjb250ZXh0LCBhc09iamVjdCkge1xuICAgIHRoaXMuZW52aXJvbm1lbnQgPSBlbnZpcm9ubWVudDtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgbG9nKCdkZWJ1ZycsIHRoaXMuZW52aXJvbm1lbnQuZGlzYXNzZW1ibGUoKSArIFwiXFxuXFxuXCIpO1xuXG4gICAgdGhpcy5uYW1lID0gdGhpcy5lbnZpcm9ubWVudC5uYW1lO1xuICAgIHRoaXMuaXNDaGlsZCA9ICEhY29udGV4dDtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0IHx8IHtcbiAgICAgIHByb2dyYW1zOiBbXSxcbiAgICAgIGVudmlyb25tZW50czogW10sXG4gICAgICBhbGlhc2VzOiB7IH1cbiAgICB9O1xuXG4gICAgdGhpcy5wcmVhbWJsZSgpO1xuXG4gICAgdGhpcy5zdGFja1Nsb3QgPSAwO1xuICAgIHRoaXMuc3RhY2tWYXJzID0gW107XG4gICAgdGhpcy5yZWdpc3RlcnMgPSB7IGxpc3Q6IFtdIH07XG4gICAgdGhpcy5oYXNoZXMgPSBbXTtcbiAgICB0aGlzLmNvbXBpbGVTdGFjayA9IFtdO1xuICAgIHRoaXMuaW5saW5lU3RhY2sgPSBbXTtcblxuICAgIHRoaXMuY29tcGlsZUNoaWxkcmVuKGVudmlyb25tZW50LCBvcHRpb25zKTtcblxuICAgIHZhciBvcGNvZGVzID0gZW52aXJvbm1lbnQub3Bjb2Rlcywgb3Bjb2RlO1xuXG4gICAgdGhpcy5pID0gMDtcblxuICAgIGZvcih2YXIgbD1vcGNvZGVzLmxlbmd0aDsgdGhpcy5pPGw7IHRoaXMuaSsrKSB7XG4gICAgICBvcGNvZGUgPSBvcGNvZGVzW3RoaXMuaV07XG5cbiAgICAgIGlmKG9wY29kZS5vcGNvZGUgPT09ICdERUNMQVJFJykge1xuICAgICAgICB0aGlzW29wY29kZS5uYW1lXSA9IG9wY29kZS52YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXNbb3Bjb2RlLm9wY29kZV0uYXBwbHkodGhpcywgb3Bjb2RlLmFyZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXNldCB0aGUgc3RyaXBOZXh0IGZsYWcgaWYgaXQgd2FzIG5vdCBzZXQgYnkgdGhpcyBvcGVyYXRpb24uXG4gICAgICBpZiAob3Bjb2RlLm9wY29kZSAhPT0gdGhpcy5zdHJpcE5leHQpIHtcbiAgICAgICAgdGhpcy5zdHJpcE5leHQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGbHVzaCBhbnkgdHJhaWxpbmcgY29udGVudCB0aGF0IG1pZ2h0IGJlIHBlbmRpbmcuXG4gICAgdGhpcy5wdXNoU291cmNlKCcnKTtcblxuICAgIGlmICh0aGlzLnN0YWNrU2xvdCB8fCB0aGlzLmlubGluZVN0YWNrLmxlbmd0aCB8fCB0aGlzLmNvbXBpbGVTdGFjay5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ0NvbXBpbGUgY29tcGxldGVkIHdpdGggY29udGVudCBsZWZ0IG9uIHN0YWNrJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlRnVuY3Rpb25Db250ZXh0KGFzT2JqZWN0KTtcbiAgfSxcblxuICBwcmVhbWJsZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG91dCA9IFtdO1xuXG4gICAgaWYgKCF0aGlzLmlzQ2hpbGQpIHtcbiAgICAgIHZhciBuYW1lc3BhY2UgPSB0aGlzLm5hbWVzcGFjZTtcblxuICAgICAgdmFyIGNvcGllcyA9IFwiaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgXCIgKyBuYW1lc3BhY2UgKyBcIi5oZWxwZXJzKTtcIjtcbiAgICAgIGlmICh0aGlzLmVudmlyb25tZW50LnVzZVBhcnRpYWwpIHsgY29waWVzID0gY29waWVzICsgXCIgcGFydGlhbHMgPSB0aGlzLm1lcmdlKHBhcnRpYWxzLCBcIiArIG5hbWVzcGFjZSArIFwiLnBhcnRpYWxzKTtcIjsgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5kYXRhKSB7IGNvcGllcyA9IGNvcGllcyArIFwiIGRhdGEgPSBkYXRhIHx8IHt9O1wiOyB9XG4gICAgICBvdXQucHVzaChjb3BpZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXQucHVzaCgnJyk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICBvdXQucHVzaChcIiwgYnVmZmVyID0gXCIgKyB0aGlzLmluaXRpYWxpemVCdWZmZXIoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dC5wdXNoKFwiXCIpO1xuICAgIH1cblxuICAgIC8vIHRyYWNrIHRoZSBsYXN0IGNvbnRleHQgcHVzaGVkIGludG8gcGxhY2UgdG8gYWxsb3cgc2tpcHBpbmcgdGhlXG4gICAgLy8gZ2V0Q29udGV4dCBvcGNvZGUgd2hlbiBpdCB3b3VsZCBiZSBhIG5vb3BcbiAgICB0aGlzLmxhc3RDb250ZXh0ID0gMDtcbiAgICB0aGlzLnNvdXJjZSA9IG91dDtcbiAgfSxcblxuICBjcmVhdGVGdW5jdGlvbkNvbnRleHQ6IGZ1bmN0aW9uKGFzT2JqZWN0KSB7XG4gICAgdmFyIGxvY2FscyA9IHRoaXMuc3RhY2tWYXJzLmNvbmNhdCh0aGlzLnJlZ2lzdGVycy5saXN0KTtcblxuICAgIGlmKGxvY2Fscy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnNvdXJjZVsxXSA9IHRoaXMuc291cmNlWzFdICsgXCIsIFwiICsgbG9jYWxzLmpvaW4oXCIsIFwiKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBtaW5pbWl6ZXIgYWxpYXMgbWFwcGluZ3NcbiAgICBpZiAoIXRoaXMuaXNDaGlsZCkge1xuICAgICAgZm9yICh2YXIgYWxpYXMgaW4gdGhpcy5jb250ZXh0LmFsaWFzZXMpIHtcbiAgICAgICAgaWYgKHRoaXMuY29udGV4dC5hbGlhc2VzLmhhc093blByb3BlcnR5KGFsaWFzKSkge1xuICAgICAgICAgIHRoaXMuc291cmNlWzFdID0gdGhpcy5zb3VyY2VbMV0gKyAnLCAnICsgYWxpYXMgKyAnPScgKyB0aGlzLmNvbnRleHQuYWxpYXNlc1thbGlhc107XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5zb3VyY2VbMV0pIHtcbiAgICAgIHRoaXMuc291cmNlWzFdID0gXCJ2YXIgXCIgKyB0aGlzLnNvdXJjZVsxXS5zdWJzdHJpbmcoMikgKyBcIjtcIjtcbiAgICB9XG5cbiAgICAvLyBNZXJnZSBjaGlsZHJlblxuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICB0aGlzLnNvdXJjZVsxXSArPSAnXFxuJyArIHRoaXMuY29udGV4dC5wcm9ncmFtcy5qb2luKCdcXG4nKSArICdcXG4nO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgICAgdGhpcy5wdXNoU291cmNlKFwicmV0dXJuIGJ1ZmZlcjtcIik7XG4gICAgfVxuXG4gICAgdmFyIHBhcmFtcyA9IHRoaXMuaXNDaGlsZCA/IFtcImRlcHRoMFwiLCBcImRhdGFcIl0gOiBbXCJIYW5kbGViYXJzXCIsIFwiZGVwdGgwXCIsIFwiaGVscGVyc1wiLCBcInBhcnRpYWxzXCIsIFwiZGF0YVwiXTtcblxuICAgIGZvcih2YXIgaT0wLCBsPXRoaXMuZW52aXJvbm1lbnQuZGVwdGhzLmxpc3QubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgcGFyYW1zLnB1c2goXCJkZXB0aFwiICsgdGhpcy5lbnZpcm9ubWVudC5kZXB0aHMubGlzdFtpXSk7XG4gICAgfVxuXG4gICAgLy8gUGVyZm9ybSBhIHNlY29uZCBwYXNzIG92ZXIgdGhlIG91dHB1dCB0byBtZXJnZSBjb250ZW50IHdoZW4gcG9zc2libGVcbiAgICB2YXIgc291cmNlID0gdGhpcy5tZXJnZVNvdXJjZSgpO1xuXG4gICAgaWYgKCF0aGlzLmlzQ2hpbGQpIHtcbiAgICAgIHNvdXJjZSA9IHRoaXMuY29tcGlsZXJJbmZvKCkrc291cmNlO1xuICAgIH1cblxuICAgIGlmIChhc09iamVjdCkge1xuICAgICAgcGFyYW1zLnB1c2goc291cmNlKTtcblxuICAgICAgcmV0dXJuIEZ1bmN0aW9uLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBmdW5jdGlvblNvdXJjZSA9ICdmdW5jdGlvbiAnICsgKHRoaXMubmFtZSB8fCAnJykgKyAnKCcgKyBwYXJhbXMuam9pbignLCcpICsgJykge1xcbiAgJyArIHNvdXJjZSArICd9JztcbiAgICAgIGxvZygnZGVidWcnLCBmdW5jdGlvblNvdXJjZSArIFwiXFxuXFxuXCIpO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uU291cmNlO1xuICAgIH1cbiAgfSxcbiAgbWVyZ2VTb3VyY2U6IGZ1bmN0aW9uKCkge1xuICAgIC8vIFdBUk46IFdlIGFyZSBub3QgaGFuZGxpbmcgdGhlIGNhc2Ugd2hlcmUgYnVmZmVyIGlzIHN0aWxsIHBvcHVsYXRlZCBhcyB0aGUgc291cmNlIHNob3VsZFxuICAgIC8vIG5vdCBoYXZlIGJ1ZmZlciBhcHBlbmQgb3BlcmF0aW9ucyBhcyB0aGVpciBmaW5hbCBhY3Rpb24uXG4gICAgdmFyIHNvdXJjZSA9ICcnLFxuICAgICAgICBidWZmZXI7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuc291cmNlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgbGluZSA9IHRoaXMuc291cmNlW2ldO1xuICAgICAgaWYgKGxpbmUuYXBwZW5kVG9CdWZmZXIpIHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIGJ1ZmZlciA9IGJ1ZmZlciArICdcXG4gICAgKyAnICsgbGluZS5jb250ZW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJ1ZmZlciA9IGxpbmUuY29udGVudDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIHNvdXJjZSArPSAnYnVmZmVyICs9ICcgKyBidWZmZXIgKyAnO1xcbiAgJztcbiAgICAgICAgICBidWZmZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlICs9IGxpbmUgKyAnXFxuICAnO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc291cmNlO1xuICB9LFxuXG4gIC8vIFtibG9ja1ZhbHVlXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCB2YWx1ZVxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJldHVybiB2YWx1ZSBvZiBibG9ja0hlbHBlck1pc3NpbmdcbiAgLy9cbiAgLy8gVGhlIHB1cnBvc2Ugb2YgdGhpcyBvcGNvZGUgaXMgdG8gdGFrZSBhIGJsb2NrIG9mIHRoZSBmb3JtXG4gIC8vIGB7eyNmb299fS4uLnt7L2Zvb319YCwgcmVzb2x2ZSB0aGUgdmFsdWUgb2YgYGZvb2AsIGFuZFxuICAvLyByZXBsYWNlIGl0IG9uIHRoZSBzdGFjayB3aXRoIHRoZSByZXN1bHQgb2YgcHJvcGVybHlcbiAgLy8gaW52b2tpbmcgYmxvY2tIZWxwZXJNaXNzaW5nLlxuICBibG9ja1ZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5ibG9ja0hlbHBlck1pc3NpbmcgPSAnaGVscGVycy5ibG9ja0hlbHBlck1pc3NpbmcnO1xuXG4gICAgdmFyIHBhcmFtcyA9IFtcImRlcHRoMFwiXTtcbiAgICB0aGlzLnNldHVwUGFyYW1zKDAsIHBhcmFtcyk7XG5cbiAgICB0aGlzLnJlcGxhY2VTdGFjayhmdW5jdGlvbihjdXJyZW50KSB7XG4gICAgICBwYXJhbXMuc3BsaWNlKDEsIDAsIGN1cnJlbnQpO1xuICAgICAgcmV0dXJuIFwiYmxvY2tIZWxwZXJNaXNzaW5nLmNhbGwoXCIgKyBwYXJhbXMuam9pbihcIiwgXCIpICsgXCIpXCI7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gW2FtYmlndW91c0Jsb2NrVmFsdWVdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHZhbHVlXG4gIC8vIENvbXBpbGVyIHZhbHVlLCBiZWZvcmU6IGxhc3RIZWxwZXI9dmFsdWUgb2YgbGFzdCBmb3VuZCBoZWxwZXIsIGlmIGFueVxuICAvLyBPbiBzdGFjaywgYWZ0ZXIsIGlmIG5vIGxhc3RIZWxwZXI6IHNhbWUgYXMgW2Jsb2NrVmFsdWVdXG4gIC8vIE9uIHN0YWNrLCBhZnRlciwgaWYgbGFzdEhlbHBlcjogdmFsdWVcbiAgYW1iaWd1b3VzQmxvY2tWYWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuYmxvY2tIZWxwZXJNaXNzaW5nID0gJ2hlbHBlcnMuYmxvY2tIZWxwZXJNaXNzaW5nJztcblxuICAgIHZhciBwYXJhbXMgPSBbXCJkZXB0aDBcIl07XG4gICAgdGhpcy5zZXR1cFBhcmFtcygwLCBwYXJhbXMpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSB0aGlzLnRvcFN0YWNrKCk7XG4gICAgcGFyYW1zLnNwbGljZSgxLCAwLCBjdXJyZW50KTtcblxuICAgIHRoaXMucHVzaFNvdXJjZShcImlmICghXCIgKyB0aGlzLmxhc3RIZWxwZXIgKyBcIikgeyBcIiArIGN1cnJlbnQgKyBcIiA9IGJsb2NrSGVscGVyTWlzc2luZy5jYWxsKFwiICsgcGFyYW1zLmpvaW4oXCIsIFwiKSArIFwiKTsgfVwiKTtcbiAgfSxcblxuICAvLyBbYXBwZW5kQ29udGVudF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vXG4gIC8vIEFwcGVuZHMgdGhlIHN0cmluZyB2YWx1ZSBvZiBgY29udGVudGAgdG8gdGhlIGN1cnJlbnQgYnVmZmVyXG4gIGFwcGVuZENvbnRlbnQ6IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgICBpZiAodGhpcy5wZW5kaW5nQ29udGVudCkge1xuICAgICAgY29udGVudCA9IHRoaXMucGVuZGluZ0NvbnRlbnQgKyBjb250ZW50O1xuICAgIH1cbiAgICBpZiAodGhpcy5zdHJpcE5leHQpIHtcbiAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL15cXHMrLywgJycpO1xuICAgIH1cblxuICAgIHRoaXMucGVuZGluZ0NvbnRlbnQgPSBjb250ZW50O1xuICB9LFxuXG4gIC8vIFtzdHJpcF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vXG4gIC8vIFJlbW92ZXMgYW55IHRyYWlsaW5nIHdoaXRlc3BhY2UgZnJvbSB0aGUgcHJpb3IgY29udGVudCBub2RlIGFuZCBmbGFnc1xuICAvLyB0aGUgbmV4dCBvcGVyYXRpb24gZm9yIHN0cmlwcGluZyBpZiBpdCBpcyBhIGNvbnRlbnQgbm9kZS5cbiAgc3RyaXA6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb250ZW50KSB7XG4gICAgICB0aGlzLnBlbmRpbmdDb250ZW50ID0gdGhpcy5wZW5kaW5nQ29udGVudC5yZXBsYWNlKC9cXHMrJC8sICcnKTtcbiAgICB9XG4gICAgdGhpcy5zdHJpcE5leHQgPSAnc3RyaXAnO1xuICB9LFxuXG4gIC8vIFthcHBlbmRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy9cbiAgLy8gQ29lcmNlcyBgdmFsdWVgIHRvIGEgU3RyaW5nIGFuZCBhcHBlbmRzIGl0IHRvIHRoZSBjdXJyZW50IGJ1ZmZlci5cbiAgLy9cbiAgLy8gSWYgYHZhbHVlYCBpcyB0cnV0aHksIG9yIDAsIGl0IGlzIGNvZXJjZWQgaW50byBhIHN0cmluZyBhbmQgYXBwZW5kZWRcbiAgLy8gT3RoZXJ3aXNlLCB0aGUgZW1wdHkgc3RyaW5nIGlzIGFwcGVuZGVkXG4gIGFwcGVuZDogZnVuY3Rpb24oKSB7XG4gICAgLy8gRm9yY2UgYW55dGhpbmcgdGhhdCBpcyBpbmxpbmVkIG9udG8gdGhlIHN0YWNrIHNvIHdlIGRvbid0IGhhdmUgZHVwbGljYXRpb25cbiAgICAvLyB3aGVuIHdlIGV4YW1pbmUgbG9jYWxcbiAgICB0aGlzLmZsdXNoSW5saW5lKCk7XG4gICAgdmFyIGxvY2FsID0gdGhpcy5wb3BTdGFjaygpO1xuICAgIHRoaXMucHVzaFNvdXJjZShcImlmKFwiICsgbG9jYWwgKyBcIiB8fCBcIiArIGxvY2FsICsgXCIgPT09IDApIHsgXCIgKyB0aGlzLmFwcGVuZFRvQnVmZmVyKGxvY2FsKSArIFwiIH1cIik7XG4gICAgaWYgKHRoaXMuZW52aXJvbm1lbnQuaXNTaW1wbGUpIHtcbiAgICAgIHRoaXMucHVzaFNvdXJjZShcImVsc2UgeyBcIiArIHRoaXMuYXBwZW5kVG9CdWZmZXIoXCInJ1wiKSArIFwiIH1cIik7XG4gICAgfVxuICB9LFxuXG4gIC8vIFthcHBlbmRFc2NhcGVkXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vXG4gIC8vIEVzY2FwZSBgdmFsdWVgIGFuZCBhcHBlbmQgaXQgdG8gdGhlIGJ1ZmZlclxuICBhcHBlbmRFc2NhcGVkOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5lc2NhcGVFeHByZXNzaW9uID0gJ3RoaXMuZXNjYXBlRXhwcmVzc2lvbic7XG5cbiAgICB0aGlzLnB1c2hTb3VyY2UodGhpcy5hcHBlbmRUb0J1ZmZlcihcImVzY2FwZUV4cHJlc3Npb24oXCIgKyB0aGlzLnBvcFN0YWNrKCkgKyBcIilcIikpO1xuICB9LFxuXG4gIC8vIFtnZXRDb250ZXh0XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiAuLi5cbiAgLy8gQ29tcGlsZXIgdmFsdWUsIGFmdGVyOiBsYXN0Q29udGV4dD1kZXB0aFxuICAvL1xuICAvLyBTZXQgdGhlIHZhbHVlIG9mIHRoZSBgbGFzdENvbnRleHRgIGNvbXBpbGVyIHZhbHVlIHRvIHRoZSBkZXB0aFxuICBnZXRDb250ZXh0OiBmdW5jdGlvbihkZXB0aCkge1xuICAgIGlmKHRoaXMubGFzdENvbnRleHQgIT09IGRlcHRoKSB7XG4gICAgICB0aGlzLmxhc3RDb250ZXh0ID0gZGVwdGg7XG4gICAgfVxuICB9LFxuXG4gIC8vIFtsb29rdXBPbkNvbnRleHRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGN1cnJlbnRDb250ZXh0W25hbWVdLCAuLi5cbiAgLy9cbiAgLy8gTG9va3MgdXAgdGhlIHZhbHVlIG9mIGBuYW1lYCBvbiB0aGUgY3VycmVudCBjb250ZXh0IGFuZCBwdXNoZXNcbiAgLy8gaXQgb250byB0aGUgc3RhY2suXG4gIGxvb2t1cE9uQ29udGV4dDogZnVuY3Rpb24obmFtZSkge1xuICAgIHRoaXMucHVzaCh0aGlzLm5hbWVMb29rdXAoJ2RlcHRoJyArIHRoaXMubGFzdENvbnRleHQsIG5hbWUsICdjb250ZXh0JykpO1xuICB9LFxuXG4gIC8vIFtwdXNoQ29udGV4dF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogY3VycmVudENvbnRleHQsIC4uLlxuICAvL1xuICAvLyBQdXNoZXMgdGhlIHZhbHVlIG9mIHRoZSBjdXJyZW50IGNvbnRleHQgb250byB0aGUgc3RhY2suXG4gIHB1c2hDb250ZXh0OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ2RlcHRoJyArIHRoaXMubGFzdENvbnRleHQpO1xuICB9LFxuXG4gIC8vIFtyZXNvbHZlUG9zc2libGVMYW1iZGFdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXNvbHZlZCB2YWx1ZSwgLi4uXG4gIC8vXG4gIC8vIElmIHRoZSBgdmFsdWVgIGlzIGEgbGFtYmRhLCByZXBsYWNlIGl0IG9uIHRoZSBzdGFjayBieVxuICAvLyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBsYW1iZGFcbiAgcmVzb2x2ZVBvc3NpYmxlTGFtYmRhOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5mdW5jdGlvblR5cGUgPSAnXCJmdW5jdGlvblwiJztcblxuICAgIHRoaXMucmVwbGFjZVN0YWNrKGZ1bmN0aW9uKGN1cnJlbnQpIHtcbiAgICAgIHJldHVybiBcInR5cGVvZiBcIiArIGN1cnJlbnQgKyBcIiA9PT0gZnVuY3Rpb25UeXBlID8gXCIgKyBjdXJyZW50ICsgXCIuYXBwbHkoZGVwdGgwKSA6IFwiICsgY3VycmVudDtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBbbG9va3VwXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogdmFsdWVbbmFtZV0sIC4uLlxuICAvL1xuICAvLyBSZXBsYWNlIHRoZSB2YWx1ZSBvbiB0aGUgc3RhY2sgd2l0aCB0aGUgcmVzdWx0IG9mIGxvb2tpbmdcbiAgLy8gdXAgYG5hbWVgIG9uIGB2YWx1ZWBcbiAgbG9va3VwOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdGhpcy5yZXBsYWNlU3RhY2soZnVuY3Rpb24oY3VycmVudCkge1xuICAgICAgcmV0dXJuIGN1cnJlbnQgKyBcIiA9PSBudWxsIHx8IFwiICsgY3VycmVudCArIFwiID09PSBmYWxzZSA/IFwiICsgY3VycmVudCArIFwiIDogXCIgKyB0aGlzLm5hbWVMb29rdXAoY3VycmVudCwgbmFtZSwgJ2NvbnRleHQnKTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBbbG9va3VwRGF0YV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogZGF0YSwgLi4uXG4gIC8vXG4gIC8vIFB1c2ggdGhlIGRhdGEgbG9va3VwIG9wZXJhdG9yXG4gIGxvb2t1cERhdGE6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgnZGF0YScpO1xuICB9LFxuXG4gIC8vIFtwdXNoU3RyaW5nUGFyYW1dXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHN0cmluZywgY3VycmVudENvbnRleHQsIC4uLlxuICAvL1xuICAvLyBUaGlzIG9wY29kZSBpcyBkZXNpZ25lZCBmb3IgdXNlIGluIHN0cmluZyBtb2RlLCB3aGljaFxuICAvLyBwcm92aWRlcyB0aGUgc3RyaW5nIHZhbHVlIG9mIGEgcGFyYW1ldGVyIGFsb25nIHdpdGggaXRzXG4gIC8vIGRlcHRoIHJhdGhlciB0aGFuIHJlc29sdmluZyBpdCBpbW1lZGlhdGVseS5cbiAgcHVzaFN0cmluZ1BhcmFtOiBmdW5jdGlvbihzdHJpbmcsIHR5cGUpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ2RlcHRoJyArIHRoaXMubGFzdENvbnRleHQpO1xuXG4gICAgdGhpcy5wdXNoU3RyaW5nKHR5cGUpO1xuXG4gICAgLy8gSWYgaXQncyBhIHN1YmV4cHJlc3Npb24sIHRoZSBzdHJpbmcgcmVzdWx0XG4gICAgLy8gd2lsbCBiZSBwdXNoZWQgYWZ0ZXIgdGhpcyBvcGNvZGUuXG4gICAgaWYgKHR5cGUgIT09ICdzZXhwcicpIHtcbiAgICAgIGlmICh0eXBlb2Ygc3RyaW5nID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLnB1c2hTdHJpbmcoc3RyaW5nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbChzdHJpbmcpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBlbXB0eUhhc2g6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgne30nKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICB0aGlzLnB1c2goJ3t9Jyk7IC8vIGhhc2hDb250ZXh0c1xuICAgICAgdGhpcy5wdXNoKCd7fScpOyAvLyBoYXNoVHlwZXNcbiAgICB9XG4gIH0sXG4gIHB1c2hIYXNoOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5oYXNoKSB7XG4gICAgICB0aGlzLmhhc2hlcy5wdXNoKHRoaXMuaGFzaCk7XG4gICAgfVxuICAgIHRoaXMuaGFzaCA9IHt2YWx1ZXM6IFtdLCB0eXBlczogW10sIGNvbnRleHRzOiBbXX07XG4gIH0sXG4gIHBvcEhhc2g6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBoYXNoID0gdGhpcy5oYXNoO1xuICAgIHRoaXMuaGFzaCA9IHRoaXMuaGFzaGVzLnBvcCgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIHRoaXMucHVzaCgneycgKyBoYXNoLmNvbnRleHRzLmpvaW4oJywnKSArICd9Jyk7XG4gICAgICB0aGlzLnB1c2goJ3snICsgaGFzaC50eXBlcy5qb2luKCcsJykgKyAnfScpO1xuICAgIH1cblxuICAgIHRoaXMucHVzaCgne1xcbiAgICAnICsgaGFzaC52YWx1ZXMuam9pbignLFxcbiAgICAnKSArICdcXG4gIH0nKTtcbiAgfSxcblxuICAvLyBbcHVzaFN0cmluZ11cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcXVvdGVkU3RyaW5nKHN0cmluZyksIC4uLlxuICAvL1xuICAvLyBQdXNoIGEgcXVvdGVkIHZlcnNpb24gb2YgYHN0cmluZ2Agb250byB0aGUgc3RhY2tcbiAgcHVzaFN0cmluZzogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHRoaXMucXVvdGVkU3RyaW5nKHN0cmluZykpO1xuICB9LFxuXG4gIC8vIFtwdXNoXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBleHByLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCBhbiBleHByZXNzaW9uIG9udG8gdGhlIHN0YWNrXG4gIHB1c2g6IGZ1bmN0aW9uKGV4cHIpIHtcbiAgICB0aGlzLmlubGluZVN0YWNrLnB1c2goZXhwcik7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH0sXG5cbiAgLy8gW3B1c2hMaXRlcmFsXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiB2YWx1ZSwgLi4uXG4gIC8vXG4gIC8vIFB1c2hlcyBhIHZhbHVlIG9udG8gdGhlIHN0YWNrLiBUaGlzIG9wZXJhdGlvbiBwcmV2ZW50c1xuICAvLyB0aGUgY29tcGlsZXIgZnJvbSBjcmVhdGluZyBhIHRlbXBvcmFyeSB2YXJpYWJsZSB0byBob2xkXG4gIC8vIGl0LlxuICBwdXNoTGl0ZXJhbDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwodmFsdWUpO1xuICB9LFxuXG4gIC8vIFtwdXNoUHJvZ3JhbV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcHJvZ3JhbShndWlkKSwgLi4uXG4gIC8vXG4gIC8vIFB1c2ggYSBwcm9ncmFtIGV4cHJlc3Npb24gb250byB0aGUgc3RhY2suIFRoaXMgdGFrZXNcbiAgLy8gYSBjb21waWxlLXRpbWUgZ3VpZCBhbmQgY29udmVydHMgaXQgaW50byBhIHJ1bnRpbWUtYWNjZXNzaWJsZVxuICAvLyBleHByZXNzaW9uLlxuICBwdXNoUHJvZ3JhbTogZnVuY3Rpb24oZ3VpZCkge1xuICAgIGlmIChndWlkICE9IG51bGwpIHtcbiAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh0aGlzLnByb2dyYW1FeHByZXNzaW9uKGd1aWQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKG51bGwpO1xuICAgIH1cbiAgfSxcblxuICAvLyBbaW52b2tlSGVscGVyXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCBwYXJhbXMuLi4sIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc3VsdCBvZiBoZWxwZXIgaW52b2NhdGlvblxuICAvL1xuICAvLyBQb3BzIG9mZiB0aGUgaGVscGVyJ3MgcGFyYW1ldGVycywgaW52b2tlcyB0aGUgaGVscGVyLFxuICAvLyBhbmQgcHVzaGVzIHRoZSBoZWxwZXIncyByZXR1cm4gdmFsdWUgb250byB0aGUgc3RhY2suXG4gIC8vXG4gIC8vIElmIHRoZSBoZWxwZXIgaXMgbm90IGZvdW5kLCBgaGVscGVyTWlzc2luZ2AgaXMgY2FsbGVkLlxuICBpbnZva2VIZWxwZXI6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgbmFtZSwgaXNSb290KSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuaGVscGVyTWlzc2luZyA9ICdoZWxwZXJzLmhlbHBlck1pc3NpbmcnO1xuICAgIHRoaXMudXNlUmVnaXN0ZXIoJ2hlbHBlcicpO1xuXG4gICAgdmFyIGhlbHBlciA9IHRoaXMubGFzdEhlbHBlciA9IHRoaXMuc2V0dXBIZWxwZXIocGFyYW1TaXplLCBuYW1lLCB0cnVlKTtcbiAgICB2YXIgbm9uSGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0LCBuYW1lLCAnY29udGV4dCcpO1xuXG4gICAgdmFyIGxvb2t1cCA9ICdoZWxwZXIgPSAnICsgaGVscGVyLm5hbWUgKyAnIHx8ICcgKyBub25IZWxwZXI7XG4gICAgaWYgKGhlbHBlci5wYXJhbXNJbml0KSB7XG4gICAgICBsb29rdXAgKz0gJywnICsgaGVscGVyLnBhcmFtc0luaXQ7XG4gICAgfVxuXG4gICAgdGhpcy5wdXNoKFxuICAgICAgJygnXG4gICAgICAgICsgbG9va3VwXG4gICAgICAgICsgJyxoZWxwZXIgJ1xuICAgICAgICAgICsgJz8gaGVscGVyLmNhbGwoJyArIGhlbHBlci5jYWxsUGFyYW1zICsgJykgJ1xuICAgICAgICAgICsgJzogaGVscGVyTWlzc2luZy5jYWxsKCcgKyBoZWxwZXIuaGVscGVyTWlzc2luZ1BhcmFtcyArICcpKScpO1xuXG4gICAgLy8gQWx3YXlzIGZsdXNoIHN1YmV4cHJlc3Npb25zLiBUaGlzIGlzIGJvdGggdG8gcHJldmVudCB0aGUgY29tcG91bmRpbmcgc2l6ZSBpc3N1ZSB0aGF0XG4gICAgLy8gb2NjdXJzIHdoZW4gdGhlIGNvZGUgaGFzIHRvIGJlIGR1cGxpY2F0ZWQgZm9yIGlubGluaW5nIGFuZCBhbHNvIHRvIHByZXZlbnQgZXJyb3JzXG4gICAgLy8gZHVlIHRvIHRoZSBpbmNvcnJlY3Qgb3B0aW9ucyBvYmplY3QgYmVpbmcgcGFzc2VkIGR1ZSB0byB0aGUgc2hhcmVkIHJlZ2lzdGVyLlxuICAgIGlmICghaXNSb290KSB7XG4gICAgICB0aGlzLmZsdXNoSW5saW5lKCk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFtpbnZva2VLbm93bkhlbHBlcl1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgaGVscGVyIGludm9jYXRpb25cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gaXMgdXNlZCB3aGVuIHRoZSBoZWxwZXIgaXMga25vd24gdG8gZXhpc3QsXG4gIC8vIHNvIGEgYGhlbHBlck1pc3NpbmdgIGZhbGxiYWNrIGlzIG5vdCByZXF1aXJlZC5cbiAgaW52b2tlS25vd25IZWxwZXI6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgbmFtZSkge1xuICAgIHZhciBoZWxwZXIgPSB0aGlzLnNldHVwSGVscGVyKHBhcmFtU2l6ZSwgbmFtZSk7XG4gICAgdGhpcy5wdXNoKGhlbHBlci5uYW1lICsgXCIuY2FsbChcIiArIGhlbHBlci5jYWxsUGFyYW1zICsgXCIpXCIpO1xuICB9LFxuXG4gIC8vIFtpbnZva2VBbWJpZ3VvdXNdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHBhcmFtcy4uLiwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzdWx0IG9mIGRpc2FtYmlndWF0aW9uXG4gIC8vXG4gIC8vIFRoaXMgb3BlcmF0aW9uIGlzIHVzZWQgd2hlbiBhbiBleHByZXNzaW9uIGxpa2UgYHt7Zm9vfX1gXG4gIC8vIGlzIHByb3ZpZGVkLCBidXQgd2UgZG9uJ3Qga25vdyBhdCBjb21waWxlLXRpbWUgd2hldGhlciBpdFxuICAvLyBpcyBhIGhlbHBlciBvciBhIHBhdGguXG4gIC8vXG4gIC8vIFRoaXMgb3BlcmF0aW9uIGVtaXRzIG1vcmUgY29kZSB0aGFuIHRoZSBvdGhlciBvcHRpb25zLFxuICAvLyBhbmQgY2FuIGJlIGF2b2lkZWQgYnkgcGFzc2luZyB0aGUgYGtub3duSGVscGVyc2AgYW5kXG4gIC8vIGBrbm93bkhlbHBlcnNPbmx5YCBmbGFncyBhdCBjb21waWxlLXRpbWUuXG4gIGludm9rZUFtYmlndW91czogZnVuY3Rpb24obmFtZSwgaGVscGVyQ2FsbCkge1xuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLmZ1bmN0aW9uVHlwZSA9ICdcImZ1bmN0aW9uXCInO1xuICAgIHRoaXMudXNlUmVnaXN0ZXIoJ2hlbHBlcicpO1xuXG4gICAgdGhpcy5lbXB0eUhhc2goKTtcbiAgICB2YXIgaGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcigwLCBuYW1lLCBoZWxwZXJDYWxsKTtcblxuICAgIHZhciBoZWxwZXJOYW1lID0gdGhpcy5sYXN0SGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdoZWxwZXJzJywgbmFtZSwgJ2hlbHBlcicpO1xuXG4gICAgdmFyIG5vbkhlbHBlciA9IHRoaXMubmFtZUxvb2t1cCgnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dCwgbmFtZSwgJ2NvbnRleHQnKTtcbiAgICB2YXIgbmV4dFN0YWNrID0gdGhpcy5uZXh0U3RhY2soKTtcblxuICAgIGlmIChoZWxwZXIucGFyYW1zSW5pdCkge1xuICAgICAgdGhpcy5wdXNoU291cmNlKGhlbHBlci5wYXJhbXNJbml0KTtcbiAgICB9XG4gICAgdGhpcy5wdXNoU291cmNlKCdpZiAoaGVscGVyID0gJyArIGhlbHBlck5hbWUgKyAnKSB7ICcgKyBuZXh0U3RhY2sgKyAnID0gaGVscGVyLmNhbGwoJyArIGhlbHBlci5jYWxsUGFyYW1zICsgJyk7IH0nKTtcbiAgICB0aGlzLnB1c2hTb3VyY2UoJ2Vsc2UgeyBoZWxwZXIgPSAnICsgbm9uSGVscGVyICsgJzsgJyArIG5leHRTdGFjayArICcgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbCgnICsgaGVscGVyLmNhbGxQYXJhbXMgKyAnKSA6IGhlbHBlcjsgfScpO1xuICB9LFxuXG4gIC8vIFtpbnZva2VQYXJ0aWFsXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBjb250ZXh0LCAuLi5cbiAgLy8gT24gc3RhY2sgYWZ0ZXI6IHJlc3VsdCBvZiBwYXJ0aWFsIGludm9jYXRpb25cbiAgLy9cbiAgLy8gVGhpcyBvcGVyYXRpb24gcG9wcyBvZmYgYSBjb250ZXh0LCBpbnZva2VzIGEgcGFydGlhbCB3aXRoIHRoYXQgY29udGV4dCxcbiAgLy8gYW5kIHB1c2hlcyB0aGUgcmVzdWx0IG9mIHRoZSBpbnZvY2F0aW9uIGJhY2suXG4gIGludm9rZVBhcnRpYWw6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgcGFyYW1zID0gW3RoaXMubmFtZUxvb2t1cCgncGFydGlhbHMnLCBuYW1lLCAncGFydGlhbCcpLCBcIidcIiArIG5hbWUgKyBcIidcIiwgdGhpcy5wb3BTdGFjaygpLCBcImhlbHBlcnNcIiwgXCJwYXJ0aWFsc1wiXTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGF0YSkge1xuICAgICAgcGFyYW1zLnB1c2goXCJkYXRhXCIpO1xuICAgIH1cblxuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLnNlbGYgPSBcInRoaXNcIjtcbiAgICB0aGlzLnB1c2goXCJzZWxmLmludm9rZVBhcnRpYWwoXCIgKyBwYXJhbXMuam9pbihcIiwgXCIpICsgXCIpXCIpO1xuICB9LFxuXG4gIC8vIFthc3NpZ25Ub0hhc2hdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IHZhbHVlLCBoYXNoLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBoYXNoLCAuLi5cbiAgLy9cbiAgLy8gUG9wcyBhIHZhbHVlIGFuZCBoYXNoIG9mZiB0aGUgc3RhY2ssIGFzc2lnbnMgYGhhc2hba2V5XSA9IHZhbHVlYFxuICAvLyBhbmQgcHVzaGVzIHRoZSBoYXNoIGJhY2sgb250byB0aGUgc3RhY2suXG4gIGFzc2lnblRvSGFzaDogZnVuY3Rpb24oa2V5KSB7XG4gICAgdmFyIHZhbHVlID0gdGhpcy5wb3BTdGFjaygpLFxuICAgICAgICBjb250ZXh0LFxuICAgICAgICB0eXBlO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIHR5cGUgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgICBjb250ZXh0ID0gdGhpcy5wb3BTdGFjaygpO1xuICAgIH1cblxuICAgIHZhciBoYXNoID0gdGhpcy5oYXNoO1xuICAgIGlmIChjb250ZXh0KSB7XG4gICAgICBoYXNoLmNvbnRleHRzLnB1c2goXCInXCIgKyBrZXkgKyBcIic6IFwiICsgY29udGV4dCk7XG4gICAgfVxuICAgIGlmICh0eXBlKSB7XG4gICAgICBoYXNoLnR5cGVzLnB1c2goXCInXCIgKyBrZXkgKyBcIic6IFwiICsgdHlwZSk7XG4gICAgfVxuICAgIGhhc2gudmFsdWVzLnB1c2goXCInXCIgKyBrZXkgKyBcIic6IChcIiArIHZhbHVlICsgXCIpXCIpO1xuICB9LFxuXG4gIC8vIEhFTFBFUlNcblxuICBjb21waWxlcjogSmF2YVNjcmlwdENvbXBpbGVyLFxuXG4gIGNvbXBpbGVDaGlsZHJlbjogZnVuY3Rpb24oZW52aXJvbm1lbnQsIG9wdGlvbnMpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSBlbnZpcm9ubWVudC5jaGlsZHJlbiwgY2hpbGQsIGNvbXBpbGVyO1xuXG4gICAgZm9yKHZhciBpPTAsIGw9Y2hpbGRyZW4ubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgY2hpbGQgPSBjaGlsZHJlbltpXTtcbiAgICAgIGNvbXBpbGVyID0gbmV3IHRoaXMuY29tcGlsZXIoKTtcblxuICAgICAgdmFyIGluZGV4ID0gdGhpcy5tYXRjaEV4aXN0aW5nUHJvZ3JhbShjaGlsZCk7XG5cbiAgICAgIGlmIChpbmRleCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5wcm9ncmFtcy5wdXNoKCcnKTsgICAgIC8vIFBsYWNlaG9sZGVyIHRvIHByZXZlbnQgbmFtZSBjb25mbGljdHMgZm9yIG5lc3RlZCBjaGlsZHJlblxuICAgICAgICBpbmRleCA9IHRoaXMuY29udGV4dC5wcm9ncmFtcy5sZW5ndGg7XG4gICAgICAgIGNoaWxkLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIGNoaWxkLm5hbWUgPSAncHJvZ3JhbScgKyBpbmRleDtcbiAgICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zW2luZGV4XSA9IGNvbXBpbGVyLmNvbXBpbGUoY2hpbGQsIG9wdGlvbnMsIHRoaXMuY29udGV4dCk7XG4gICAgICAgIHRoaXMuY29udGV4dC5lbnZpcm9ubWVudHNbaW5kZXhdID0gY2hpbGQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaGlsZC5pbmRleCA9IGluZGV4O1xuICAgICAgICBjaGlsZC5uYW1lID0gJ3Byb2dyYW0nICsgaW5kZXg7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBtYXRjaEV4aXN0aW5nUHJvZ3JhbTogZnVuY3Rpb24oY2hpbGQpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5jb250ZXh0LmVudmlyb25tZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIGVudmlyb25tZW50ID0gdGhpcy5jb250ZXh0LmVudmlyb25tZW50c1tpXTtcbiAgICAgIGlmIChlbnZpcm9ubWVudCAmJiBlbnZpcm9ubWVudC5lcXVhbHMoY2hpbGQpKSB7XG4gICAgICAgIHJldHVybiBpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwcm9ncmFtRXhwcmVzc2lvbjogZnVuY3Rpb24oZ3VpZCkge1xuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLnNlbGYgPSBcInRoaXNcIjtcblxuICAgIGlmKGd1aWQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFwic2VsZi5ub29wXCI7XG4gICAgfVxuXG4gICAgdmFyIGNoaWxkID0gdGhpcy5lbnZpcm9ubWVudC5jaGlsZHJlbltndWlkXSxcbiAgICAgICAgZGVwdGhzID0gY2hpbGQuZGVwdGhzLmxpc3QsIGRlcHRoO1xuXG4gICAgdmFyIHByb2dyYW1QYXJhbXMgPSBbY2hpbGQuaW5kZXgsIGNoaWxkLm5hbWUsIFwiZGF0YVwiXTtcblxuICAgIGZvcih2YXIgaT0wLCBsID0gZGVwdGhzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIGRlcHRoID0gZGVwdGhzW2ldO1xuXG4gICAgICBpZihkZXB0aCA9PT0gMSkgeyBwcm9ncmFtUGFyYW1zLnB1c2goXCJkZXB0aDBcIik7IH1cbiAgICAgIGVsc2UgeyBwcm9ncmFtUGFyYW1zLnB1c2goXCJkZXB0aFwiICsgKGRlcHRoIC0gMSkpOyB9XG4gICAgfVxuXG4gICAgcmV0dXJuIChkZXB0aHMubGVuZ3RoID09PSAwID8gXCJzZWxmLnByb2dyYW0oXCIgOiBcInNlbGYucHJvZ3JhbVdpdGhEZXB0aChcIikgKyBwcm9ncmFtUGFyYW1zLmpvaW4oXCIsIFwiKSArIFwiKVwiO1xuICB9LFxuXG4gIHJlZ2lzdGVyOiBmdW5jdGlvbihuYW1lLCB2YWwpIHtcbiAgICB0aGlzLnVzZVJlZ2lzdGVyKG5hbWUpO1xuICAgIHRoaXMucHVzaFNvdXJjZShuYW1lICsgXCIgPSBcIiArIHZhbCArIFwiO1wiKTtcbiAgfSxcblxuICB1c2VSZWdpc3RlcjogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmKCF0aGlzLnJlZ2lzdGVyc1tuYW1lXSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnNbbmFtZV0gPSB0cnVlO1xuICAgICAgdGhpcy5yZWdpc3RlcnMubGlzdC5wdXNoKG5hbWUpO1xuICAgIH1cbiAgfSxcblxuICBwdXNoU3RhY2tMaXRlcmFsOiBmdW5jdGlvbihpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMucHVzaChuZXcgTGl0ZXJhbChpdGVtKSk7XG4gIH0sXG5cbiAgcHVzaFNvdXJjZTogZnVuY3Rpb24oc291cmNlKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0NvbnRlbnQpIHtcbiAgICAgIHRoaXMuc291cmNlLnB1c2godGhpcy5hcHBlbmRUb0J1ZmZlcih0aGlzLnF1b3RlZFN0cmluZyh0aGlzLnBlbmRpbmdDb250ZW50KSkpO1xuICAgICAgdGhpcy5wZW5kaW5nQ29udGVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAoc291cmNlKSB7XG4gICAgICB0aGlzLnNvdXJjZS5wdXNoKHNvdXJjZSk7XG4gICAgfVxuICB9LFxuXG4gIHB1c2hTdGFjazogZnVuY3Rpb24oaXRlbSkge1xuICAgIHRoaXMuZmx1c2hJbmxpbmUoKTtcblxuICAgIHZhciBzdGFjayA9IHRoaXMuaW5jclN0YWNrKCk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIHRoaXMucHVzaFNvdXJjZShzdGFjayArIFwiID0gXCIgKyBpdGVtICsgXCI7XCIpO1xuICAgIH1cbiAgICB0aGlzLmNvbXBpbGVTdGFjay5wdXNoKHN0YWNrKTtcbiAgICByZXR1cm4gc3RhY2s7XG4gIH0sXG5cbiAgcmVwbGFjZVN0YWNrOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBwcmVmaXggPSAnJyxcbiAgICAgICAgaW5saW5lID0gdGhpcy5pc0lubGluZSgpLFxuICAgICAgICBzdGFjayxcbiAgICAgICAgY3JlYXRlZFN0YWNrLFxuICAgICAgICB1c2VkTGl0ZXJhbDtcblxuICAgIC8vIElmIHdlIGFyZSBjdXJyZW50bHkgaW5saW5lIHRoZW4gd2Ugd2FudCB0byBtZXJnZSB0aGUgaW5saW5lIHN0YXRlbWVudCBpbnRvIHRoZVxuICAgIC8vIHJlcGxhY2VtZW50IHN0YXRlbWVudCB2aWEgJywnXG4gICAgaWYgKGlubGluZSkge1xuICAgICAgdmFyIHRvcCA9IHRoaXMucG9wU3RhY2sodHJ1ZSk7XG5cbiAgICAgIGlmICh0b3AgaW5zdGFuY2VvZiBMaXRlcmFsKSB7XG4gICAgICAgIC8vIExpdGVyYWxzIGRvIG5vdCBuZWVkIHRvIGJlIGlubGluZWRcbiAgICAgICAgc3RhY2sgPSB0b3AudmFsdWU7XG4gICAgICAgIHVzZWRMaXRlcmFsID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEdldCBvciBjcmVhdGUgdGhlIGN1cnJlbnQgc3RhY2sgbmFtZSBmb3IgdXNlIGJ5IHRoZSBpbmxpbmVcbiAgICAgICAgY3JlYXRlZFN0YWNrID0gIXRoaXMuc3RhY2tTbG90O1xuICAgICAgICB2YXIgbmFtZSA9ICFjcmVhdGVkU3RhY2sgPyB0aGlzLnRvcFN0YWNrTmFtZSgpIDogdGhpcy5pbmNyU3RhY2soKTtcblxuICAgICAgICBwcmVmaXggPSAnKCcgKyB0aGlzLnB1c2gobmFtZSkgKyAnID0gJyArIHRvcCArICcpLCc7XG4gICAgICAgIHN0YWNrID0gdGhpcy50b3BTdGFjaygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdGFjayA9IHRoaXMudG9wU3RhY2soKTtcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IGNhbGxiYWNrLmNhbGwodGhpcywgc3RhY2spO1xuXG4gICAgaWYgKGlubGluZSkge1xuICAgICAgaWYgKCF1c2VkTGl0ZXJhbCkge1xuICAgICAgICB0aGlzLnBvcFN0YWNrKCk7XG4gICAgICB9XG4gICAgICBpZiAoY3JlYXRlZFN0YWNrKSB7XG4gICAgICAgIHRoaXMuc3RhY2tTbG90LS07XG4gICAgICB9XG4gICAgICB0aGlzLnB1c2goJygnICsgcHJlZml4ICsgaXRlbSArICcpJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByZXZlbnQgbW9kaWZpY2F0aW9uIG9mIHRoZSBjb250ZXh0IGRlcHRoIHZhcmlhYmxlLiBUaHJvdWdoIHJlcGxhY2VTdGFja1xuICAgICAgaWYgKCEvXnN0YWNrLy50ZXN0KHN0YWNrKSkge1xuICAgICAgICBzdGFjayA9IHRoaXMubmV4dFN0YWNrKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucHVzaFNvdXJjZShzdGFjayArIFwiID0gKFwiICsgcHJlZml4ICsgaXRlbSArIFwiKTtcIik7XG4gICAgfVxuICAgIHJldHVybiBzdGFjaztcbiAgfSxcblxuICBuZXh0U3RhY2s6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnB1c2hTdGFjaygpO1xuICB9LFxuXG4gIGluY3JTdGFjazogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zdGFja1Nsb3QrKztcbiAgICBpZih0aGlzLnN0YWNrU2xvdCA+IHRoaXMuc3RhY2tWYXJzLmxlbmd0aCkgeyB0aGlzLnN0YWNrVmFycy5wdXNoKFwic3RhY2tcIiArIHRoaXMuc3RhY2tTbG90KTsgfVxuICAgIHJldHVybiB0aGlzLnRvcFN0YWNrTmFtZSgpO1xuICB9LFxuICB0b3BTdGFja05hbWU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcInN0YWNrXCIgKyB0aGlzLnN0YWNrU2xvdDtcbiAgfSxcbiAgZmx1c2hJbmxpbmU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbmxpbmVTdGFjayA9IHRoaXMuaW5saW5lU3RhY2s7XG4gICAgaWYgKGlubGluZVN0YWNrLmxlbmd0aCkge1xuICAgICAgdGhpcy5pbmxpbmVTdGFjayA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGlubGluZVN0YWNrLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IGlubGluZVN0YWNrW2ldO1xuICAgICAgICBpZiAoZW50cnkgaW5zdGFuY2VvZiBMaXRlcmFsKSB7XG4gICAgICAgICAgdGhpcy5jb21waWxlU3RhY2sucHVzaChlbnRyeSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5wdXNoU3RhY2soZW50cnkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICBpc0lubGluZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5saW5lU3RhY2subGVuZ3RoO1xuICB9LFxuXG4gIHBvcFN0YWNrOiBmdW5jdGlvbih3cmFwcGVkKSB7XG4gICAgdmFyIGlubGluZSA9IHRoaXMuaXNJbmxpbmUoKSxcbiAgICAgICAgaXRlbSA9IChpbmxpbmUgPyB0aGlzLmlubGluZVN0YWNrIDogdGhpcy5jb21waWxlU3RhY2spLnBvcCgpO1xuXG4gICAgaWYgKCF3cmFwcGVkICYmIChpdGVtIGluc3RhbmNlb2YgTGl0ZXJhbCkpIHtcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIWlubGluZSkge1xuICAgICAgICBpZiAoIXRoaXMuc3RhY2tTbG90KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignSW52YWxpZCBzdGFjayBwb3AnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN0YWNrU2xvdC0tO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuICB9LFxuXG4gIHRvcFN0YWNrOiBmdW5jdGlvbih3cmFwcGVkKSB7XG4gICAgdmFyIHN0YWNrID0gKHRoaXMuaXNJbmxpbmUoKSA/IHRoaXMuaW5saW5lU3RhY2sgOiB0aGlzLmNvbXBpbGVTdGFjayksXG4gICAgICAgIGl0ZW0gPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcblxuICAgIGlmICghd3JhcHBlZCAmJiAoaXRlbSBpbnN0YW5jZW9mIExpdGVyYWwpKSB7XG4gICAgICByZXR1cm4gaXRlbS52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuICB9LFxuXG4gIHF1b3RlZFN0cmluZzogZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuICdcIicgKyBzdHJcbiAgICAgIC5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpXG4gICAgICAucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpXG4gICAgICAucmVwbGFjZSgvXFxuL2csICdcXFxcbicpXG4gICAgICAucmVwbGFjZSgvXFxyL2csICdcXFxccicpXG4gICAgICAucmVwbGFjZSgvXFx1MjAyOC9nLCAnXFxcXHUyMDI4JykgICAvLyBQZXIgRWNtYS0yNjIgNy4zICsgNy44LjRcbiAgICAgIC5yZXBsYWNlKC9cXHUyMDI5L2csICdcXFxcdTIwMjknKSArICdcIic7XG4gIH0sXG5cbiAgc2V0dXBIZWxwZXI6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgbmFtZSwgbWlzc2luZ1BhcmFtcykge1xuICAgIHZhciBwYXJhbXMgPSBbXSxcbiAgICAgICAgcGFyYW1zSW5pdCA9IHRoaXMuc2V0dXBQYXJhbXMocGFyYW1TaXplLCBwYXJhbXMsIG1pc3NpbmdQYXJhbXMpO1xuICAgIHZhciBmb3VuZEhlbHBlciA9IHRoaXMubmFtZUxvb2t1cCgnaGVscGVycycsIG5hbWUsICdoZWxwZXInKTtcblxuICAgIHJldHVybiB7XG4gICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgIHBhcmFtc0luaXQ6IHBhcmFtc0luaXQsXG4gICAgICBuYW1lOiBmb3VuZEhlbHBlcixcbiAgICAgIGNhbGxQYXJhbXM6IFtcImRlcHRoMFwiXS5jb25jYXQocGFyYW1zKS5qb2luKFwiLCBcIiksXG4gICAgICBoZWxwZXJNaXNzaW5nUGFyYW1zOiBtaXNzaW5nUGFyYW1zICYmIFtcImRlcHRoMFwiLCB0aGlzLnF1b3RlZFN0cmluZyhuYW1lKV0uY29uY2F0KHBhcmFtcykuam9pbihcIiwgXCIpXG4gICAgfTtcbiAgfSxcblxuICBzZXR1cE9wdGlvbnM6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgcGFyYW1zKSB7XG4gICAgdmFyIG9wdGlvbnMgPSBbXSwgY29udGV4dHMgPSBbXSwgdHlwZXMgPSBbXSwgcGFyYW0sIGludmVyc2UsIHByb2dyYW07XG5cbiAgICBvcHRpb25zLnB1c2goXCJoYXNoOlwiICsgdGhpcy5wb3BTdGFjaygpKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICBvcHRpb25zLnB1c2goXCJoYXNoVHlwZXM6XCIgKyB0aGlzLnBvcFN0YWNrKCkpO1xuICAgICAgb3B0aW9ucy5wdXNoKFwiaGFzaENvbnRleHRzOlwiICsgdGhpcy5wb3BTdGFjaygpKTtcbiAgICB9XG5cbiAgICBpbnZlcnNlID0gdGhpcy5wb3BTdGFjaygpO1xuICAgIHByb2dyYW0gPSB0aGlzLnBvcFN0YWNrKCk7XG5cbiAgICAvLyBBdm9pZCBzZXR0aW5nIGZuIGFuZCBpbnZlcnNlIGlmIG5laXRoZXIgYXJlIHNldC4gVGhpcyBhbGxvd3NcbiAgICAvLyBoZWxwZXJzIHRvIGRvIGEgY2hlY2sgZm9yIGBpZiAob3B0aW9ucy5mbilgXG4gICAgaWYgKHByb2dyYW0gfHwgaW52ZXJzZSkge1xuICAgICAgaWYgKCFwcm9ncmFtKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLnNlbGYgPSBcInRoaXNcIjtcbiAgICAgICAgcHJvZ3JhbSA9IFwic2VsZi5ub29wXCI7XG4gICAgICB9XG5cbiAgICAgIGlmICghaW52ZXJzZSkge1xuICAgICAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5zZWxmID0gXCJ0aGlzXCI7XG4gICAgICAgIGludmVyc2UgPSBcInNlbGYubm9vcFwiO1xuICAgICAgfVxuXG4gICAgICBvcHRpb25zLnB1c2goXCJpbnZlcnNlOlwiICsgaW52ZXJzZSk7XG4gICAgICBvcHRpb25zLnB1c2goXCJmbjpcIiArIHByb2dyYW0pO1xuICAgIH1cblxuICAgIGZvcih2YXIgaT0wOyBpPHBhcmFtU2l6ZTsgaSsrKSB7XG4gICAgICBwYXJhbSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIHBhcmFtcy5wdXNoKHBhcmFtKTtcblxuICAgICAgaWYodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgICB0eXBlcy5wdXNoKHRoaXMucG9wU3RhY2soKSk7XG4gICAgICAgIGNvbnRleHRzLnB1c2godGhpcy5wb3BTdGFjaygpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgb3B0aW9ucy5wdXNoKFwiY29udGV4dHM6W1wiICsgY29udGV4dHMuam9pbihcIixcIikgKyBcIl1cIik7XG4gICAgICBvcHRpb25zLnB1c2goXCJ0eXBlczpbXCIgKyB0eXBlcy5qb2luKFwiLFwiKSArIFwiXVwiKTtcbiAgICB9XG5cbiAgICBpZih0aGlzLm9wdGlvbnMuZGF0YSkge1xuICAgICAgb3B0aW9ucy5wdXNoKFwiZGF0YTpkYXRhXCIpO1xuICAgIH1cblxuICAgIHJldHVybiBvcHRpb25zO1xuICB9LFxuXG4gIC8vIHRoZSBwYXJhbXMgYW5kIGNvbnRleHRzIGFyZ3VtZW50cyBhcmUgcGFzc2VkIGluIGFycmF5c1xuICAvLyB0byBmaWxsIGluXG4gIHNldHVwUGFyYW1zOiBmdW5jdGlvbihwYXJhbVNpemUsIHBhcmFtcywgdXNlUmVnaXN0ZXIpIHtcbiAgICB2YXIgb3B0aW9ucyA9ICd7JyArIHRoaXMuc2V0dXBPcHRpb25zKHBhcmFtU2l6ZSwgcGFyYW1zKS5qb2luKCcsJykgKyAnfSc7XG5cbiAgICBpZiAodXNlUmVnaXN0ZXIpIHtcbiAgICAgIHRoaXMudXNlUmVnaXN0ZXIoJ29wdGlvbnMnKTtcbiAgICAgIHBhcmFtcy5wdXNoKCdvcHRpb25zJyk7XG4gICAgICByZXR1cm4gJ29wdGlvbnM9JyArIG9wdGlvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcy5wdXNoKG9wdGlvbnMpO1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxufTtcblxudmFyIHJlc2VydmVkV29yZHMgPSAoXG4gIFwiYnJlYWsgZWxzZSBuZXcgdmFyXCIgK1xuICBcIiBjYXNlIGZpbmFsbHkgcmV0dXJuIHZvaWRcIiArXG4gIFwiIGNhdGNoIGZvciBzd2l0Y2ggd2hpbGVcIiArXG4gIFwiIGNvbnRpbnVlIGZ1bmN0aW9uIHRoaXMgd2l0aFwiICtcbiAgXCIgZGVmYXVsdCBpZiB0aHJvd1wiICtcbiAgXCIgZGVsZXRlIGluIHRyeVwiICtcbiAgXCIgZG8gaW5zdGFuY2VvZiB0eXBlb2ZcIiArXG4gIFwiIGFic3RyYWN0IGVudW0gaW50IHNob3J0XCIgK1xuICBcIiBib29sZWFuIGV4cG9ydCBpbnRlcmZhY2Ugc3RhdGljXCIgK1xuICBcIiBieXRlIGV4dGVuZHMgbG9uZyBzdXBlclwiICtcbiAgXCIgY2hhciBmaW5hbCBuYXRpdmUgc3luY2hyb25pemVkXCIgK1xuICBcIiBjbGFzcyBmbG9hdCBwYWNrYWdlIHRocm93c1wiICtcbiAgXCIgY29uc3QgZ290byBwcml2YXRlIHRyYW5zaWVudFwiICtcbiAgXCIgZGVidWdnZXIgaW1wbGVtZW50cyBwcm90ZWN0ZWQgdm9sYXRpbGVcIiArXG4gIFwiIGRvdWJsZSBpbXBvcnQgcHVibGljIGxldCB5aWVsZFwiXG4pLnNwbGl0KFwiIFwiKTtcblxudmFyIGNvbXBpbGVyV29yZHMgPSBKYXZhU2NyaXB0Q29tcGlsZXIuUkVTRVJWRURfV09SRFMgPSB7fTtcblxuZm9yKHZhciBpPTAsIGw9cmVzZXJ2ZWRXb3Jkcy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gIGNvbXBpbGVyV29yZHNbcmVzZXJ2ZWRXb3Jkc1tpXV0gPSB0cnVlO1xufVxuXG5KYXZhU2NyaXB0Q29tcGlsZXIuaXNWYWxpZEphdmFTY3JpcHRWYXJpYWJsZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIGlmKCFKYXZhU2NyaXB0Q29tcGlsZXIuUkVTRVJWRURfV09SRFNbbmFtZV0gJiYgL15bYS16QS1aXyRdWzAtOWEtekEtWl8kXSokLy50ZXN0KG5hbWUpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBKYXZhU2NyaXB0Q29tcGlsZXI7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBqc2hpbnQgaWdub3JlOnN0YXJ0ICovXG4vKiBKaXNvbiBnZW5lcmF0ZWQgcGFyc2VyICovXG52YXIgaGFuZGxlYmFycyA9IChmdW5jdGlvbigpe1xudmFyIHBhcnNlciA9IHt0cmFjZTogZnVuY3Rpb24gdHJhY2UoKSB7IH0sXG55eToge30sXG5zeW1ib2xzXzoge1wiZXJyb3JcIjoyLFwicm9vdFwiOjMsXCJzdGF0ZW1lbnRzXCI6NCxcIkVPRlwiOjUsXCJwcm9ncmFtXCI6NixcInNpbXBsZUludmVyc2VcIjo3LFwic3RhdGVtZW50XCI6OCxcIm9wZW5JbnZlcnNlXCI6OSxcImNsb3NlQmxvY2tcIjoxMCxcIm9wZW5CbG9ja1wiOjExLFwibXVzdGFjaGVcIjoxMixcInBhcnRpYWxcIjoxMyxcIkNPTlRFTlRcIjoxNCxcIkNPTU1FTlRcIjoxNSxcIk9QRU5fQkxPQ0tcIjoxNixcInNleHByXCI6MTcsXCJDTE9TRVwiOjE4LFwiT1BFTl9JTlZFUlNFXCI6MTksXCJPUEVOX0VOREJMT0NLXCI6MjAsXCJwYXRoXCI6MjEsXCJPUEVOXCI6MjIsXCJPUEVOX1VORVNDQVBFRFwiOjIzLFwiQ0xPU0VfVU5FU0NBUEVEXCI6MjQsXCJPUEVOX1BBUlRJQUxcIjoyNSxcInBhcnRpYWxOYW1lXCI6MjYsXCJwYXJ0aWFsX29wdGlvbjBcIjoyNyxcInNleHByX3JlcGV0aXRpb24wXCI6MjgsXCJzZXhwcl9vcHRpb24wXCI6MjksXCJkYXRhTmFtZVwiOjMwLFwicGFyYW1cIjozMSxcIlNUUklOR1wiOjMyLFwiSU5URUdFUlwiOjMzLFwiQk9PTEVBTlwiOjM0LFwiT1BFTl9TRVhQUlwiOjM1LFwiQ0xPU0VfU0VYUFJcIjozNixcImhhc2hcIjozNyxcImhhc2hfcmVwZXRpdGlvbl9wbHVzMFwiOjM4LFwiaGFzaFNlZ21lbnRcIjozOSxcIklEXCI6NDAsXCJFUVVBTFNcIjo0MSxcIkRBVEFcIjo0MixcInBhdGhTZWdtZW50c1wiOjQzLFwiU0VQXCI6NDQsXCIkYWNjZXB0XCI6MCxcIiRlbmRcIjoxfSxcbnRlcm1pbmFsc186IHsyOlwiZXJyb3JcIiw1OlwiRU9GXCIsMTQ6XCJDT05URU5UXCIsMTU6XCJDT01NRU5UXCIsMTY6XCJPUEVOX0JMT0NLXCIsMTg6XCJDTE9TRVwiLDE5OlwiT1BFTl9JTlZFUlNFXCIsMjA6XCJPUEVOX0VOREJMT0NLXCIsMjI6XCJPUEVOXCIsMjM6XCJPUEVOX1VORVNDQVBFRFwiLDI0OlwiQ0xPU0VfVU5FU0NBUEVEXCIsMjU6XCJPUEVOX1BBUlRJQUxcIiwzMjpcIlNUUklOR1wiLDMzOlwiSU5URUdFUlwiLDM0OlwiQk9PTEVBTlwiLDM1OlwiT1BFTl9TRVhQUlwiLDM2OlwiQ0xPU0VfU0VYUFJcIiw0MDpcIklEXCIsNDE6XCJFUVVBTFNcIiw0MjpcIkRBVEFcIiw0NDpcIlNFUFwifSxcbnByb2R1Y3Rpb25zXzogWzAsWzMsMl0sWzMsMV0sWzYsMl0sWzYsM10sWzYsMl0sWzYsMV0sWzYsMV0sWzYsMF0sWzQsMV0sWzQsMl0sWzgsM10sWzgsM10sWzgsMV0sWzgsMV0sWzgsMV0sWzgsMV0sWzExLDNdLFs5LDNdLFsxMCwzXSxbMTIsM10sWzEyLDNdLFsxMyw0XSxbNywyXSxbMTcsM10sWzE3LDFdLFszMSwxXSxbMzEsMV0sWzMxLDFdLFszMSwxXSxbMzEsMV0sWzMxLDNdLFszNywxXSxbMzksM10sWzI2LDFdLFsyNiwxXSxbMjYsMV0sWzMwLDJdLFsyMSwxXSxbNDMsM10sWzQzLDFdLFsyNywwXSxbMjcsMV0sWzI4LDBdLFsyOCwyXSxbMjksMF0sWzI5LDFdLFszOCwxXSxbMzgsMl1dLFxucGVyZm9ybUFjdGlvbjogZnVuY3Rpb24gYW5vbnltb3VzKHl5dGV4dCx5eWxlbmcseXlsaW5lbm8seXkseXlzdGF0ZSwkJCxfJCkge1xuXG52YXIgJDAgPSAkJC5sZW5ndGggLSAxO1xuc3dpdGNoICh5eXN0YXRlKSB7XG5jYXNlIDE6IHJldHVybiBuZXcgeXkuUHJvZ3JhbU5vZGUoJCRbJDAtMV0sIHRoaXMuXyQpOyBcbmJyZWFrO1xuY2FzZSAyOiByZXR1cm4gbmV3IHl5LlByb2dyYW1Ob2RlKFtdLCB0aGlzLl8kKTsgXG5icmVhaztcbmNhc2UgMzp0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoW10sICQkWyQwLTFdLCAkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDQ6dGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKCQkWyQwLTJdLCAkJFskMC0xXSwgJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSA1OnRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZSgkJFskMC0xXSwgJCRbJDBdLCBbXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgNjp0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSA3OnRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZShbXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgODp0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoW10sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDk6dGhpcy4kID0gWyQkWyQwXV07XG5icmVhaztcbmNhc2UgMTA6ICQkWyQwLTFdLnB1c2goJCRbJDBdKTsgdGhpcy4kID0gJCRbJDAtMV07IFxuYnJlYWs7XG5jYXNlIDExOnRoaXMuJCA9IG5ldyB5eS5CbG9ja05vZGUoJCRbJDAtMl0sICQkWyQwLTFdLmludmVyc2UsICQkWyQwLTFdLCAkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDEyOnRoaXMuJCA9IG5ldyB5eS5CbG9ja05vZGUoJCRbJDAtMl0sICQkWyQwLTFdLCAkJFskMC0xXS5pbnZlcnNlLCAkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDEzOnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSAxNDp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgMTU6dGhpcy4kID0gbmV3IHl5LkNvbnRlbnROb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTY6dGhpcy4kID0gbmV3IHl5LkNvbW1lbnROb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTc6dGhpcy4kID0gbmV3IHl5Lk11c3RhY2hlTm9kZSgkJFskMC0xXSwgbnVsbCwgJCRbJDAtMl0sIHN0cmlwRmxhZ3MoJCRbJDAtMl0sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDE4OnRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV0sIG51bGwsICQkWyQwLTJdLCBzdHJpcEZsYWdzKCQkWyQwLTJdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxOTp0aGlzLiQgPSB7cGF0aDogJCRbJDAtMV0sIHN0cmlwOiBzdHJpcEZsYWdzKCQkWyQwLTJdLCAkJFskMF0pfTtcbmJyZWFrO1xuY2FzZSAyMDp0aGlzLiQgPSBuZXcgeXkuTXVzdGFjaGVOb2RlKCQkWyQwLTFdLCBudWxsLCAkJFskMC0yXSwgc3RyaXBGbGFncygkJFskMC0yXSwgJCRbJDBdKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjE6dGhpcy4kID0gbmV3IHl5Lk11c3RhY2hlTm9kZSgkJFskMC0xXSwgbnVsbCwgJCRbJDAtMl0sIHN0cmlwRmxhZ3MoJCRbJDAtMl0sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDIyOnRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTm9kZSgkJFskMC0yXSwgJCRbJDAtMV0sIHN0cmlwRmxhZ3MoJCRbJDAtM10sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDIzOnRoaXMuJCA9IHN0cmlwRmxhZ3MoJCRbJDAtMV0sICQkWyQwXSk7XG5icmVhaztcbmNhc2UgMjQ6dGhpcy4kID0gbmV3IHl5LlNleHByTm9kZShbJCRbJDAtMl1dLmNvbmNhdCgkJFskMC0xXSksICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjU6dGhpcy4kID0gbmV3IHl5LlNleHByTm9kZShbJCRbJDBdXSwgbnVsbCwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjY6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDI3OnRoaXMuJCA9IG5ldyB5eS5TdHJpbmdOb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjg6dGhpcy4kID0gbmV3IHl5LkludGVnZXJOb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMjk6dGhpcy4kID0gbmV3IHl5LkJvb2xlYW5Ob2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzA6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDMxOiQkWyQwLTFdLmlzSGVscGVyID0gdHJ1ZTsgdGhpcy4kID0gJCRbJDAtMV07XG5icmVhaztcbmNhc2UgMzI6dGhpcy4kID0gbmV3IHl5Lkhhc2hOb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzM6dGhpcy4kID0gWyQkWyQwLTJdLCAkJFskMF1dO1xuYnJlYWs7XG5jYXNlIDM0OnRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTmFtZU5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzNTp0aGlzLiQgPSBuZXcgeXkuUGFydGlhbE5hbWVOb2RlKG5ldyB5eS5TdHJpbmdOb2RlKCQkWyQwXSwgdGhpcy5fJCksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDM2OnRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTmFtZU5vZGUobmV3IHl5LkludGVnZXJOb2RlKCQkWyQwXSwgdGhpcy5fJCkpO1xuYnJlYWs7XG5jYXNlIDM3OnRoaXMuJCA9IG5ldyB5eS5EYXRhTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDM4OnRoaXMuJCA9IG5ldyB5eS5JZE5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzOTogJCRbJDAtMl0ucHVzaCh7cGFydDogJCRbJDBdLCBzZXBhcmF0b3I6ICQkWyQwLTFdfSk7IHRoaXMuJCA9ICQkWyQwLTJdOyBcbmJyZWFrO1xuY2FzZSA0MDp0aGlzLiQgPSBbe3BhcnQ6ICQkWyQwXX1dO1xuYnJlYWs7XG5jYXNlIDQzOnRoaXMuJCA9IFtdO1xuYnJlYWs7XG5jYXNlIDQ0OiQkWyQwLTFdLnB1c2goJCRbJDBdKTtcbmJyZWFrO1xuY2FzZSA0Nzp0aGlzLiQgPSBbJCRbJDBdXTtcbmJyZWFrO1xuY2FzZSA0ODokJFskMC0xXS5wdXNoKCQkWyQwXSk7XG5icmVhaztcbn1cbn0sXG50YWJsZTogW3szOjEsNDoyLDU6WzEsM10sODo0LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDExXSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezE6WzNdfSx7NTpbMSwxNl0sODoxNyw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwxMV0sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHsxOlsyLDJdfSx7NTpbMiw5XSwxNDpbMiw5XSwxNTpbMiw5XSwxNjpbMiw5XSwxOTpbMiw5XSwyMDpbMiw5XSwyMjpbMiw5XSwyMzpbMiw5XSwyNTpbMiw5XX0sezQ6MjAsNjoxOCw3OjE5LDg6NCw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwyMV0sMjA6WzIsOF0sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHs0OjIwLDY6MjIsNzoxOSw4OjQsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMjFdLDIwOlsyLDhdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7NTpbMiwxM10sMTQ6WzIsMTNdLDE1OlsyLDEzXSwxNjpbMiwxM10sMTk6WzIsMTNdLDIwOlsyLDEzXSwyMjpbMiwxM10sMjM6WzIsMTNdLDI1OlsyLDEzXX0sezU6WzIsMTRdLDE0OlsyLDE0XSwxNTpbMiwxNF0sMTY6WzIsMTRdLDE5OlsyLDE0XSwyMDpbMiwxNF0sMjI6WzIsMTRdLDIzOlsyLDE0XSwyNTpbMiwxNF19LHs1OlsyLDE1XSwxNDpbMiwxNV0sMTU6WzIsMTVdLDE2OlsyLDE1XSwxOTpbMiwxNV0sMjA6WzIsMTVdLDIyOlsyLDE1XSwyMzpbMiwxNV0sMjU6WzIsMTVdfSx7NTpbMiwxNl0sMTQ6WzIsMTZdLDE1OlsyLDE2XSwxNjpbMiwxNl0sMTk6WzIsMTZdLDIwOlsyLDE2XSwyMjpbMiwxNl0sMjM6WzIsMTZdLDI1OlsyLDE2XX0sezE3OjIzLDIxOjI0LDMwOjI1LDQwOlsxLDI4XSw0MjpbMSwyN10sNDM6MjZ9LHsxNzoyOSwyMToyNCwzMDoyNSw0MDpbMSwyOF0sNDI6WzEsMjddLDQzOjI2fSx7MTc6MzAsMjE6MjQsMzA6MjUsNDA6WzEsMjhdLDQyOlsxLDI3XSw0MzoyNn0sezE3OjMxLDIxOjI0LDMwOjI1LDQwOlsxLDI4XSw0MjpbMSwyN10sNDM6MjZ9LHsyMTozMywyNjozMiwzMjpbMSwzNF0sMzM6WzEsMzVdLDQwOlsxLDI4XSw0MzoyNn0sezE6WzIsMV19LHs1OlsyLDEwXSwxNDpbMiwxMF0sMTU6WzIsMTBdLDE2OlsyLDEwXSwxOTpbMiwxMF0sMjA6WzIsMTBdLDIyOlsyLDEwXSwyMzpbMiwxMF0sMjU6WzIsMTBdfSx7MTA6MzYsMjA6WzEsMzddfSx7NDozOCw4OjQsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMTFdLDIwOlsyLDddLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7NzozOSw4OjE3LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDIxXSwyMDpbMiw2XSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezE3OjIzLDE4OlsxLDQwXSwyMToyNCwzMDoyNSw0MDpbMSwyOF0sNDI6WzEsMjddLDQzOjI2fSx7MTA6NDEsMjA6WzEsMzddfSx7MTg6WzEsNDJdfSx7MTg6WzIsNDNdLDI0OlsyLDQzXSwyODo0MywzMjpbMiw0M10sMzM6WzIsNDNdLDM0OlsyLDQzXSwzNTpbMiw0M10sMzY6WzIsNDNdLDQwOlsyLDQzXSw0MjpbMiw0M119LHsxODpbMiwyNV0sMjQ6WzIsMjVdLDM2OlsyLDI1XX0sezE4OlsyLDM4XSwyNDpbMiwzOF0sMzI6WzIsMzhdLDMzOlsyLDM4XSwzNDpbMiwzOF0sMzU6WzIsMzhdLDM2OlsyLDM4XSw0MDpbMiwzOF0sNDI6WzIsMzhdLDQ0OlsxLDQ0XX0sezIxOjQ1LDQwOlsxLDI4XSw0MzoyNn0sezE4OlsyLDQwXSwyNDpbMiw0MF0sMzI6WzIsNDBdLDMzOlsyLDQwXSwzNDpbMiw0MF0sMzU6WzIsNDBdLDM2OlsyLDQwXSw0MDpbMiw0MF0sNDI6WzIsNDBdLDQ0OlsyLDQwXX0sezE4OlsxLDQ2XX0sezE4OlsxLDQ3XX0sezI0OlsxLDQ4XX0sezE4OlsyLDQxXSwyMTo1MCwyNzo0OSw0MDpbMSwyOF0sNDM6MjZ9LHsxODpbMiwzNF0sNDA6WzIsMzRdfSx7MTg6WzIsMzVdLDQwOlsyLDM1XX0sezE4OlsyLDM2XSw0MDpbMiwzNl19LHs1OlsyLDExXSwxNDpbMiwxMV0sMTU6WzIsMTFdLDE2OlsyLDExXSwxOTpbMiwxMV0sMjA6WzIsMTFdLDIyOlsyLDExXSwyMzpbMiwxMV0sMjU6WzIsMTFdfSx7MjE6NTEsNDA6WzEsMjhdLDQzOjI2fSx7ODoxNyw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwxMV0sMjA6WzIsM10sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHs0OjUyLDg6NCw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwxMV0sMjA6WzIsNV0sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHsxNDpbMiwyM10sMTU6WzIsMjNdLDE2OlsyLDIzXSwxOTpbMiwyM10sMjA6WzIsMjNdLDIyOlsyLDIzXSwyMzpbMiwyM10sMjU6WzIsMjNdfSx7NTpbMiwxMl0sMTQ6WzIsMTJdLDE1OlsyLDEyXSwxNjpbMiwxMl0sMTk6WzIsMTJdLDIwOlsyLDEyXSwyMjpbMiwxMl0sMjM6WzIsMTJdLDI1OlsyLDEyXX0sezE0OlsyLDE4XSwxNTpbMiwxOF0sMTY6WzIsMThdLDE5OlsyLDE4XSwyMDpbMiwxOF0sMjI6WzIsMThdLDIzOlsyLDE4XSwyNTpbMiwxOF19LHsxODpbMiw0NV0sMjE6NTYsMjQ6WzIsNDVdLDI5OjUzLDMwOjYwLDMxOjU0LDMyOlsxLDU3XSwzMzpbMSw1OF0sMzQ6WzEsNTldLDM1OlsxLDYxXSwzNjpbMiw0NV0sMzc6NTUsMzg6NjIsMzk6NjMsNDA6WzEsNjRdLDQyOlsxLDI3XSw0MzoyNn0sezQwOlsxLDY1XX0sezE4OlsyLDM3XSwyNDpbMiwzN10sMzI6WzIsMzddLDMzOlsyLDM3XSwzNDpbMiwzN10sMzU6WzIsMzddLDM2OlsyLDM3XSw0MDpbMiwzN10sNDI6WzIsMzddfSx7MTQ6WzIsMTddLDE1OlsyLDE3XSwxNjpbMiwxN10sMTk6WzIsMTddLDIwOlsyLDE3XSwyMjpbMiwxN10sMjM6WzIsMTddLDI1OlsyLDE3XX0sezU6WzIsMjBdLDE0OlsyLDIwXSwxNTpbMiwyMF0sMTY6WzIsMjBdLDE5OlsyLDIwXSwyMDpbMiwyMF0sMjI6WzIsMjBdLDIzOlsyLDIwXSwyNTpbMiwyMF19LHs1OlsyLDIxXSwxNDpbMiwyMV0sMTU6WzIsMjFdLDE2OlsyLDIxXSwxOTpbMiwyMV0sMjA6WzIsMjFdLDIyOlsyLDIxXSwyMzpbMiwyMV0sMjU6WzIsMjFdfSx7MTg6WzEsNjZdfSx7MTg6WzIsNDJdfSx7MTg6WzEsNjddfSx7ODoxNyw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwxMV0sMjA6WzIsNF0sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHsxODpbMiwyNF0sMjQ6WzIsMjRdLDM2OlsyLDI0XX0sezE4OlsyLDQ0XSwyNDpbMiw0NF0sMzI6WzIsNDRdLDMzOlsyLDQ0XSwzNDpbMiw0NF0sMzU6WzIsNDRdLDM2OlsyLDQ0XSw0MDpbMiw0NF0sNDI6WzIsNDRdfSx7MTg6WzIsNDZdLDI0OlsyLDQ2XSwzNjpbMiw0Nl19LHsxODpbMiwyNl0sMjQ6WzIsMjZdLDMyOlsyLDI2XSwzMzpbMiwyNl0sMzQ6WzIsMjZdLDM1OlsyLDI2XSwzNjpbMiwyNl0sNDA6WzIsMjZdLDQyOlsyLDI2XX0sezE4OlsyLDI3XSwyNDpbMiwyN10sMzI6WzIsMjddLDMzOlsyLDI3XSwzNDpbMiwyN10sMzU6WzIsMjddLDM2OlsyLDI3XSw0MDpbMiwyN10sNDI6WzIsMjddfSx7MTg6WzIsMjhdLDI0OlsyLDI4XSwzMjpbMiwyOF0sMzM6WzIsMjhdLDM0OlsyLDI4XSwzNTpbMiwyOF0sMzY6WzIsMjhdLDQwOlsyLDI4XSw0MjpbMiwyOF19LHsxODpbMiwyOV0sMjQ6WzIsMjldLDMyOlsyLDI5XSwzMzpbMiwyOV0sMzQ6WzIsMjldLDM1OlsyLDI5XSwzNjpbMiwyOV0sNDA6WzIsMjldLDQyOlsyLDI5XX0sezE4OlsyLDMwXSwyNDpbMiwzMF0sMzI6WzIsMzBdLDMzOlsyLDMwXSwzNDpbMiwzMF0sMzU6WzIsMzBdLDM2OlsyLDMwXSw0MDpbMiwzMF0sNDI6WzIsMzBdfSx7MTc6NjgsMjE6MjQsMzA6MjUsNDA6WzEsMjhdLDQyOlsxLDI3XSw0MzoyNn0sezE4OlsyLDMyXSwyNDpbMiwzMl0sMzY6WzIsMzJdLDM5OjY5LDQwOlsxLDcwXX0sezE4OlsyLDQ3XSwyNDpbMiw0N10sMzY6WzIsNDddLDQwOlsyLDQ3XX0sezE4OlsyLDQwXSwyNDpbMiw0MF0sMzI6WzIsNDBdLDMzOlsyLDQwXSwzNDpbMiw0MF0sMzU6WzIsNDBdLDM2OlsyLDQwXSw0MDpbMiw0MF0sNDE6WzEsNzFdLDQyOlsyLDQwXSw0NDpbMiw0MF19LHsxODpbMiwzOV0sMjQ6WzIsMzldLDMyOlsyLDM5XSwzMzpbMiwzOV0sMzQ6WzIsMzldLDM1OlsyLDM5XSwzNjpbMiwzOV0sNDA6WzIsMzldLDQyOlsyLDM5XSw0NDpbMiwzOV19LHs1OlsyLDIyXSwxNDpbMiwyMl0sMTU6WzIsMjJdLDE2OlsyLDIyXSwxOTpbMiwyMl0sMjA6WzIsMjJdLDIyOlsyLDIyXSwyMzpbMiwyMl0sMjU6WzIsMjJdfSx7NTpbMiwxOV0sMTQ6WzIsMTldLDE1OlsyLDE5XSwxNjpbMiwxOV0sMTk6WzIsMTldLDIwOlsyLDE5XSwyMjpbMiwxOV0sMjM6WzIsMTldLDI1OlsyLDE5XX0sezM2OlsxLDcyXX0sezE4OlsyLDQ4XSwyNDpbMiw0OF0sMzY6WzIsNDhdLDQwOlsyLDQ4XX0sezQxOlsxLDcxXX0sezIxOjU2LDMwOjYwLDMxOjczLDMyOlsxLDU3XSwzMzpbMSw1OF0sMzQ6WzEsNTldLDM1OlsxLDYxXSw0MDpbMSwyOF0sNDI6WzEsMjddLDQzOjI2fSx7MTg6WzIsMzFdLDI0OlsyLDMxXSwzMjpbMiwzMV0sMzM6WzIsMzFdLDM0OlsyLDMxXSwzNTpbMiwzMV0sMzY6WzIsMzFdLDQwOlsyLDMxXSw0MjpbMiwzMV19LHsxODpbMiwzM10sMjQ6WzIsMzNdLDM2OlsyLDMzXSw0MDpbMiwzM119XSxcbmRlZmF1bHRBY3Rpb25zOiB7MzpbMiwyXSwxNjpbMiwxXSw1MDpbMiw0Ml19LFxucGFyc2VFcnJvcjogZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3Ioc3RyKTtcbn0sXG5wYXJzZTogZnVuY3Rpb24gcGFyc2UoaW5wdXQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsIHN0YWNrID0gWzBdLCB2c3RhY2sgPSBbbnVsbF0sIGxzdGFjayA9IFtdLCB0YWJsZSA9IHRoaXMudGFibGUsIHl5dGV4dCA9IFwiXCIsIHl5bGluZW5vID0gMCwgeXlsZW5nID0gMCwgcmVjb3ZlcmluZyA9IDAsIFRFUlJPUiA9IDIsIEVPRiA9IDE7XG4gICAgdGhpcy5sZXhlci5zZXRJbnB1dChpbnB1dCk7XG4gICAgdGhpcy5sZXhlci55eSA9IHRoaXMueXk7XG4gICAgdGhpcy55eS5sZXhlciA9IHRoaXMubGV4ZXI7XG4gICAgdGhpcy55eS5wYXJzZXIgPSB0aGlzO1xuICAgIGlmICh0eXBlb2YgdGhpcy5sZXhlci55eWxsb2MgPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgdGhpcy5sZXhlci55eWxsb2MgPSB7fTtcbiAgICB2YXIgeXlsb2MgPSB0aGlzLmxleGVyLnl5bGxvYztcbiAgICBsc3RhY2sucHVzaCh5eWxvYyk7XG4gICAgdmFyIHJhbmdlcyA9IHRoaXMubGV4ZXIub3B0aW9ucyAmJiB0aGlzLmxleGVyLm9wdGlvbnMucmFuZ2VzO1xuICAgIGlmICh0eXBlb2YgdGhpcy55eS5wYXJzZUVycm9yID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgIHRoaXMucGFyc2VFcnJvciA9IHRoaXMueXkucGFyc2VFcnJvcjtcbiAgICBmdW5jdGlvbiBwb3BTdGFjayhuKSB7XG4gICAgICAgIHN0YWNrLmxlbmd0aCA9IHN0YWNrLmxlbmd0aCAtIDIgKiBuO1xuICAgICAgICB2c3RhY2subGVuZ3RoID0gdnN0YWNrLmxlbmd0aCAtIG47XG4gICAgICAgIGxzdGFjay5sZW5ndGggPSBsc3RhY2subGVuZ3RoIC0gbjtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGV4KCkge1xuICAgICAgICB2YXIgdG9rZW47XG4gICAgICAgIHRva2VuID0gc2VsZi5sZXhlci5sZXgoKSB8fCAxO1xuICAgICAgICBpZiAodHlwZW9mIHRva2VuICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHNlbGYuc3ltYm9sc19bdG9rZW5dIHx8IHRva2VuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0b2tlbjtcbiAgICB9XG4gICAgdmFyIHN5bWJvbCwgcHJlRXJyb3JTeW1ib2wsIHN0YXRlLCBhY3Rpb24sIGEsIHIsIHl5dmFsID0ge30sIHAsIGxlbiwgbmV3U3RhdGUsIGV4cGVjdGVkO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHN0YXRlID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG4gICAgICAgIGlmICh0aGlzLmRlZmF1bHRBY3Rpb25zW3N0YXRlXSkge1xuICAgICAgICAgICAgYWN0aW9uID0gdGhpcy5kZWZhdWx0QWN0aW9uc1tzdGF0ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc3ltYm9sID09PSBudWxsIHx8IHR5cGVvZiBzeW1ib2wgPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIHN5bWJvbCA9IGxleCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYWN0aW9uID0gdGFibGVbc3RhdGVdICYmIHRhYmxlW3N0YXRlXVtzeW1ib2xdO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgYWN0aW9uID09PSBcInVuZGVmaW5lZFwiIHx8ICFhY3Rpb24ubGVuZ3RoIHx8ICFhY3Rpb25bMF0pIHtcbiAgICAgICAgICAgIHZhciBlcnJTdHIgPSBcIlwiO1xuICAgICAgICAgICAgaWYgKCFyZWNvdmVyaW5nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKHAgaW4gdGFibGVbc3RhdGVdKVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy50ZXJtaW5hbHNfW3BdICYmIHAgPiAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5wdXNoKFwiJ1wiICsgdGhpcy50ZXJtaW5hbHNfW3BdICsgXCInXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubGV4ZXIuc2hvd1Bvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGVyclN0ciA9IFwiUGFyc2UgZXJyb3Igb24gbGluZSBcIiArICh5eWxpbmVubyArIDEpICsgXCI6XFxuXCIgKyB0aGlzLmxleGVyLnNob3dQb3NpdGlvbigpICsgXCJcXG5FeHBlY3RpbmcgXCIgKyBleHBlY3RlZC5qb2luKFwiLCBcIikgKyBcIiwgZ290ICdcIiArICh0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wpICsgXCInXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyU3RyID0gXCJQYXJzZSBlcnJvciBvbiBsaW5lIFwiICsgKHl5bGluZW5vICsgMSkgKyBcIjogVW5leHBlY3RlZCBcIiArIChzeW1ib2wgPT0gMT9cImVuZCBvZiBpbnB1dFwiOlwiJ1wiICsgKHRoaXMudGVybWluYWxzX1tzeW1ib2xdIHx8IHN5bWJvbCkgKyBcIidcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VFcnJvcihlcnJTdHIsIHt0ZXh0OiB0aGlzLmxleGVyLm1hdGNoLCB0b2tlbjogdGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sLCBsaW5lOiB0aGlzLmxleGVyLnl5bGluZW5vLCBsb2M6IHl5bG9jLCBleHBlY3RlZDogZXhwZWN0ZWR9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoYWN0aW9uWzBdIGluc3RhbmNlb2YgQXJyYXkgJiYgYWN0aW9uLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBhcnNlIEVycm9yOiBtdWx0aXBsZSBhY3Rpb25zIHBvc3NpYmxlIGF0IHN0YXRlOiBcIiArIHN0YXRlICsgXCIsIHRva2VuOiBcIiArIHN5bWJvbCk7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoIChhY3Rpb25bMF0pIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgc3RhY2sucHVzaChzeW1ib2wpO1xuICAgICAgICAgICAgdnN0YWNrLnB1c2godGhpcy5sZXhlci55eXRleHQpO1xuICAgICAgICAgICAgbHN0YWNrLnB1c2godGhpcy5sZXhlci55eWxsb2MpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChhY3Rpb25bMV0pO1xuICAgICAgICAgICAgc3ltYm9sID0gbnVsbDtcbiAgICAgICAgICAgIGlmICghcHJlRXJyb3JTeW1ib2wpIHtcbiAgICAgICAgICAgICAgICB5eWxlbmcgPSB0aGlzLmxleGVyLnl5bGVuZztcbiAgICAgICAgICAgICAgICB5eXRleHQgPSB0aGlzLmxleGVyLnl5dGV4dDtcbiAgICAgICAgICAgICAgICB5eWxpbmVubyA9IHRoaXMubGV4ZXIueXlsaW5lbm87XG4gICAgICAgICAgICAgICAgeXlsb2MgPSB0aGlzLmxleGVyLnl5bGxvYztcbiAgICAgICAgICAgICAgICBpZiAocmVjb3ZlcmluZyA+IDApXG4gICAgICAgICAgICAgICAgICAgIHJlY292ZXJpbmctLTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3ltYm9sID0gcHJlRXJyb3JTeW1ib2w7XG4gICAgICAgICAgICAgICAgcHJlRXJyb3JTeW1ib2wgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGxlbiA9IHRoaXMucHJvZHVjdGlvbnNfW2FjdGlvblsxXV1bMV07XG4gICAgICAgICAgICB5eXZhbC4kID0gdnN0YWNrW3ZzdGFjay5sZW5ndGggLSBsZW5dO1xuICAgICAgICAgICAgeXl2YWwuXyQgPSB7Zmlyc3RfbGluZTogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5maXJzdF9saW5lLCBsYXN0X2xpbmU6IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ubGFzdF9saW5lLCBmaXJzdF9jb2x1bW46IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0uZmlyc3RfY29sdW1uLCBsYXN0X2NvbHVtbjogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAxXS5sYXN0X2NvbHVtbn07XG4gICAgICAgICAgICBpZiAocmFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgeXl2YWwuXyQucmFuZ2UgPSBbbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5yYW5nZVswXSwgbHN0YWNrW2xzdGFjay5sZW5ndGggLSAxXS5yYW5nZVsxXV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByID0gdGhpcy5wZXJmb3JtQWN0aW9uLmNhbGwoeXl2YWwsIHl5dGV4dCwgeXlsZW5nLCB5eWxpbmVubywgdGhpcy55eSwgYWN0aW9uWzFdLCB2c3RhY2ssIGxzdGFjayk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICBzdGFjayA9IHN0YWNrLnNsaWNlKDAsIC0xICogbGVuICogMik7XG4gICAgICAgICAgICAgICAgdnN0YWNrID0gdnN0YWNrLnNsaWNlKDAsIC0xICogbGVuKTtcbiAgICAgICAgICAgICAgICBsc3RhY2sgPSBsc3RhY2suc2xpY2UoMCwgLTEgKiBsZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhY2sucHVzaCh0aGlzLnByb2R1Y3Rpb25zX1thY3Rpb25bMV1dWzBdKTtcbiAgICAgICAgICAgIHZzdGFjay5wdXNoKHl5dmFsLiQpO1xuICAgICAgICAgICAgbHN0YWNrLnB1c2goeXl2YWwuXyQpO1xuICAgICAgICAgICAgbmV3U3RhdGUgPSB0YWJsZVtzdGFja1tzdGFjay5sZW5ndGggLSAyXV1bc3RhY2tbc3RhY2subGVuZ3RoIC0gMV1dO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXdTdGF0ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG59O1xuXG5cbmZ1bmN0aW9uIHN0cmlwRmxhZ3Mob3BlbiwgY2xvc2UpIHtcbiAgcmV0dXJuIHtcbiAgICBsZWZ0OiBvcGVuLmNoYXJBdCgyKSA9PT0gJ34nLFxuICAgIHJpZ2h0OiBjbG9zZS5jaGFyQXQoMCkgPT09ICd+JyB8fCBjbG9zZS5jaGFyQXQoMSkgPT09ICd+J1xuICB9O1xufVxuXG4vKiBKaXNvbiBnZW5lcmF0ZWQgbGV4ZXIgKi9cbnZhciBsZXhlciA9IChmdW5jdGlvbigpe1xudmFyIGxleGVyID0gKHtFT0Y6MSxcbnBhcnNlRXJyb3I6ZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICAgICAgaWYgKHRoaXMueXkucGFyc2VyKSB7XG4gICAgICAgICAgICB0aGlzLnl5LnBhcnNlci5wYXJzZUVycm9yKHN0ciwgaGFzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3Ioc3RyKTtcbiAgICAgICAgfVxuICAgIH0sXG5zZXRJbnB1dDpmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgdGhpcy5faW5wdXQgPSBpbnB1dDtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRoaXMuX2xlc3MgPSB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy55eWxpbmVubyA9IHRoaXMueXlsZW5nID0gMDtcbiAgICAgICAgdGhpcy55eXRleHQgPSB0aGlzLm1hdGNoZWQgPSB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uU3RhY2sgPSBbJ0lOSVRJQUwnXTtcbiAgICAgICAgdGhpcy55eWxsb2MgPSB7Zmlyc3RfbGluZToxLGZpcnN0X2NvbHVtbjowLGxhc3RfbGluZToxLGxhc3RfY29sdW1uOjB9O1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykgdGhpcy55eWxsb2MucmFuZ2UgPSBbMCwwXTtcbiAgICAgICAgdGhpcy5vZmZzZXQgPSAwO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuaW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY2ggPSB0aGlzLl9pbnB1dFswXTtcbiAgICAgICAgdGhpcy55eXRleHQgKz0gY2g7XG4gICAgICAgIHRoaXMueXlsZW5nKys7XG4gICAgICAgIHRoaXMub2Zmc2V0Kys7XG4gICAgICAgIHRoaXMubWF0Y2ggKz0gY2g7XG4gICAgICAgIHRoaXMubWF0Y2hlZCArPSBjaDtcbiAgICAgICAgdmFyIGxpbmVzID0gY2gubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICBpZiAobGluZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsaW5lbm8rKztcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLmxhc3RfbGluZSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy55eWxsb2MubGFzdF9jb2x1bW4rKztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykgdGhpcy55eWxsb2MucmFuZ2VbMV0rKztcblxuICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKDEpO1xuICAgICAgICByZXR1cm4gY2g7XG4gICAgfSxcbnVucHV0OmZ1bmN0aW9uIChjaCkge1xuICAgICAgICB2YXIgbGVuID0gY2gubGVuZ3RoO1xuICAgICAgICB2YXIgbGluZXMgPSBjaC5zcGxpdCgvKD86XFxyXFxuP3xcXG4pL2cpO1xuXG4gICAgICAgIHRoaXMuX2lucHV0ID0gY2ggKyB0aGlzLl9pbnB1dDtcbiAgICAgICAgdGhpcy55eXRleHQgPSB0aGlzLnl5dGV4dC5zdWJzdHIoMCwgdGhpcy55eXRleHQubGVuZ3RoLWxlbi0xKTtcbiAgICAgICAgLy90aGlzLnl5bGVuZyAtPSBsZW47XG4gICAgICAgIHRoaXMub2Zmc2V0IC09IGxlbjtcbiAgICAgICAgdmFyIG9sZExpbmVzID0gdGhpcy5tYXRjaC5zcGxpdCgvKD86XFxyXFxuP3xcXG4pL2cpO1xuICAgICAgICB0aGlzLm1hdGNoID0gdGhpcy5tYXRjaC5zdWJzdHIoMCwgdGhpcy5tYXRjaC5sZW5ndGgtMSk7XG4gICAgICAgIHRoaXMubWF0Y2hlZCA9IHRoaXMubWF0Y2hlZC5zdWJzdHIoMCwgdGhpcy5tYXRjaGVkLmxlbmd0aC0xKTtcblxuICAgICAgICBpZiAobGluZXMubGVuZ3RoLTEpIHRoaXMueXlsaW5lbm8gLT0gbGluZXMubGVuZ3RoLTE7XG4gICAgICAgIHZhciByID0gdGhpcy55eWxsb2MucmFuZ2U7XG5cbiAgICAgICAgdGhpcy55eWxsb2MgPSB7Zmlyc3RfbGluZTogdGhpcy55eWxsb2MuZmlyc3RfbGluZSxcbiAgICAgICAgICBsYXN0X2xpbmU6IHRoaXMueXlsaW5lbm8rMSxcbiAgICAgICAgICBmaXJzdF9jb2x1bW46IHRoaXMueXlsbG9jLmZpcnN0X2NvbHVtbixcbiAgICAgICAgICBsYXN0X2NvbHVtbjogbGluZXMgP1xuICAgICAgICAgICAgICAobGluZXMubGVuZ3RoID09PSBvbGRMaW5lcy5sZW5ndGggPyB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gOiAwKSArIG9sZExpbmVzW29sZExpbmVzLmxlbmd0aCAtIGxpbmVzLmxlbmd0aF0ubGVuZ3RoIC0gbGluZXNbMF0ubGVuZ3RoOlxuICAgICAgICAgICAgICB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gLSBsZW5cbiAgICAgICAgICB9O1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5yYW5nZSA9IFtyWzBdLCByWzBdICsgdGhpcy55eWxlbmcgLSBsZW5dO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5tb3JlOmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5sZXNzOmZ1bmN0aW9uIChuKSB7XG4gICAgICAgIHRoaXMudW5wdXQodGhpcy5tYXRjaC5zbGljZShuKSk7XG4gICAgfSxcbnBhc3RJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwYXN0ID0gdGhpcy5tYXRjaGVkLnN1YnN0cigwLCB0aGlzLm1hdGNoZWQubGVuZ3RoIC0gdGhpcy5tYXRjaC5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gKHBhc3QubGVuZ3RoID4gMjAgPyAnLi4uJzonJykgKyBwYXN0LnN1YnN0cigtMjApLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxudXBjb21pbmdJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuZXh0ID0gdGhpcy5tYXRjaDtcbiAgICAgICAgaWYgKG5leHQubGVuZ3RoIDwgMjApIHtcbiAgICAgICAgICAgIG5leHQgKz0gdGhpcy5faW5wdXQuc3Vic3RyKDAsIDIwLW5leHQubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKG5leHQuc3Vic3RyKDAsMjApKyhuZXh0Lmxlbmd0aCA+IDIwID8gJy4uLic6JycpKS5yZXBsYWNlKC9cXG4vZywgXCJcIik7XG4gICAgfSxcbnNob3dQb3NpdGlvbjpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwcmUgPSB0aGlzLnBhc3RJbnB1dCgpO1xuICAgICAgICB2YXIgYyA9IG5ldyBBcnJheShwcmUubGVuZ3RoICsgMSkuam9pbihcIi1cIik7XG4gICAgICAgIHJldHVybiBwcmUgKyB0aGlzLnVwY29taW5nSW5wdXQoKSArIFwiXFxuXCIgKyBjK1wiXlwiO1xuICAgIH0sXG5uZXh0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuZG9uZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5faW5wdXQpIHRoaXMuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgdmFyIHRva2VuLFxuICAgICAgICAgICAgbWF0Y2gsXG4gICAgICAgICAgICB0ZW1wTWF0Y2gsXG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIGNvbCxcbiAgICAgICAgICAgIGxpbmVzO1xuICAgICAgICBpZiAoIXRoaXMuX21vcmUpIHtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ID0gJyc7XG4gICAgICAgICAgICB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJ1bGVzID0gdGhpcy5fY3VycmVudFJ1bGVzKCk7XG4gICAgICAgIGZvciAodmFyIGk9MDtpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRlbXBNYXRjaCA9IHRoaXMuX2lucHV0Lm1hdGNoKHRoaXMucnVsZXNbcnVsZXNbaV1dKTtcbiAgICAgICAgICAgIGlmICh0ZW1wTWF0Y2ggJiYgKCFtYXRjaCB8fCB0ZW1wTWF0Y2hbMF0ubGVuZ3RoID4gbWF0Y2hbMF0ubGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoID0gdGVtcE1hdGNoO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5mbGV4KSBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGxpbmVzID0gbWF0Y2hbMF0ubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICAgICAgaWYgKGxpbmVzKSB0aGlzLnl5bGluZW5vICs9IGxpbmVzLmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jID0ge2ZpcnN0X2xpbmU6IHRoaXMueXlsbG9jLmxhc3RfbGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RfbGluZTogdGhpcy55eWxpbmVubysxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3RfY29sdW1uOiB0aGlzLnl5bGxvYy5sYXN0X2NvbHVtbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RfY29sdW1uOiBsaW5lcyA/IGxpbmVzW2xpbmVzLmxlbmd0aC0xXS5sZW5ndGgtbGluZXNbbGluZXMubGVuZ3RoLTFdLm1hdGNoKC9cXHI/XFxuPy8pWzBdLmxlbmd0aCA6IHRoaXMueXlsbG9jLmxhc3RfY29sdW1uICsgbWF0Y2hbMF0ubGVuZ3RofTtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ICs9IG1hdGNoWzBdO1xuICAgICAgICAgICAgdGhpcy5tYXRjaCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIHRoaXMubWF0Y2hlcyA9IG1hdGNoO1xuICAgICAgICAgICAgdGhpcy55eWxlbmcgPSB0aGlzLnl5dGV4dC5sZW5ndGg7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykge1xuICAgICAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3RoaXMub2Zmc2V0LCB0aGlzLm9mZnNldCArPSB0aGlzLnl5bGVuZ107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tb3JlID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgICAgICB0aGlzLm1hdGNoZWQgKz0gbWF0Y2hbMF07XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMucGVyZm9ybUFjdGlvbi5jYWxsKHRoaXMsIHRoaXMueXksIHRoaXMsIHJ1bGVzW2luZGV4XSx0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTFdKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmRvbmUgJiYgdGhpcy5faW5wdXQpIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHRva2VuKSByZXR1cm4gdG9rZW47XG4gICAgICAgICAgICBlbHNlIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5faW5wdXQgPT09IFwiXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVPRjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlRXJyb3IoJ0xleGljYWwgZXJyb3Igb24gbGluZSAnKyh0aGlzLnl5bGluZW5vKzEpKycuIFVucmVjb2duaXplZCB0ZXh0LlxcbicrdGhpcy5zaG93UG9zaXRpb24oKSxcbiAgICAgICAgICAgICAgICAgICAge3RleHQ6IFwiXCIsIHRva2VuOiBudWxsLCBsaW5lOiB0aGlzLnl5bGluZW5vfSk7XG4gICAgICAgIH1cbiAgICB9LFxubGV4OmZ1bmN0aW9uIGxleCgpIHtcbiAgICAgICAgdmFyIHIgPSB0aGlzLm5leHQoKTtcbiAgICAgICAgaWYgKHR5cGVvZiByICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5sZXgoKTtcbiAgICAgICAgfVxuICAgIH0sXG5iZWdpbjpmdW5jdGlvbiBiZWdpbihjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5jb25kaXRpb25TdGFjay5wdXNoKGNvbmRpdGlvbik7XG4gICAgfSxcbnBvcFN0YXRlOmZ1bmN0aW9uIHBvcFN0YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25TdGFjay5wb3AoKTtcbiAgICB9LFxuX2N1cnJlbnRSdWxlczpmdW5jdGlvbiBfY3VycmVudFJ1bGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25zW3RoaXMuY29uZGl0aW9uU3RhY2tbdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGgtMV1dLnJ1bGVzO1xuICAgIH0sXG50b3BTdGF0ZTpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTJdO1xuICAgIH0sXG5wdXNoU3RhdGU6ZnVuY3Rpb24gYmVnaW4oY29uZGl0aW9uKSB7XG4gICAgICAgIHRoaXMuYmVnaW4oY29uZGl0aW9uKTtcbiAgICB9fSk7XG5sZXhlci5vcHRpb25zID0ge307XG5sZXhlci5wZXJmb3JtQWN0aW9uID0gZnVuY3Rpb24gYW5vbnltb3VzKHl5LHl5XywkYXZvaWRpbmdfbmFtZV9jb2xsaXNpb25zLFlZX1NUQVJUKSB7XG5cblxuZnVuY3Rpb24gc3RyaXAoc3RhcnQsIGVuZCkge1xuICByZXR1cm4geXlfLnl5dGV4dCA9IHl5Xy55eXRleHQuc3Vic3RyKHN0YXJ0LCB5eV8ueXlsZW5nLWVuZCk7XG59XG5cblxudmFyIFlZU1RBVEU9WVlfU1RBUlRcbnN3aXRjaCgkYXZvaWRpbmdfbmFtZV9jb2xsaXNpb25zKSB7XG5jYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHl5Xy55eXRleHQuc2xpY2UoLTIpID09PSBcIlxcXFxcXFxcXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJpcCgwLDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmVnaW4oXCJtdVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmKHl5Xy55eXRleHQuc2xpY2UoLTEpID09PSBcIlxcXFxcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cmlwKDAsMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iZWdpbihcImVtdVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJlZ2luKFwibXVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoeXlfLnl5dGV4dCkgcmV0dXJuIDE0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG5icmVhaztcbmNhc2UgMTpyZXR1cm4gMTQ7XG5icmVhaztcbmNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3BTdGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSAzOnN0cmlwKDAsNCk7IHRoaXMucG9wU3RhdGUoKTsgcmV0dXJuIDE1O1xuYnJlYWs7XG5jYXNlIDQ6cmV0dXJuIDM1O1xuYnJlYWs7XG5jYXNlIDU6cmV0dXJuIDM2O1xuYnJlYWs7XG5jYXNlIDY6cmV0dXJuIDI1O1xuYnJlYWs7XG5jYXNlIDc6cmV0dXJuIDE2O1xuYnJlYWs7XG5jYXNlIDg6cmV0dXJuIDIwO1xuYnJlYWs7XG5jYXNlIDk6cmV0dXJuIDE5O1xuYnJlYWs7XG5jYXNlIDEwOnJldHVybiAxOTtcbmJyZWFrO1xuY2FzZSAxMTpyZXR1cm4gMjM7XG5icmVhaztcbmNhc2UgMTI6cmV0dXJuIDIyO1xuYnJlYWs7XG5jYXNlIDEzOnRoaXMucG9wU3RhdGUoKTsgdGhpcy5iZWdpbignY29tJyk7XG5icmVhaztcbmNhc2UgMTQ6c3RyaXAoMyw1KTsgdGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMTU7XG5icmVhaztcbmNhc2UgMTU6cmV0dXJuIDIyO1xuYnJlYWs7XG5jYXNlIDE2OnJldHVybiA0MTtcbmJyZWFrO1xuY2FzZSAxNzpyZXR1cm4gNDA7XG5icmVhaztcbmNhc2UgMTg6cmV0dXJuIDQwO1xuYnJlYWs7XG5jYXNlIDE5OnJldHVybiA0NDtcbmJyZWFrO1xuY2FzZSAyMDovLyBpZ25vcmUgd2hpdGVzcGFjZVxuYnJlYWs7XG5jYXNlIDIxOnRoaXMucG9wU3RhdGUoKTsgcmV0dXJuIDI0O1xuYnJlYWs7XG5jYXNlIDIyOnRoaXMucG9wU3RhdGUoKTsgcmV0dXJuIDE4O1xuYnJlYWs7XG5jYXNlIDIzOnl5Xy55eXRleHQgPSBzdHJpcCgxLDIpLnJlcGxhY2UoL1xcXFxcIi9nLCdcIicpOyByZXR1cm4gMzI7XG5icmVhaztcbmNhc2UgMjQ6eXlfLnl5dGV4dCA9IHN0cmlwKDEsMikucmVwbGFjZSgvXFxcXCcvZyxcIidcIik7IHJldHVybiAzMjtcbmJyZWFrO1xuY2FzZSAyNTpyZXR1cm4gNDI7XG5icmVhaztcbmNhc2UgMjY6cmV0dXJuIDM0O1xuYnJlYWs7XG5jYXNlIDI3OnJldHVybiAzNDtcbmJyZWFrO1xuY2FzZSAyODpyZXR1cm4gMzM7XG5icmVhaztcbmNhc2UgMjk6cmV0dXJuIDQwO1xuYnJlYWs7XG5jYXNlIDMwOnl5Xy55eXRleHQgPSBzdHJpcCgxLDIpOyByZXR1cm4gNDA7XG5icmVhaztcbmNhc2UgMzE6cmV0dXJuICdJTlZBTElEJztcbmJyZWFrO1xuY2FzZSAzMjpyZXR1cm4gNTtcbmJyZWFrO1xufVxufTtcbmxleGVyLnJ1bGVzID0gWy9eKD86W15cXHgwMF0qPyg/PShcXHtcXHspKSkvLC9eKD86W15cXHgwMF0rKS8sL14oPzpbXlxceDAwXXsyLH0/KD89KFxce1xce3xcXFxcXFx7XFx7fFxcXFxcXFxcXFx7XFx7fCQpKSkvLC9eKD86W1xcc1xcU10qPy0tXFx9XFx9KS8sL14oPzpcXCgpLywvXig/OlxcKSkvLC9eKD86XFx7XFx7KH4pPz4pLywvXig/Olxce1xceyh+KT8jKS8sL14oPzpcXHtcXHsofik/XFwvKS8sL14oPzpcXHtcXHsofik/XFxeKS8sL14oPzpcXHtcXHsofik/XFxzKmVsc2VcXGIpLywvXig/Olxce1xceyh+KT9cXHspLywvXig/Olxce1xceyh+KT8mKS8sL14oPzpcXHtcXHshLS0pLywvXig/Olxce1xceyFbXFxzXFxTXSo/XFx9XFx9KS8sL14oPzpcXHtcXHsofik/KS8sL14oPzo9KS8sL14oPzpcXC5cXC4pLywvXig/OlxcLig/PShbPX59XFxzXFwvLildKSkpLywvXig/OltcXC8uXSkvLC9eKD86XFxzKykvLC9eKD86XFx9KH4pP1xcfVxcfSkvLC9eKD86KH4pP1xcfVxcfSkvLC9eKD86XCIoXFxcXFtcIl18W15cIl0pKlwiKS8sL14oPzonKFxcXFxbJ118W14nXSkqJykvLC9eKD86QCkvLC9eKD86dHJ1ZSg/PShbfn1cXHMpXSkpKS8sL14oPzpmYWxzZSg/PShbfn1cXHMpXSkpKS8sL14oPzotP1swLTldKyg/PShbfn1cXHMpXSkpKS8sL14oPzooW15cXHMhXCIjJS0sXFwuXFwvOy0+QFxcWy1cXF5gXFx7LX5dKyg/PShbPX59XFxzXFwvLildKSkpKS8sL14oPzpcXFtbXlxcXV0qXFxdKS8sL14oPzouKS8sL14oPzokKS9dO1xubGV4ZXIuY29uZGl0aW9ucyA9IHtcIm11XCI6e1wicnVsZXNcIjpbNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTksMjAsMjEsMjIsMjMsMjQsMjUsMjYsMjcsMjgsMjksMzAsMzEsMzJdLFwiaW5jbHVzaXZlXCI6ZmFsc2V9LFwiZW11XCI6e1wicnVsZXNcIjpbMl0sXCJpbmNsdXNpdmVcIjpmYWxzZX0sXCJjb21cIjp7XCJydWxlc1wiOlszXSxcImluY2x1c2l2ZVwiOmZhbHNlfSxcIklOSVRJQUxcIjp7XCJydWxlc1wiOlswLDEsMzJdLFwiaW5jbHVzaXZlXCI6dHJ1ZX19O1xucmV0dXJuIGxleGVyO30pKClcbnBhcnNlci5sZXhlciA9IGxleGVyO1xuZnVuY3Rpb24gUGFyc2VyICgpIHsgdGhpcy55eSA9IHt9OyB9UGFyc2VyLnByb3RvdHlwZSA9IHBhcnNlcjtwYXJzZXIuUGFyc2VyID0gUGFyc2VyO1xucmV0dXJuIG5ldyBQYXJzZXI7XG59KSgpO2V4cG9ydHNbXCJkZWZhdWx0XCJdID0gaGFuZGxlYmFycztcbi8qIGpzaGludCBpZ25vcmU6ZW5kICovIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgVmlzaXRvciA9IHJlcXVpcmUoXCIuL3Zpc2l0b3JcIilbXCJkZWZhdWx0XCJdO1xuXG5mdW5jdGlvbiBwcmludChhc3QpIHtcbiAgcmV0dXJuIG5ldyBQcmludFZpc2l0b3IoKS5hY2NlcHQoYXN0KTtcbn1cblxuZXhwb3J0cy5wcmludCA9IHByaW50O2Z1bmN0aW9uIFByaW50VmlzaXRvcigpIHtcbiAgdGhpcy5wYWRkaW5nID0gMDtcbn1cblxuZXhwb3J0cy5QcmludFZpc2l0b3IgPSBQcmludFZpc2l0b3I7UHJpbnRWaXNpdG9yLnByb3RvdHlwZSA9IG5ldyBWaXNpdG9yKCk7XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUucGFkID0gZnVuY3Rpb24oc3RyaW5nLCBuZXdsaW5lKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuXG4gIGZvcih2YXIgaT0wLGw9dGhpcy5wYWRkaW5nOyBpPGw7IGkrKykge1xuICAgIG91dCA9IG91dCArIFwiICBcIjtcbiAgfVxuXG4gIG91dCA9IG91dCArIHN0cmluZztcblxuICBpZihuZXdsaW5lICE9PSBmYWxzZSkgeyBvdXQgPSBvdXQgKyBcIlxcblwiOyB9XG4gIHJldHVybiBvdXQ7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLnByb2dyYW0gPSBmdW5jdGlvbihwcm9ncmFtKSB7XG4gIHZhciBvdXQgPSBcIlwiLFxuICAgICAgc3RhdGVtZW50cyA9IHByb2dyYW0uc3RhdGVtZW50cyxcbiAgICAgIGksIGw7XG5cbiAgZm9yKGk9MCwgbD1zdGF0ZW1lbnRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICBvdXQgPSBvdXQgKyB0aGlzLmFjY2VwdChzdGF0ZW1lbnRzW2ldKTtcbiAgfVxuXG4gIHRoaXMucGFkZGluZy0tO1xuXG4gIHJldHVybiBvdXQ7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLmJsb2NrID0gZnVuY3Rpb24oYmxvY2spIHtcbiAgdmFyIG91dCA9IFwiXCI7XG5cbiAgb3V0ID0gb3V0ICsgdGhpcy5wYWQoXCJCTE9DSzpcIik7XG4gIHRoaXMucGFkZGluZysrO1xuICBvdXQgPSBvdXQgKyB0aGlzLmFjY2VwdChibG9jay5tdXN0YWNoZSk7XG4gIGlmIChibG9jay5wcm9ncmFtKSB7XG4gICAgb3V0ID0gb3V0ICsgdGhpcy5wYWQoXCJQUk9HUkFNOlwiKTtcbiAgICB0aGlzLnBhZGRpbmcrKztcbiAgICBvdXQgPSBvdXQgKyB0aGlzLmFjY2VwdChibG9jay5wcm9ncmFtKTtcbiAgICB0aGlzLnBhZGRpbmctLTtcbiAgfVxuICBpZiAoYmxvY2suaW52ZXJzZSkge1xuICAgIGlmIChibG9jay5wcm9ncmFtKSB7IHRoaXMucGFkZGluZysrOyB9XG4gICAgb3V0ID0gb3V0ICsgdGhpcy5wYWQoXCJ7e159fVwiKTtcbiAgICB0aGlzLnBhZGRpbmcrKztcbiAgICBvdXQgPSBvdXQgKyB0aGlzLmFjY2VwdChibG9jay5pbnZlcnNlKTtcbiAgICB0aGlzLnBhZGRpbmctLTtcbiAgICBpZiAoYmxvY2sucHJvZ3JhbSkgeyB0aGlzLnBhZGRpbmctLTsgfVxuICB9XG4gIHRoaXMucGFkZGluZy0tO1xuXG4gIHJldHVybiBvdXQ7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLnNleHByID0gZnVuY3Rpb24oc2V4cHIpIHtcbiAgdmFyIHBhcmFtcyA9IHNleHByLnBhcmFtcywgcGFyYW1TdHJpbmdzID0gW10sIGhhc2g7XG5cbiAgZm9yKHZhciBpPTAsIGw9cGFyYW1zLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICBwYXJhbVN0cmluZ3MucHVzaCh0aGlzLmFjY2VwdChwYXJhbXNbaV0pKTtcbiAgfVxuXG4gIHBhcmFtcyA9IFwiW1wiICsgcGFyYW1TdHJpbmdzLmpvaW4oXCIsIFwiKSArIFwiXVwiO1xuXG4gIGhhc2ggPSBzZXhwci5oYXNoID8gXCIgXCIgKyB0aGlzLmFjY2VwdChzZXhwci5oYXNoKSA6IFwiXCI7XG5cbiAgcmV0dXJuIHRoaXMuYWNjZXB0KHNleHByLmlkKSArIFwiIFwiICsgcGFyYW1zICsgaGFzaDtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUubXVzdGFjaGUgPSBmdW5jdGlvbihtdXN0YWNoZSkge1xuICByZXR1cm4gdGhpcy5wYWQoXCJ7eyBcIiArIHRoaXMuYWNjZXB0KG11c3RhY2hlLnNleHByKSArIFwiIH19XCIpO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wYXJ0aWFsID0gZnVuY3Rpb24ocGFydGlhbCkge1xuICB2YXIgY29udGVudCA9IHRoaXMuYWNjZXB0KHBhcnRpYWwucGFydGlhbE5hbWUpO1xuICBpZihwYXJ0aWFsLmNvbnRleHQpIHsgY29udGVudCA9IGNvbnRlbnQgKyBcIiBcIiArIHRoaXMuYWNjZXB0KHBhcnRpYWwuY29udGV4dCk7IH1cbiAgcmV0dXJuIHRoaXMucGFkKFwie3s+IFwiICsgY29udGVudCArIFwiIH19XCIpO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5oYXNoID0gZnVuY3Rpb24oaGFzaCkge1xuICB2YXIgcGFpcnMgPSBoYXNoLnBhaXJzO1xuICB2YXIgam9pbmVkUGFpcnMgPSBbXSwgbGVmdCwgcmlnaHQ7XG5cbiAgZm9yKHZhciBpPTAsIGw9cGFpcnMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgIGxlZnQgPSBwYWlyc1tpXVswXTtcbiAgICByaWdodCA9IHRoaXMuYWNjZXB0KHBhaXJzW2ldWzFdKTtcbiAgICBqb2luZWRQYWlycy5wdXNoKCBsZWZ0ICsgXCI9XCIgKyByaWdodCApO1xuICB9XG5cbiAgcmV0dXJuIFwiSEFTSHtcIiArIGpvaW5lZFBhaXJzLmpvaW4oXCIsIFwiKSArIFwifVwiO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5TVFJJTkcgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgcmV0dXJuICdcIicgKyBzdHJpbmcuc3RyaW5nICsgJ1wiJztcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuSU5URUdFUiA9IGZ1bmN0aW9uKGludGVnZXIpIHtcbiAgcmV0dXJuIFwiSU5URUdFUntcIiArIGludGVnZXIuaW50ZWdlciArIFwifVwiO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5CT09MRUFOID0gZnVuY3Rpb24oYm9vbCkge1xuICByZXR1cm4gXCJCT09MRUFOe1wiICsgYm9vbC5ib29sICsgXCJ9XCI7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLklEID0gZnVuY3Rpb24oaWQpIHtcbiAgdmFyIHBhdGggPSBpZC5wYXJ0cy5qb2luKFwiL1wiKTtcbiAgaWYoaWQucGFydHMubGVuZ3RoID4gMSkge1xuICAgIHJldHVybiBcIlBBVEg6XCIgKyBwYXRoO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBcIklEOlwiICsgcGF0aDtcbiAgfVxufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5QQVJUSUFMX05BTUUgPSBmdW5jdGlvbihwYXJ0aWFsTmFtZSkge1xuICAgIHJldHVybiBcIlBBUlRJQUw6XCIgKyBwYXJ0aWFsTmFtZS5uYW1lO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5EQVRBID0gZnVuY3Rpb24oZGF0YSkge1xuICByZXR1cm4gXCJAXCIgKyB0aGlzLmFjY2VwdChkYXRhLmlkKTtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuY29udGVudCA9IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgcmV0dXJuIHRoaXMucGFkKFwiQ09OVEVOVFsgJ1wiICsgY29udGVudC5zdHJpbmcgKyBcIicgXVwiKTtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuY29tbWVudCA9IGZ1bmN0aW9uKGNvbW1lbnQpIHtcbiAgcmV0dXJuIHRoaXMucGFkKFwie3shICdcIiArIGNvbW1lbnQuY29tbWVudCArIFwiJyB9fVwiKTtcbn07IiwiXCJ1c2Ugc3RyaWN0XCI7XG5mdW5jdGlvbiBWaXNpdG9yKCkge31cblxuVmlzaXRvci5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBWaXNpdG9yLFxuXG4gIGFjY2VwdDogZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIHRoaXNbb2JqZWN0LnR5cGVdKG9iamVjdCk7XG4gIH1cbn07XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gVmlzaXRvcjsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGVycm9yUHJvcHMgPSBbJ2Rlc2NyaXB0aW9uJywgJ2ZpbGVOYW1lJywgJ2xpbmVOdW1iZXInLCAnbWVzc2FnZScsICduYW1lJywgJ251bWJlcicsICdzdGFjayddO1xuXG5mdW5jdGlvbiBFeGNlcHRpb24obWVzc2FnZSwgbm9kZSkge1xuICB2YXIgbGluZTtcbiAgaWYgKG5vZGUgJiYgbm9kZS5maXJzdExpbmUpIHtcbiAgICBsaW5lID0gbm9kZS5maXJzdExpbmU7XG5cbiAgICBtZXNzYWdlICs9ICcgLSAnICsgbGluZSArICc6JyArIG5vZGUuZmlyc3RDb2x1bW47XG4gIH1cblxuICB2YXIgdG1wID0gRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgbWVzc2FnZSk7XG5cbiAgLy8gVW5mb3J0dW5hdGVseSBlcnJvcnMgYXJlIG5vdCBlbnVtZXJhYmxlIGluIENocm9tZSAoYXQgbGVhc3QpLCBzbyBgZm9yIHByb3AgaW4gdG1wYCBkb2Vzbid0IHdvcmsuXG4gIGZvciAodmFyIGlkeCA9IDA7IGlkeCA8IGVycm9yUHJvcHMubGVuZ3RoOyBpZHgrKykge1xuICAgIHRoaXNbZXJyb3JQcm9wc1tpZHhdXSA9IHRtcFtlcnJvclByb3BzW2lkeF1dO1xuICB9XG5cbiAgaWYgKGxpbmUpIHtcbiAgICB0aGlzLmxpbmVOdW1iZXIgPSBsaW5lO1xuICAgIHRoaXMuY29sdW1uID0gbm9kZS5maXJzdENvbHVtbjtcbiAgfVxufVxuXG5FeGNlcHRpb24ucHJvdG90eXBlID0gbmV3IEVycm9yKCk7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gRXhjZXB0aW9uOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFV0aWxzID0gcmVxdWlyZShcIi4vdXRpbHNcIik7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBDT01QSUxFUl9SRVZJU0lPTiA9IHJlcXVpcmUoXCIuL2Jhc2VcIikuQ09NUElMRVJfUkVWSVNJT047XG52YXIgUkVWSVNJT05fQ0hBTkdFUyA9IHJlcXVpcmUoXCIuL2Jhc2VcIikuUkVWSVNJT05fQ0hBTkdFUztcblxuZnVuY3Rpb24gY2hlY2tSZXZpc2lvbihjb21waWxlckluZm8pIHtcbiAgdmFyIGNvbXBpbGVyUmV2aXNpb24gPSBjb21waWxlckluZm8gJiYgY29tcGlsZXJJbmZvWzBdIHx8IDEsXG4gICAgICBjdXJyZW50UmV2aXNpb24gPSBDT01QSUxFUl9SRVZJU0lPTjtcblxuICBpZiAoY29tcGlsZXJSZXZpc2lvbiAhPT0gY3VycmVudFJldmlzaW9uKSB7XG4gICAgaWYgKGNvbXBpbGVyUmV2aXNpb24gPCBjdXJyZW50UmV2aXNpb24pIHtcbiAgICAgIHZhciBydW50aW1lVmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW2N1cnJlbnRSZXZpc2lvbl0sXG4gICAgICAgICAgY29tcGlsZXJWZXJzaW9ucyA9IFJFVklTSU9OX0NIQU5HRVNbY29tcGlsZXJSZXZpc2lvbl07XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGVtcGxhdGUgd2FzIHByZWNvbXBpbGVkIHdpdGggYW4gb2xkZXIgdmVyc2lvbiBvZiBIYW5kbGViYXJzIHRoYW4gdGhlIGN1cnJlbnQgcnVudGltZS4gXCIrXG4gICAgICAgICAgICBcIlBsZWFzZSB1cGRhdGUgeW91ciBwcmVjb21waWxlciB0byBhIG5ld2VyIHZlcnNpb24gKFwiK3J1bnRpbWVWZXJzaW9ucytcIikgb3IgZG93bmdyYWRlIHlvdXIgcnVudGltZSB0byBhbiBvbGRlciB2ZXJzaW9uIChcIitjb21waWxlclZlcnNpb25zK1wiKS5cIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSB0aGUgZW1iZWRkZWQgdmVyc2lvbiBpbmZvIHNpbmNlIHRoZSBydW50aW1lIGRvZXNuJ3Qga25vdyBhYm91dCB0aGlzIHJldmlzaW9uIHlldFxuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGEgbmV3ZXIgdmVyc2lvbiBvZiBIYW5kbGViYXJzIHRoYW4gdGhlIGN1cnJlbnQgcnVudGltZS4gXCIrXG4gICAgICAgICAgICBcIlBsZWFzZSB1cGRhdGUgeW91ciBydW50aW1lIHRvIGEgbmV3ZXIgdmVyc2lvbiAoXCIrY29tcGlsZXJJbmZvWzFdK1wiKS5cIik7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydHMuY2hlY2tSZXZpc2lvbiA9IGNoZWNrUmV2aXNpb247Ly8gVE9ETzogUmVtb3ZlIHRoaXMgbGluZSBhbmQgYnJlYWsgdXAgY29tcGlsZVBhcnRpYWxcblxuZnVuY3Rpb24gdGVtcGxhdGUodGVtcGxhdGVTcGVjLCBlbnYpIHtcbiAgaWYgKCFlbnYpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiTm8gZW52aXJvbm1lbnQgcGFzc2VkIHRvIHRlbXBsYXRlXCIpO1xuICB9XG5cbiAgLy8gTm90ZTogVXNpbmcgZW52LlZNIHJlZmVyZW5jZXMgcmF0aGVyIHRoYW4gbG9jYWwgdmFyIHJlZmVyZW5jZXMgdGhyb3VnaG91dCB0aGlzIHNlY3Rpb24gdG8gYWxsb3dcbiAgLy8gZm9yIGV4dGVybmFsIHVzZXJzIHRvIG92ZXJyaWRlIHRoZXNlIGFzIHBzdWVkby1zdXBwb3J0ZWQgQVBJcy5cbiAgdmFyIGludm9rZVBhcnRpYWxXcmFwcGVyID0gZnVuY3Rpb24ocGFydGlhbCwgbmFtZSwgY29udGV4dCwgaGVscGVycywgcGFydGlhbHMsIGRhdGEpIHtcbiAgICB2YXIgcmVzdWx0ID0gZW52LlZNLmludm9rZVBhcnRpYWwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICBpZiAocmVzdWx0ICE9IG51bGwpIHsgcmV0dXJuIHJlc3VsdDsgfVxuXG4gICAgaWYgKGVudi5jb21waWxlKSB7XG4gICAgICB2YXIgb3B0aW9ucyA9IHsgaGVscGVyczogaGVscGVycywgcGFydGlhbHM6IHBhcnRpYWxzLCBkYXRhOiBkYXRhIH07XG4gICAgICBwYXJ0aWFsc1tuYW1lXSA9IGVudi5jb21waWxlKHBhcnRpYWwsIHsgZGF0YTogZGF0YSAhPT0gdW5kZWZpbmVkIH0sIGVudik7XG4gICAgICByZXR1cm4gcGFydGlhbHNbbmFtZV0oY29udGV4dCwgb3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUaGUgcGFydGlhbCBcIiArIG5hbWUgKyBcIiBjb3VsZCBub3QgYmUgY29tcGlsZWQgd2hlbiBydW5uaW5nIGluIHJ1bnRpbWUtb25seSBtb2RlXCIpO1xuICAgIH1cbiAgfTtcblxuICAvLyBKdXN0IGFkZCB3YXRlclxuICB2YXIgY29udGFpbmVyID0ge1xuICAgIGVzY2FwZUV4cHJlc3Npb246IFV0aWxzLmVzY2FwZUV4cHJlc3Npb24sXG4gICAgaW52b2tlUGFydGlhbDogaW52b2tlUGFydGlhbFdyYXBwZXIsXG4gICAgcHJvZ3JhbXM6IFtdLFxuICAgIHByb2dyYW06IGZ1bmN0aW9uKGksIGZuLCBkYXRhKSB7XG4gICAgICB2YXIgcHJvZ3JhbVdyYXBwZXIgPSB0aGlzLnByb2dyYW1zW2ldO1xuICAgICAgaWYoZGF0YSkge1xuICAgICAgICBwcm9ncmFtV3JhcHBlciA9IHByb2dyYW0oaSwgZm4sIGRhdGEpO1xuICAgICAgfSBlbHNlIGlmICghcHJvZ3JhbVdyYXBwZXIpIHtcbiAgICAgICAgcHJvZ3JhbVdyYXBwZXIgPSB0aGlzLnByb2dyYW1zW2ldID0gcHJvZ3JhbShpLCBmbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gcHJvZ3JhbVdyYXBwZXI7XG4gICAgfSxcbiAgICBtZXJnZTogZnVuY3Rpb24ocGFyYW0sIGNvbW1vbikge1xuICAgICAgdmFyIHJldCA9IHBhcmFtIHx8IGNvbW1vbjtcblxuICAgICAgaWYgKHBhcmFtICYmIGNvbW1vbiAmJiAocGFyYW0gIT09IGNvbW1vbikpIHtcbiAgICAgICAgcmV0ID0ge307XG4gICAgICAgIFV0aWxzLmV4dGVuZChyZXQsIGNvbW1vbik7XG4gICAgICAgIFV0aWxzLmV4dGVuZChyZXQsIHBhcmFtKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSxcbiAgICBwcm9ncmFtV2l0aERlcHRoOiBlbnYuVk0ucHJvZ3JhbVdpdGhEZXB0aCxcbiAgICBub29wOiBlbnYuVk0ubm9vcCxcbiAgICBjb21waWxlckluZm86IG51bGxcbiAgfTtcblxuICByZXR1cm4gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBuYW1lc3BhY2UgPSBvcHRpb25zLnBhcnRpYWwgPyBvcHRpb25zIDogZW52LFxuICAgICAgICBoZWxwZXJzLFxuICAgICAgICBwYXJ0aWFscztcblxuICAgIGlmICghb3B0aW9ucy5wYXJ0aWFsKSB7XG4gICAgICBoZWxwZXJzID0gb3B0aW9ucy5oZWxwZXJzO1xuICAgICAgcGFydGlhbHMgPSBvcHRpb25zLnBhcnRpYWxzO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gdGVtcGxhdGVTcGVjLmNhbGwoXG4gICAgICAgICAgY29udGFpbmVyLFxuICAgICAgICAgIG5hbWVzcGFjZSwgY29udGV4dCxcbiAgICAgICAgICBoZWxwZXJzLFxuICAgICAgICAgIHBhcnRpYWxzLFxuICAgICAgICAgIG9wdGlvbnMuZGF0YSk7XG5cbiAgICBpZiAoIW9wdGlvbnMucGFydGlhbCkge1xuICAgICAgZW52LlZNLmNoZWNrUmV2aXNpb24oY29udGFpbmVyLmNvbXBpbGVySW5mbyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0cy50ZW1wbGF0ZSA9IHRlbXBsYXRlO2Z1bmN0aW9uIHByb2dyYW1XaXRoRGVwdGgoaSwgZm4sIGRhdGEgLyosICRkZXB0aCAqLykge1xuICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG5cbiAgdmFyIHByb2cgPSBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgW2NvbnRleHQsIG9wdGlvbnMuZGF0YSB8fCBkYXRhXS5jb25jYXQoYXJncykpO1xuICB9O1xuICBwcm9nLnByb2dyYW0gPSBpO1xuICBwcm9nLmRlcHRoID0gYXJncy5sZW5ndGg7XG4gIHJldHVybiBwcm9nO1xufVxuXG5leHBvcnRzLnByb2dyYW1XaXRoRGVwdGggPSBwcm9ncmFtV2l0aERlcHRoO2Z1bmN0aW9uIHByb2dyYW0oaSwgZm4sIGRhdGEpIHtcbiAgdmFyIHByb2cgPSBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICByZXR1cm4gZm4oY29udGV4dCwgb3B0aW9ucy5kYXRhIHx8IGRhdGEpO1xuICB9O1xuICBwcm9nLnByb2dyYW0gPSBpO1xuICBwcm9nLmRlcHRoID0gMDtcbiAgcmV0dXJuIHByb2c7XG59XG5cbmV4cG9ydHMucHJvZ3JhbSA9IHByb2dyYW07ZnVuY3Rpb24gaW52b2tlUGFydGlhbChwYXJ0aWFsLCBuYW1lLCBjb250ZXh0LCBoZWxwZXJzLCBwYXJ0aWFscywgZGF0YSkge1xuICB2YXIgb3B0aW9ucyA9IHsgcGFydGlhbDogdHJ1ZSwgaGVscGVyczogaGVscGVycywgcGFydGlhbHM6IHBhcnRpYWxzLCBkYXRhOiBkYXRhIH07XG5cbiAgaWYocGFydGlhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRoZSBwYXJ0aWFsIFwiICsgbmFtZSArIFwiIGNvdWxkIG5vdCBiZSBmb3VuZFwiKTtcbiAgfSBlbHNlIGlmKHBhcnRpYWwgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIHJldHVybiBwYXJ0aWFsKGNvbnRleHQsIG9wdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydHMuaW52b2tlUGFydGlhbCA9IGludm9rZVBhcnRpYWw7ZnVuY3Rpb24gbm9vcCgpIHsgcmV0dXJuIFwiXCI7IH1cblxuZXhwb3J0cy5ub29wID0gbm9vcDsiLCJcInVzZSBzdHJpY3RcIjtcbi8vIEJ1aWxkIG91dCBvdXIgYmFzaWMgU2FmZVN0cmluZyB0eXBlXG5mdW5jdGlvbiBTYWZlU3RyaW5nKHN0cmluZykge1xuICB0aGlzLnN0cmluZyA9IHN0cmluZztcbn1cblxuU2FmZVN0cmluZy5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiXCIgKyB0aGlzLnN0cmluZztcbn07XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gU2FmZVN0cmluZzsiLCJcInVzZSBzdHJpY3RcIjtcbi8qanNoaW50IC1XMDA0ICovXG52YXIgU2FmZVN0cmluZyA9IHJlcXVpcmUoXCIuL3NhZmUtc3RyaW5nXCIpW1wiZGVmYXVsdFwiXTtcblxudmFyIGVzY2FwZSA9IHtcbiAgXCImXCI6IFwiJmFtcDtcIixcbiAgXCI8XCI6IFwiJmx0O1wiLFxuICBcIj5cIjogXCImZ3Q7XCIsXG4gICdcIic6IFwiJnF1b3Q7XCIsXG4gIFwiJ1wiOiBcIiYjeDI3O1wiLFxuICBcImBcIjogXCImI3g2MDtcIlxufTtcblxudmFyIGJhZENoYXJzID0gL1smPD5cIidgXS9nO1xudmFyIHBvc3NpYmxlID0gL1smPD5cIidgXS87XG5cbmZ1bmN0aW9uIGVzY2FwZUNoYXIoY2hyKSB7XG4gIHJldHVybiBlc2NhcGVbY2hyXSB8fCBcIiZhbXA7XCI7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZChvYmosIHZhbHVlKSB7XG4gIGZvcih2YXIga2V5IGluIHZhbHVlKSB7XG4gICAgaWYoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCBrZXkpKSB7XG4gICAgICBvYmpba2V5XSA9IHZhbHVlW2tleV07XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydHMuZXh0ZW5kID0gZXh0ZW5kO3ZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5leHBvcnRzLnRvU3RyaW5nID0gdG9TdHJpbmc7XG4vLyBTb3VyY2VkIGZyb20gbG9kYXNoXG4vLyBodHRwczovL2dpdGh1Yi5jb20vYmVzdGllanMvbG9kYXNoL2Jsb2IvbWFzdGVyL0xJQ0VOU0UudHh0XG52YXIgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG59O1xuLy8gZmFsbGJhY2sgZm9yIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpXG5pZiAoaXNGdW5jdGlvbigveC8pKSB7XG4gIGlzRnVuY3Rpb24gPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG4gIH07XG59XG52YXIgaXNGdW5jdGlvbjtcbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSA/IHRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nIDogZmFsc2U7XG59O1xuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gZXNjYXBlRXhwcmVzc2lvbihzdHJpbmcpIHtcbiAgLy8gZG9uJ3QgZXNjYXBlIFNhZmVTdHJpbmdzLCBzaW5jZSB0aGV5J3JlIGFscmVhZHkgc2FmZVxuICBpZiAoc3RyaW5nIGluc3RhbmNlb2YgU2FmZVN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcudG9TdHJpbmcoKTtcbiAgfSBlbHNlIGlmICghc3RyaW5nICYmIHN0cmluZyAhPT0gMCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgLy8gRm9yY2UgYSBzdHJpbmcgY29udmVyc2lvbiBhcyB0aGlzIHdpbGwgYmUgZG9uZSBieSB0aGUgYXBwZW5kIHJlZ2FyZGxlc3MgYW5kXG4gIC8vIHRoZSByZWdleCB0ZXN0IHdpbGwgZG8gdGhpcyB0cmFuc3BhcmVudGx5IGJlaGluZCB0aGUgc2NlbmVzLCBjYXVzaW5nIGlzc3VlcyBpZlxuICAvLyBhbiBvYmplY3QncyB0byBzdHJpbmcgaGFzIGVzY2FwZWQgY2hhcmFjdGVycyBpbiBpdC5cbiAgc3RyaW5nID0gXCJcIiArIHN0cmluZztcblxuICBpZighcG9zc2libGUudGVzdChzdHJpbmcpKSB7IHJldHVybiBzdHJpbmc7IH1cbiAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKGJhZENoYXJzLCBlc2NhcGVDaGFyKTtcbn1cblxuZXhwb3J0cy5lc2NhcGVFeHByZXNzaW9uID0gZXNjYXBlRXhwcmVzc2lvbjtmdW5jdGlvbiBpc0VtcHR5KHZhbHVlKSB7XG4gIGlmICghdmFsdWUgJiYgdmFsdWUgIT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZXhwb3J0cy5pc0VtcHR5ID0gaXNFbXB0eTsiLCIvLyBVU0FHRTpcbi8vIHZhciBoYW5kbGViYXJzID0gcmVxdWlyZSgnaGFuZGxlYmFycycpO1xuXG4vLyB2YXIgbG9jYWwgPSBoYW5kbGViYXJzLmNyZWF0ZSgpO1xuXG52YXIgaGFuZGxlYmFycyA9IHJlcXVpcmUoJy4uL2Rpc3QvY2pzL2hhbmRsZWJhcnMnKVtcImRlZmF1bHRcIl07XG5cbmhhbmRsZWJhcnMuVmlzaXRvciA9IHJlcXVpcmUoJy4uL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvdmlzaXRvcicpW1wiZGVmYXVsdFwiXTtcblxudmFyIHByaW50ZXIgPSByZXF1aXJlKCcuLi9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3ByaW50ZXInKTtcbmhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yID0gcHJpbnRlci5QcmludFZpc2l0b3I7XG5oYW5kbGViYXJzLnByaW50ID0gcHJpbnRlci5wcmludDtcblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGViYXJzO1xuXG4vLyBQdWJsaXNoIGEgTm9kZS5qcyByZXF1aXJlKCkgaGFuZGxlciBmb3IgLmhhbmRsZWJhcnMgYW5kIC5oYnMgZmlsZXNcbmlmICh0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgJiYgcmVxdWlyZS5leHRlbnNpb25zKSB7XG4gIHZhciBleHRlbnNpb24gPSBmdW5jdGlvbihtb2R1bGUsIGZpbGVuYW1lKSB7XG4gICAgdmFyIGZzID0gcmVxdWlyZShcImZzXCIpO1xuICAgIHZhciB0ZW1wbGF0ZVN0cmluZyA9IGZzLnJlYWRGaWxlU3luYyhmaWxlbmFtZSwgXCJ1dGY4XCIpO1xuICAgIG1vZHVsZS5leHBvcnRzID0gaGFuZGxlYmFycy5jb21waWxlKHRlbXBsYXRlU3RyaW5nKTtcbiAgfTtcbiAgcmVxdWlyZS5leHRlbnNpb25zW1wiLmhhbmRsZWJhcnNcIl0gPSBleHRlbnNpb247XG4gIHJlcXVpcmUuZXh0ZW5zaW9uc1tcIi5oYnNcIl0gPSBleHRlbnNpb247XG59XG4iLCIvLyBDcmVhdGUgYSBzaW1wbGUgcGF0aCBhbGlhcyB0byBhbGxvdyBicm93c2VyaWZ5IHRvIHJlc29sdmVcbi8vIHRoZSBydW50aW1lIG9uIGEgc3VwcG9ydGVkIHBhdGguXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGlzdC9janMvaGFuZGxlYmFycy5ydW50aW1lJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIilbXCJkZWZhdWx0XCJdO1xuIiwib2JqZWN0ID0ge31cbm1vZHVsZS5leHBvcnRzID0gb2JqZWN0XG5cblxuIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcbiMjIyAgIFBBUkxFWS5KUyBDSEFUIExJQlJBUlkgRVhUUk9ESU5BSVJFICAgIyMjXG4jIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI1xuXG5cbiMjIHRoaXMgaXMgdGhlIGNvbnRydWN0b3IgZm9yIHRoZSBnbG9iYWwgb2JqZWN0IHRoYXQgd2hlbiBpbml0aWFsaXplZFxuIyMgZXhlY3V0ZXMgYWxsIG5lY2Nlc2FyeSBvcGVyYXRpb25zIHRvIGdldCB0aGlzIHRyYWluIG1vdmluZy5cbmNsYXNzIEFwcFxuXG4gIGNvbnN0cnVjdG9yOiAtPlxuICAgIEBjdXJyZW50X3VzZXJzID0gW11cbiAgICBAb3Blbl9jb252ZXJzYXRpb25zID0gW11cbiAgICBAY29udmVyc2F0aW9ucyA9IFtdXG5cbiAgICAjIyBpbnNlcnQgc2NyaXB0IGZvciBzb2NrZXQuaW8gY29ubmVjdGlvbnNcbiAgICBkbyAtPlxuICAgICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0JylcbiAgICAgIHNjcmlwdC50eXBlID0gJ3RleHQvamF2YXNjcmlwdCdcbiAgICAgIHNjcmlwdC5hc3luYyA9IHRydWVcbiAgICAgIHNjcmlwdC5zcmMgPSBcIi9zb2NrZXQuaW8vc29ja2V0LmlvLmpzXCJcbiAgICAgIHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0JylbMF1cbiAgICAgIHMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoc2NyaXB0LCBzKVxuXG4gICAgIyMgaW5zZXJ0IHNjcmlwdCBmb3IgZ29vZ2xlIHBsdXMgc2lnbmluXG4gICAgZG8gLT5cbiAgICAgIHBvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0JylcbiAgICAgIHBvLnR5cGUgPSAndGV4dC9qYXZhc2NyaXB0J1xuICAgICAgcG8uYXN5bmMgPSB0cnVlXG4gICAgICBwby5zcmMgPSAnaHR0cHM6Ly9hcGlzLmdvb2dsZS5jb20vanMvY2xpZW50OnBsdXNvbmUuanMnXG4gICAgICBzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdXG4gICAgICBzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHBvLCBzKVxuXG4gICAgIyMgbGlzdGVuIGZvciBwZXJzaXN0ZW50IGNvbnZlcnNhdGlvbnMgZnJvbSB0aGUgc2VydmVyIG9uIGxvYWQuXG4gICAgIyMgd2lsbCBiZSBzZW50IGluIG9uZSBhdCBhIHRpbWUgZnJvbSByZWRpcyBvbiBsb2FkLlxuICAgIEBzZXJ2ZXIub24gJ3BlcnNpc3RlbnRfY29udm8nLCBAbG9hZF9wZXJzaXN0ZW50X2NvbnZvLmJpbmQodGhpcylcblxuICAgICMjIGxpc3RlbnMgZm9yIGN1cnJlbnQgdXNlcnMgYXJyYXkgZnJvbSBzZXJ2ZXJcbiAgICBAc2VydmVyLm9uICdjdXJyZW50X3VzZXJzJywgQGxvYWRfY3VycmVudF91c2Vycy5iaW5kKHRoaXMpXG4gICAgQHNlcnZlci5vbiAndXNlcl9sb2dnZWRfb24nLCBAdXNlcl9sb2dnZWRfb24uYmluZCh0aGlzKVxuICAgIEBzZXJ2ZXIub24gJ3VzZXJfbG9nZ2VkX29mZicsIEB1c2VyX2xvZ2dlZF9vZmYuYmluZCh0aGlzKVxuXG4gIHNlcnZlcjogaW8uY29ubmVjdCgnd3NzOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZSlcblxuXG4gIGxvYWRfcGVyc2lzdGVudF9jb252bzogKGNvbnZvX2tleSwgbWVzc2FnZXMpIC0+XG4gICAgIyMgdGFrZXMgY29udm9fa2V5IGFuZCBjb252ZXJ0cyB0byBjb252b19wYXJ0bmVycyBmb3IgY29udmVyc2F0aW9uIGNyZWF0aW9uXG4gICAgY29udm9fbWVtYmVycyA9IGNvbnZvX2tleS5zcGxpdCgnLCcpXG4gICAgZm9yIGlkIGluIGNvbnZvX21lbWJlcnNcbiAgICAgIGlmIGlkIGlzbnQgQGFwcC5tZS5pbWFnZV91cmxcbiAgICAgICAgY29udm9fcGFydG5lcnMgKz0gaWRcblxuICAgICMjIGNyZWF0ZSBuZXcgY29udmVyc2F0aW9uIG9iamVjdCBmcm9tIHBlcnNpc3RlbnQgY29udmVyc2F0aW9uIGluZm9cbiAgICBjb252byA9IG5ldyBDb252ZXJzYXRpb24oY29udm9fcGFydG5lcnMsIG1lc3NhZ2VzKVxuICAgIEBjb252ZXJzYXRpb25zLnB1c2goY29udm8pXG5cblxuXG4gIGxvYWRfY3VycmVudF91c2VyczogKGxvZ2dlZF9vbikgLT5cbiAgICAjIyByZWNpZXZlcyBjdXJyZW50IHVzZXJzIGZyb20gc2VydmVyIG9uIGxvZ2luXG4gICAgQGN1cnJlbnRfdXNlcnMgPSBsb2dnZWRfb25cbiAgICBmb3IgdXNlciwgaSBpbiBAY3VycmVudF91c2Vyc1xuICAgICAgaWYgdXNlci5pbWFnZV91cmwgaXMgQG1lLmltYWdlX3VybFxuICAgICAgICBAY3VycmVudF91c2Vycy5zcGxpY2UoaSwxKVxuXG4gIHVzZXJfbG9nZ2VkX29uOiAoZGlzcGxheV9uYW1lLCBpbWFnZV91cmwpIC0+XG4gICAgdXNlciA9IG5ldyBVc2VyKGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsKVxuICAgIEBjdXJyZW50X3VzZXJzLnB1c2godXNlcilcblxuICB1c2VyX2xvZ2dlZF9vZmY6IChkaXNwbGF5X25hbWUsIGltYWdlX3VybCkgLT5cbiAgICBmb3IgdXNlciBpbiBAY3VycmVudF91c2Vyc1xuICAgICAgaWYgaW1hZ2VfdXJsIGlzIHVzZXIuaW1hZ2VfdXJsXG4gICAgICAgIEBjdXJyZW50X3VzZXJzLnNwbGljZSggaSwgMSlcblxuXG4jIyBTQVRJU0ZJRVMgQ0lSQ1VMQVIgREVQRU5EQU5DWSBGT1IgQlJPV1NFUklGWSBCVU5ETElOR1xucGFybGV5ID0gbmV3IEFwcCgpXG5cbm1vZHVsZS5leHBvcnRzID0gcGFybGV5XG5cbiMjIExPQUQgQ09NTUFORENFTlRFUiBBTkQgT0FVVEggVE8gU1RBUlQgQVBQXG5vYXV0aCA9IHJlcXVpcmUoJy4vb2F1dGguY29mZmVlJylcbmNvbW1hbmRfY2VudGVyID0gcmVxdWlyZSgnLi9jb21tYW5kX2NlbnRlcl92aWV3LmNvZmZlZScpXG5Db252ZXJzYXRpb24gPSByZXF1aXJlKCcuL2NvbnZlcnNhdGlvbl9tb2RlbC5jb2ZmZWUnKVxuVXNlciA9IHJlcXVpcmUoJy4vdXNlcl9tb2RlbC5jb2ZmZWUnKVxuQXBwLnByb3RvdHlwZS5jb21tYW5kX2NlbnRlciA9IGNvbW1hbmRfY2VudGVyXG5BcHAucHJvdG90eXBlLm9hdXRoID0gb2F1dGhcblxuXG5cblxuIiwiYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcbk1lc3NhZ2UgPSByZXF1aXJlKCcuL21lc3NhZ2VfbW9kZWwuY29mZmVlJylcbk1lc3NhZ2VWaWV3ID0gcmVxdWlyZSgnLi9tZXNzYWdlX3ZpZXcuY29mZmVlJylcbkNvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uX21vZGVsLmNvZmZlZScpXG5jaGF0X3Jvb21fdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9jaGF0X3Jvb20uaGJzJylcblxuXG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgY29udGFpbmluZyB0ZW1wbGF0ZSBhbmQgdXNlclxuIyMgaW50ZXJhY3Rpb24gbG9naWMgZm9yIGVhY2ggb3BlbiBjaGF0IHdpbmRvdy5cbiMjIHdhdGNoZXMgYSBjb252ZXJzYXRpb24gbW9kZWwuXG5jbGFzcyBDaGF0Um9vbVxuXG4gIGNvbnN0cnVjdG9yOiAoQGNvbnZvKSAtPlxuICAgIGNvbnNvbGUubG9nKFwiaSdtIGhlcmUhIVwiKVxuICAgIGNvbnNvbGUubG9nKGFwcClcbiAgICBAcmVuZGVyKClcbiAgICAkKCdib2R5JykuYXBwZW5kKEAkZWxlbWVudClcbiAgICBjb25zb2xlLmxvZyhcIm5vdyBJJ20gSGVyZVwiKVxuICAgICMjIFdFQlNPQ0tFVCBMSVNURU5FUlMgRk9SIE1FU1NBR0UgQU5EIFRZUElORyBOT1RJRklDQVRJT05TXG4gICAgYXBwLnNlcnZlci5vbiAnbWVzc2FnZScsIEBtZXNzYWdlX2NhbGxiYWNrLmJpbmQodGhpcylcbiAgICBhcHAuc2VydmVyLm9uICd1c2VyX29mZmxpbmUnLCBAdXNlcl9vZmZsaW5lX2NhbGxiYWNrLmJpbmQodGhpcylcbiAgICBhcHAuc2VydmVyLm9uICd0eXBpbmdfbm90aWZpY2F0aW9uJywgQHR5cGluZ19ub3RpZmljYXRpb25fY2FsbGJhY2suYmluZCh0aGlzKVxuXG4gICAgIyMgTElTVEVORVJTIEZPUiBVU0VSIElOVEVSQUNUSU9OIFdJVEggQ0hBVCBXSU5ET1dcbiAgICBAJGVsZW1lbnQuZmluZCgnLmNoYXQtY2xvc2UnKS5vbiAnY2xpY2snLCBAY2xvc2VXaW5kb3dcbiAgICBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS5vbiAna2V5cHJlc3MnLCBAc2VuZE9uRW50ZXJcbiAgICBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS5vbiAna2V5dXAnLCBAZW1pdFR5cGluZ05vdGlmaWNhdGlvblxuICAgIEAkZWxlbWVudC5maW5kKCcudG9wLWJhciwgbWluaWZ5ICcpLm9uICdjbGljaycsIEB0b2dnbGVDaGF0XG4gICAgQCRlbGVtZW50Lm9uICdjbGljaycsIEByZW1vdmVOb3RpZmljYXRpb25zXG4gICAgQCRkaXNjdXNzaW9uLmZpbmQoJy5wYXJsZXlfZmlsZV91cGxvYWQnKS5vbiAnY2hhbmdlJywgQGZpbGVfdXBsb2FkXG4gICAgY29uc29sZS5sb2coXCJ3YXkgZG93biBoZXJlXCIpXG4gIG1lc3NhZ2VfY2FsbGJhY2s6IChtZXNzYWdlKSAtPlxuICAgICAgQGNvbnZvLmFkZF9tZXNzYWdlKG1lc3NhZ2UpXG4gICAgICBAcmVuZGVyRGlzY3Vzc2lvbigpXG4gICAgICBAJGVsZW1lbnQuZmluZCgnLnRvcC1iYXInKS5hZGRDbGFzcygnbmV3LW1lc3NhZ2UnKVxuICAgICAgQHRpdGxlQWxlcnQoKVxuXG4gIHVzZXJfb2ZmbGluZV9jYWxsYmFjazogLT5cbiAgICBtZXNzYWdlID0gbmV3IE1lc3NhZ2UoIGFwcC5tZSwgJ2h0dHA6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3BhcmxleS1hc3NldHMvc2VydmVyX25ldHdvcmsucG5nJywgXCJUaGlzIHVzZXIgaXMgbm8gbG9uZ2VyIG9ubGluZVwiLCBuZXcgRGF0ZSgpIClcbiAgICBAY29udm8uYWRkX21lc3NhZ2UobWVzc2FnZSlcbiAgICBAcmVuZGVyRGlzY3Vzc2lvbigpXG5cbiAgdHlwaW5nX25vdGlmaWNhdGlvbl9jYWxsYmFjazogKGNvbnZvX2tleSwgdHlwaXN0LCBib29sKSAtPlxuICAgIGlmIGNvbnZvX2tleSBpcyBAY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgIGlmIGJvb2xcbiAgICAgICAgaWYgQCRkaXNjdXNzaW9uLmZpbmQoJy5pbmNvbWluZycpLmxlbmd0aCBpcyAwXG4gICAgICAgICAgdHlwaW5nX25vdGlmaWNhdGlvbiA9IFwiPGxpIGNsYXNzPSdpbmNvbWluZyc+PGRpdiBjbGFzcz0nYXZhdGFyJz48aW1nIHNyYz0nI3t0eXBpc3QuaW1hZ2VfdXJsfScvPjwvZGl2PjxkaXYgY2xhc3M9J21lc3NhZ2VzJz48cD4je3R5cGlzdC5kaXNwbGF5X25hbWV9IGlzIHR5cGluZy4uLjwvcD48L2Rpdj48L2xpPlwiXG4gICAgICAgICAgdGhhdC4kKCcuZGlzY3Vzc2lvbicpLmFwcGVuZCh0eXBpbmdOb3RpZmljYXRpb24pO1xuICAgICAgICAgIEAkZGlzY3Vzc2lvbi5hcHBlbmQodHlwaW5nX25vdGlmaWNhdGlvbilcbiAgICAgICAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG4gICAgICBlbHNlXG4gICAgICAgIEAkZGlzY3Vzc2lvbi5maW5kKCcuaW5jb21pbmcnKS5yZW1vdmUoKVxuICAgICAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG5cblxuICBhZGRfbWVtYmVyOiAobmV3X3VzZXIpIC0+XG4gICAgIyMgY3JlYXRlIGEgY29udmVyc2F0aW9uIGNvbnNpc3Rpbmcgb2YgY3VycmVudCBwbHVzIGFkZGVkIG1lbWJlcnNcbiAgICBuZXdfY29udm9fcGFydG5lcnMgPSBAY29udm8uY29udm9fcGFydG5lcnMuY29uY2F0KG5ld191c2VyKVxuICAgIG5ld19jb252b19ncm91cCA9IG5ldyBDb252ZXJzYXRpb24obmV3X2NvbnZvX3BhcnRuZXJzKVxuICAgIGFwcC5jb252ZXJzYXRpb25zLnB1c2gobmV3X2NvbnZvX2dyb3VwKVxuXG4gICAgIyMgcmVtb3ZlIGN1cnJlbnQgY29udm9fa2V5IGZyb20gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgIGZvciBjb252byBpbiBhcHAub3Blbl9jb252ZXJzYXRpb25zXG4gICAgICBpZiBjb252byBpcyBAY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgICAgYXBwLm9wZW5fY29udmVyc2F0aW9ucy5zcGxpY2UoaSwxKVxuXG4gICAgIyMgcHVzaCBuZXcgY29udm8gdG8gb3BlbiBjb252ZXJzYXRpb25zLCBjaGFuZ2UgQGNvbnZvIGFuZCByZS1yZW5kZXJcbiAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2gobmV3X2NvbnZvX2dyb3VwLm1lc3NhZ2VfZmlsdGVyKVxuICAgIEBjb252byA9IG5ld19jb252b19ncm91cFxuICAgIEByZW5kZXIoKVxuXG4gIHJlbmRlcjogLT5cbiAgICBAJGVsZW1lbnQgPSAkKGNoYXRfcm9vbV90ZW1wbGF0ZShAY29udm8pKVxuICAgIEAkZGlzY3Vzc2lvbiA9IEAkZWxlbWVudC5maW5kKCcuZGlzY3Vzc2lvbicpXG5cbiAgcmVuZGVyRGlzY3Vzc2lvbjogLT5cbiAgICBuZXdfbWVzc2FnZSA9IEBjb252by5tZXNzYWdlcy5zbGljZSgtMSlbMF1cbiAgICBAYXBwZW5kTWVzc2FnZShuZXdfbWVzc2FnZSlcbiAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG5cbiAgYXBwZW5kTWVzc2FnZTogKG1lc3NhZ2UpLT5cbiAgICBtZXNzYWdlX3ZpZXcgPSBuZXcgTWVzc3NhZ2VWaWV3KG1lc3NhZ2UpXG4gICAgbWVzc2FnZV92aWV3LnJlbmRlcigpXG4gICAgQCRkaXNjdXNzaW9uLmFwcGVuZChtZXNzYWdlX3ZpZXcuJGVsZW1lbnQpXG5cbiAgc2Nyb2xsVG9MYXN0TWVzc2FnZTogLT5cbiAgICBAJGRpc2N1c3Npb24uc2Nyb2xsVG9wKCBAJGRpc2N1c3Npb24uZmluZCgnbGk6bGFzdC1jaGlsZCcpLm9mZnNldCgpLnRvcCArIEAkZGlzY3Vzc2lvbi5zY3JvbGxUb3AoKSApXG5cbiAgbG9hZFBlcnNpc3RlbnRNZXNzYWdlczogLT5cbiAgICBmb3IgbWVzc2FnZSBpbiBAY29udm8ubWVzc2FnZXNcbiAgICAgIEBhcHBlbmRNZXNzYWdlKG1lc3NhZ2UpXG4gICAgaWYgQG1lc3NhZ2VzLmxlbmd0aCA+IDBcbiAgICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlKClcblxuICBzZW5kT25FbnRlcjogKGUpLT5cbiAgICBpZiBlLmtleUNvZGUgaXMgMTNcbiAgICAgIEBzZW5kTWVzc2FnZSgpXG4gICAgICBAcmVtb3ZlTm90aWZpY2F0aW9ucygpXG5cbiAgc2VuZE1lc3NhZ2U6IC0+XG4gICAgbWVzc2FnZSA9IG5ldyBNZXNzYWdlIEBjb252by5jb252b19wYXJ0bmVycywgYXBwLm1lLCBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS52YWwoKVxuICAgIEBtZXNzYWdlcy5hZGQoc2VuZClcbiAgICBAcmVuZGVyRGlzY3Vzc2lvbigpXG4gICAgYXBwLnNlcnZlci5lbWl0ICdtZXNhZ2UnLCBtZXNzYWdlXG4gICAgQCRkaXNjdXNzaW9uLmZpbmQoJy5zZW5kJykudmFsKCcnKVxuICAgIHRoaXMuZW1pdFR5cGluZ05vdGlmaWNhdGlvbigpXG5cbiAgdG9nZ2xlX2NvbnZvOiAoZSkgLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBAJGRpc2N1c3Npb24udG9nZ2xlKClcbiAgICBpZiBAJGRpc2N1c3Npb24uYXR0cignZGlzcGxheScpIGlzIG5vdCBcIm5vbmVcIlxuICAgICAgQHNjcm9sbFRvTGFzdE1lc3NhZ2VcblxuICBjbG9zZVdpbmRvdzogKGUpIC0+XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIGFwcC5zZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKClcbiAgICBAJGVsZW1lbnQuZmluZCgnLmNoYXQtY2xvc2UnKS5vZmYoKVxuICAgIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLm9mZigpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub2ZmKClcbiAgICBAJGVsZW1lbnQuZmluZCgnLnRvcC1iYXInKS5vZmYoKVxuICAgIEAkZWxlbWVudC5vZmYoKVxuICAgIEAkZGlzY3Vzc2lvbi5vZmYoKVxuICAgIEAkZWxlbWVudC5yZW1vdmUoKVxuICAgIGRlbGV0ZSB0aGlzXG5cbiAgcmVtb3ZlTm90aWZpY2F0aW9uczogKGUpIC0+XG4gICAgQCRlbGVtZW50LmZpbmQoJy50b3AtYmFyJykucmVtb3ZlQ2xhc3MoJ25ldy1tZXNzYWdlJylcbiAgICBpZiBhcHAudGl0bGVfbm90aWZpY2F0aW9uLm5vdGlmaWVkXG4gICAgICBAY2xlYXJUaXRsZU5vdGlmaWNhdGlvbigpXG5cbiAgZW1pdFR5cGluZ05vdGlmaWNhdGlvbjogKGUpIC0+XG4gICAgaWYgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykudmFsKCkgaXNudCBcIlwiXG4gICAgICBhcHAuc2VydmVyLmVtaXQgJ3VzZXJfdHlwaW5nJywgQGNvbnZvLmNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMsIGFwcC5tZSwgdHJ1ZVxuICAgIGVsc2VcbiAgICAgIGFwcC5zZXJ2ZXIuZW1pdCAndXNlcl90eXBpbmcnLCBAY29udm8uY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscywgYXBwLm1lLCBmYWxzZVxuXG4gIGNsZWFyVGl0bGVOb3RpZmljYXRpb246IC0+XG4gICAgYXBwLmNsZWFyQWxlcnQoKVxuICAgICQoJ2h0bWwgdGl0bGUnKS5odG1sKCBhcHAudGl0bGVfbm90aWZpY2F0aW9uLnBhZ2VfdGl0bGUgKVxuICAgIGFwcC50aXRsZV9ub3RpZmljYXRpb24ubm90aWZpZWQgPSBmYWxzZVxuXG4gIHRpdGxlQWxlcnQ6IC0+XG4gICAgaWYgbm90IGFwcC50aXRsZV9ub3RpZmljYXRpb24ubm90aWZpZWRcbiAgICAgIHNlbmRlcl9uYW1lID0gQGNvbnZvLm1lc3NhZ2VzWy0xXS5zZW5kZXIuZGlzcGxheV9uYW1lXG4gICAgICBhbGVydCA9IFwiUGVuZGluZyAqKiAje3NlbmRlcl9uYW1lfVwiXG5cbiAgICAgIHNldEFsZXJ0ID0gLT5cbiAgICAgICAgaWYgJCgnaHRtbCB0aXRsZScpLmh0bWwoKSBpcyBhcHAudGl0bGVfbm90aWZpY2F0aW9uLnBhZ2VfdGl0bGVcbiAgICAgICAgICAkKCdodG1sIHRpdGxlJykuaHRtbChhbGVydClcbiAgICAgICAgZWxzZVxuICAgICAgICAgICQoJ2h0bWwgdGl0bGUnKS5odG1sKCBhcHAudGl0bGVfbm90aWZpY2F0aW9uLnBhZ2VfdGl0bGUpXG5cbiAgICAgIHRpdGxlX2FsZXJ0ID0gc2V0SW50ZXJ2YWwoc2V0QWxlcnQsIDIyMDApXG5cbiAgICAgIGFwcC5jbGVhcl9hbGVydCA9IC0+XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGl0bGVfYWxlcnQpXG5cbiAgICAgIGFwcC50aXRsZV9ub3RpZmljYXRpb24ubm90aWZpZWQgPSB0cnVlXG5cbiAgZmlsZV91cGxvYWQ6IC0+XG4gICAgZmlsZSA9IEAkZGlzY3Vzc2lvbi5maW5kKCcucGljdHVyZV91cGxvYWQnKS5nZXQoMCkuZmlsZXNbMF1cbiAgICBhcHAub2F1dGguZmlsZV91cGxvYWQgZmlsZSwgQGNvbnZvLmNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMsIGFwcC5tZS5pbWFnZV91cmxcblxuXG5tb2R1bGUuZXhwb3J0cyA9IENoYXRSb29tXG4iLCJhcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuVXNlclZpZXcgPSByZXF1aXJlKCcuL3VzZXJfdmlldy5jb2ZmZWUnKVxuUGVyc2lzdGVudENvbnZlcnNhdGlvblZpZXcgPSByZXF1aXJlKCcuL3BlcnNpc3RlbnRfY29udmVyc2F0aW9uX3ZpZXcuY29mZmVlJylcbmxvZ2dlZF9vdXRfdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9sb2dnZWRfb3V0LmhicycpXG5sb2dnZWRfaW5fdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9sb2dnZWRfaW4uaGJzJylcbnByb2ZpbGVfdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9wcm9maWxlLmhicycpXG5cblxuXG4jIENvbnRyb2wgUGFuZWwgZm9yIFBhcmxleS5qc1xuIyBUaGlzIGlzIHRoZSBvbmx5IHZpZXcgdGhhdCBjYW5ub3QgYmUgcmVtb3ZlZC5cbiMgSXQgaXMgdGhlIGh1YiBmb3IgYWxsIGludGVyYWN0aW9uLlxuY2xhc3MgQ29tbWFuZENlbnRlclxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBAbWVudSA9IFwiZGVmYXVsdFwiXG4gICAgJCgnYm9keScpLmFwcGVuZCBsb2dnZWRfb3V0X3RlbXBsYXRlKClcbiAgICAkKFwidWwubG9naW4tYmFyXCIpLmhpZGUoKVxuICAgICQoJy5wYXJsZXkgLnBlcnNpc3RlbnQtYmFyLmxvZ2dlZC1vdXQnKS5vbiAnY2xpY2snLCAoZSkgLT4gJCgndWwubG9naW4tYmFyJykudG9nZ2xlKClcblxuICBsb2dfaW46IC0+XG4gICAgJChcIi5wYXJsZXkgLnBlcnNpc3RlbnQtYmFyLmxvZ2dlZF9vdXRcIikub2ZmKClcbiAgICBAJGVsZW1lbnQgPSAkKGxvZ2dlZF9pbl90ZW1wbGF0ZShhcHAubWUpKVxuICAgICQoJy5wYXJsZXkgc2VjdGlvbi5jb250cm9sbGVyJykuaHRtbChAJGVsZW1lbnQpXG4gICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci1iYXIgYS5tZXNzYWdlcycpLm9uICdjbGljaycsIEB0b2dnbGVfcGVyc2lzdGVudF9jb252b3MuYmluZCh0aGlzKVxuICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItYmFyIGEuYWN0aXZlLXVzZXJzJykub24gJ2NsaWNrJywgQHRvZ2dsZV9jdXJyZW50X3VzZXJzLmJpbmQodGhpcylcbiAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLWJhciBhLnVzZXItc2V0dGluZ3MnKS5vbiAnY2xpY2snLCBAdG9nZ2xlX3VzZXJfc2V0dGluZ3MuYmluZCh0aGlzKVxuXG4gIHRvZ2dsZV9jb21tYW5kX2NlbnRlcjogKGUpLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAjIyBJZiBhIHVzZXIgaXMgbG9nZ2VkIGluIHRoZXkgZ2V0IGEgZGVmYXVsdCBwcm9maWxlIHZpZXdcbiAgICAjIyBvdGhlcndpc2UgYSBsb2dpbiB3aXRoIGdvb2dsZSBhcHBlYXJzLlxuICAgIGlmIGxvZ2dlZF9vdXRcbiAgICAgICQoIFwiLnBlcnNpc3RlbnQtYmFyLmxvZ2dlZC1vdXRcIiApLm9uIFwiY2xpY2tcIiwgLT5cbiAgICAgICAgJCggXCIjbG9nLWNsaWNrXCIgKS50b2dnbGUoKVxuICAgICAgICAkKCBcInVsLmxvZ2luLWJhclwiICkuc2xpZGVUb2dnbGUoKVxuICAgIGVsc2VcbiAgICAgICQgLT5cbiAgICAgICAgJCgnLnBlcnNpc3RlbnQtYmFyJykub24gJ2NsaWNrJywgLT5cbiAgICAgICAgICAkKCcuY29udHJvbGxlci12aWV3JykudG9nZ2xlKClcblxuICB0b2dnbGVfY3VycmVudF91c2VyczogKGUpLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBpZiBAbWVudSBpc250IFwiY3VycmVudF91c2Vyc1wiXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgICBmb3IgdXNlciBpbiBhcHAuY3VycmVudF91c2Vyc1xuICAgICAgICB2aWV3ID0gbmV3IFVzZXJWaWV3KHVzZXIpXG4gICAgICAgIHZpZXcucmVuZGVyKClcbiAgICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuYXBwZW5kKHZpZXcuJGVsZW1lbnQpXG4gICAgICBAbWVudSA9IFwiY3VycmVudF91c2Vyc1wiXG4gICAgZWxzZVxuICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuY2hpbGRyZW4oKS5yZW1vdmUoKVxuICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuaHRtbChwcm9maWxlX3RlbXBsYXRlKGFwcC5tZSkpXG4gICAgICBAbWVudSA9IFwiZGVmYXVsdFwiXG5cbiAgdG9nZ2xlX3BlcnNpc3RlbnRfY29udm9zOiAoZSktPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGlmIEBtZW51IGlzbnQgXCJwZXJzaXN0ZW50X2NvbnZvc1wiXG4gICAgICAkKFwiLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3XCIpLmNoaWxkcmVuKCkucmVtb3ZlKClcbiAgICAgIGZvciBjb252byBpbiBhcHAuY29udmVyc2F0aW9uc1xuICAgICAgICB2aWV3ID0gbmV3IFBlcnNpc3RlbnRDb252ZXJzYXRpb25WaWV3KGNvbnZvKVxuICAgICAgICB2aWV3LnJlbmRlcigpXG4gICAgICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmFwcGVuZCh2aWV3LiRlbGVtZW50KVxuICAgICAgQG1lbnUgPSBcInBlcnNpc3RlbnRfY29udm9zXCJcbiAgICBlbHNlXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5odG1sKHByb2ZpbGVfdGVtcGxhdGUoYXBwLm1lKSlcbiAgICAgIEBtZW51ID0gXCJkZWZhdWx0XCJcblxuXG4gIHRvZ2dsZV91c2VyX3NldHRpbmdzOiAtPlxuXG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IENvbW1hbmRDZW50ZXIoKVxuXG4iLCJhcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuXG4jIyBjb25zdHJ1Y3RvciBmb3IgY29udmVyc2F0aW9ucyBvYmplY3RzIHRoYXQgcmVwcmVzZW50IGFsbCByZWxldmFudFxuIyMgZGF0YSBhbmQgbG9naWMgcGVydGFpbmluZyB0byBtYW5hZ2luZyBhIGNvbnZlcnNhdGlvblxuIyMgaW5jbHVkaW5nIGEgY29sbGVjdGlvbiBvZiBtZXNzYWdlIG9iamVjdHMuXG5jbGFzcyBDb252ZXJzYXRpb25cblxuICBjb25zdHJ1Y3RvcjogKEBjb252b19wYXJ0bmVycywgQG1lc3NhZ2VzPVtdKSAtPlxuICAgIEBnZW5lcmF0ZV9tZXNzYWdlX2ZpbHRlcigpXG4gICAgQGZpcnN0X25hbWVfbGlzdCA9IFwiXCJcbiAgICBAY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscyA9IFtdXG5cbiAgICBmb3IgdXNlciwgaSBpbiBAY29udm9fcGFydG5lcnNcbiAgICAgIGZpcnN0X25hbWUgPSB1c2VyLmRpc3BsYXlfbmFtZS5tYXRjaCgvXltBLXpdKy8pXG4gICAgICBpZiBpIGlzbnQgQGNvbnZvX3BhcnRuZXJzLmxlbmd0aFxuICAgICAgICBAZmlyc3RfbmFtZV9saXN0ICs9IFwiI3tmaXJzdF9uYW1lfSwgXCJcbiAgICAgICAgQGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMgKz0gdXNlci5pbWFnZV91cmxcbiAgICAgIGVsc2VcbiAgICAgICAgQGZpcnN0X25hbWVfbGlzdCArPSBcIiN7Zmlyc3RfbmFtZX1cIlxuICAgICAgICBAY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscyArPSB1c2VyLmltYWdlX3VybFxuXG4gIGFkZF9tZXNzYWdlOiAobWVzc2FnZSkgLT5cbiAgICBAbWVzc2FnZXMucHVzaCBtZXNzYWdlXG5cbiAgZ2VuZXJhdGVfbWVzc2FnZV9maWx0ZXI6IC0+XG4gICAgQG1lc3NhZ2VfZmlsdGVyID0gW2FwcC5tZS5pbWFnZV91cmxdXG4gICAgZm9yIHBhcnRuZXIgaW4gQGNvbnZvX3BhcnRuZXJzXG4gICAgICBAbWVzc2FnZV9maWx0ZXIucHVzaCBwYXJ0bmVyLmltYWdlX3VybFxuICAgIEBtZXNzYWdlX2ZpbHRlci5zb3J0KCkuam9pbigpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBDb252ZXJzYXRpb25cbiIsImFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgdGhhdCBjb250YWlucyBhbGwgbG9naWMgYW5kIGRhdGFcbiMjIGFzc29jaWF0ZWQgd2l0aCBpbmRpdmlkdWFsIG1lc3NhZ2VzXG5cbmNsYXNzIE1lc3NhZ2VcblxuICBjb25zdHJ1Y3RvcjogKEByZWNpcGllbnRzLCBAc2VuZGVyLCBAY29udGVudCwgQHRpbWVfc3RhbXApIC0+XG4gICAgaWYgbm90IEB0aW1lX3N0YW1wXG4gICAgICBAdGltZV9zdGFtcCA9IG5ldyBEYXRlKCkudG9VVENTdHJpbmcoKVxuICAgIEBjb252b19pZCA9IEByZWNpcGllbnRzLmNvbmNhdChAc2VuZGVyKS5zb3J0KCkuam9pbigpXG4gICAgQHRpbWVfY3JlYXRlZCA9IG5ldyBEYXRlKEB0aW1lX3N0YW1wKVxuXG4gIHRpbWVfZWxhcHNlZDogLT5cbiAgICBAY3VycmVudF90aW1lID0gbmV3IERhdGUoKVxuICAgICMjIENvbnZlcnQgdG8gbWludXRlc1xuICAgIG1pbnV0ZXMgPSBNYXRoLmZsb29yKCggY3VycmVudF90aW1lIC0gdGltZV9jcmVhdGVkKSAvIDYwMDAwIClcbiAgICAjIyBkZXRlcm1pbmUgaWYgdG9kYXlcbiAgICBpZiBjdXJyZW50X3RpbWUuZ2V0RGF0ZSgpIGlzIHRpbWVfY3JlYXRlZC5nZXREYXRlKCkgYW5kIG1pbnV0ZXMgPCAxNDQwXG4gICAgICB0b2RheSA9IHRydWVcbiAgICAjIyBDb252ZXJ0IHRvIGhvdXJzXG4gICAgaG91cnMgPSBNYXRoLmZsb29yKChtaW51dGVzIC8gNjAgKSlcbiAgICBtaW51dGVfcmVtYWluZGVyID0gTWF0aC5mbG9vcigobWludXRlcyAlIDYwICkpXG4gICAgIyMgZm9ybWF0IG1lc3NhZ2VcbiAgICBpZiBtaW51dGVzIDwgNjBcbiAgICAgIHJldHVybiBcIiN7bWludXRlc30gbWlucyBhZ29cIlxuICAgIGlmIGhvdXJzIDwgNFxuICAgICAgaWYgbWludXRlX3JlbWFpbmRlciBpcyAwXG4gICAgICAgIHJldHVybiBcIiN7aG91cnN9IGhvdXJzIGFnb1wiXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBcIiN7aG91cnN9IGhvdXIgI3ttaW51dGVfcmVtYWluZGVyfSBtaW4gYWdvXCJcbiAgICBlbHNlXG4gICAgICAjIyBsb25nIHRlcm0gbWVzc2FnZSBmb3JtYXRcbiAgICAgIGZfZGF0ZSA9IEBkYXRlX2Zvcm1hdHRlcigpXG4gICAgICBpZiB0b2RheVxuICAgICAgICByZXR1cm4gXCIje2ZfZGF0ZS5ob3VyfToje2ZfZGF0ZS5taW51dGVzfSAje2ZfZGF0ZS5zdWZmaXh9XCJcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIFwiI3tmX2RhdGUubW9udGh9ICN7Zl9kYXRlLmRheX0gfCAje2ZfZGF0ZS5ob3VyfToje2ZfZGF0ZS5taW51dGVzfSAje2ZfZGF0ZS5zdWZmaXh9XCJcblxuICBkYXRlX2Zvcm1hdHRlcjogLT5cbiAgICAjIyBmb3JtYXRzIGRhdGUgZm9yIEB0aW1lX2VsYXBzZWQgZnVuY3Rpb25cblxuICAgIHN3aXRjaCBAdGltZV9jcmVhdGVkLmdldE1vbnRoKClcbiAgICAgIHdoZW4gMCB0aGVuIG5ld19tb250aCA9IFwiSmFuXCJcbiAgICAgIHdoZW4gMSB0aGVuIG5ld19tb250aCA9IFwiRmViXCJcbiAgICAgIHdoZW4gMiB0aGVuIG5ld19tb250aCA9IFwiTWFyXCJcbiAgICAgIHdoZW4gMyB0aGVuIG5ld19tb250aCA9IFwiQXByXCJcbiAgICAgIHdoZW4gNCB0aGVuIG5ld19tb250aCA9IFwiTWF5XCJcbiAgICAgIHdoZW4gNSB0aGVuIG5ld19tb250aCA9IFwiSnVuXCJcbiAgICAgIHdoZW4gNiB0aGVuIG5ld19tb250aCA9IFwiSnVsXCJcbiAgICAgIHdoZW4gNyB0aGVuIG5ld19tb250aCA9IFwiQXVnXCJcbiAgICAgIHdoZW4gOCB0aGVuIG5ld19tb250aCA9IFwiU2VwXCJcbiAgICAgIHdoZW4gOSB0aGVuIG5ld19tb250aCA9IFwiT2N0XCJcbiAgICAgIHdoZW4gMTAgdGhlbiBuZXdfbW9udGggPSBcIk5vdlwiXG4gICAgICB3aGVuIDExIHRoZW4gbmV3X21vbnRoID0gXCJEZWNcIlxuXG4gICAgaG91cnMgPSBAdGltZV9jcmVhdGVkLmdldEhvdXJzKClcbiAgICBpZiBob3VycyA+IDEyXG4gICAgICBzdWZmaXggPSBcIlBNXCJcbiAgICAgIG5ld19ob3VyID0gaG91cnMgLSAxMlxuICAgIGVsc2VcbiAgICAgIHN1ZmZpeCA9IFwiQU1cIlxuICAgICAgbmV3X2hvdXIgPSBob3Vyc1xuXG4gICAgbWludXRlcyA9IEB0aW1lX2NyZWF0ZWQuZ2V0TWludXRlcygpXG4gICAgaWYgbWludXRlcyA8IDEwXG4gICAgICBuZXdfbWludXRlcyA9IFwiMCN7bWludXRlc31cIlxuICAgIGVsc2VcbiAgICAgIG5ld19taW51dGVzID0gXCIje21pbnV0ZXN9XCJcblxuICAgIGZvcm1hdGVkID1cbiAgICAgIG1vbnRoOiBuZXdfbW9udGhcbiAgICAgIGRheTogQHRpbWVfY3JlYXRlZC5nZXREYXRlKClcbiAgICAgIGhvdXI6IG5ld19ob3VyXG4gICAgICBtaW51dGVzOiBuZXdfbWludXRlc1xuICAgICAgc3VmZml4OiBzdWZmaXhcblxubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlXG5cblxuIiwiXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxubWVzc2FnZV90ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdGVtcGxhdGVzL21lc3NhZ2UuaGJzJylcbkhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYnNmeS9ydW50aW1lJylcbiMjIEhBTkRMRUJBUiBIRUxQRVIgRlVOQ1RJT04gRk9SIENBTENVTEFUSU5HIFRJTUUgU0lOQ0UgTUVTU0FHRSBDUkVBVElPTlxuSGFuZGxlYmFycy5yZWdpc3RlckhlbHBlciAnY2FsY3VsYXRlX3RpbWUnLCAtPlxuICB0aGlzLnRpbWVfZWxhcHNlZCgpXG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgdGhhdCBjb250YWlucyB0ZW1wbGF0ZSBkYXRhXG4jIyBhbmQgaW50ZXJhY3Rpb24gbG9naWMgZm9yIGluZGl2aWR1YWwgbWVzc2FnZSBtb2RlbHNcbmNsYXNzIE1lc3NhZ2VWaWV3XG5cbiAgY29uc3RydWN0b3I6IChAbWVzc2FnZSkgLT5cblxuXG4gIHJlbmRlcjogLT5cbiAgICAjIyByZW5kZXJzIHRlbXBsYXRlIGRpZmZlcmVudGx5IGlmIHVzZXIgaXMgc2VuZGluZyBvciByZWNpZXZpbmcgdGhlIG1lc3NhZ2VcbiAgICBpZiBAbWVzc2FnZS5zZW5kZXIuaW1hZ2VfdXJsIGlzIGFwcC5tZS5pbWFnZV91cmxcbiAgICAgIEAkZWxlbWVudCA9ICQoJzxsaSBjbGFzcz1cInNlbGZcIj48L2xpPicpLmFwcGVuZChtZXNzYWdlX3RlbXBsYXRlKEBtZXNzYWdlKSlcbiAgICBlbHNlXG4gICAgICBAJGVsZW1lbnQgPSAkKCc8bGkgY2xhc3M9XCJvdGhlclwiPjwvbGk+JykuYXBwZW5kKG1lc3NhZ2VfdGVtcGxhdGUoQG1lc3NhZ2UpKVxuXG5tb2R1bGUuZXhwb3J0cyA9IE1lc3NhZ2VWaWV3IiwiXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuVXNlciA9IHJlcXVpcmUoJy4vdXNlcl9tb2RlbC5jb2ZmZWUnKVxuTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZV9tb2RlbC5jb2ZmZWUnKVxuXG5cbiMjIEFsbCBsb2dpYyByZWxhdGluZyB0byBsb2dpbmcgaW4gdGhyb3VnaCBHb29nbGUgUGx1cyBPYXV0aFxuIyMgYW5kIGFueSBsb2dpYyB1c2VkIGZvciByZXRyaWV2aW5nIGluZm9ybWF0aW9uIHJlcXVpcmluZyBhbiBhY2Nlc3MgdG9rZW4uXG5jbGFzcyBPYXV0aFxuXG4gIGNvbnN0cnVjdG9yOiAtPlxuXG4gIHdpbmRvdy5zaWduX2luX2NhbGxiYWNrID0gKGF1dGhSZXN1bHQpID0+XG4gICAgaWYgYXV0aFJlc3VsdC5zdGF0dXMuc2lnbmVkX2luXG4gICAgICAjIyB1cGRhdGUgdGhlIGFwcCB0byByZWZsZWN0IHRoZSB1c2VyIGlzIHNpZ25lZCBpbi5cbiAgICAgIGdhcGkuY2xpZW50LmxvYWQgJ3BsdXMnLCAndjEnLCA9PlxuICAgICAgICByZXF1ZXN0ID0gZ2FwaS5jbGllbnQucGx1cy5wZW9wbGUuZ2V0KHsndXNlcklkJzogJ21lJ30pXG4gICAgICAgIHJlcXVlc3QuZXhlY3V0ZSAocHJvZmlsZSkgPT5cbiAgICAgICAgICBkaXNwbGF5X25hbWUgPSBwcm9maWxlLmRpc3BsYXlOYW1lXG4gICAgICAgICAgaW1hZ2VfdXJsID0gcHJvZmlsZS5pbWFnZS51cmxcbiAgICAgICAgICBhcHAubWUgPSBuZXcgVXNlciBkaXNwbGF5X25hbWUsIGltYWdlX3VybFxuICAgICAgICAgIGFwcC5zZXJ2ZXIuZW1pdCgnam9pbicsIGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsKVxuICAgICAgICAgIGFwcC5jb21tYW5kX2NlbnRlci5sb2dfaW4oKVxuICAgICAgQGZpbGVfdXBsb2FkID0gKGZpbGUsIHJJRHMsIHNJRCkgLT5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICB1cmw6IFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vdXBsb2FkL3N0b3JhZ2UvdjFiZXRhMi9iL3BhcmxleS1pbWFnZXMvbz91cGxvYWRUeXBlPW1lZGlhJm5hbWU9I3tmaWxlLm5hbWV9XCJcbiAgICAgICAgICB0eXBlOiBcIlBPU1RcIlxuICAgICAgICAgIGRhdGE6IGZpbGVcbiAgICAgICAgICBjb250ZW50VHlwZTogZmlsZS50eXBlXG4gICAgICAgICAgcHJvY2Vzc0RhdGE6IGZhbHNlXG4gICAgICAgICAgaGVhZGVyczpcbiAgICAgICAgICAgIEF1dGhvcml6YXRpb246IFwiQmVhcmVyICN7YXV0aFJlc3VsdC5hY2Nlc3NfdG9rZW59XCJcbiAgICAgICAgICBzdWNjZXNzOiAocmVzKSA9PlxuICAgICAgICAgICAgaW1hZ2Vfc3JjPSBcImh0dHBzOi8vc3RvcmFnZS5jbG91ZC5nb29nbGUuY29tL3BhcmxleS1pbWFnZXMvI3tyZXMubmFtZX1cIlxuICAgICAgICAgICAgbXNnID0gXCI8aW1nIHNyYz0je2ltYWdlX3NyY30gLz5cIlxuICAgICAgICAgICAgYXBwLnNlcnZlci5lbWl0KCdtZXNzYWdlJywgbXNnLCBySURzLCBzSUQpXG4gICAgICAgICAgICBtZXNzYWdlID0gbmV3IE1lc3NhZ2UgcklEcywgc0lELCBtc2dcbiAgICAgICAgICAgIEBjb252by5tZXNzYWdlcy5hZGRfbWVzc2FnZShtZXNzYWdlKVxuICAgICAgICAgICAgQHJlbmRlcigpXG4gICAgICAgIH0pXG4gICAgZWxzZVxuICAgICAgIyMgbG9naW4gdW5zdWNjZXNzZnVsIGxvZyBlcnJvciB0byB0aGUgY29uc29sZVxuICAgICAgIyNQb3NzaWJsZSBlcnJvciB2YWx1ZXM6XG4gICAgICAjI1widXNlcl9zaWduZWRfb3V0XCIgLSBVc2VyIGlzIHNpZ25lZC1vdXRcbiAgICAgICMjXCJhY2Nlc3NfZGVuaWVkXCIgLSBVc2VyIGRlbmllZCBhY2Nlc3MgdG8geW91ciBhcHBcbiAgICAgICMjXCJpbW1lZGlhdGVfZmFpbGVkXCIgLSBDb3VsZCBub3QgYXV0b21hdGljYWxseSBsb2cgaW4gdGhlIHVzZXJcbiAgICAgIGNvbnNvbGUubG9nKFwiU2lnbi1pbiBzdGF0ZTogI3thdXRoUmVzdWx0LmVycm9yfVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBPYXV0aCgpIiwiYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcbkNoYXRSb29tID0gcmVxdWlyZSgnLi9jaGF0X3Jvb21fdmlldy5jb2ZmZWUnKVxuSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMnKVxucGVyc2lzdGVudF9jb252b19yZWcgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9wZXJzaXN0ZW50X2NvbnZvX3JlZy5oYnMnKVxuSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKVxuXG4jIyBIQU5ETEVCQVJTIEhFTFBFUiBGVU5DVElPTlMgRk9SIFBFUlNJU1RFTlQgTUVTU0FHRSBURU1QTEFURVxuSGFuZGxlYmFycy5yZWdpc3RlckhlbHBlciAncmV0cmlldmVfaW1hZ2UnLCAtPlxuICB0aGlzLmNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHNbMF1cbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgJ3JldHJpZXZlX2xhc3RfbWVzc2FnZScsIC0+XG4gIHRoaXMubWVzc2FnZXNbLTFdLmNvbnRlbnRcbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgJ2NhbGN1bGF0ZV9sYXN0X21lc3NhZ2VfdGltZScsIC0+XG4gIHRoaXMubWVzc2FnZXNbLTFdLnRpbWVfZWxhcHNlZCgpXG5cbiMjIFRoaXMgaXMgdGhlIGNvbnN0cnVjdG9yIGZvciBlYWNoIHBlcnNpc3RlbnQgbWVzc2FnZSBpbiB0aGUgbGlzdCB2aWV3XG4jIyBpdCBjb250YWlucyB0aGUgdGVtcGxhdGUgYW5kbG9naWMgZm9yIHJlbmRlcmluZyB0aGUgbGlzdCB0aGF0IGFwcGVhcnMgaW5cbiMjIGJvdGggdGhlIGNoYXQgd2luZG93IGFuZCBjb21tYW5kIGNlbnRlciB2aWV3cyBhbmQgdGhlIGNvcnJlc3BvbmRpbmcgdXNlciBpbnRlcmFjdGlvbiBsb2dpYy5cbmNsYXNzIFBlcnNpc3RlbnRDb252ZXJzYXRpb25WaWV3XG5cbiAgY29uc3RydWN0b3I6IChAY29udm8pIC0+XG4gICAgQCRlbGVtZW50Lm9uICdjbGljaycsIEBsb2FkX2NvbnZvXG5cbiAgICByZW5kZXI6IC0+XG4gICAgICBAJGVsZW1lbnQgPSAkKHBlcnNpc3RlbnRfY29udm9fcmVnKEBjb252bykpXG5cblxuICAgIGxvYWRfY29udm86IC0+XG4gICAgICAjIyBpZiBjb252byBpc24ndCBvcGVuIGxvYWQgbmV3IGNoYXQgd2luZG93IHdpdGggY29udm9cbiAgICAgIGNvbnZvX3N0YXR1cyA9ICdjbG9zZWQnXG4gICAgICBmb3IgY29udm8gaW4gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgICAgICBpZiBAY29udm8ubWVzc2FnZV9maWx0ZXIgaXMgY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgICAgICBjb252b19zdGF0dXMgPSAnb3BlbidcblxuICAgICAgaWYgY29udm9fc3RhdHVzIGlzbnQgJ29wZW4nXG4gICAgICAgIGNoYXRfd2luZG93ID0gbmV3IENoYXRSb29tKEBjb252bylcbiAgICAgICAgYXBwLm9wZW5fY29udmVyc2F0aW9ucy5wdXNoKEBjb252by5tZXNzYWdlX2ZpbHRlcilcblxuICAgICAgICAjIyBjaGVjayBhbmQgc2VlIGlmIGFjdGlvbiBpcyBpbiBjb21tYW5kIGNlbnRlciBvciBjaGF0IHdpbmRvd1xuICAgICAgICBpZiBub3QgQCRlbGVtZW50LnBhcmVudCgpWzBdLmhhc0NsYXNzKCdjb250cm9sbGVyLXZpZXcnKVxuICAgICAgICAgIEAkZWxlbWVudC5wYXJlbnRzKCdkaXYucGFybGV5JykucmVtb3ZlKClcblxubW9kdWxlLmV4cG9ydHMgPSBQZXJzaXN0ZW50Q29udmVyc2F0aW9uVmlldyIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwicGFybGV5XFxcIj5cXG4gIDxzZWN0aW9uIGNsYXNzPVxcXCJjb252ZXJzYXRpb25cXFwiPlxcbiAgICA8ZGl2IGNsYXNzPVxcXCJ0b3AtYmFyXFxcIj5cXG4gICAgICA8YT5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuZmlyc3RfbmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5maXJzdF9uYW1lKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIjwvYT5cXG4gICAgICA8dWwgY2xhc3M9XFxcIm1lc3NhZ2UtYWx0XFxcIj5cXG4gICAgICAgIDxsaSBjbGFzcz1cXFwiZW50eXBvLW1pbnVzIG1pbmlmeVxcXCI+PC9saT5cXG4gICAgICAgIDxsaSBjbGFzcz1cXFwiZW50eXBvLXJlc2l6ZS1mdWxsXFxcIj48L2xpPlxcbiAgICAgICAgPGxpIGNsYXNzPVxcXCJlbnR5cG8tY2FuY2VsIGNoYXQtY2xvc2VcXFwiPjwvbGk+XFxuICAgICAgPC91bD5cXG4gICAgPC9kaXY+XFxuICAgIDxkaXYgY2xhc3M9XFxcIm1lc3NhZ2UtYmFyXFxcIj5cXG4gICAgICA8dWwgY2xhc3M9XFxcImFkZGl0aW9uYWxcXFwiPlxcbiAgICAgICAgPGxpPjxhIGNsYXNzPVxcXCJlbnR5cG8tdXNlci1hZGRcXFwiPjwvYT48L2xpPlxcbiAgICAgICAgPGxpPjxhIGNsYXNzPVxcXCJmb250YXdlc29tZS1mYWNldGltZS12aWRlb1xcXCI+PC9hPjwvbGk+XFxuICAgICAgPC91bD5cXG4gICAgICA8dWwgY2xhc3M9XFxcImV4aXN0aW5nXFxcIj5cXG4gICAgICAgIDxsaT48YSBjbGFzcz1cXFwiZW50eXBvLWNoYXRcXFwiPjwvYT48L2xpPlxcbiAgICAgIDwvdWw+XFxuICAgIDwvZGl2PlxcbiAgICA8b2wgY2xhc3M9XFxcImRpc2N1c3Npb25cXFwiPjwvb2w+XFxuICAgIDx0ZXh0YXJlYSBjbGFzcz1cXFwiZ3J3IHNlbmRcXFwiIHBsYWNlaG9sZGVyPVxcXCJFbnRlciBNZXNzYWdlLi4uXFxcIj48L3RleHRhcmVhPlxcbiAgICA8bGFiZWwgY2xhc3M9XFxcImltZ191cGxvYWQgZW50eXBvLWNhbWVyYVxcXCI+XFxuICAgICAgPHNwYW4+XFxuICAgICAgICA8aW5wdXQgY2xhc3M9XFxcInBhcmxleV9maWxlX3VwbG9hZFxcXCIgbmFtZT1cXFwiaW1nX3VwbG9hZFxcXCIgdHlwZT1cXFwiZmlsZVxcXCIgLz48L2xhYmVsPlxcbiAgICAgIDwvc3Bhbj5cXG4gIDwvc2VjdGlvbj5cXG48L2Rpdj5cIjtcbiAgcmV0dXJuIGJ1ZmZlcjtcbiAgfSk7XG4iLCIvLyBoYnNmeSBjb21waWxlZCBIYW5kbGViYXJzIHRlbXBsYXRlXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKTtcbm1vZHVsZS5leHBvcnRzID0gSGFuZGxlYmFycy50ZW1wbGF0ZShmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgaGVscGVyLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbjtcblxuXG4gIGJ1ZmZlciArPSBcIjxkaXYgY2xhc3M9XFxcImF2YXRhclxcXCI+XFxuICA8aW1nIHNyYz0gXCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmltYWdlX3VybCkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5pbWFnZV91cmwpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiIC8+XFxuPC9kaXY+XFxuPGRpdiBjbGFzcz1cXFwiY29udGVudFxcXCI+XFxuICA8aDI+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmRpc3BsYXlfbmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5kaXNwbGF5X25hbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9oMj5cXG48L2Rpdj5cXG5cIjtcbiAgcmV0dXJuIGJ1ZmZlcjtcbiAgfSk7XG4iLCIvLyBoYnNmeSBjb21waWxlZCBIYW5kbGViYXJzIHRlbXBsYXRlXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKTtcbm1vZHVsZS5leHBvcnRzID0gSGFuZGxlYmFycy50ZW1wbGF0ZShmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgaGVscGVyLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbjtcblxuXG4gIGJ1ZmZlciArPSBcIjxkaXYgY2xhc3M9XFxcImNvbnRyb2xsZXItdmlld1xcXCI+XFxuICA8ZGl2IGNsYXNzPVxcXCJkZWZhdWx0LXZpZXdcXFwiPlxcbiAgICA8ZmlndXJlPlxcbiAgICAgIDxpbWcgc3JjPVwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5pbWFnZV91cmwpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuaW1hZ2VfdXJsKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIiAvPlxcbiAgICAgIDxoMj5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuZGlzcGxheV9uYW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmRpc3BsYXlfbmFtZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L2gyPlxcbiAgICA8L2ZpZ3VyZT5cXG4gIDwvZGl2PlxcbjwvZGl2PlxcbjxkaXYgY2xhc3M9XFxcImNvbnRyb2xsZXItYmFyXFxcIj5cXG4gIDx1bCBjbGFzcz1cXFwidXRpbGl0eS1iYXIgaG9yaXpvbnRhbC1saXN0XFxcIj5cXG4gICAgPGxpPlxcbiAgICAgIDxhIGNsYXNzPVxcXCJtZXNzYWdlc1xcXCIgaHJlZj1cXFwiI1xcXCI+XFxuICAgICAgICA8c3BhbiBjbGFzcz1cXFwiZW50eXBvLWNoYXRcXFwiPjwvc3Bhbj5cXG4gICAgICA8L2E+XFxuICAgIDwvbGk+XFxuICAgIDxsaT5cXG4gICAgICA8YSBjbGFzcz1cXFwiYWN0aXZlLXVzZXJzXFxcIiBocmVmPVxcXCIjXFxcIj5cXG4gICAgICAgIDxzcGFuIGNsYXNzPVxcXCJlbnR5cG8tdXNlcnNcXFwiPjwvc3Bhbj5cXG4gICAgICA8L2E+XFxuICAgIDwvbGk+XFxuICAgIDxsaT5cXG4gICAgICA8YSBjbGFzcz1cXFwidXNlci1zZXR0aW5nc1xcXCIgaHJlZj1cXFwiI1xcXCI+XFxuICAgICAgICA8c3BhbiBjbGFzcz1cXFwiZm9udGF3ZXNvbWUtY29nXFxcIj48L3NwYW4+XFxuICAgICAgPC9hPlxcbiAgICA8L2xpPlxcbiAgPC91bD5cXG4gIDxkaXYgY2xhc3M9XFxcInBlcnNpc3RlbnQtYmFyXFxcIj5cXG4gICAgPGE+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmRpc3BsYXlfbmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5kaXNwbGF5X25hbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9hPlxcbiAgICA8c3BhbiBjbGFzcz1cXFwiZm9udGF3ZXNvbWUtcmVvcmRlclxcXCI+PC9zcGFuPlxcbiAgPC9kaXY+XFxuPC9kaXY+XCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH0pO1xuIiwiLy8gaGJzZnkgY29tcGlsZWQgSGFuZGxlYmFycyB0ZW1wbGF0ZVxudmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYnNmeS9ydW50aW1lJyk7XG5tb2R1bGUuZXhwb3J0cyA9IEhhbmRsZWJhcnMudGVtcGxhdGUoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIFxuXG5cbiAgcmV0dXJuIFwiPGRpdiBjbGFzcz1cXFwicGFybGV5XFxcIj5cXG4gIDxzZWN0aW9uIGNsYXNzPVxcXCJjb250cm9sbGVyXFxcIj5cXG4gICAgPGRpdiBjbGFzcz1cXFwiY29udHJvbGxlci12aWV3XFxcIj5cXG4gICAgICA8ZGl2IGNsYXNzPVxcXCJnLXNpZ25pbiBsb2dpbi1iYXJcXFwiXFxuICAgICAgICBkYXRhLWNhbGxiYWNrPVxcXCJzaWduX2luX2NhbGxiYWNrXFxcIlxcbiAgICAgICAgZGF0YS1jbGllbnRpZD1cXFwiMTAyNzQyNzExNjc2NS05YzE4Y2t1bzA3cjVtczBhY2xiZmpzbWNwZDNqcm10Yy5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbVxcXCJcXG4gICAgICAgIGRhdGEtY29va2llcG9saWN5PVxcXCJzaW5nbGVfaG9zdF9vcmlnaW5cXFwiXFxuICAgICAgICBkYXRhLXRoZW1lPVxcXCJub25lXFxcIlxcbiAgICAgICAgZGF0YS1zY29wZT1cXFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9wbHVzLmxvZ2luIGh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvZGV2c3RvcmFnZS5yZWFkX3dyaXRlXFxcIj5cXG4gICAgICAgIDxsaSBjbGFzcz1cXFwiYnRuXFxcIj5cXG4gICAgICAgICAgPGEgY2xhc3M9XFxcImVudHlwby1ncGx1c1xcXCI+PC9hPlxcbiAgICAgICAgPC9saT5cXG4gICAgICAgIDxsaSBjbGFzcz1cXFwiYXNpZGVcXFwiPlxcbiAgICAgICAgICA8YT4gU2lnbiBpbiB3aXRoIGdvb2dsZTwvYT5cXG4gICAgICAgIDwvbGk+XFxuICAgICAgPC9kaXY+XFxuICAgIDwvZGl2PlxcbiAgICA8ZGl2IGNsYXNzPVxcXCJwZXJzaXN0ZW50LWJhciBsb2dnZWQtb3V0XFxcIj5cXG4gICAgICA8YSBpZD1cXFwibG9nLWNsaWNrXFxcIj4gY2xpY2sgaGVyZSB0byBsb2dpbiE8L2E+XFxuICAgICAgPHNwYW4gY2xhc3M9XFxcImZvbnRhd2Vzb21lLXJlb3JkZXJcXFwiPjwvc3Bhbj5cXG4gICAgPC9kaXY+XFxuICA8L3NlY3Rpb24+XFxuPC9kaXY+XCI7XG4gIH0pO1xuIiwiLy8gaGJzZnkgY29tcGlsZWQgSGFuZGxlYmFycyB0ZW1wbGF0ZVxudmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYnNmeS9ydW50aW1lJyk7XG5tb2R1bGUuZXhwb3J0cyA9IEhhbmRsZWJhcnMudGVtcGxhdGUoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGhlbHBlciwgZnVuY3Rpb25UeXBlPVwiZnVuY3Rpb25cIiwgZXNjYXBlRXhwcmVzc2lvbj10aGlzLmVzY2FwZUV4cHJlc3Npb247XG5cblxuICBidWZmZXIgKz0gXCI8ZGl2IGNsYXNzPVxcXCJhdmF0YXJcXFwiPlxcbiAgPGltZyBzcmM9IFwiXG4gICAgKyBlc2NhcGVFeHByZXNzaW9uKCgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zZW5kZXIpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLmltYWdlX3VybCkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKSlcbiAgICArIFwiLz5cXG48ZGl2IGNsYXNzPVxcXCJtZXNzYWdlIHN0YXR1c1xcXCI+XFxuICA8aDI+XCJcbiAgICArIGVzY2FwZUV4cHJlc3Npb24oKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnNlbmRlcikpLHN0YWNrMSA9PSBudWxsIHx8IHN0YWNrMSA9PT0gZmFsc2UgPyBzdGFjazEgOiBzdGFjazEuZGlzcGxheV9uYW1lKSksdHlwZW9mIHN0YWNrMSA9PT0gZnVuY3Rpb25UeXBlID8gc3RhY2sxLmFwcGx5KGRlcHRoMCkgOiBzdGFjazEpKVxuICAgICsgXCI8L2gyPlxcbiAgPHA+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmNvbnRlbnQpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuY29udGVudCk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L3A+XFxuICA8YSBjbGFzcz1cXFwidGltZVxcXCI+XFxuICAgIDxzcGFuIGNsYXNzPVxcXCJlbnR5cG8tY2xvY2tcXFwiPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5jYWxjdWxhdGVfdGltZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5jYWxjdWxhdGVfdGltZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L3NwYW4+XFxuICA8L2E+XFxuPC9kaXY+XCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH0pO1xuIiwiLy8gaGJzZnkgY29tcGlsZWQgSGFuZGxlYmFycyB0ZW1wbGF0ZVxudmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYnNmeS9ydW50aW1lJyk7XG5tb2R1bGUuZXhwb3J0cyA9IEhhbmRsZWJhcnMudGVtcGxhdGUoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGhlbHBlciwgZnVuY3Rpb25UeXBlPVwiZnVuY3Rpb25cIiwgZXNjYXBlRXhwcmVzc2lvbj10aGlzLmVzY2FwZUV4cHJlc3Npb247XG5cblxuICBidWZmZXIgKz0gXCI8ZGl2IGNsYXNzPVxcXCJtZXNzYWdlIGV4aXN0aW5nXFxcIj5cXG4gIDxkaXYgY2xhc3M9XFxcImF2YXRhclxcXCI+XFxuICAgIDxpbWcgc3JjPVwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5yZXRyaWV2ZV9pbWFnZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5yZXRyaWV2ZV9pbWFnZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCIgLz5cXG4gIDwvZGl2PlxcbiAgPGRpdiBjbGFzcz1cXFwiY29udGVudCBzdGF0dXMgZW50eXBvLXJpZ2h0LW9wZW4tYmlnXFxcIj5cXG4gICAgPGgyPlwiXG4gICAgKyBlc2NhcGVFeHByZXNzaW9uKCgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5jb252b19wYXJ0bmVyKSksc3RhY2sxID09IG51bGwgfHwgc3RhY2sxID09PSBmYWxzZSA/IHN0YWNrMSA6IHN0YWNrMS5kaXNwbGF5X25hbWUpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSkpXG4gICAgKyBcIjwvaDI+XFxuICAgIDxwPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5yZXRyaWV2ZV9sYXN0X21lc3NhZ2UpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAucmV0cmlldmVfbGFzdF9tZXNzYWdlKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIjwvcD5cXG4gICAgPGEgY2xhc3M9XFxcInRpbWVcXFwiPlxcbiAgICAgIDxzcGFuIGNsYXNzPVxcXCJlbnR5cG8tY2xvY2tcXFwiPiBcIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuY2FsY3VsYXRlX2xhc3RfbWVzc2FnZV90aW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmNhbGN1bGF0ZV9sYXN0X21lc3NhZ2VfdGltZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L3NwYW4+XFxuICAgIDwvYT5cXG4gIDwvZGl2PlxcbjwvZGl2PlwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwiZGVmYXVsdC12aWV3XFxcIj5cXG4gIDxmaWd1cmU+XFxuICAgIDxpbWcgc3JjPVwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5pbWFnZV91cmwpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuaW1hZ2VfdXJsKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIiAvPlxcbiAgICA8aDI+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmRpc3BsYXlfbmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5kaXNwbGF5X25hbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9oMj5cXG4gIDwvZmlndXJlPlxcbjwvZGl2PlwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIlxuYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcblxuIyNjb25zdHJ1Y3RvciBmb3Igb2JqZWN0IHRoYXQgaG9sZHMgYWxsXG4jI2RhdGEgYW5kIGxvZ2ljIHJlbGF0ZWQgdG8gZWFjaCB1c2VyXG5cbmNsYXNzIFVzZXJcblxuICBjb25zdHJ1Y3RvcjogKEBkaXNwbGF5X25hbWUsIEBpbWFnZV91cmwpIC0+XG4gICAgIyMgYWN0aXZlLCBpZGxlLCBhd2F5LCBvciBETkRcbiAgICBAc3RhdHVzID0gXCJhY3RpdmVcIlxuXG5cbm1vZHVsZS5leHBvcnRzID0gVXNlciIsIlxuYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcbkNoYXRSb29tID0gcmVxdWlyZSgnLi9jaGF0X3Jvb21fdmlldy5jb2ZmZWUnKVxuQ29udmVyc2F0aW9uID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb25fbW9kZWwuY29mZmVlJylcbmN1cnJlbnRfdXNlcl90ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdGVtcGxhdGVzL2N1cnJlbnRfdXNlci5oYnMnKVxuXG4jIyBUaGlzIGlzIHRoZSBjb25zdHJ1Y3RvciBmb3IgZWFjaCBsaXN0IGl0ZW1jb3JyZXNwb25kaW5nIHRvIGxvZ2dlZFxuIyMgb24gdXNlcnMgZGlzcGxheWVkIGluIHRoZSBsb2dnZWQgb24gdXNlcnMgbGlzdCBvbiBib3RoXG4jIyBjb21tYW5kIGNlbnRlciBhbmQgY2hhdCB3aW5kb3cgdmlld3MuXG5jbGFzcyBVc2VyVmlld1xuXG4gIGNvbnN0cnVjdG9yOiAoQGN1cnJlbnRfdXNlciwgQGNoYXRfcm9vbSkgLT5cbiAgICBAJGVsZW1lbnQgPSAkKFwiPGxpIGNsYXNzPSd1c2VyJz48L2xpPlwiKVxuICAgIEAkZWxlbWVudC5vbiAnY2xpY2snLCBAdXNlcl9pbnRlcmFjdF9jYWxsYmFjay5iaW5kKHRoaXMpXG5cbiAgcmVuZGVyOiAtPlxuICAgIEAkZWxlbWVudC5odG1sKGN1cnJlbnRfdXNlcl90ZW1wbGF0ZShAY3VycmVudF91c2VyKSlcblxuICB1c2VyX2ludGVyYWN0X2NhbGxiYWNrOiAtPlxuICAgICMjIGlmIGludGVyYWN0aW9uIGlzIGluIHRoZSBjb21tYW5kIGNlbnRlciBvcGVuIGEgbmV3IGNvbnZvXG4gICAgaWYgQCRlbGVtZW50LnBhcmVudCgpLmhhc0NsYXNzKCdjb250cm9sbGVyLXZpZXcnKVxuICAgICAgQG9wZW5fY29udmVyc2F0aW9uKClcbiAgICBlbHNlXG4gICAgICAjIyBhZGQgdXNlciB0byBjdXJyZW50IGNvbnZvLyBtYWtlIGdyb3VwIGNvbnZvXG4gICAgICBAY2hhdF9yb29tLmFkZF9tZW1iZXIoQGN1cnJlbnRfdXNlcilcblxuICBvcGVuX2NvbnZlcnNhdGlvbjogLT5cbiAgICAjIyBjaGVjayB0byBtYWtlIHN1cmUgY29udm8gaXNuJ3QgYWxyZWFkeSBvcGVuXG4gICAgY29udm9fa2V5ID0gW2FwcC5tZS5pbWFnZV91cmwsIEBjdXJyZW50X3VzZXIuaW1hZ2VfdXJsXS5zb3J0KCkuam9pbigpXG4gICAgZm9yIGNvbnZvIGluIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnNcbiAgICAgIGlmIGNvbnZvX2tleSBpcyBjb252by5tZXNzYWdlX2ZpbHRlclxuICAgICAgICByZXR1cm5cbiAgICAjIyBjaGVjayB0byBzZWUgaWYgcGVyc2lzdGVudCBjb252byBleGlzdHMgd2l0aCB0aGUgdXNlclxuICAgIGNvbnZvX2V4aXN0cyA9IGZhbHNlXG4gICAgZm9yIGNvbnZvIGluIGFwcC5jb252ZXJzYXRpb25zXG4gICAgICBpZiBjb252by5tZXNzYWdlX2ZpbHRlciBpcyBjb252b19rZXlcbiAgICAgICAgY29udm9fZXhpc3RzID0gdHJ1ZVxuICAgICAgICBjb252byA9IGNvbnZvXG4gICAgaWYgY29udm9fZXhpc3RzXG4gICAgICBjaGF0X3dpbmRvdyA9IG5ldyBDaGF0Um9vbShjb252bylcbiAgICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMucHVzaChjb252b19rZXkpXG4gICAgZWxzZVxuICAgICAgY29udmVyc2F0aW9uID0gbmV3IENvbnZlcnNhdGlvbihbQGN1cnJlbnRfdXNlcl0pXG4gICAgICBjaGF0X3dpbmRvdyA9IG5ldyBDaGF0Um9vbShjb252ZXJzYXRpb24pXG4gICAgICBhcHAuY29udmVyc2F0aW9ucy5wdXNoKGNvbnZlcnNhdGlvbilcbiAgICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMucHVzaChjb252b19rZXkpXG5cbm1vZHVsZS5leHBvcnRzID0gVXNlclZpZXciXX0=
