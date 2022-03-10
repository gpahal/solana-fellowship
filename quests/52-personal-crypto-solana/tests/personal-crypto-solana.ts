import * as anchor from "@project-serum/anchor";
import { Program, web3 } from "@project-serum/anchor";
import * as serumCommon from "@project-serum/common";
import { TokenInstructions } from "@project-serum/serum";
import * as assert from "assert";
import { PersonalCryptoSolana } from "../target/types/personal_crypto_solana";

describe("personal-crypto-solana", () => {
  // Configure the client to use the test cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PersonalCryptoSolana as Program<PersonalCryptoSolana>;

  let mint: web3.PublicKey = web3.PublicKey.default;
  let from: web3.PublicKey = web3.PublicKey.default;
  let to: web3.PublicKey = web3.PublicKey.default;

  it("Initializes test state", async () => {
    mint = await createMint(provider);
    from = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    to = await createTokenAccount(provider, mint, provider.wallet.publicKey);
  });

  it("Mints a token", async () => {
    await program.rpc.proxyMintTo(new anchor.BN(1000), {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to: from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const fromAccount = await getTokenAccount(provider, from);
    assert.ok(fromAccount.amount.eq(new anchor.BN(1000)));
  });

  it("Transfers a token", async () => {
    await program.rpc.proxyTransfer(new anchor.BN(400), {
      accounts: {
        authority: provider.wallet.publicKey,
        to,
        from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const fromAccount = await getTokenAccount(provider, from);
    const toAccount = await getTokenAccount(provider, to);

    assert.ok(fromAccount.amount.eq(new anchor.BN(600)));
    assert.ok(toAccount.amount.eq(new anchor.BN(400)));
  });

  it("Burns a token", async () => {
    await program.rpc.proxyBurn(new anchor.BN(350), {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const toAccount = await getTokenAccount(provider, to);
    assert.ok(toAccount.amount.eq(new anchor.BN(50)));
  });

  it("Set new mint authority", async () => {
    const newMintAuthority = anchor.web3.Keypair.generate();
    await program.rpc.proxySetAuthority(
      { mintTokens: {} },
      newMintAuthority.publicKey,
      {
        accounts: {
          accountOrMint: mint,
          currentAuthority: provider.wallet.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      }
    );

    const mintInfo = await getMintInfo(provider, mint);
    assert.ok(mintInfo.mintAuthority.equals(newMintAuthority.publicKey));
  });
});

const TOKEN_PROGRAM_ID: web3.PublicKey = TokenInstructions.TOKEN_PROGRAM_ID;

async function getTokenAccount(provider: anchor.Provider, addr: web3.PublicKey) {
  return await serumCommon.getTokenAccount(provider, addr);
}

async function getMintInfo(provider: anchor.Provider, mintAddr: web3.PublicKey) {
  return await serumCommon.getMintInfo(provider, mintAddr);
}

async function createMint(provider: anchor.Provider, authority?: web3.PublicKey) {
  if (authority === undefined) {
    authority = provider.wallet.publicKey;
  }

  const mint = anchor.web3.Keypair.generate();
  const instructions = await createMintInstructions(
    provider,
    authority,
    mint.publicKey
  );

  const tx = new anchor.web3.Transaction();
  tx.add(...instructions);

  await provider.send(tx, [mint]);

  return mint.publicKey;
}

async function createMintInstructions(
  provider: anchor.Provider,
  authority: web3.PublicKey,
  mint: web3.PublicKey,
) {
  return [
    web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeMint({
      mint,
      decimals: 0,
      mintAuthority: authority,
    }),
  ];
}

async function createTokenAccount(
  provider: anchor.Provider,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
) {
  const vault = anchor.web3.Keypair.generate();
  const tx = new anchor.web3.Transaction();
  tx.add(
    ...(await createTokenAccountInstrs(provider, vault.publicKey, mint, owner))
  );
  await provider.send(tx, [vault]);
  return vault.publicKey;
}

async function createTokenAccountInstrs(
  provider: anchor.Provider,
  newAccountPublicKey: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  lamports?: number,
) {
  if (lamports === undefined) {
    lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
  }
  return [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: newAccountPublicKey,
      space: 165,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeAccount({
      account: newAccountPublicKey,
      mint,
      owner,
    }),
  ];
}
