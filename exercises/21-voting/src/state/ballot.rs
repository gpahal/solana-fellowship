use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::pubkey::Pubkey,
};

/// Voter represents a single voter
#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub struct Ballot {
    // If true, ballot has been initialized
    pub is_initialized: bool,

    // Chairperson of the ballot who is the only person can give right to vote
    pub chairperson: Pubkey,

    // Total number of proposals
    pub proposals: Vec<Proposal>,
}

/// Proposal represents a single proposal people can vote on
#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub struct Proposal {
    /// Name of the proposal
    pub name: String,

    /// Number of accumulated votes
    pub vote_count: u64,
}

impl Ballot {
    pub fn serialized_size(&self) -> usize {
        self
            .try_to_vec()
            .expect("Failed to serialize Ballot")
            .len()
    }
}

pub const BALLOT_SEED: &str = "Ballot";

pub fn get_ballot_state_key(base: &Pubkey) -> Pubkey {
    Pubkey::create_with_seed(
        base,
        BALLOT_SEED,
        &crate::id(),
    ).expect("Failed to create ballot state key")
}
