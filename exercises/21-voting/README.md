# Voting program

## Build and test the program compiled for BPF

```shell
cargo build-bpf
cargo test-bpf
```

## Using the program

An integration test along with a description is present in [`tests/integration.rs`](./tests/integration.rs). It has a
full working example on how to use the program and all of its features.

## Notes on implementation

- Two types of states are used
  - Ballot: For storing information about the ballot as a whole. Only one ballot state account per program. It stores
    chairperson and state of the proposals
  - Voter: Each voter eligible to vote has a separate account

- When delegating the vote from person A to person B, the program expects that both of them are eligible to vote. Which
  means the chairperson should have granted both of them permission to vote before delegation can take place

- To limit the amount of data stored on chain, various limits are used and appropriate error messages are thrown when
  are violated

```rust
pub const MAX_PROPOSALS: u8 = 32;
pub const MAX_PROPOSAL_NAME_LENGTH: usize = 64;
pub const MAX_DELEGATE_CHAIN: usize = 5;
```
