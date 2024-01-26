const path = require("path");
const Block = require("./block.js").Block;
const BlockHeader = require("./block.js").BlockHeader;
const verifyTransaction = require("./transaction.js").verifyTransaction;
const moment = require("moment");
const CryptoJS = require("crypto-js");
const rocksdb = require("rocksdb");
const fs = require("fs");

let db;

const MEDIAN_BLOCK_COUNT = 11;
const FUTURE_TIMESTAMP_THRESHOLD = 7200; // 2 hours in seconds

const calculateMedianTimestamp = (blockchain) => {
  const blockCount = blockchain.length;
  const medianIndex = Math.floor(MEDIAN_BLOCK_COUNT / 2);

  let medianTimestamps = blockchain
    .slice(Math.max(blockCount - MEDIAN_BLOCK_COUNT, 0)) // Get the last MEDIAN_BLOCK_COUNT blocks
    .map((block) => block.blockHeader.time)
    .sort((a, b) => a - b); // Sort timestamps

  return medianTimestamps[medianIndex] || 0;
};

const isTimestampValid = (newBlock, blockchain) => {
  if (blockchain.length < MEDIAN_BLOCK_COUNT) {
    return true; // Not enough blocks for a median check
  }

  const medianTimestamp = calculateMedianTimestamp(blockchain);
  const currentNodeTime = moment().unix();

  return (
    newBlock.blockHeader.time > medianTimestamp &&
    newBlock.blockHeader.time <= currentNodeTime + FUTURE_TIMESTAMP_THRESHOLD
  );
};

// proof of work
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

let createDb = async (peerId) => {
  let dir = path.join(__dirname, "db", peerId);
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    db = rocksdb(dir);
    db.open((err) => {
      if (err) {
        console.error("Error opening RocksDB database:", err);
      } else {
        storeBlock(getGenesisBlock());
      }
    });
  } catch (err) {
    console.error("Error creating database directory:", err);
  }
};

let getGenesisBlock = () => {
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

let getLatestBlock = () => blockchain[blockchain.length - 1];

let addBlock = (newBlock) => {
  let prevBlock = getLatestBlock();
  if (
    prevBlock.index < newBlock.index &&
    newBlock.blockHeader.previousBlockHeader ===
      prevBlock.blockHeader.merkleRoot &&
    isTimestampValid(newBlock, blockchain)
  ) {
    // Add the timestamp validation check
    blockchain.push(newBlock);
    storeBlock(newBlock);
  }
  {
    blockchain.push(newBlock);
    storeBlock(newBlock); // When you generate a new block using the generateNextBlock method, you can now store the block in the LevelDB database
  }
};

// create a storeBlock method to store the new block
let storeBlock = (newBlock) => {
  db.put(newBlock.index, JSON.stringify(newBlock), function (err) {
    if (err) console.error("Error storing block:", err);
    else console.log("--- Inserting block index: " + newBlock.index);
  });
};

let getDbBlock = (index, res) => {
  db.get(index, function (err, value) {
    if (err) res.send(JSON.stringify(err));
    else res.send(value);
  });
};
let getBlock = (index) => {
  if (blockchain.length - 1 >= index) return blockchain[index];
  else return null;
};

const blockchain = [getGenesisBlock()];

const generateNextBlock = (txns) => {
  txns = txns || []; // Default to an empty array if txns is not provided or is not an array

  const prevBlock = getLatestBlock(),
    prevMerkleRoot = prevBlock.blockHeader.merkleRoot;
  const nextIndex = prevBlock.index + 1,
    nextTime = moment().unix();

  let nonce = 0; // Start with a nonce of 0
  let nextMerkleRoot, hash;

  do {
    nonce++;
    nextMerkleRoot = CryptoJS.SHA256(
      1,
      prevMerkleRoot,
      nextTime + nonce
    ).toString();
    hash = calculateHash(1, prevMerkleRoot, nextMerkleRoot, nextTime, 4, nonce); // Assuming a difficulty of 4 leading zeros
  } while (hash.substring(0, 4) !== "0000");

  const blockHeader = new BlockHeader(
    1,
    prevMerkleRoot,
    nextMerkleRoot,
    nextTime,
    4,
    nonce
  );

  // Verify transactions
  for (const txn of txns) {
    if (!verifyTransaction(txn, blockchain)) {
      throw new Error("Invalid transaction");
    }
  }

  const newBlock = new Block(blockHeader, nextIndex, txns);
  blockchain.push(newBlock);
  storeBlock(newBlock);
  return newBlock;
};

if (typeof exports != "undefined") {
  exports.addBlock = addBlock;
  exports.getBlock = getBlock;
  exports.blockchain = blockchain;
  exports.getLatestBlock = getLatestBlock;
  exports.generateNextBlock = generateNextBlock;
  exports.createDb = createDb;
  exports.getDbBlock = getDbBlock;
}
