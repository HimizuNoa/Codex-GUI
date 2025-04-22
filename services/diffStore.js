
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

// Ensure the path is within the diffs directory (avoid path traversal)
function isInside(p) {
  const resolved = path.resolve(p);
  const relative = path.relative(diffDir, resolved);
  // Outside if relative path starts with '..' or is absolute
  return !relative.startsWith('..') && !path.isAbsolute(relative);

/**
 * Load a diff file by name or full path if it's inside the diffs directory.
 * @param {string} fileNameOrPath
 * @returns {string|null}
 */
function loadDiff(fileNameOrPath) {
  // Determine resolved path: use basename or absolute
  let resolved;
  if (fileNameOrPath === path.basename(fileNameOrPath)) {
    resolved = path.join(diffDir, fileNameOrPath);
  } else {
    resolved = path.resolve(fileNameOrPath);
  }
  // Validate location and existence
  if (!isInside(resolved) || !fs.existsSync(resolved)) return null;
  try {
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return null;
  }
}


module.exports={ saveDiff, listDiffs, loadDiff };
