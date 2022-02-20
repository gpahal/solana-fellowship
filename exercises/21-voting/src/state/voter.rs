use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        msg,
        program_error::ProgramError,
        program_pack::{IsInitialized, Pack, Sealed},
        pubkey::Pubkey,
    },
};

/// Voter represents a single person with the right to vote
///
/// Voter can have 4 possible states:
///   1. Voted (voted == true && delegate == Pubkey::default())
///   2. Delegated (voted == true && delegate != Pubkey::default())
///   3. Neither voted or delegated (voted == false)
#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub struct Voter {
    /// If true, the person has already voted
    pub voted: bool,

    /// Index of the upvoted proposal
    pub vote: u8,

    /// Weight is accumulated by delegation. It should be > 0 after initialization
    pub weight: u64,

    /// The person to delegate to. If not set, it is `Pubkey::default()`
    pub delegate: Pubkey,
}

impl Sealed for Voter {}

impl Pack for Voter {
    const LEN: usize = 42;

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let mut slice = dst;
        self.serialize(&mut slice).unwrap()
    }

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let mut p = src;
        Voter::deserialize(&mut p).map_err(|_| {
            msg!("Failed to deserialize voter account data");
            ProgramError::InvalidAccountData
        })
    }
}

impl IsInitialized for Voter {
    fn is_initialized(&self) -> bool {
        self.weight > 0
    }
}

pub const VOTER_SEED: &str = "Voter";

pub fn get_voter_state_key_and_bump_seed(
    program_id: &Pubkey, ballot_state_key: &Pubkey, voter: &Pubkey) -> (Pubkey, u8) {
    let seeds = &[
        VOTER_SEED.as_bytes(),
        ballot_state_key.as_ref(),
        voter.as_ref(),
    ];
    let (voter_state_key, bump) =
        Pubkey::find_program_address(seeds, program_id);
    (voter_state_key, bump)
}
