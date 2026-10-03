'use strict';
// Bound recursion before upstream's compile/expand/stringify walkers run.
const MAX_DEPTH = 128;
const MAX_NODES = 100000;
function assertAstDepth(root) {
  const pending = [{ node: root, depth: 0 }];
  const seen = new Set();
  let count = 0;
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth > MAX_DEPTH) throw new SyntaxError('Brace nesting limit exceeded');
    if (seen.has(node)) throw new SyntaxError('Shared or cyclic brace AST rejected');
    if (++count > MAX_NODES) throw new SyntaxError('Brace AST node limit exceeded');
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      if (node.nodes.length > MAX_NODES - count) throw new SyntaxError('Brace AST node limit exceeded');
      for (const child of node.nodes) pending.push({ node: child, depth: depth + 1 });
    }
  }
}
module.exports = { MAX_DEPTH, assertAstDepth };
