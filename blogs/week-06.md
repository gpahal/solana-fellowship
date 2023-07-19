# Week 6: More Complex dApps

There was no particular theme this week, just practicing, building more complicated programs and starting on the
fellowship project.

## dApps, dApps everywhere...

There were 4 guided quests - all very different.

- [Staking on Solana:](https://openquest.xyz/quest/staking-solana) This talked about what staking is and how you can
stake on Solana. I have been staking on Solana for the past year, and this was a good deep dive into how it works
under the hood.

- [Building a messaging app on Solana:](https://openquest.xyz/quest/solana-messaging-app) This was quest to create a
simple messaging contract and write tests for it.

- [Building a decentralized identity verification system on Solana:](https://alexgrinman.com/posts/building-decentralized-identity-verification-system-on-solana/)
Decentralized identity verification is an interesting problem and one for which blockchains are a good tool to solve.
If you've used ENS (.eth domains) or Bonfida (.sol domains), you should try doing this quest. It gives an idea on how
to implement services like that.

- [Building a blog on Solana:](https://learn.figment.io/tutorials/build-a-blog-dapp-using-anchor) This one was similar
to the messaging app. But the good thing was that the author provided a UI that I could use to play with the app.

The exercise for this week was to create a shared wallet between friends to expense from. The program I built allowed
a group of people to create a shared wallet which they can use to manage any spl token. I used the proxying technique
used last week to create a proxy spl token. The shared wallet only allows transfer of spl tokens for now. It can be
extended to any transaction in the future similar to multi-sig wallets like Goki.

## Fellowship project

For my fellowship project, I've decided to work on streaming payments for Solana.

### The problem

The original idea that I came into the fellowship with:

> Having worked at private remote companies, I have seen people having issues with ESOPs (transparency and
> illiquidity), global payroll and expense management.
>
> This is something I feel blockchain technology can solve especially for newer generation companies which are global,
> distributed, want new structures for incentivisation and want seamless experience for their employees.

At the same time, startups are coming up in India and overseas that are trying to solve for earned wage access. Earned
wage access means employees can access their earned wage anytime. For example a person with a wage of 30k per month can
withdraw ~15k on the 15th of that month, rather than waiting for the start of the next month.

The reason low-income employees want this is that they sometimes face cash crush at the end of the month if there is
any sudden financial expense. They have to resort to predatory loans in these circumstances.

### The Solution

I used Superfluid when I was trying to build something on Ethereum. Thinking about these problems made me think of
it and how easy it would be to build solutions on top of it that can solve the problems mentioned above.

The idea is to have a contract that allows a sender to send streaming payments to a recipient. Some features that I
need for this contract:

- **Support for cliffs:** ESOPs generally involve cliffs, so to support that use case we need some way to codify
cliffs.
- **Prepaid and Unbounded streams:** Some streams like ESOPs would need to be prepaid because employees would need
assurance that some set of tokens are locked up in an escrow that will be given to them on the vesting schedule. Other
streams like payroll, subscriptions will be unbounded - senders can top up the escrow to keep them running.
- **Solvency detection:** Unbounded streams may become insolvent if not topped up timely. There needs to be a way to
identify them as quickly as possible and penalize the sender of that stream somehow. Superfluid uses deposits and
sentinals to incentivize this behaviour. Something similar would be needed here.

There are solutions in the Solana ecosystem that are trying to bring streaming payments to Solana. But these lack some
features that are needed to solve the use cases. Some of these are closed source, so it's difficult to gauge if they
can add these features in an update.

---

Hopefully, I'll be able to build what I have in mind for the project. There is a lot to be designed and implemented,
but after 6 weeks I am much more confident I'll do a decent job.
