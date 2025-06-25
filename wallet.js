const path = require("path");
const fs = require("fs");
const CryptoAdapter = require("./cryptoAdapter");

const privateKeyDir = path.join(__dirname, "wallet");
const privateKeyFile = path.join(privateKeyDir, "private_key");
const publicKeyFile = path.join(privateKeyDir, "public_key");

exports.initWallet = async () => {
  if (!fs.existsSync(privateKeyDir))
    fs.mkdirSync(privateKeyDir, { recursive: true });

  let privateKey, publicKey;
  if (fs.existsSync(privateKeyFile) && fs.existsSync(publicKeyFile)) {
    privateKey = fs.readFileSync(privateKeyFile, "utf8");
    publicKey = fs.readFileSync(publicKeyFile, "utf8");
  } else {
    const keys = await CryptoAdapter.generateKeyPair();
    privateKey = keys.privateKey.toString();
    publicKey = keys.publicKey.toString();
    fs.writeFileSync(privateKeyFile, privateKey);
    fs.writeFileSync(publicKeyFile, publicKey);
  }

  const address = CryptoAdapter.getAddress(publicKey);
  return {
    privateKey,
    publicKey,
    address,
  };
};
