const crypto = require("crypto");

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRandomBlock(length = 4) {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = crypto.randomInt(0, PASSWORD_ALPHABET.length);
    result += PASSWORD_ALPHABET[randomIndex];
  }
  return result;
}

function generateUniquePassword() {
  return `T3H-${makeRandomBlock(4)}-${makeRandomBlock(4)}`;
}

module.exports = { generateUniquePassword };
