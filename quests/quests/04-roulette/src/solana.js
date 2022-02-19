const fs = require("fs");
const path = require("path");

const {
    clusterApiUrl,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} = require("@solana/web3.js");

const generateKeypair = () => {
    return Keypair.generate();
};

const writeKeypair = (filename, keypair) => {
    writeSecretKey(filename, keypair.secretKey);
};

const writeSecretKey = (filename, secretKey) => {
    fs.writeFileSync(
        path.join(__dirname, `../${filename}_wallet.txt`),
        JSON.stringify(Array.from(secretKey)),
        "utf8",
    );
};

const readKeypair = (filename) => {
    const secretKey = readSecretKey(filename);
    return Keypair.fromSecretKey(secretKey);
};

const readSecretKey = (filename) => {
    const secretKeyArray = JSON.parse(
        fs.readFileSync(path.join(__dirname, `../${filename}_wallet.txt`), "utf8"),
    );
    return Uint8Array.from(secretKeyArray);
};

const createConnection = (network) => {
    const apiUrl = clusterApiUrl(network);
    return new Connection(apiUrl, "confirmed");
};

const getBalance = async (conn, publicKey) => {
    return await conn.getBalance(new PublicKey(publicKey.toString()));
};

const airdropSOL = async (conn, publicKey, amount) => {
    console.log(`Airdropping ${amount} SOL...`);
    const sig = await conn.requestAirdrop(
        new PublicKey(publicKey),
        amount * LAMPORTS_PER_SOL,
    );
    await conn.confirmTransaction(sig);
};

const transferSOL = async (conn, fromKeypair, toPublicKey, sols) => {
    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: new PublicKey(fromKeypair.publicKey.toString()),
            toPubkey: new PublicKey(toPublicKey.toString()),
            lamports: sols * LAMPORTS_PER_SOL,
        }),
    );

    return await sendAndConfirmTransaction(
        conn,
        tx,
        [fromKeypair],
    );
};

module.exports = {
    generateKeypair,
    writeKeypair,
    writeSecretKey,
    readKeypair,
    readSecretKey,
    createConnection,
    getBalance,
    airdropSOL,
    transferSOL,
};
