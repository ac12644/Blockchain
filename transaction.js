const CryptoAdapter = require("./cryptoAdapter");

const getBalance = (address, blockchain) => {
  let balance = 0;
  // Calculate balance by iterating over all blocks and transactions
  for (const block of blockchain) {
    if (!block.txns) continue;
    for (const txn of block.txns) {
      if (txn.fromAddress === address) balance -= txn.amount;
      if (txn.toAddress === address) balance += txn.amount;
    }
  }
  return balance;
};

exports.verifyTransaction = async (transaction, blockchain) => {
  if (
    !transaction.fromAddress ||
    !transaction.toAddress ||
    typeof transaction.amount !== "number"
  ) {
    return false;
  }

  // Always construct the message in the SAME way you sign!
  const message =
    transaction.fromAddress + transaction.toAddress + transaction.amount;

  // Pluggable crypto (classic or PQC) verification
  const valid = await CryptoAdapter.verify(
    message,
    transaction.signature,
    transaction.fromAddress
  );
  if (!valid) return false;

  if (getBalance(transaction.fromAddress, blockchain) < transaction.amount) {
    return false;
  }

  return true;
};
