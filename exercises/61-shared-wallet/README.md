# Shared wallet

## Build and test the program

```shell
anchor build
anchor test
```

## Using the program

Creation and transferring of spl tokens for a group of users is shown in the test
[`shared-wallet.ts`](./tests/shared-wallet.ts).

## Notes on implementation

- The shared wallet only allows transfer of spl tokens for now. It can be extended to any transaction in the future
  similar to multi-sig wallets like Goki.
