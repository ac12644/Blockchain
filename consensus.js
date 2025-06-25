const Block = require("./block.js").Block;
const BlockHeader = require("./block.js").BlockHeader;
const CryptoJS = require("crypto-js");

function generatePoWBlock(prevBlock, txns, index, time, blockchain) {
  let nonce = 0;
  let merkleRoot, hash;
  do {
    nonce++;
    merkleRoot = CryptoJS.SHA256(
      index + JSON.stringify(txns) + nonce
    ).toString();
    hash = CryptoJS.SHA256(
      index + prevBlock.blockHeader.merkleRoot + merkleRoot + time + 4 + nonce
    ).toString();
  } while (hash.substring(0, 4) !== "0000");

  const header = new BlockHeader(
    1,
    prevBlock.blockHeader.merkleRoot,
    merkleRoot,
    time,
    4,
    nonce
  );
  return new Block(header, index, txns);
}

function generatePoSBlock(prevBlock, txns, index, time, blockchain, stakes) {
  if (!stakes || stakes.length === 0) {
    throw new Error("No stakes provided for PoS block generation");
  }

  const validator = selectValidator(stakes);
  const merkleRoot = CryptoJS.SHA256(
    index + JSON.stringify(txns) + validator
  ).toString();
  const header = new BlockHeader(
    1,
    prevBlock.blockHeader.merkleRoot,
    merkleRoot,
    time,
    "POS",
    validator
  );

  return new Block(header, index, txns);
}

function selectValidator(stakes) {
  const total = stakes.reduce((sum, s) => sum + s.stake, 0);
  const rand = Math.random() * total;
  let cumulative = 0;
  for (const s of stakes) {
    cumulative += s.stake;
    if (rand <= cumulative) return s.address;
  }
  return stakes[stakes.length - 1].address;
}

module.exports = {
  generatePoWBlock,
  generatePoSBlock,
};
