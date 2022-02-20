use {
    crate::{
        error::VotingError,
        instruction::VotingInstruction,
        state::{
            ballot::{Ballot, Proposal},
            voter::{Voter, VOTER_SEED},
        },
    },
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        entrypoint::ProgramResult,
        msg,
        program::{invoke_signed},
        program_error::ProgramError,
        program_pack::{IsInitialized, Pack},
        pubkey::Pubkey,
        rent::Rent,
        system_instruction,
        sysvar::Sysvar,
    },
};

pub const MAX_PROPOSALS: u8 = 32;
pub const MAX_DELEGATE_CHAIN: usize = 5;

pub struct Processor {}

impl Processor {
    pub fn process_instruction(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        msg!("Begin processing");
        let instruction = VotingInstruction::try_from_slice(instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        msg!("Instruction unpacked");

        match instruction {
            VotingInstruction::InitBallot { chairperson, proposals } => {
                msg!("Instruction: InitBallot");
                Processor::process_init_ballot(program_id, accounts, chairperson, proposals)?;
            }
            VotingInstruction::AddVoter { voter, voter_bump_seed } => {
                msg!("Instruction: AddVoter");
                Processor::process_add_voter(program_id, accounts, voter, voter_bump_seed)?;
            }
            VotingInstruction::DelegateVote => {
                msg!("Instruction: DelegateVote");
                Processor::process_delegate_vote(program_id, accounts)?;
            }
            VotingInstruction::Vote { vote } => {
                msg!("Instruction: Vote");
                Processor::process_vote(program_id, accounts, vote)?;
            }
        }
        Ok(())
    }

    pub fn process_init_ballot(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        chairperson: Pubkey,
        proposals: Vec<String>,
    ) -> ProgramResult {
        if proposals.len() == 0 {
            return Err(VotingError::NoProposals.into());
        } else if proposals.len() > MAX_PROPOSALS as usize {
            return Err(VotingError::TooManyProposals.into());
        }

        let accounts_iter = &mut accounts.iter();

        let payer_account = next_account_info(accounts_iter)?;
        if !payer_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let ballot_state_account = next_account_info(accounts_iter)?;
        Processor::ensure_uninitialized_ballot_state_account(program_id, ballot_state_account)?;

        let ballot_state = Ballot {
            is_initialized: true,
            chairperson,
            proposals: proposals
                .into_iter()
                .map(|name| Proposal { name, vote_count: 0 })
                .collect(),
        };
        ballot_state.serialize(&mut *ballot_state_account.data.borrow_mut())?;

        Ok(())
    }

    pub fn process_add_voter(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        voter: Pubkey,
        voter_bump_seed: u8,
    ) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let chairperson_account = next_account_info(accounts_iter)?;
        if !chairperson_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let ballot_state_account = next_account_info(accounts_iter)?;
        Processor::get_initialized_ballot_state(program_id, ballot_state_account)?;

        let voter_state_account = next_account_info(accounts_iter)?;
        Processor::ensure_uninitialized_voter_state_account(program_id, voter_state_account)?;

        if voter_state_account.data.borrow().len() == 0 {
            Processor::create_voter_data_account(
                program_id,
                accounts,
                chairperson_account,
                ballot_state_account,
                voter_state_account,
                &voter,
                voter_bump_seed,
            )?;
        }

        let voter_state = Voter {
            voted: false,
            vote: 0,
            weight: 1,
            delegate: Pubkey::default(),
        };
        voter_state.pack_into_slice(&mut voter_state_account.data.borrow_mut());

        Ok(())
    }

    pub fn process_delegate_vote(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
    ) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let voter_account = next_account_info(accounts_iter)?;
        if !voter_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let ballot_state_account = next_account_info(accounts_iter)?;
        let mut ballot_state = Processor::get_initialized_ballot_state(
            program_id, ballot_state_account)?;

        let voter_state_account = next_account_info(accounts_iter)?;
        let mut voter_state = Processor::get_initialized_voter_state(
            program_id, voter_state_account)?;
        if voter_state.voted {
            return Err(VotingError::AlreadyVoted.into());
        }

        let mut found_final_to_voter = false;
        let mut to_voter_state_account = next_account_info(accounts_iter)?;
        for _ in 0..MAX_DELEGATE_CHAIN {
            if to_voter_state_account.key == voter_state_account.key {
                return Err(VotingError::DelegateChainCycle.into());
            }

            let to_voter_state = Processor::get_initialized_voter_state(
                program_id, to_voter_state_account)?;
            if to_voter_state.delegate == Pubkey::default() {
                found_final_to_voter = true;
                break;
            }

            to_voter_state_account = next_account_info(accounts_iter)?;
        }

        if !found_final_to_voter {
            return Err(VotingError::MaxDelegateChainLimitExceeded.into());
        }

