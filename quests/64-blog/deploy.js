import fs from "fs";
import path, { dirname } from "path";

import spawn from "cross-spawn";

import { fileURLToPath } from "url";

import { Keypair } from "@solana/web3.js";

const projectName = "blog";

const SLASH = path.sep;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const programKeyfileName = `target/deploy/${projectName}-keypair.json`;
const programKeypairFile = path.resolve(
    `${__dirname}${SLASH}${programKeyfileName}`,
);

function readKeyfile(keypairFile) {
    let kf = fs.readFileSync(keypairFile);
    let parsed = JSON.parse(kf.toString());
    kf = new Uint8Array(parsed);
    return Keypair.fromSecretKey(kf);
}

async function deploy() {
    const programKeypair = readKeyfile(programKeypairFile);
    console.log({ publicKey: programKeypair.publicKey });
    const programId = programKeypair.publicKey.toString();

    const args = process.argv.slice(2);
    let upgrade = false;
    if (args.length > 0) {
        if (args[0] === "upgrade") {
            upgrade = true;
        } else if (args[0] !== "deploy") {
            throw new Error(`Unknown argument: ${args[0]}. Expected 'deploy' or 'upgrade`);
        }
    }

    let method;
    if (!upgrade) {
        console.log("Deploying...");
        spawn.sync("anchor", ["build"], { stdio: "inherit" });
        method = ["deploy"];
    } else {
        console.log("Upgrading...");
        method = [
            "upgrade",
            `target/deploy/${projectName}.so`,
            "--program-id",
            programId,
        ];
    }

    console.log({ method });
    spawn.sync(
        "anchor",
        [
            ...method,
            "--provider.cluster",
            "Devnet",
        ],
        { stdio: "inherit" },
    );

    fs.copyFile(
        `target/idl/${projectName}.json`,
        `app/src/lib/idl/${projectName}.json`,
        (err) => {
            if (err) throw err;
            console.log(`${projectName}.json was copied to ./app`);
        },
    );
}

deploy();
