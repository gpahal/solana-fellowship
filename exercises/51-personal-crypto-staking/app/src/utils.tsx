import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Idl, Program, Provider as ProviderLib } from "@project-serum/anchor";

import stakingIdl from "./staking.json";
import { Staking as StakingLib } from "../../target/types/staking";

export const CLUSTER_API_URL = "http://localhost:8899";

declare global {
  // Extend the window interface. This uses the declaration merging feature of interfaces.
  interface Window {
    solana?: Provider;
  }
}

export type Provider = {
  isPhantom?: boolean;
  publicKey: PublicKey;
  connect: () => Promise<void>;
  on: (event: string, cb: () => any) => void;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
};

export function createConnection(): Connection {
  return new Connection(CLUSTER_API_URL, "confirmed");
}

export type Staking = StakingLib;

export const STAKING_PROGRAM_ID = "9RcRcEXKMpNJ5zMaUbTwqKoh2RoehEvd9csQAoBz4MCo";

export function createStakingProgram(provider: Provider): Program<Staking> {
  return new Program<Staking>(
    // @ts-ignore
    stakingIdl as Idl,
    STAKING_PROGRAM_ID,
    new ProviderLib(createConnection(), provider, {}),
  );
}

export const withLoading = (
  setLoading: (value: boolean) => void,
  fn: () => Promise<void>,
) => {
  return async () => {
    setLoading(true);
    try {
      await fn();
      setLoading(false);
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        alert(`Error: ${e.message}`);
      } else {
        alert("Error: Unknown error occurred");
      }
      setLoading(false);
    }
  };
};

export const withConnection = (
  setLoading: (value: boolean) => void,
  fn: (connection: Connection) => Promise<void>,
  airdropPublicKey?: PublicKey,
  amountOfSol?: number,
) => {
  return async () => {
    setLoading(true);
    try {
      const connection = new Connection(CLUSTER_API_URL, "confirmed");
      if (airdropPublicKey) {
        await requestAirdrop(connection, airdropPublicKey, amountOfSol);
      }

      await fn(connection);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };
};

export const requestAirdrop = async (
  connection: Connection,
  airdropPublicKey: PublicKey,
  amountOfSols?: number,
) => {
  const lamports = amountOfSols ? amountOfSols * LAMPORTS_PER_SOL : LAMPORTS_PER_SOL / 4;
  const solString = amountOfSols ? `${amountOfSols} SOL` : "0.25 SOL";
  console.log(`Airdropping ${solString}...`);
  const fromAirDropSignature = await connection.requestAirdrop(airdropPublicKey, lamports);
  await connection.confirmTransaction(fromAirDropSignature);
  console.log(`Airdropped ${solString}`);
};

export class Token {
  mint: PublicKey;
  mintingAuthority: Keypair;
  decimals: number;

  constructor(mint: PublicKey, mintingAuthority: Keypair, decimals: number) {
    this.mint = mint;
    this.mintingAuthority = mintingAuthority;
    this.decimals = decimals;
  }

  mintTo = async (connection: Connection, destination: PublicKey, amount: number = 100) => {
    if (amount === 0) {
      return;
    }

    console.log(`Minting ${amount} tokens to wallet: ${destination.toString()}...`);
    const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection, this.mintingAuthority, this.mint, destination, true);
    await mintTo(
      connection,
      this.mintingAuthority,
      this.mint,
      destinationTokenAccount.address,
      this.mintingAuthority,
      amount * Math.pow(10, this.decimals),
    );
    console.log(`Minted ${amount} tokens (${amount}e${this.decimals} without decimal) to associated account: ${
      destinationTokenAccount.toString()
    }...`);
  };

  toString = () => {
    return `Mint: ${this.mint.toString()}; Minting authority: ${this.mintingAuthority.publicKey.toString()}`;
  };
}
