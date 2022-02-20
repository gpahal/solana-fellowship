# Week 2: Create mini dApps

This week's goal was to start creating mini dApps on Solana. This included interacting with Solana using
[`@solana/web3.js`](https://solana-labs.github.io/solana-web3.js/) library and creating on-chain programs.

On Monday, [Preethi Kasireddy](https://twitter.com/iam_preethi) gave a talk about how web3 development is different from
the classical client-server programming model. On one hand, web3 makes it very simple to have a global computer with
persistent storage, but on the other hand doing iterative development is significantly more difficult and security
model is different. My experience so far with Solana and Ethereum aligns with that: a lot of the basic concepts are the
same - you are still writing rust/solidity/js, storing/retrieving data, using a database as a source of truth - but
things change a lot when you start building and combining these components. So be sure to have an open mind if you want
to go deep.

## Solana

### [`@solana/web3.js`](https://solana-labs.github.io/solana-web3.js/)

This week we had 2 quests -
[creating an airdrop program](https://openquest.xyz/quest/create-an-airdrop-program-with-solana-web3.js) and
[creating a roulette game](https://openquest.xyz/quest/roulette_game_in_solana). Both of them were about how to use
[`@solana/web3.js`](https://solana-labs.github.io/solana-web3.js/) to interact with Solana and on-chain programs. My
quick review of the library - very easy to use, powerful (you can move real money in a couple of lines of code), and
it's even better with typescript with all the autocompletion goodness. The quests are relatively easy if you know
javascript.

### On chain programs

We had to build a voting program with support for delegation
([Same thing implemented in Solidity](https://docs.soliditylang.org/en/v0.8.11/solidity-by-example.html)). I wanted to
do this exercise without using the [Anchor framework](https://github.com/project-serum/anchor). Even though it makes
program development much simpler and secure, it abstracts away quite a few things.

It turned out to be more challenging than I expected. I couldn't find a good starting point, so I had to go into a
rabbit hole and explore the solana program library. I found the
[`name-service`](https://github.com/solana-labs/solana-program-library/tree/master/name-service) program most helpful.
It's features were relatively straightforward and the implementation was simple to understand. I created a template for
myself at [templates/program](../templates/program).

I completed the program after a lot of browsing, going through open source Solana and Rust programs. I had no way to
test it through a UI, so I ended up learning how to write integration tests for Solana. It was satisfying to see the
green check marks after some challenging work.
