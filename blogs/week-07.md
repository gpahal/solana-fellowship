# Week 7: Starting on the project

This week was spent designing and implementing the project idea. I made significant progress, finalized the scope and
implemented major parts of the smart contract.

## Project idea

As I described in my last post, for my fellowship project, I've decided to work on streaming payments for Solana.

To recap, the idea is to have a contract that allows a sender to send streaming payments to a recipient. Major product
requirements that I decided on:

- Support for cliffs
- Prepaid and unbounded streams
- Solvency detection and punishment for senders whose streams become insolvent
- Cancellation should be configurable - whether sender and recipient can cancel the stream and when they can cancel
  should be configurable

## Components

There would be 4 main components:

- Streaming contract
- Service that checks for insolvent streams
- Javascript client for usage in browser/node applications
- Web UI for users to manage their streams

One of the main aims I have for the project is that any other project should be able to hook into these components to
incorporate payment streaming.

Another interesting aspect of the project is insolvency - how to detect it, how to decentralize it and how to
incentivize people to not let it happen. I have some ideas on this subject, but still finalizing the approach.

## Naming the project

Probably the most difficult decision of this week. I spent a decent amount of time thinking about it. I finalized on
**Fura**. I was searching what flow is called in different languages. In Japanese, it's Furō. It sounded nice, short and
memorable. So that's what the project will be called.

## Future considerations

There are many more interesting things that can be done. One example is transitive streams. If Alice is streaming to Bob
and Bob is streaming to Charles - Charles can be assured that his stream will not go insolvent till Alice is topping up
the stream. The contract can make sure that, Bob only takes out the net balance from both the streams.

But implementation of these ideas is pretty complex and out of scope for the project. I'll come back to these ideas once
the basic things are in place.

## Tech stack

- I implemented major part of the smart contract. It's made using the awesome
  [Anchor framework](https://book.anchor-lang.com/).
- I'll be building the insolvency checker and javascript client in Typescript.
- For the web UI, I'll use [Remix](https://remix.run/) and Typescript. Using Remix is very pleasant, and I recently
  built my website ([garvitpahal.com](https://garvitpahal.com/)) using it, so I am comfortable with it.

---

I'll be spending the next couple of weeks completing the project, presenting it and completing the fellowship. There is
a lot of work left to be done. Fingers crossed!