        voter_state.voted = true;
        voter_state.delegate = *to_voter_state_account.key;
        voter_state.pack_into_slice(&mut voter_state_account.data.borrow_mut());

        let mut to_voter_state = Voter::unpack_from_slice(&to_voter_state_account.data.borrow())?;
        if to_voter_state.voted {
            ballot_state.proposals[to_voter_state.vote as usize].vote_count += voter_state.weight;
            ballot_state.serialize(&mut *ballot_state_account.data.borrow_mut())?;
        } else {
            to_voter_state.weight += voter_state.weight;
            to_voter_state.pack_into_slice(&mut to_voter_state_account.data.borrow_mut());
        }

        Ok(())
    }

    pub fn process_vote(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        vote: u8,
    ) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let voter_account = next_account_info(accounts_iter)?;
        if !voter_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let ballot_state_account = next_account_info(accounts_iter)?;
        let mut ballot_state = Processor::get_initialized_ballot_state(
            program_id, ballot_state_account)?;
        if vote as usize >= ballot_state.proposals.len() {
            return Err(VotingError::InvalidVote.into());
        }

        let voter_state_account = next_account_info(accounts_iter)?;
        let mut voter_state = Processor::get_initialized_voter_state(
            program_id, voter_state_account)?;
        if voter_state.voted {
            return Err(VotingError::AlreadyVoted.into());
        }

        voter_state.voted = true;
        voter_state.vote = vote;
        voter_state.pack_into_slice(&mut voter_state_account.data.borrow_mut());

        ballot_state.proposals[vote as usize].vote_count += voter_state.weight;
        ballot_state.serialize(&mut *ballot_state_account.data.borrow_mut())?;

        Ok(())
    }

    fn ensure_uninitialized_ballot_state_account(
        program_id: &Pubkey, ballot_state_account: &AccountInfo) -> Result<(), ProgramError> {
        if ballot_state_account.owner != program_id {
            return Err(ProgramError::IllegalOwner);
        }

        let ballot_state_result = Ballot::try_from_slice(*ballot_state_account.data.borrow());
        if let Ok(ballot_state) = ballot_state_result {
            if ballot_state.is_initialized {
                return Err(ProgramError::AccountAlreadyInitialized);
            }
        }
        Ok(())
    }

    fn get_initialized_ballot_state(
        program_id: &Pubkey, ballot_state_account: &AccountInfo) -> Result<Ballot, ProgramError> {
        if ballot_state_account.owner != program_id {
            return Err(ProgramError::IllegalOwner);
        }

        let ballot_state = Ballot::try_from_slice(*ballot_state_account.data.borrow())?;
        if !ballot_state.is_initialized {
            return Err(ProgramError::UninitializedAccount);
        }
        Ok(ballot_state)
    }

    fn ensure_uninitialized_voter_state_account(
        program_id: &Pubkey, voter_state_account: &AccountInfo) -> Result<(), ProgramError> {
        if voter_state_account.data.borrow().len() > 0 {
            if voter_state_account.owner != program_id {
                return Err(ProgramError::IllegalOwner);
            }

            let voter_state = Voter::unpack_from_slice(&voter_state_account.data.borrow())?;
            if voter_state.is_initialized() {
                return Err(ProgramError::AccountAlreadyInitialized);
            }
        }
        Ok(())
    }

    fn create_voter_data_account(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        chairperson_account: &AccountInfo,
        ballot_state_account: &AccountInfo,
        voter_state_account: &AccountInfo,
        voter: &Pubkey,
        voter_bump_seed: u8,
    ) -> Result<(), ProgramError> {
        let create_voter_state_account_instruction = system_instruction::create_account(
            chairperson_account.key,
            voter_state_account.key,
            Rent::get()?.minimum_balance(Voter::LEN),
            Voter::LEN as u64,
            program_id,
        );

        let seeds = &[
            VOTER_SEED.as_bytes(),
            ballot_state_account.key.as_ref(),
            voter.as_ref(),
            &[voter_bump_seed],
        ];

        invoke_signed(&create_voter_state_account_instruction, accounts, &[seeds])
    }

    fn get_initialized_voter_state(
        program_id: &Pubkey, voter_state_account: &AccountInfo) -> Result<Voter, ProgramError> {
        if *voter_state_account.key == Pubkey::default() {
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        if voter_state_account.owner != program_id {
            return Err(ProgramError::IllegalOwner);
        }
        if voter_state_account.data.borrow().len() == 0 {
            return Err(ProgramError::UninitializedAccount);
        }

        let voter_state = Voter::unpack_from_slice(&voter_state_account.data.borrow())?;
        if !voter_state.is_initialized() {
            return Err(ProgramError::UninitializedAccount);
        }
        Ok(voter_state)
    }
}
