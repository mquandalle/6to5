var traverse = require("../../traverse");
var util     = require("../../util");
var core     = require("core-js/library");
var t        = require("../../types");
var _        = require("lodash");

exports.optional = true;

exports.ast = {
  enter: function (ast, file) {
    file._coreId = file.generateUidIdentifier("core");
    var specifiers = [t.importSpecifier(t.identifier("default"), file._coreId)];
    var declar = t.importDeclaration(specifiers, t.literal("core-js/library"));
    ast.program.body.unshift(declar);
  },

  exit: function (ast, file) {
    traverse(ast, {
      enter: function (node, parent) {
        var prop;

        if (t.isMemberExpression(node) && t.isReferenced(node, parent)) {
          // Array.from -> _core.Array.from
          var obj = node.object;
          prop = node.property;

          if (!t.isReferenced(obj, node)) return;

          var coreHasObject = obj.name !== "_" && _.has(core, obj.name);
          if (coreHasObject && _.has(core[obj.name], prop.name)) {
            this.stop();
            return t.memberExpression(file._coreId, node);
          }
        } else if (t.isCallExpression(node)) {
          // arr[Symbol.iterator]() -> _core.$for.getIterator(arr)

          if (node.arguments.length) return;

          var callee = node.callee;
          if (!t.isMemberExpression(callee)) return;
          if (!callee.computed) return;

          prop = callee.property;
          if (!t.isIdentifier(prop.object, { name: "Symbol" })) return;
          if (!t.isIdentifier(prop.property, { name: "iterator" })) return;

          return util.template("corejs-iterator", {
            CORE_ID: file._coreId,
            VALUE:   callee.object
          });
        }
      }
    });
  }
};
