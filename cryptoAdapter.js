require("dotenv").config();
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const { sign } = (() => {
  try {
    return require("pqclean");
  } catch {
    return {};
  }
})();
const { createHash } = require("crypto");

const CRYPTO_MODE = process.env.CRYPTO_MODE || "secp256k1";

class CryptoAdapter {
  // Generate a wallet: returns {privateKey, publicKey}
  static async generateKeyPair() {
    if (CRYPTO_MODE === "falcon") {
      const { publicKey, privateKey } = await sign.generateKeyPair(
        "falcon-512"
      );
      return {
        privateKey: Buffer.from(privateKey.export()),
        publicKey: Buffer.from(publicKey.export()),
      };
    }
    // Default: secp256k1
    const key = ec.genKeyPair();
    return {
      privateKey: key.getPrivate("hex"),
      publicKey: key.getPublic("hex"),
    };
  }

  // Address from publicKey
  static getAddress(publicKey) {
    if (CRYPTO_MODE === "falcon") {
      return createHash("sha256").update(publicKey).digest("hex").slice(0, 40);
    }
    // secp256k1: use pubkey hex, hash, and truncate
    return createHash("sha256")
      .update(publicKey, "hex")
      .digest("hex")
      .slice(0, 40);
  }

  // Sign a string message
  static async sign(message, privateKey) {
    if (CRYPTO_MODE === "falcon") {
      const privateKeyObj = new sign.PrivateKey("falcon-512", privateKey);
      const signature = await privateKeyObj.sign(Buffer.from(message, "utf8"));
      return Buffer.from(signature).toString("hex");
    }
    // secp256k1
    const key = ec.keyFromPrivate(privateKey, "hex");
    const msgHash = createHash("sha256").update(message).digest();
    const signature = key.sign(msgHash);
    return signature.toDER("hex");
  }

  // Verify a message signature
  static async verify(message, signatureHex, publicKey) {
    if (CRYPTO_MODE === "falcon") {
      const signature = Buffer.from(signatureHex, "hex");
      const publicKeyObj = new sign.PublicKey("falcon-512", publicKey);
      return await publicKeyObj.verify(Buffer.from(message, "utf8"), signature);
    }
    // secp256k1
    const key = ec.keyFromPublic(publicKey, "hex");
    const msgHash = createHash("sha256").update(message).digest();
    return key.verify(msgHash, signatureHex);
  }
}

module.exports = CryptoAdapter;
