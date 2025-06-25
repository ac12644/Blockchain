require("dotenv").config();
const crypto = require("crypto");
const Swarm = require("discovery-swarm");
const defaults = require("dat-swarm-defaults");
const getPort = require("get-port");
const chain = require("./chain");
const CronJob = require("cron").CronJob;
const express = require("express");
const bodyParser = require("body-parser");
const wallet = require("./wallet");

// ----- Consensus/Crypto Mode Info -----
const consensusMode = process.env.CONSENSUS_MODE || "pow";
const cryptoMode = process.env.CRYPTO_MODE || "secp256k1";

console.log("===========================================");
console.log("   Blockchain Node Starting...");
console.log(
  "   Consensus Mode:",
  consensusMode === "pow" ? "Proof-of-Work (PoW)" : "Proof-of-Stake (PoS)"
);
console.log(
  "   Crypto Algorithm:",
  cryptoMode === "falcon"
    ? "Falcon-512 (Post-Quantum)"
    : "secp256k1 (Classic ECDSA)"
);
console.log("===========================================");

const peers = {};
let connSeq = 0;

const channel = "myBlockchain";
let registeredMiners = [];
let lastBlockMinedBy = null;

// --- NEW: For PoS simulation ---
let stakes = []; // [{ address, stake }]
let myStake = 50 + Math.floor(Math.random() * 100); // Random stake for demo

// Message types
const MessageType = {
  REQUEST_BLOCK: "requestBlock",
  RECEIVE_NEXT_BLOCK: "receiveNextBlock",
  RECEIVE_NEW_BLOCK: "receiveNewBlock",
  REQUEST_ALL_REGISTER_MINERS: "requestAllRegisterMiners",
  REGISTER_MINER: "registerMiner",
  REQUEST_FULL_CHAIN: "requestFullChain",
  RECEIVE_FULL_CHAIN: "receiveFullChain",
  REQUEST_STAKES: "requestStakes",
  RECEIVE_STAKES: "receiveStakes",
};

const myPeerId = crypto.randomBytes(32);

// create a database once you start the code
chain.createDb(myPeerId.toString("hex"));

let initHttpServer = (port) => {
  let http_port = "80" + port.toString().slice(-2);
  let app = express();
  app.use(bodyParser.json());

  app.get("/blocks", (req, res) => res.send(JSON.stringify(chain.blockchain)));
  app.get("/getBlock", (req, res) => {
    let blockIndex = req.query.index;
    res.send(chain.blockchain[blockIndex]);
  });
  app.get("/getDBBlock", (req, res) => {
    let blockIndex = req.query.index;
    chain.getDbBlock(blockIndex, res);
  });
  app.get("/getWallet", (req, res) => {
    res.send(wallet.initWallet());
  });
  app.listen(http_port, () =>
    console.log("Listening http on port:", http_port)
  );
};

// Peer discovery config
const config = defaults({
  id: myPeerId,
});
const swarm = Swarm(config);

