# Week 2: Creating mini dApps

This week's goal was to start creating mini dApps on Solana. There are 2 parts to this - interacting with Solana using
[`@solana/web3.js`](https://solana-labs.github.io/solana-web3.js/) library and creating on-chain programs.

## Thoughts on web2 vs web3 development

On Monday, [Preethi Kasireddy](https://twitter.com/iam_preethi) gave a talk about how web3 development is different
from the classical client-server programming model. On one hand, web3 makes it extremely simple to have a global
computer with persistent storage, but on the other hand, doing iterative development is significantly more difficult.
Another major difference is the security model and how much auditing is needed before deployment. Because iterative
upgrades are difficult, most of the auditing and security reviews need to done prior to deployment.

My experience so far with Solana and Ethereum aligns with that: a lot of the basic concepts are the
same - you are still writing rust/solidity/js, storing/retrieving data, using a database as a source of truth - but
things change a lot when you start building, deploying, combining these components. Be sure to have an open mind if you
want to go deep.

## Solana web3.js library

This week we did 2 quests -
[creating an airdrop program](https://openquest.xyz/quest/create-an-airdrop-program-with-solana-web3.js) and
[creating a roulette game](https://openquest.xyz/quest/roulette_game_in_solana). Both of them were about how to use
[`@solana/web3.js`](https://solana-labs.github.io/solana-web3.js/) to interact with Solana and on-chain programs. The
quests are relatively easy if you know javascript.

My quick review of the library - very easy to use, powerful (you can move real money in a couple of lines of code), and
even better with typescript with all the autocompletion goodness.

## On chain programs

We had to build a voting program with support for delegation
([same thing implemented in Solidity](https://docs.soliditylang.org/en/v0.8.11/solidity-by-example.html)). I wanted to
do this exercise without using the [Anchor framework](https://github.com/project-serum/anchor). Even though it makes
program development much simpler and secure, it abstracts away quite a few things. I wanted to learn how those things
handled by the solana program sdk, without the Anchor abstractions.

It turned out to be more challenging than I expected. I couldn't find a good starting point, so I went into a rabbit
hole and explored the solana program library. I found the
[`name-service`](https://github.com/solana-labs/solana-program-library/tree/master/name-service) program most helpful.
It's features were relatively straightforward and the implementation was simple to understand. I created a template for
myself at [templates/program](../programs/templates/program).

I completed the program after a lot of browsing, going through open source Solana and Rust programs. I had no way to
test it through a UI, so I ended up learning how to write integration tests for Solana. It was satisfying to see the
green check marks after some challenging work.

That being said, I'll be using the Anchor framework from now. If anything, not using it showed me how useful it is.

---

The fellowship seems to be moving into top gear, with each week being more challenging than the last one. I enjoyed this
week's exercise a lot. The only thing lacking was a UI to make it an end-to-end voting system. I'll continue writing
more Solana programs next week, building on this week's work.
