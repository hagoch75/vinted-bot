const fs = require('fs');
const path = require('path');

const seenIds = new Set();

function load(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const arr = JSON.parse(raw || '[]');
      arr.forEach((id) => seenIds.add(id));
      console.log(`Loaded ${arr.length} seen IDs from ${filePath}`);
    }
  } catch (err) {
    console.warn('Failed to load seenIds:', err.message || err);
  }
}

function save(filePath) {
  try {
    const arr = Array.from(seenIds);
    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save seenIds:', err.message || err);
  }
}

function register(id) {
  if (!id || seenIds.has(id)) {
    return false;
  }

  seenIds.add(id);
  return true;
}

function add(id) {
  if (id) {
    seenIds.add(id);
  }
}

function has(id) {
  return !!id && seenIds.has(id);
}

function size() {
  return seenIds.size;
}

module.exports = {
  load,
  save,
  register,
  add,
  has,
  size,
};
