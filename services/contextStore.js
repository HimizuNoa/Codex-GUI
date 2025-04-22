const Store = require('electron-store');
const store = new Store({ name: 'context', defaults: { entries: [] } });

/**
 * Add a context entry (e.g. user message, system event).
 * @param {object} entry
 * @returns {array} Updated entries
 */
function addContext(entry) {
  const entries = store.get('entries');
  entries.push({ ...entry, timestamp: Date.now() });
  store.set('entries', entries);
  return entries;
}

/**
 * List all context entries.
 * @returns {array}
 */
function listContext() {
  return store.get('entries');
}

/**
 * Clear context history.
 * @returns {array} Empty entries
 */
function clearContext() {
  store.set('entries', []);
  return [];
}

module.exports = { addContext, listContext, clearContext };