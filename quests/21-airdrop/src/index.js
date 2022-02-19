const {
    airdropSOL,
    createConnection,
    printBalance,
    readKeypair,
} = require("./solana");

const NETWORK = "devnet";
const KEYPAIR_PUBLIC_KEY = readKeypair().publicKey;

const driver = async () => {
    try {
        console.log(`Wallet public key: ${KEYPAIR_PUBLIC_KEY.toString()}`);

        const conn = createConnection(NETWORK);
        await printBalance(conn, KEYPAIR_PUBLIC_KEY);
        await airdropSOL(conn, KEYPAIR_PUBLIC_KEY);
        await printBalance(conn, KEYPAIR_PUBLIC_KEY);
    } catch (e) {
        console.log(e);
    }
};

driver();
