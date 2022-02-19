const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");

const {
    airdropSOL,
    createConnection,
    getBalance,
    readKeypair,
    transferSOL,
} = require("./solana");
const {
    generateRandomNumber,
    getReturnAmount,
    getTotalAmountToBePaid,
} = require("./helper");

const NETWORK = "devnet";
const TREASURY_KEYPAIR = readKeypair("treasury");
const USER_KEYPAIR = readKeypair("user");

const init = () => {
    console.log(
        chalk.green(
            figlet.textSync("SOL Stake", {
                font: "Standard",
                horizontalLayout: "default",
                verticalLayout: "default",
            }),
        ),
    );
    console.log(chalk.yellow`The max bidding amount is 2.5 SOL here`);
};

const askQuestions = (conn) => {
    const questions = [
        {
            name: "SOL",
            type: "number",
            message: "What is the amount of SOL you want to stake?",
        },
        {
            name: "RATIO",
            type: "rawlist",
            message: "What is the ratio of your staking?",
            choices: ["1:1.25", "1:1.5", "1.75", "1:2"],
            filter: (val) => val.split(":")[1],
        },
        {
            name:"RANDOM",
            type:"number",
            message:"Guess a random number between 1 and 5 (both 1, 5 included)",
            when: async (val) => {
                const amountToBePaid = getTotalAmountToBePaid(val.SOL);
                if (amountToBePaid > 5) {
                    console.log(chalk.red`You have violated the max stake limit. Stake with smaller amount`);
                    return false;
                } else {
                    console.log(`You need to pay ${chalk.green`${amountToBePaid}`} to move forward`);
                    const userBalance = await getBalance(conn, USER_KEYPAIR.publicKey);
                    if (userBalance < amountToBePaid) {
                        console.log(chalk.red`You don't have enough balance in your wallet`);
                        return false;
                    } else {
                        console.log(chalk.green`You will get ${getReturnAmount(val.SOL, val.RATIO)} if you guess the number correctly`);
                        return true;
                    }
                }
            },
        }
    ];
    return inquirer.prompt(questions);
};

const executeGame = async () => {
    init();
    const randomNumber = generateRandomNumber(1, 5);
    const conn = createConnection(NETWORK);
    const answers = await askQuestions(conn);
    if (!answers.RANDOM) {
        console.log("No guesses. Ending game");
        return;
    }

    const paymentSig = await transferSOL(
        conn,
        USER_KEYPAIR,
        TREASURY_KEYPAIR.publicKey,
        getTotalAmountToBePaid(answers.SOL),
    );
    console.log(`Signature of payment transaction for playing the game: ${chalk.green(paymentSig)}`);

    if (answers.RANDOM === randomNumber){
        await airdropSOL(conn, TREASURY_KEYPAIR, getReturnAmount(answers.SOL, answers.RATIO));
        const prizeSig = await transferSOL(
            conn,
            TREASURY_KEYPAIR,
            USER_KEYPAIR.publicKey,
            getReturnAmount(answers.SOL, answers.RATIO),
        );
        console.log(chalk.green`Your guess is absolutely correct!!!`);
        console.log(`Here is the prize transaction signature: ${chalk.green(prizeSig)}`);
    } else {
        console.log(chalk.yellowBright`Better luck next time`)
    }
};

executeGame();
