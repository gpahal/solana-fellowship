const { generateKeypair, writeKeypair } = require("./solana");

const treasuryKeypair = generateKeypair();
console.log(`Treasury public key: ${treasuryKeypair.publicKey.toString()}`);
writeKeypair("treasury", treasuryKeypair);

const userKeypair = generateKeypair();
console.log(`User public key: ${userKeypair.publicKey.toString()}`);
writeKeypair("user", userKeypair);
