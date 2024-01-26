const CryptoJS = require("crypto-js");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const getBalance = (address, blockchain) => {
  let balance = 0;
  // Code to calculate balance from the blockchain's transaction history
  return balance;
};

export const verifyTransaction = (transaction, blockchain) => {
  // Check for the transaction structure
  if (
    !transaction.fromAddress ||
    !transaction.toAddress ||
    !transaction.amount
  ) {
    return false;
  }

  // Check if the signature is valid
  const publicKey = ec.keyFromPublic(transaction.fromAddress, "hex");
  if (
    !publicKey.verify(
      CryptoJS.SHA256(
        transaction.fromAddress + transaction.toAddress + transaction.amount
      ).toString(),
      transaction.signature
    )
  ) {
    return false;
  }

  // Check for sufficient balance (this requires a function to calculate the balance)
  if (getBalance(transaction.fromAddress, blockchain) < transaction.amount) {
    return false;
  }

  return true;
};
