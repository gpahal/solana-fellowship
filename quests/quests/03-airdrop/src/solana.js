const fs = require("fs");
const path = require("path");

const {
    clusterApiUrl,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
} = require("@solana/web3.js");

const generateKeypair = () => {
    return Keypair.generate();
};

const walletFilePath = path.join(__dirname, "../wallet.txt");

const writeKeypair = (keypair) => {
    writeSecretKey(keypair.secretKey);
};

const writeSecretKey = (secretKey) => {
    fs.writeFileSync(walletFilePath, JSON.stringify(Array.from(secretKey)), "utf8");
};

const readKeypair = () => {
    const secretKey = readSecretKey();
    return Keypair.fromSecretKey(secretKey);
};

const readSecretKey = () => {
    const secretKeyArray = JSON.parse(fs.readFileSync(walletFilePath, "utf8"));
    return Uint8Array.from(secretKeyArray);
};

const createConnection = (network) => {
    const apiUrl = clusterApiUrl(network);
    return new Connection(apiUrl, "confirmed");
};

const printBalance = async (conn, keypair) => {
    const balance = await conn.getBalance(keypair.publicKey);
    console.log(`Balance: ${balance/LAMPORTS_PER_SOL} SOL`);
};

const airdropSOL = async (conn, keypair) => {
    console.log(`Airdropping 2 SOL...`)
    const sig = await conn.requestAirdrop(
        new PublicKey(keypair.publicKey),
        2 * LAMPORTS_PER_SOL,
    );
    await conn.confirmTransaction(sig);
};

module.exports = {
    generateKeypair,
    writeKeypair,
    writeSecretKey,
    readKeypair,
    readSecretKey,
    createConnection,
    printBalance,
    airdropSOL,
};
