require("dotenv").config();
const path = require("path");
const Block = require("./block.js").Block;
const BlockHeader = require("./block.js").BlockHeader;
const verifyTransaction = require("./transaction.js").verifyTransaction;
const moment = require("moment");
const CryptoJS = require("crypto-js");
const rocksdb = require("rocksdb");
const fs = require("fs");

const consensus = require("./consensus.js");

let db;

const MEDIAN_BLOCK_COUNT = 11;
const FUTURE_TIMESTAMP_THRESHOLD = 7200; // 2 hours in seconds
let blockchain = [];

const calculateMedianTimestamp = (chain) => {
  const blockCount = chain.length;
  const medianIndex = Math.floor(MEDIAN_BLOCK_COUNT / 2);

  let medianTimestamps = chain
    .slice(Math.max(blockCount - MEDIAN_BLOCK_COUNT, 0))
    .map((block) => block.blockHeader.time)
    .sort((a, b) => a - b);

  return medianTimestamps[medianIndex] || 0;
};

const isTimestampValid = (newBlock, chain) => {
  if (chain.length < MEDIAN_BLOCK_COUNT) return true;
  const medianTimestamp = calculateMedianTimestamp(chain);
  const currentNodeTime = moment().unix();

  return (
    newBlock.blockHeader.time > medianTimestamp &&
    newBlock.blockHeader.time <= currentNodeTime + FUTURE_TIMESTAMP_THRESHOLD
  );
};

const calculateHash = (
  index,
  previousBlockHeader,
  merkleRoot,
  time,
  nBits,
  nonce
) => {
  return CryptoJS.SHA256(
    index + previousBlockHeader + merkleRoot + time + nBits + nonce
  ).toString();
};

const createDb = async (peerId) => {
  const dir = path.join(__dirname, "db", peerId);
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    db = rocksdb(dir);
    db.open((err) => {
      if (err) console.error("Error opening RocksDB database:", err);
      else storeBlock(getGenesisBlock());
    });
  } catch (err) {
    console.error("Error creating database directory:", err);
  }
};

const getGenesisBlock = () => {
  let blockHeader = new BlockHeader(
    1,
    null,
    "0x1bc1100000000000000000000000000000000000000000000",
    moment().unix(),
    "0x171b7320",
    "1CAD2B8C"
  );
  return new Block(blockHeader, 0, null);
};

const getLatestBlock = () => blockchain[blockchain.length - 1];

const addBlock = (newBlock) => {
  const prevBlock = getLatestBlock();
  if (
    prevBlock.index < newBlock.index &&
    newBlock.blockHeader.previousBlockHeader ===
      prevBlock.blockHeader.merkleRoot &&
    isTimestampValid(newBlock, blockchain)
  ) {
    blockchain.push(newBlock);
    storeBlock(newBlock);
  }
};

const storeBlock = (newBlock) => {
  db.put(newBlock.index, JSON.stringify(newBlock), (err) => {
    if (err) console.error("Error storing block:", err);
    else console.log("--- Inserting block index: " + newBlock.index);
  });
};

const getBlock = (index) => {
  return blockchain[index] || null;
};

const getDbBlock = (index, res) => {
  db.get(index, function (err, value) {
    if (err) res.send(JSON.stringify(err));
    else res.send(value);
  });
};

const isValidChain = (chainToValidate) => {
  if (JSON.stringify(chainToValidate[0]) !== JSON.stringify(getGenesisBlock()))
    return false;

  for (let i = 1; i < chainToValidate.length; i++) {
    const current = chainToValidate[i];
    const previous = chainToValidate[i - 1];
    if (
      current.blockHeader.previousBlockHeader !==
        previous.blockHeader.merkleRoot ||
      !isTimestampValid(current, chainToValidate)
    ) {
      return false;
    }
  }
  return true;
};

const replaceChain = (newChain) => {
  if (isValidChain(newChain) && newChain.length > blockchain.length) {
    console.log("Replacing chain with new longer valid chain");
    blockchain = newChain;
  }
};

const generateNextBlock = (txns = [], stakes = []) => {
  const prevBlock = getLatestBlock();
  const nextIndex = prevBlock.index + 1;
  const nextTime = moment().unix();
  const consensusMode = process.env.CONSENSUS_MODE || "pow";

  let newBlock;
  if (consensusMode === "pow") {
    newBlock = consensus.generatePoWBlock(
      prevBlock,
      txns,
      nextIndex,
      nextTime,
      blockchain
    );
  } else {
    newBlock = consensus.generatePoSBlock(
      prevBlock,
      txns,
      nextIndex,
      nextTime,
      blockchain,
      stakes
    );
  }

  blockchain.push(newBlock);
  storeBlock(newBlock);
  return newBlock;
};

blockchain = [getGenesisBlock()];

module.exports = {
  addBlock,
  getBlock,
  blockchain,
  getLatestBlock,
  generateNextBlock,
  createDb,
  getDbBlock,
  isValidChain,
  replaceChain,
};
