import React, { useState } from 'react';
import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  createMint,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
} from "@solana/spl-token";

export default function App() {
  const [walletConnected,setWalletConnected] = useState(false);
  const [provider, setProvider] = useState();
  const [loading, setLoading] = useState(false);

  const [isTokenCreated, setIsTokenCreated] = useState(false);
  const [createdTokenPublicKey, setCreatedTokenPublicKey] = useState(null);
  const [createdTokenPublicKeyStr, setCreatedTokenPublicKeyStr] = useState(null);
  const [mintingWalletSecretKey, setMintingWalletSecretKey] = useState(null);
  const [supplyCapped, setSupplyCapped] = useState(false);

  const getProvider = async () => {
    if ("solana" in window) {
      const provider = window.solana;
      if ("isPhantom" in provider && provider.isPhantom) {
        return provider;
      }
    } else {
      window.open("https://www.phantom.app/", "_blank");
    }
  };

  const walletConnectionHelper = async () => {
    if (walletConnected) {
      setProvider(undefined);
      setWalletConnected(false);
    } else {
      try {
        const userWallet = await getProvider();
        if (userWallet) {
          await userWallet.connect();
          userWallet.on("connect", async () => {
            setProvider(userWallet);
            setWalletConnected(true);
          });
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  };

  const airDropHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );
      const fromAirDropSignature = await connection.requestAirdrop(new PublicKey(provider.publicKey), LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      console.log(`1 SOL airdropped to your wallet ${provider.publicKey.toString()} successfully`);
      setLoading(false);
    } catch(err) {
      console.log(err);
      setLoading(false);
    }
  };

  const initialMintHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const mintRequester = await provider.publicKey;
      const mintingFromWallet = await Keypair.generate();
      setMintingWalletSecretKey(JSON.stringify(mintingFromWallet.secretKey));

      const fromAirDropSignature = await connection.requestAirdrop(mintingFromWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      const creatorToken = await createMint(connection, mintingFromWallet, mintingFromWallet.publicKey, mintingFromWallet.publicKey, 6);
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingFromWallet, creatorToken, mintingFromWallet.publicKey);
      await mintTo(connection, mintingFromWallet, creatorToken, fromTokenAccount.address, mintingFromWallet, 1000000);

      const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintingFromWallet, creatorToken, mintRequester);
      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount.address,
          toTokenAccount.address,
          mintingFromWallet.publicKey,
          1000000,
        )
      );
      const signature=await sendAndConfirmTransaction(connection, transaction, [mintingFromWallet], { commitment: "confirmed" });

      console.log("SIGNATURE:",signature);

      setCreatedTokenPublicKey(creatorToken);
      setCreatedTokenPublicKeyStr(creatorToken.toString());
      setIsTokenCreated(true);
      setLoading(false);
    } catch(err) {
      console.log(err)
      setLoading(false);
    }
  };

  const mintAgainHelper=async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );
      const createMintingWallet = await Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const mintRequester = await provider?.publicKey;

      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey,LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });

      const creatorToken = createdTokenPublicKey;
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, createMintingWallet, creatorToken, createMintingWallet.publicKey);
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, createMintingWallet, creatorToken, mintRequester);
      await mintTo(connection, createMintingWallet, creatorToken, fromTokenAccount.address, createMintingWallet, 100000000);

      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount.address,
          toTokenAccount.address,
          createMintingWallet.publicKey,
          100000000,
        )
      );
      await sendAndConfirmTransaction(connection, transaction, [createMintingWallet], { commitment: "confirmed" });

      setLoading(false);
    } catch(err) {
      console.log(err);
      setLoading(false);
    }
  };

  const transferTokenHelper = async () => {
    try {
      setLoading(true);

      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const createMintingWallet = Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const receiverWallet = new PublicKey("5eaFQvgJgvW4rDjcAaKwdBb6ZAJ6avWimftFyjnQB3Aj");

      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });
      console.log('1 SOL airdropped to the wallet for fee');

      const creatorToken = createdTokenPublicKey;
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(connection, createMintingWallet, creatorToken, provider?.publicKey);
      const toTokenAccount = await getOrCreateAssociatedTokenAccount(connection, createMintingWallet, creatorToken, receiverWallet);

      const transaction = new Transaction().add(
        createTransferInstruction(fromTokenAccount.address, toTokenAccount.address, provider?.publicKey,10000000)
      );
      transaction.feePayer = provider?.publicKey;
      let blockhashObj = await connection.getRecentBlockhash();
      console.log("blockhashObj", blockhashObj);
      transaction.recentBlockhash = await blockhashObj.blockhash;

      if (transaction) {
        console.log("Txn created successfully");
      }

      let signed = await provider.signTransaction(transaction);
      let signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      console.log("SIGNATURE: ", signature);
      setLoading(false);
    } catch(err) {
      console.log(err)
      setLoading(false);
    }
  };

  const capSupplyHelper = async () => {
    try {
      setLoading(true);
      const connection = new Connection(
        clusterApiUrl("devnet"),
        "confirmed"
      );

      const createMintingWallet = await Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
      const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(fromAirDropSignature);

      await setAuthority(connection, createMintingWallet, createdTokenPublicKey, createMintingWallet.publicKey, "MintTokens", null, [createMintingWallet]);

      setSupplyCapped(true);
      setLoading(false);
    } catch(err) {
      console.log(err);
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Create your own token using JavaScript</h1>
      {
        walletConnected ? (
          <div>
            <p><strong>Public Key:</strong> {provider?.publicKey.toString()}</p>
          </div>
        ) : null
      }

      <button onClick={walletConnectionHelper} disabled={loading}>
        {!walletConnected?"Connect Wallet":"Disconnect Wallet"}
      </button>

      {
        walletConnected ? (
          <ul>
            <li>
              Airdrop 1 SOL into your wallet{" "}
              <button disabled={loading} onClick={airDropHelper}>AirDrop SOL </button>
            </li>
            <li>
              Create your own token{" "}
              <button disabled={loading} onClick={initialMintHelper}>Initial Mint </button>
            </li>
            {isTokenCreated ? (<>
              <li>
                Mint 100 more tokens:{" "}
                <button disabled={loading || supplyCapped} onClick={mintAgainHelper}>Mint Again</button>
              </li>
              <li>
                Transfer 10 tokens to your friend:{" "}
                <button disabled={loading} onClick={transferTokenHelper}>Transfer</button>
              </li>
              <li>
                Cap token supply:{" "}
                <button disabled={loading} onClick={capSupplyHelper}>Cap token supply</button>
              </li>
            </>) : null}
          </ul>
        ) : null
      }
    </div>
  )
}
