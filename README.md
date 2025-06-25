<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/ac12644/Blockchain">
    <img src="blockchain.svg" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Blockchain</h3>

  <p align="center">
    A modular educational blockchain built in Node.js.<br>
    Switch consensus (PoW/PoS) and cryptography (secp256k1/Falcon PQC) on the fly.<br>
    <a href="https://abhishek-chauhan.medium.com/e65dfc40479e"><strong>Read the Medium article »</strong></a>
    <br />
    <br />
    <strong>⭐ Star this repo if you like real, hackable blockchain code!</strong>
  </p>
</div>

---

## Features

- Modular **P2P blockchain network**
- Pluggable **consensus**: Proof-of-Work (PoW) or Proof-of-Stake (PoS)
- Pluggable **cryptography**: Classic (secp256k1) or **Post-Quantum** (Falcon-512)
- Automatic **fork detection** and **chain re-org**
- Educational **wallet** and **transaction** system (works with any crypto mode)
- Syncs with peers, broadcasts blocks, and supports miner registration
- CLI and REST API for block, wallet, and chain interaction

---

## Steps Implemented

  <ol>
    <li>Creating a basic P2P network</li>
    <li>Sending and receiving blocks</li>
    <li>Registering miners and creating new blocks</li>
    <li>Setting up a name-value database (LevelDB/RocksDB)</li>
    <li>Creating a private-public wallet with pluggable crypto</li>
    <li>REST API for chain/wallet interaction</li>
    <li>Command-line interface</li>
    <li>Consensus switch (PoW / PoS)</li>
    <li>Cryptography switch (secp256k1 / Falcon PQC)</li>
    <li>Automatic fork detection and chain re-org</li>
  </ol>

---

## Getting Started

```sh
npm install
```

## Usage

### Run in Default Mode (PoW, secp256k1):

```sh
node p2p.js

```

Switch Consensus (PoW / PoS):

```sh
npm run start:pow    # Proof-of-Work (default)
npm run start:pos    # Proof-of-Stake
```

Or with environment variable:

```sh
CONSENSUS_MODE=pow node p2p.js
CONSENSUS_MODE=pos node p2p.js
```

Switch Cryptography (secp256k1 / Falcon Post-Quantum):

```sh
npm run start:secp    # Classic ECDSA (default)
npm run start:falcon  # Falcon-512 (Post-Quantum, requires pqclean)
```

Or with environment variable:

```sh
CRYPTO_MODE=secp256k1 node p2p.js
CRYPTO_MODE=falcon node p2p.js
```

You can combine switches:

```sh
CRYPTO_MODE=falcon CONSENSUS_MODE=pos node p2p.js
```

### Advanced

- Run multiple nodes: Use multiple terminals, each in a separate folder, or clear /wallet before launching to simulate multiple identities.

- Fork detection/re-org: Disconnect peers and create different blocks, then reconnect to see automatic chain resolution.

- Stake management: Edit stake values in code for PoS testing.

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>
