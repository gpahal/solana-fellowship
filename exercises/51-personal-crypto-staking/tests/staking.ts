import * as assert from "assert";
import * as anchor from "@project-serum/anchor";
import { BN, web3 } from "@project-serum/anchor";
import * as tokenLib from "@solana/spl-token";

import { Staking } from "../target/types/staking";

describe("staking", () => {
  // Configure the client to use the test cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Staking as anchor.Program<Staking>;

  let mint: web3.PublicKey = web3.PublicKey.default;
  let escrow = web3.PublicKey.default;
  let escrowBump = -1;
  let escrowToken = web3.PublicKey.default;

  const owner = provider.wallet.publicKey;
  let ownerToken: web3.PublicKey = web3.PublicKey.default;

  const getStakePublicKey = async () => {
    return await web3.PublicKey.findProgramAddress(
      [Buffer.from("stake"), owner.toBuffer(), mint.toBuffer()],
      program.programId,
    );
  };

  it("Initializes test state", async () => {
    mint = await createMint(provider);
    [escrow, escrowBump] = getEscrowPublicKey(program.programId, mint);
    escrowToken = await createAssociatedTokenAccount(provider, mint, escrow);
    ownerToken = await createAssociatedTokenAccount(provider, mint, provider.wallet.publicKey);
    await mintTo(provider, mint, ownerToken, 1e10);
  });

  it("Creates and funds escrow account", async () => {
    await program.rpc.createEscrowAccount({
      accounts: {
        escrow,
        payer: provider.wallet.publicKey,
        mint,
        escrowToken,
        tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      }
    });

    const escrowAccount = await program.account.escrow.fetch(escrow);
    assert.equal(escrowAccount.payer.toString(), provider.wallet.publicKey.toString());
    assert.equal(escrowAccount.mint.toString(), mint.toString());
    assert.equal(escrowAccount.bump, escrowBump);

    await program.rpc.fundEscrowAccount(new anchor.BN(1e9), {
      accounts: {
        escrow,
        payer: provider.wallet.publicKey,
        mint,
        escrowToken,
        payerToken: ownerToken,
        tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
      }
    });

    const escrowTokenAccount = await fetchTokenAccount(provider, escrowToken);
    assert.ok(escrowTokenAccount != null);
    assert.ok(escrowTokenAccount.amount === BigInt(1e9));

    const ownerTokenAccount = await fetchTokenAccount(provider, ownerToken);
    assert.ok(ownerTokenAccount != null);
    assert.equal(ownerTokenAccount.amount, BigInt(9e9));
  });

  let stakeDoneTime = 0;

  it("Stakes tokens", async () => {
    const [stake, bump] = await getStakePublicKey();
    await program.rpc.createStakeAccount(new anchor.BN(1e9), {
      accounts: {
        stake,
        escrow,
        mint,
        owner,
        escrowToken,
        ownerToken,
        tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      },
    });

    stakeDoneTime = Date.now();

    const stakeAccount = await program.account.stake.fetch(stake);
    assert.equal(stakeAccount.owner.toString(), owner.toString());
    assert.equal(stakeAccount.mint.toString(), mint.toString());
    assert.ok(stakeAccount.amount.eq(new anchor.BN(1e9)));
    assert.equal(stakeAccount.bump, bump);
    assert.ok(stakeAccount.createdAt.gt(new anchor.BN(0)));

    const escrowTokenAccount = await fetchTokenAccount(provider, escrowToken);
    assert.ok(escrowTokenAccount != null);
    assert.equal(escrowTokenAccount.amount, BigInt(2e9));
  });

  it("Withdraws tokens", async () => {
    await sleep(5000 - Date.now() + stakeDoneTime);

    const [stake,] = await getStakePublicKey();
    await program.rpc.closeStakeAccount({
      accounts: {
        stake,
        escrow,
        mint,
        owner,
        escrowToken,
        ownerToken,
        tokenProgram: tokenLib.TOKEN_PROGRAM_ID,
      },
    });

    const stakeAccount = await program.account.stake.fetchNullable(stake);
    assert.ok(stakeAccount == null);

    const escrowTokenAccount = await fetchTokenAccount(provider, escrowToken);
    assert.ok(escrowTokenAccount != null);
    assert.equal(escrowTokenAccount.amount, BigInt(1e9-20));

    const ownerTokenAccount = await fetchTokenAccount(provider, ownerToken);
    assert.ok(ownerTokenAccount != null);
    assert.equal(ownerTokenAccount.amount, BigInt(9e9+20));
  });
});

function getEscrowPublicKey(programId: web3.PublicKey, mint: web3.PublicKey): [web3.PublicKey, number] {
  return anchor.utils.publicKey.findProgramAddressSync(
    [Buffer.from("escrow"), mint.toBuffer()],
    programId,
  );
}

async function fetchTokenAccount(provider: anchor.Provider, publicKey: web3.PublicKey): Promise<tokenLib.RawAccount | null> {
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
  const associatedToken = await tokenLib.getAssociatedTokenAddress(mint, owner, true, tokenLib.TOKEN_PROGRAM_ID, tokenLib.ASSOCIATED_TOKEN_PROGRAM_ID);
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

async function mintTo(provider: anchor.Provider, mint: web3.PublicKey, destination: web3.PublicKey, amount: number): Promise<void> {
  const transaction = new web3.Transaction().add(
    tokenLib.createMintToInstruction(mint, destination, provider.wallet.publicKey, amount),
  );
  await provider.send(transaction);
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}
