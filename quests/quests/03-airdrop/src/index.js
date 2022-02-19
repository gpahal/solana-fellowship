const {
    airdropSOL,
    createConnection,
    printBalance,
    readKeypair,
} = require("./solana");

const NETWORK = "devnet";
const KEYPAIR = readKeypair();

const driver = async () => {
    try {
        console.log(`Wallet public key: ${KEYPAIR.publicKey.toString()}`);

        const conn = createConnection(NETWORK);
        await printBalance(conn);
        await airdropSOL(conn);
        await printBalance(conn);
    } catch (e) {
        console.log(e);
    }
};

driver();