(async () => {
  const port = await getPort();

  const myWallet = await wallet.initWallet();
  const myAddress = myWallet.address;

  console.log("myPeerId:", myPeerId.toString("hex"));
  console.log("myWallet:", myAddress);

  initHttpServer(port);
  swarm.listen(port);
  console.log("Listening port:", port);

  swarm.join(channel);
  swarm.on("connection", (conn, info) => {
    const seq = connSeq;
    const peerId = info.id.toString("hex");
    console.log(`Connected #${seq} to peer: ${peerId}`);

    if (info.initiator) {
      try {
        conn.setKeepAlive(true, 600);
      } catch (exception) {}
    }

    conn.on("data", (data) => {
      let message = JSON.parse(data);
      //console.log('Received', message.type, 'from', peerId);

      switch (message.type) {
        case MessageType.REQUEST_BLOCK: {
          let requestedIndex = message.data.index;
          let requestedBlock = chain.getBlock(requestedIndex);
          if (requestedBlock)
            writeMessageToPeerToId(
              peerId,
              MessageType.RECEIVE_NEXT_BLOCK,
              requestedBlock
            );
          else console.log("No block found @ index:", requestedIndex);
          break;
        }
        case MessageType.RECEIVE_NEXT_BLOCK: {
          // If this block doesn't fit, likely a fork: request full chain
          let newBlock = message.data;
          let prevBlock = chain.getLatestBlock();
          if (
            prevBlock.blockHeader.merkleRoot ===
            newBlock.blockHeader.previousBlockHeader
          ) {
            chain.addBlock(newBlock);
          } else {
            // Fork detected!
            console.log("Possible fork detected. Requesting full chain...");
            writeMessageToPeerToId(peerId, MessageType.REQUEST_FULL_CHAIN, {});
          }
          break;
        }
        case MessageType.RECEIVE_NEW_BLOCK: {
          let newBlock = message.data;
          let prevBlock = chain.getLatestBlock();
          if (
            prevBlock.blockHeader.merkleRoot ===
            newBlock.blockHeader.previousBlockHeader
          ) {
            chain.addBlock(newBlock);
          } else {
            // Fork detected!
            console.log("Possible fork detected. Requesting full chain...");
            writeMessageToPeerToId(peerId, MessageType.REQUEST_FULL_CHAIN, {});
          }
          break;
        }
        case MessageType.REQUEST_FULL_CHAIN: {
          // Send the full chain to the requester
          writeMessageToPeerToId(
            peerId,
            MessageType.RECEIVE_FULL_CHAIN,
            chain.blockchain
          );
          break;
        }
        case MessageType.RECEIVE_FULL_CHAIN: {
          let receivedChain = message.data;
          // Validate and replace if valid & longer
          chain.replaceChain(receivedChain);
          break;
        }
        case MessageType.REQUEST_ALL_REGISTER_MINERS: {
          writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
          registeredMiners = message.data;
          break;
        }
        case MessageType.REGISTER_MINER: {
          registeredMiners = message.data;
          break;
        }
        // PoS: share/receive stakes
        case MessageType.REQUEST_STAKES: {
          writeMessageToPeerToId(peerId, MessageType.RECEIVE_STAKES, {
            address: myAddress,
            stake: myStake,
          });
          break;
        }
        case MessageType.RECEIVE_STAKES: {
          // Simple: update local stakes
          let stakeInfo = message.data;
          if (stakes.find((s) => s.address === stakeInfo.address)) {
            // Already present, update
            stakes = stakes.map((s) =>
              s.address === stakeInfo.address ? stakeInfo : s
            );
          } else {
            stakes.push(stakeInfo);
          }
          break;
        }
      }
    });

    conn.on("close", () => {
      console.log(`Connection ${seq} closed, peerId: ${peerId}`);
      if (peers[peerId].seq === seq) {
        delete peers[peerId];
        let index = registeredMiners.indexOf(peerId);
        if (index > -1) registeredMiners.splice(index, 1);
      }
    });

    if (!peers[peerId]) {
      peers[peerId] = {};
    }
    peers[peerId].conn = conn;
    peers[peerId].seq = seq;
    connSeq++;
  });
})();

// --- Messaging Helpers ---
function writeMessageToPeers(type, data) {
  for (let id in peers) sendMessage(id, type, data);
}
function writeMessageToPeerToId(toId, type, data) {
  if (peers[toId]) sendMessage(toId, type, data);
}
function sendMessage(id, type, data) {
  peers[id].conn.write(
    JSON.stringify({
      to: id,
      from: myPeerId,
      type: type,
      data: data,
    })
  );
}

// Initial peer state sync
setTimeout(() => {
  writeMessageToPeers(MessageType.REQUEST_ALL_REGISTER_MINERS, null);
}, 5000);

setTimeout(() => {
  writeMessageToPeers(MessageType.REQUEST_BLOCK, {
    index: chain.getLatestBlock().index + 1,
  });
}, 5000);

setTimeout(() => {
  registeredMiners.push(myPeerId.toString("hex"));
  writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
}, 7000);

// PoS: Share stake info
setTimeout(() => {
  writeMessageToPeers(MessageType.REQUEST_STAKES, null);
  // Add your own if missing
  if (!stakes.find((s) => s.address === myAddress)) {
    stakes.push({ address: myAddress, stake: myStake });
  }
}, 7000);

// Mining/Block Production Job
const job = new CronJob("30 * * * * *", function () {
  let index = 0;
  if (lastBlockMinedBy) {
    let newIndex = registeredMiners.indexOf(lastBlockMinedBy);
    index = newIndex + 1 > registeredMiners.length - 1 ? 0 : newIndex + 1;
  }

  lastBlockMinedBy = registeredMiners[index];
  const consensusMode = process.env.CONSENSUS_MODE || "pow";

  // PoW: anyone can mine. PoS: only validator for this round.
  let canMine = true;
  if (consensusMode === "pos") {
    // Wait for stakes to be loaded, then pick validator.
    if (!stakes.length) return; // Wait for stake sync
    let validator = selectValidator(stakes);
    canMine = validator === myAddress;
    if (!canMine) return;
  }

  if (canMine && registeredMiners[index] === myPeerId.toString("hex")) {
    console.log("--- Creating next block ---");
    let newBlock = chain.generateNextBlock(null, stakes);
    chain.addBlock(newBlock);
    writeMessageToPeers(MessageType.RECEIVE_NEW_BLOCK, newBlock);
  }
});

// -- PoS Validator selection, same as consensus.js --
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

job.start();
