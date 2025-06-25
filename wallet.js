const path = require("path");
const fs = require("fs");
const CryptoAdapter = require("./cryptoAdapter");

const privateKeyDir = path.join(__dirname, "wallet");
const privateKeyFile = path.join(privateKeyDir, "private_key");
const publicKeyFile = path.join(privateKeyDir, "public_key");

exports.initWallet = async () => {
  // Generate keys only if they don't exist
  if (!fs.existsSync(privateKeyDir)) fs.mkdirSync(privateKeyDir);

  let privateKey, publicKey;
  if (fs.existsSync(privateKeyFile) && fs.existsSync(publicKeyFile)) {
    privateKey = fs.readFileSync(privateKeyFile);
    publicKey = fs.readFileSync(publicKeyFile);
  } else {
    const keys = await CryptoAdapter.generateKeyPair();
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
    fs.writeFileSync(privateKeyFile, privateKey);
    fs.writeFileSync(publicKeyFile, publicKey);
  }

  const address = CryptoAdapter.getAddress(publicKey);
  return {
    privateKeyLocation: privateKeyFile,
    publicKey: publicKey.toString("hex"),
    address,
  };
};
