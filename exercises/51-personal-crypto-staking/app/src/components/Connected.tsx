import { useState } from "react";
import { Keypair } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";

import { Provider, requestAirdrop, Token, withConnection } from "../utils";

import TokenCreated from "./TokenCreated";

type ConnectedProps = {
  provider: Provider;
  loading: boolean;
  setLoading: (value: boolean) => void;
};

export default function Connected({ provider, loading, setLoading }: ConnectedProps) {
  const [token, setToken] = useState<Token | null>(null);
  const [balanceChangedAt, setBalanceChangedAt] = useState(0);

  const airdrop = withConnection(
    setLoading,
    async (_connection) => {
      setBalanceChangedAt(Date.now());
    }, provider.publicKey,
    1,
  );

  const initialMintHelper = withConnection(
    setLoading,
    async (connection) => {
      const mintingAuthority = await Keypair.generate();
      await requestAirdrop(connection, mintingAuthority.publicKey, 1);

      console.log(`Creating mint with authority: ${mintingAuthority.publicKey.toString()}...`);
      const mint = await createMint(
        connection, mintingAuthority, mintingAuthority.publicKey, mintingAuthority.publicKey, 6);
      console.log(`Created mint: ${mint.toString()}`);

      const token = new Token(mint, mintingAuthority, 6);
      await token.mintTo(connection, provider.publicKey);
      setToken(token);
      setBalanceChangedAt(Date.now());
    },
  );

  return (
    <div>
      <h2>Wallet connected</h2>
      <div>
        <strong>Public Key:</strong> {provider.publicKey.toString()}
      </div>
      <ul>
        <li>
          Airdrop 1 SOL to your wallet{" "}
          <button disabled={loading} onClick={airdrop}>Airdrop SOL</button>
        </li>
        <li>
          Create your own token{" "}
          <button disabled={loading} onClick={initialMintHelper}>Initial Mint</button>
        </li>
      </ul>
      {token
        ? <TokenCreated provider={provider} token={token} loading={loading} setLoading={setLoading} balanceChangedAt={balanceChangedAt} />
        : null}
    </div>
  );
}
