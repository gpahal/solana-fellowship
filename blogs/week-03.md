# Week 2: More dApps

This week's goal was to continue creating dApps on Solana - not as simple as last week's.

## Anchor framework

I had a personal goal this week - to learn and use the
[Anchor framework](https://github.com/project-serum/anchor). Anchor provides an eDSL for writing Solana programs and IDL
that can be used to generate a client. It also comes with a cli and workspace management for developing applications.

I faced a lot of issues last week getting started with Solana programs. Too little documentation and quite a bit of
boilerplate. The thing that helped me a great deal was looking at open-source programs, especially
[`solana-program-library`](https://github.com/solana-labs/solana-program-library).

I had heard great things about Anchor, so I decided to use it for this week's work. And it was great. It was easy to
follow along the tutorials, go through [The Anchor Book](https://book.anchor-lang.com/), start a new project and get a
program to working state. It makes Solana development feel as simple as Solidity development. The only problem I faced
was the limited documentation, which was expected given that it's a young project and under active development.

## On chain programs

This week we did 3 quests -
[building a crowdfunding platform](https://openquest.xyz/quest/building-a-crowdfunding-platform-using-solana),
[setting up campaign accounts and sending money](https://openquest.xyz/quest/setting-up-campaign-accounts-and-sending-money-on-solana)
and [creating an on-chain calculator](https://openquest.xyz/quest/solana-calculator). These were easy to follow after
last week's exercise. The calculator program was also a good introduction to using the Anchor framework.

This week's exercise was to build a bi-directional payment channel
([same thing implemented in Solidity](https://solidity-by-example.org/app/bi-directional-payment-channel/)). This was a
challenging exercise, just like last one, but for different reasons.

The programming models of Ethereum and Solana are very different. So directly copying over the logic is not possible.
Where you can store data, where you hold the treasury, how you manage the treasury - all of these things have to handled
differently on Solana.

There were many instances when I thought I am done with the program logic, just to be hit with another error and having
to learn something new about the Solana programming model. I did manage to complete it after a day of work. What was
really helpful is that I wrote some basic tests beforehand. So the build and test cycle was really tight.

Some final thoughts - Anchor is awesome, be ready to go into rabbit holes as the documentation and example programs are
limited, test continuously, error messages are not clear sometimes, join the Anchor and Solana discords to get help.

---

After the last couple of exercises, writing a Solana program seems a lot more approachable. I can start thinking about
my project now which I have to complete by the end of March. In the coming weeks, we'll dive deeper into NFT's, DeFi,
DAOs, etc.
