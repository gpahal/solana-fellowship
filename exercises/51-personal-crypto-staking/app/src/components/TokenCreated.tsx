import { useCallback, useEffect, useMemo, useState } from "react";

import * as tokenLib from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { BN, web3 } from "@project-serum/anchor";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

import { createStakingProgram, Provider, Token, withConnection, withLoading } from "../utils";

import Balance, { TokenBalance } from "./Balance";

const REWARD_RATIO_PER_5_SECONDS_SIGNIFICAND = 2;
const REWARD_RATIO_PER_5_SECONDS_DECIMAL = 8;
const YEARLY_REWARD_PERCENTAGE = (REWARD_RATIO_PER_5_SECONDS_SIGNIFICAND * 12 * 60 * 24 * 365) / Math.pow(10, REWARD_RATIO_PER_5_SECONDS_DECIMAL-2);

type TokenCreatedProps = {
  provider: Provider;
  token: Token;
  balanceChangedAt: number;
  loading: boolean;
  setLoading: (value: boolean) => void;
};

export default function TokenCreated({ provider, token, balanceChangedAt, loading, setLoading }: TokenCreatedProps) {
  const [balance, setBalance] = useState<TokenBalance | null>(null);
  const [stakedAt, setStakedAt] = useState<number>(0);

  const mint = token.mint;
  const mintingAuthority = token.mintingAuthority;
  const stakingProgram = useMemo(() => createStakingProgram(provider), [provider]);
  const connection = stakingProgram.provider.connection;

  const getStakePublicKey = useCallback(async () => {
    const [publicKey,] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("stake"), provider.publicKey.toBuffer(), mint.toBuffer()],
      stakingProgram.programId,
    );
    return publicKey;
  }, [mint, provider.publicKey, stakingProgram]);

  const getEscrowPublicKey = useCallback(async () => {
    const [publicKey,] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow"), mint.toBuffer()],
      stakingProgram.programId,
    );
    return publicKey;
  }, [mint, stakingProgram]);

  const getEscrowTokenAccount = useCallback(async (escrowPublicKey: PublicKey) => {
    return await getOrCreateAssociatedTokenAccount(connection, mintingAuthority, mint, escrowPublicKey, true);
  }, [connection, mint, mintingAuthority]);

  const getOwnerTokenAccount = useCallback(async () => {
    return await getOrCreateAssociatedTokenAccount(connection, mintingAuthority, mint, provider.publicKey, true);
  }, [connection, mint, mintingAuthority, provider.publicKey]);

  const refreshBalance = useCallback(async () => {
    console.log(`Refreshing balance of wallet: ${provider.publicKey}`);
    try {
      const ownerTokenAccount = await getOwnerTokenAccount();
      const amount = Number(ownerTokenAccount.amount);

      const stake = await getStakePublicKey();
      let stakedAmount: number | undefined, rewardAmount: number | undefined;
      try {
        const stakeAccount = await stakingProgram.account.stake.fetch(stake);
        stakedAmount = stakeAccount.amount.toNumber();
        const now = Math.floor(Date.now() / 1000);
        const intervals = stakedAt === 0 ? 0 : Math.max(Math.floor((now - stakedAt) / 5), 0);
        rewardAmount = (intervals * amount * REWARD_RATIO_PER_5_SECONDS_SIGNIFICAND) / Math.pow(10, REWARD_RATIO_PER_5_SECONDS_DECIMAL);
      } catch (e) {
        console.error(e);
      }

      let escrowAmount: number | undefined;
      try {
        const escrow = await getEscrowPublicKey();
        const escrowTokenAccount = await getEscrowTokenAccount(escrow);
        escrowAmount = Number(escrowTokenAccount.amount);
      } catch (e) {
        console.error(e);
      }

      const newBalance = {
        amount,
        stakedAmount,
        rewardAmount,
        escrowAmount,
      };
      setBalance(newBalance);
      console.log(`Refreshed balance: ${JSON.stringify(newBalance)}`);
    } catch (e) {
      console.error(e);
      setBalance(null);
      console.log("Refreshed balance: null");
    }
  }, [provider.publicKey, stakedAt, stakingProgram, getOwnerTokenAccount, getStakePublicKey, getEscrowPublicKey, getEscrowTokenAccount]);

  useEffect(() => {
    refreshBalance();
  }, [balanceChangedAt, refreshBalance]);

  const mintTokensAgain = useCallback(withConnection(
    setLoading,
    async (connection) => {
      await token.mintTo(connection, provider.publicKey);
      await refreshBalance();
    },
    mintingAuthority.publicKey,
  ), [token, provider.publicKey, connection, refreshBalance]);

  const stakeTokens = useCallback(withLoading(
    setLoading,
    async () => {
      const escrow = await getEscrowPublicKey();
      let escrowTokenAccount = await getEscrowTokenAccount(escrow);
      const escrowToken = escrowTokenAccount.address;
      if (await connection.getAccountInfo(escrow)) {
        console.log(`Found escrow account: ${escrow.toString()}`);
      } else {
        console.log(`Couldn't find escrow account: ${escrow.toString()}. Creating...`);
        await stakingProgram.rpc.createEscrowAccount({
          accounts: {
            escrow,
            payer: provider.publicKey,
            mint,
            escrowToken,
            tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
          }
        });
        console.log(`Created escrow account with token account: ${escrowToken}`);
      }

      await token.mintTo(connection, escrow, 10);
      escrowTokenAccount = await getEscrowTokenAccount(escrow);
      console.log(`Escrow token account balance after minting: ${escrowTokenAccount.amount}`);

      const stake = await getStakePublicKey();
      const ownerTokenAccount = await getOwnerTokenAccount();
      const ownerToken = ownerTokenAccount.address;

      console.log(`Staking 10 tokens of wallet: ${provider.publicKey.toString()}...`);
      await stakingProgram.rpc.createStakeAccount(new BN(Math.pow(10, token.decimals+1)), {
        accounts: {
          stake,
          escrow,
          mint,
          owner: provider.publicKey,
          escrowToken,
          ownerToken,
          tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        },
      });
      console.log(`Staked 10 tokens to staking account: ${stake.toString()}...`);

      setStakedAt(Math.floor(Date.now()/1000));
      await refreshBalance();
    },
  ), [token, provider.publicKey, connection, stakingProgram, getEscrowPublicKey, getEscrowTokenAccount, getStakePublicKey, getOwnerTokenAccount, refreshBalance]);

  const closeStakedAccount = useCallback(withLoading(
    setLoading,
    async () => {
      const escrow = await getEscrowPublicKey();
      const escrowTokenAccount = await getEscrowTokenAccount(escrow);
      const escrowToken = escrowTokenAccount.address;
      const stake = await getStakePublicKey();
      const ownerTokenAccount = await getOwnerTokenAccount();
      const ownerToken = ownerTokenAccount.address;

      console.log(`Closing and withdrawing staked tokens of wallet: ${provider.publicKey.toString()}...`);
      await stakingProgram.rpc.closeStakeAccount({
        accounts: {
          stake,
          escrow,
          mint,
          owner: provider.publicKey,
          escrowToken,
          ownerToken,
          tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
        },
      });
      console.log(`Closed and withdrew staked tokens of staking account: ${stake.toString()}...`);

      setStakedAt(0);
      await refreshBalance();
    },
  ), [provider.publicKey, connection, stakingProgram, getEscrowPublicKey, getEscrowTokenAccount, getStakePublicKey, getOwnerTokenAccount, refreshBalance]);

  return (
    <div>
      <h2>Created a token</h2>
      <div>
        <p><strong>Mint:</strong> {token.mint.toString()}</p>
        <p><strong>Mint authority:</strong> {token.mintingAuthority.publicKey.toString()}</p>
      </div>
      <ul>
        <li>
          Mint 100 more tokens:{" "}
          <button disabled={loading} onClick={mintTokensAgain}>Mint Again</button>
        </li>
        <li>
          Stake 10 tokens at {YEARLY_REWARD_PERCENTAGE}% APY:{" "}
          <button disabled={loading || stakedAt > 0} onClick={stakeTokens}>Stake{stakedAt > 0 ? " (Already staked)" : ""}</button>
        </li>
        <li>
          Close stake account and withdraw tokens:{" "}
          <button disabled={loading} onClick={closeStakedAccount}>Close Stake Account</button>
        </li>
      </ul>
      <Balance token={token} balance={balance} refreshBalance={refreshBalance} loading={loading} />
    </div>
  )
}
