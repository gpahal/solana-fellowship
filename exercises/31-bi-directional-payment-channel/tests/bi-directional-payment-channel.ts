import * as anchor from "@project-serum/anchor";
import { BN, web3 } from "@project-serum/anchor";
import { assert, expect } from "chai";

import { BiDirectionalPaymentChannel } from "../target/types/bi_directional_payment_channel";

describe("bi-directional-payment-channel", () => {
  const provider = anchor.Provider.env();
  const wallet = provider.wallet;
  anchor.setProvider(provider);

  const program =
    anchor.workspace.BiDirectionalPaymentChannel as anchor.Program<BiDirectionalPaymentChannel>;
  const user1 = web3.Keypair.generate();
  const user2 = web3.Keypair.generate();
  const SOL = web3.LAMPORTS_PER_SOL;

  it("Supports end to end bi directional payment", async () => {
    const [channel, bump_seed] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("channel")],
      program.programId,
    );

    const [treasury, treasury_bump_seed] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("treasury")],
      program.programId,
    );

    await program.rpc.initialize(
      [user1.publicKey, user2.publicKey],
      [new BN(SOL), new BN(2 * SOL)],
      new BN(1),
      new BN(10000000000),
      {
        accounts: {
          channel,
          treasury,
          authority: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        },
      },
    );

    console.log(`Initial balance: ${(await provider.connection.getBalance(treasury)) / web3.LAMPORTS_PER_SOL} SOL`);

    let channelAccount = await program.account.channel.fetch(channel);
    assertDeepEq(channelAccount.authority, wallet.publicKey);
    assertDeepEq(channelAccount.authority, wallet.publicKey);
    assertDeepEq(channelAccount.users, [user1.publicKey, user2.publicKey]);
    assert(channelAccount.balances[0].eq(new BN(SOL)));
    assert(channelAccount.balances[1].eq(new BN(2 * SOL)));
    assert(channelAccount.challengePeriod.eq(new BN(1)));
    assert(channelAccount.expiresAt.eq(new BN(10000000000)));
    assert(channelAccount.nonce.eq(new BN(0)));
    assertDeepEq(channelAccount.newProposer, web3.PublicKey.default);
    assert(channelAccount.newBalances[0].eq(new BN(0)));
    assert(channelAccount.newBalances[1].eq(new BN(0)));
    assert(channelAccount.newNonce.eq(new BN(0)));
    assert.equal(channelAccount.bumpSeed, bump_seed);
    assert.equal(channelAccount.treasuryBumpSeed, treasury_bump_seed);

    try {
      await program.rpc.challengeExit(
        [new BN(2 * SOL), new BN(2 * SOL)],
        new BN(2),
        {
          accounts: {
            channel,
            treasury,
            user: user1.publicKey,
          },
          signers: [user1],
        },
      );
    } catch (e: any) {
      expect(e?.code).to.eq(6000);
    }

    await program.rpc.depositTreasury(
      new BN(SOL),
      {
        accounts: {
          channel,
          treasury,
          payer: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        }
      },
    );

    await program.rpc.challengeExit(
      [new BN(2 * SOL), new BN(2 * SOL)],
      new BN(1),
      {
        accounts: {
          channel,
          treasury,
          user: user1.publicKey,
        },
        signers: [user1],
      },
    );

    channelAccount = await program.account.channel.fetch(channel);
    assertDeepEq(channelAccount.authority, wallet.publicKey);
    assertDeepEq(channelAccount.users, [user1.publicKey, user2.publicKey]);
    assert(channelAccount.balances[0].eq(new BN(SOL)));
    assert(channelAccount.balances[1].eq(new BN(2 * SOL)));
    assert(channelAccount.nonce.eq(new BN(0)));
    assertDeepEq(channelAccount.newProposer, user1.publicKey);
    assert(channelAccount.newBalances[0].eq(new BN(2 * SOL)));
    assert(channelAccount.newBalances[1].eq(new BN(2 * SOL)));
    assert(channelAccount.newNonce.eq(new BN(1)));
    assert.equal(channelAccount.bumpSeed, bump_seed);
    assert.equal(channelAccount.treasuryBumpSeed, treasury_bump_seed);

    await program.rpc.challengeExit(
      [new BN(2 * SOL), new BN(2 * SOL)],
      new BN(1),
      {
        accounts: {
          channel,
          treasury,
          user: user2.publicKey,
        },
        signers: [user2],
      },
    );

    channelAccount = await program.account.channel.fetch(channel);
    assertDeepEq(channelAccount.authority, wallet.publicKey);
    assertDeepEq(channelAccount.users, [user1.publicKey, user2.publicKey]);
    assert(channelAccount.balances[0].eq(new BN(2 * SOL)));
    assert(channelAccount.balances[1].eq(new BN(2 * SOL)));
    assert(channelAccount.nonce.eq(new BN(1)));
    assertDeepEq(channelAccount.newProposer, web3.PublicKey.default);
    assert(channelAccount.newBalances[0].eq(new BN(0)));
    assert(channelAccount.newBalances[1].eq(new BN(0)));
    assert(channelAccount.newNonce.eq(new BN(0)));
    assert.equal(channelAccount.bumpSeed, bump_seed);
    assert.equal(channelAccount.treasuryBumpSeed, treasury_bump_seed);

    // Wait for challenge period to pass.
    await new Promise(r => setTimeout(r, 1500));

    await program.rpc.withdraw(
      {
        accounts: {
          channel,
          treasury,
          user: user1.publicKey,
        },
        signers: [user1],
      },
    );

    channelAccount = await program.account.channel.fetch(channel);
    assertDeepEq(channelAccount.authority, wallet.publicKey);
    assertDeepEq(channelAccount.users, [user1.publicKey, user2.publicKey]);
    assert(channelAccount.balances[0].eq(new BN(0)));
    assert(channelAccount.balances[1].eq(new BN(2 * SOL)));
    assert(channelAccount.nonce.eq(new BN(1)));
    assertDeepEq(channelAccount.newProposer, web3.PublicKey.default);
    assert(channelAccount.newBalances[0].eq(new BN(0)));
    assert(channelAccount.newBalances[1].eq(new BN(0)));
    assert(channelAccount.newNonce.eq(new BN(0)));
    assert.equal(channelAccount.bumpSeed, bump_seed);
    assert.equal(channelAccount.treasuryBumpSeed, treasury_bump_seed);

    await program.rpc.withdrawExcessTreasuryAuthority(
      {
        accounts: {
          channel,
          treasury,
          authority: wallet.publicKey,
        },
        signers: [],
      },
    );

    channelAccount = await program.account.channel.fetch(channel);
    assertDeepEq(channelAccount.authority, wallet.publicKey);
    assertDeepEq(channelAccount.users, [user1.publicKey, user2.publicKey]);
    assert(channelAccount.balances[0].eq(new BN(0)));
    assert(channelAccount.balances[1].eq(new BN(2 * SOL)));
    assert(channelAccount.nonce.eq(new BN(1)));
    assertDeepEq(channelAccount.newProposer, web3.PublicKey.default);
    assert(channelAccount.newBalances[0].eq(new BN(0)));
    assert(channelAccount.newBalances[1].eq(new BN(0)));
    assert(channelAccount.newNonce.eq(new BN(0)));
    assert.equal(channelAccount.bumpSeed, bump_seed);
    assert.equal(channelAccount.treasuryBumpSeed, treasury_bump_seed);

    await program.rpc.withdraw(
      {
        accounts: {
          channel,
          treasury,
          user: user2.publicKey,
        },
        signers: [user2],
      },
    );

    channelAccount = await program.account.channel.fetch(channel);
    assertDeepEq(channelAccount.authority, wallet.publicKey);
    assertDeepEq(channelAccount.users, [user1.publicKey, user2.publicKey]);
    assert(channelAccount.balances[0].eq(new BN(0)));
    assert(channelAccount.balances[1].eq(new BN(0)));
    assert(channelAccount.nonce.eq(new BN(1)));
    assertDeepEq(channelAccount.newProposer, web3.PublicKey.default);
    assert(channelAccount.newBalances[0].eq(new BN(0)));
    assert(channelAccount.newBalances[1].eq(new BN(0)));
    assert(channelAccount.newNonce.eq(new BN(0)));
    assert.equal(channelAccount.bumpSeed, bump_seed);
    assert.equal(channelAccount.treasuryBumpSeed, treasury_bump_seed);

    console.log(`Final balance: ${
      (await provider.connection.getBalance(treasury)) / web3.LAMPORTS_PER_SOL
    } SOL`);
  });
});

function assertDeepEq(got: any, expected: any) {
  expect(got).to.deep.eq(expected);
}
