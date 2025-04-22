
const fs = require('fs');
const path = require('path');

const diffDir = path.join(__dirname, '..', 'diffs');
if (!fs.existsSync(diffDir)) fs.mkdirSync(diffDir);

function saveDiff(content) {
  const filename = `diff_${Date.now()}_${Math.random().toString(36).slice(2,8)}.diff`;
  const full = path.join(diffDir, filename);
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}

function listDiffs() {
  return fs.readdirSync(diffDir)
    .filter(f => f.endsWith('.diff'))
    .map(f => ({
      name: f,
      path: path.join(diffDir, f),
      mtime: fs.statSync(path.join(diffDir, f)).mtimeMs
    }))
    .sort((a,b)=>b.mtime - a.mtime);
}

// Ensure the path is within the diffs directory
function isInside(p) {
  return path.dirname(path.resolve(p)) === diffDir;
}

/**
 * Load a diff file if it's inside the diffs directory
 * @param {string} filePath
 * @returns {string|null}
 */
function loadDiff(filePath) {
  if (!isInside(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}


module.exports={ saveDiff, listDiffs, loadDiff };
