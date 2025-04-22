const Store = require('electron-store');
const store = new Store({ name: 'memory', defaults: { nodes: [] } });

/**
 * Add a memory node.
 * @param {object} node
 * @returns {array} Updated nodes
 */
function addNode(node) {
  const nodes = store.get('nodes');
  nodes.push({ ...node, id: nodes.length + 1, timestamp: Date.now() });
  store.set('nodes', nodes);
  return nodes;
}

/**
 * List all memory nodes.
 * @returns {array}
 */
function listNodes() {
  return store.get('nodes');
}

/**
 * Query nodes by a text filter in content.
 * @param {string} filter
 * @returns {array}
 */
function queryNodes(filter) {
  const nodes = store.get('nodes');
  return nodes.filter((n) => n.content.includes(filter));
}

module.exports = { addNode, listNodes, queryNodes };