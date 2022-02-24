const {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} = require("@solana/web3.js");
const fs = require("mz/fs");

const RPC_URL = "http://localhost:8899";
const PROGRAM_ID = new PublicKey("DeCxmNnoGAqNuunLKMLim1E5gih3wyCpVk1iWaXE5qj1");

async function createKeypairFromFile() {
    const secretKeyString = await fs.readFile(
        "/Users/gpahal/.config/solana/id.json",
        { encoding: "utf8" },
    );
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
}

function createConnection() {
    return new Connection(RPC_URL, "confirmed");
}

async function checkConnection() {
    const connection = createConnection();
    const version = await connection.getVersion();
    console.log('Connection to cluster established:', RPC_URL, version);
}

async function createAccount() {
    const signer = await createKeypairFromFile();
    const connection = createConnection();
    const newAccountPubkey = await PublicKey.createWithSeed(
        signer.publicKey,
        "campaign1",
        PROGRAM_ID,
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(1024);
    const instruction = SystemProgram.createAccountWithSeed({
        fromPubkey: signer.publicKey,
        basePubkey: signer.publicKey,
        seed: "campaign1",
        newAccountPubkey,
        lamports,
        space: 1024,
        programId : PROGRAM_ID,
    });
    const transaction = new Transaction().add(instruction);

    console.log(`The address of campaign1 account is: ${newAccountPubkey.toBase58()}`);

    await sendAndConfirmTransaction(connection, transaction, [signer]);
}

checkConnection();
createAccount();
