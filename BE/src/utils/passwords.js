function makeRandomBlock(length = 4) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

function generateUniquePassword() {
  return `T3H-${makeRandomBlock(4)}-${makeRandomBlock(4)}`;
}

module.exports = { generateUniquePassword };
