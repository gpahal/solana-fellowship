const { generateKeypair, writeKeypair } = require("./solana");

const keypair = generateKeypair();
console.log(`Wallet public key: ${keypair.publicKey.toString()}`);
writeKeypair(keypair);
