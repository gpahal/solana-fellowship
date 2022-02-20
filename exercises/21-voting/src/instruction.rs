use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program_error::ProgramError,
        pubkey::Pubkey,
        system_program,
    },
};

#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub enum VotingInstruction {
    /// Initialize a ballot
    ///
    /// Accounts expected by this instruction:
    ///   0. `[writeable, signer]` Payer account (must be a system account)
    ///   1. `[writeable]` Ballot state account
    InitBallot {
        chairperson: Pubkey,
        proposals: Vec<String>,
    },

    /// Add a voter
    ///
    /// Accounts expected by this instruction:
    ///   0. `[writeable, signer]` Chairperson account
    ///   1. `[]` Ballot state account
    ///   2. `[writeable]` Voter state account
    ///   3. `[]` System program
    AddVoter {
        voter: Pubkey,
        voter_bump_seed: u8,
    },

    /// Delegate vote
    ///
    /// Accounts expected by this instruction:
    ///   0. `[writeable, signer]` Voter account
    ///   1. `[writeable]` Ballot state account
    ///   2. `[writeable]` Voter state account
    ///   3. `[writeable]` To voter state account
    ///   4. `[writeable]` To voter state account (delegate of 3)
    ///   .                "
    ///   .                "
    ///   ... and so on
    DelegateVote,

    /// Vote
    ///
    /// Accounts expected by this instruction:
    ///   0. `[writeable, signer]` Voter account
    ///   1. `[writeable]` Ballot state account
    ///   2. `[writeable]` Voter state account
    Vote {
        vote: u8,
    },
}

pub fn init_ballot(
    program_id: Pubkey,
    instruction_data: VotingInstruction,
    payer_key: Pubkey,
    ballot_state_key: Pubkey,
) -> Result<Instruction, ProgramError> {
    let data = instruction_data.try_to_vec()?;
    let accounts = vec![
        AccountMeta::new(payer_key, true),
        AccountMeta::new(ballot_state_key, false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

pub fn add_voter(
    program_id: Pubkey,
    instruction_data: VotingInstruction,
    chairperson_key: Pubkey,
    ballot_state_key: Pubkey,
    voter_state_key: Pubkey,
) -> Result<Instruction, ProgramError> {
    let data = instruction_data.try_to_vec()?;
    let accounts = vec![
        AccountMeta::new(chairperson_key, true),
        AccountMeta::new_readonly(ballot_state_key, false),
        AccountMeta::new(voter_state_key, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

pub fn delegate_vote(
    program_id: Pubkey,
    instruction_data: VotingInstruction,
    voter_key: Pubkey,
    ballot_state_key: Pubkey,
    voter_state_key: Pubkey,
    to_voter_state_keys: &[Pubkey],
) -> Result<Instruction, ProgramError> {
    let data = instruction_data.try_to_vec()?;
    let mut accounts = vec![
        AccountMeta::new(voter_key, true),
        AccountMeta::new(ballot_state_key, false),
        AccountMeta::new(voter_state_key, false),
    ];

    for to_voter_state_key in to_voter_state_keys {
        accounts.push(AccountMeta::new(*to_voter_state_key, false));
    }

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}

pub fn vote(
    program_id: Pubkey,
    instruction_data: VotingInstruction,
    voter_key: Pubkey,
    ballot_state_key: Pubkey,
    voter_state_key: Pubkey,
) -> Result<Instruction, ProgramError> {
    let data = instruction_data.try_to_vec()?;
    let accounts = vec![
        AccountMeta::new(voter_key, true),
        AccountMeta::new(ballot_state_key, false),
        AccountMeta::new(voter_state_key, false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}
