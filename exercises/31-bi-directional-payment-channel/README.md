# Bi-directional payment channel program

## Build and test the program compiled for BPF

```shell
cargo build-bpf
cargo test-bpf
```

## Using the program

An integration test along with a description is present in
[`tests/bi-directional-payment-channel.ts`](./tests/bi-directional-payment-channel.ts). It has a full working example on
how to use the program and all of its features.

## Notes on implementation

- The program has 2 PDAs
  - Channel: For storing the channel state
  - Treasury: A zero-data account holding the SOL

- The program always ensure whenever balances change, treasury has enough SOL

- There is an authority which initiates the channel and funds the treasury. This authority has the power to withdraw any
  excess funds after both the users have withdrawn their shares.

- If someone wants to update balances to higher values, the authority must first deposit the required amount in the
  treasury. If authority deposits more amount than necessary or balances are updated to a lower sum values, authority
  can withdraw excess funds anytime.

- In order to update balances, the program requires two instructions - one for each user. Each user need to confirm the
  new balances and the new nonce, with them being signers to their individual instructions. This approach is similar to
  the one used by the [`project-serum/multisig`](https://github.com/project-serum/multisig) program, rather than the
  offline signature scheme used by the Solidity program.
