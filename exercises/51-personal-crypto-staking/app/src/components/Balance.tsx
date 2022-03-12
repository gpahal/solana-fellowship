import { useEffect, useRef } from "react";

import { Token } from "../utils";

export type TokenBalance = {
  amount?: number,
  stakedAmount?: number,
  rewardAmount?: number,
  escrowAmount?: number,
};

function fmtAmount(token: Token, amount?: number) {
  if (amount == null) {
    return "unknown";
  }
  return `${amount / Math.pow(10, token.decimals)}`;
}

type BalanceProps = {
  token: Token;
  balance: TokenBalance | null;
  refreshBalance: () => Promise<void>;
  loading: boolean;
};

export default function Balance({ token, balance, refreshBalance, loading }: BalanceProps) {
  const interval = useRef<NodeJS.Timer | null>(null);

  useEffect(() => {
    const inner = async () => {
      await refreshBalance();
      if (interval.current) clearInterval(interval.current);

      interval.current = setInterval(() => {
        refreshBalance();
      }, 30000);
    };
    inner();
  }, [refreshBalance]);

  return !balance ? null : (
    <div>
      <h3>Balances:</h3>
      <p>Token balance: {fmtAmount(token, balance.amount)}</p>
      <p>Staked balance: {fmtAmount(token, balance.stakedAmount)}</p>
      <p>Estimated rewards till now: {fmtAmount(token, balance.rewardAmount)}</p>
      <p>Escrow balance: {fmtAmount(token, balance.escrowAmount)}</p>
      <div>
        <button disabled={loading} onClick={refreshBalance}>Refresh Balance</button>
      </div>
    </div>
  )
}
