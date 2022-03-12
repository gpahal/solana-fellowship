# Staking of custom crypto-currency

## Requirements

- [Solana and Anchor](https://book.anchor-lang.com/chapter_2/installation.html)
- [Node.js](https://nodejs.org/en/download/) (>= 14.17.0)
- [yarn](https://yarnpkg.com/en/)

## Build and test the program

```shell
anchor build
anchor test
```

## Running the app

- Start the local solana validator

```shell
solana-test-validator
```

- Build and deploy the program

```shell
anchor build
anchor deploy
```

- Start the app

```shell
cd app
yarn start
```

## Screenshot

![App screenshot](./images/app.png "App screenshot")

## Notes on implementation

- Only 1 stake account is allowed per user per token. This can be extended to support multiple accounts as well.
- Rewards are given every 5 seconds. Every 5 secs, stake accounts receive 0.000002% reward which results in 12.6144%
  APY.
- Right now each token has a corresponding escrow account that funds these rewards. This escrow account needs to be
  funded manually. This can also be automated later by making the program the minting authority of the token.
