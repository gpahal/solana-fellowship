import * as assert from "assert";
import * as anchor from "@project-serum/anchor";
import { BN, Program, web3 } from "@project-serum/anchor";
import * as tokenLib from "@solana/spl-token";

import { SharedWallet } from "../target/types/shared_wallet";

describe("shared-wallet", () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SharedWallet as Program<SharedWallet>;
  const [wallet, walletBump] = anchor.utils.publicKey.findProgramAddressSync(
    [
      Buffer.from("wallet"),
    ],
    program.programId,
  );
  const user1 = web3.Keypair.generate();
  const user2 = web3.Keypair.generate();
  const user3 = web3.Keypair.generate();

  let mint = web3.PublicKey.default;
  let walletToken = web3.PublicKey.default;

  it("Initializes test setup", async () => {
    mint = await createMint(provider);
    walletToken = await createAssociatedTokenAccount(provider, mint, wallet);
    await mintTo(provider, mint, walletToken, 1e9);
  });

  it("Creates wallet", async () => {
    await program.rpc.create([user1.publicKey, user2.publicKey, user3.publicKey], {
      accounts: {
        wallet,
        payer: provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      },
    });

    let walletAccount = await program.account.wallet.fetch(wallet);
    assert.deepEqual(
      walletAccount.users.map(pk => pk.toString()),
      [user1.publicKey.toString(), user2.publicKey.toString(), user3.publicKey.toString()],
    );
    assert.equal(walletAccount.bump, walletBump);
  });

  it("Transfers spl token", async () => {
    const destination = web3.Keypair.generate();
    const destinationToken = await createAssociatedTokenAccount(provider, mint, destination.publicKey);

    const randomUser = web3.Keypair.generate();

    try {
      await program.rpc.transferTokens(new BN(1000), {
        accounts: {
          wallet,
          user: randomUser.publicKey,
          mint,
          walletToken,
          destinationToken,
          tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
        },
        signers: [randomUser],
      });
      assert.fail("Only authorized users should be allowed to transfer");
    } catch (e) {}

    await program.rpc.transferTokens(new BN(1000), {
      accounts: {
        wallet,
        user: user1.publicKey,
        mint,
        walletToken,
        destinationToken,
        tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
      },
      signers: [user1],
    });

    const walletTokenAccount = await fetchTokenAccount(provider, walletToken);
    assert.equal(walletTokenAccount.amount, BigInt(1e9 - 1000));

    const destinationTokenAccount = await fetchTokenAccount(provider, destinationToken);
    assert.equal(destinationTokenAccount.amount, BigInt(1000));
  });
});

async function fetchTokenAccount(
  provider: anchor.Provider, publicKey: web3.PublicKey): Promise<tokenLib.RawAccount | null> {
  const accountInfo = await provider.connection.getAccountInfo(publicKey);
  return accountInfo == null ? null : tokenLib.AccountLayout.decode(accountInfo.data);
}

async function createMint(provider: anchor.Provider): Promise<web3.PublicKey> {
  const authority = provider.wallet.publicKey;
  const mint = anchor.web3.Keypair.generate();
  const lamports = await tokenLib.getMinimumBalanceForRentExemptMint(provider.connection);

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: tokenLib.MINT_SIZE,
      lamports,
      programId: tokenLib.TOKEN_PROGRAM_ID,
    }),
    tokenLib.createInitializeMintInstruction(mint.publicKey, 9, authority, authority, tokenLib.TOKEN_PROGRAM_ID),
  );

  await provider.send(transaction, [mint]);
  return mint.publicKey;
}

async function createAssociatedTokenAccount(
  provider: anchor.Provider,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
): Promise<web3.PublicKey> {
  const [instructions, associatedTokenAccountPublicKey] = await createAssociatedTokenAccountInstructions(provider, mint, owner);
  await provider.send(new web3.Transaction().add(...instructions));
  return associatedTokenAccountPublicKey;
}

async function createAssociatedTokenAccountInstructions(
  provider: anchor.Provider,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
): Promise<[web3.TransactionInstruction[], web3.PublicKey]> {
  const associatedToken = await tokenLib.getAssociatedTokenAddress(
    mint, owner, true, tokenLib.TOKEN_PROGRAM_ID, tokenLib.ASSOCIATED_TOKEN_PROGRAM_ID);
  return [[
    tokenLib.createAssociatedTokenAccountInstruction(
      provider.wallet.publicKey,
      associatedToken,
      owner,
      mint,
      tokenLib.TOKEN_PROGRAM_ID,
      tokenLib.ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  ], associatedToken];
}

async function mintTo(
  provider: anchor.Provider, mint: web3.PublicKey, destination: web3.PublicKey, amount: number): Promise<void> {
  const transaction = new web3.Transaction().add(
    tokenLib.createMintToInstruction(mint, destination, provider.wallet.publicKey, amount),
  );
  await provider.send(transaction);
}
