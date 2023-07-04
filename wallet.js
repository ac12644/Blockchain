const path = require("path");
const EC = require("elliptic").ec;
const fs = require("fs");
const ec = new EC("secp256k1"); // create and initialize the EC context

const privateKeyDir = path.join(__dirname, "wallet");
const privateKeyFile = path.join(privateKeyDir, "private_key");

// create a method exports.initWallet to generate the actual public-private key, generatePrivateKey
exports.initWallet = () => {
  let privateKey;

  // If the directory doesn't exist, create it
  if (!fs.existsSync(privateKeyDir)) {
    fs.mkdirSync(privateKeyDir);
  }

  // you will be generating a new wallet only if one doesn’t exist
  if (fs.existsSync(privateKeyFile)) {
    const buffer = fs.readFileSync(privateKeyFile, "utf8");
    privateKey = buffer.toString();
  } else {
    privateKey = generatePrivateKey();
    fs.writeFileSync(privateKeyFile, privateKey);
  }

  const key = ec.keyFromPrivate(privateKey, "hex");
  const publicKey = key.getPublic().encode("hex");
  return { privateKeyLocation: privateKeyFile, publicKey: publicKey };
};

const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

// To see the code working, script will create the public and private keys
let wallet = this;
let retVal = wallet.initWallet();
console.log(JSON.stringify(retVal));
