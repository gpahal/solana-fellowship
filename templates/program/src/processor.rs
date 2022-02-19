use solana_program::native_token::LAMPORTS_PER_SOL;
use {
    crate::{
        instruction::CustomInstruction,
        state::{CustomHeader, get_seeds_and_key},
    },
    borsh::BorshDeserialize,
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        entrypoint::ProgramResult,
        msg,
        program::{invoke, invoke_signed},
        program_error::ProgramError,
        program_pack::Pack,
        pubkey::Pubkey,
        system_instruction,
    },
};
use crate::error::CustomError;

pub struct Processor {}

impl Processor {
    pub fn process_sample_create(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        lamports: u64,
    ) -> ProgramResult {
        if lamports < LAMPORTS_PER_SOL / 1000 {
            msg!("The amount of lamports is too few.");
            return Err(CustomError::TooFewLamports.into());
        }

        let accounts_iter = &mut accounts.iter();

        let system_program = next_account_info(accounts_iter)?;
        let payer_account = next_account_info(accounts_iter)?;
        let record_account = next_account_info(accounts_iter)?;
        let record_owner = next_account_info(accounts_iter)?;

        let (record_account_key, seeds) =
            get_seeds_and_key(program_id, record_owner.key);

        if record_account_key != *record_account.key {
            msg!("The given record account is incorrect.");
            return Err(ProgramError::InvalidArgument);
        }
        if record_account.data.borrow().len() > 0 {
            let name_record_header =
                CustomHeader::unpack_from_slice(&record_account.data.borrow())?;
            if name_record_header.owner != Pubkey::default() {
                msg!("The given record account already exists.");
                return Err(ProgramError::InvalidArgument);
            }
        }
        if record_owner.key == &Pubkey::default() {
            msg!("The owner cannot be `Pubkey::default()`.");
            return Err(ProgramError::InvalidArgument);
        }

        if record_account.data.borrow().len() == 0 {
            // Issue the record account.
            // The creation is done in three steps: transfer, allocate and assign.
            // This is because one cannot `system_instruction::create` an account to which lamports
            // have been transferred before.
            invoke(
                &system_instruction::transfer(payer_account.key, &record_account_key, lamports),
                &[
                    payer_account.clone(),
                    record_account.clone(),
                    system_program.clone(),
                ],
            )?;

            invoke_signed(
                &system_instruction::allocate(
                    &record_account_key,
                    CustomHeader::LEN as u64,
                ),
                &[record_account.clone(), system_program.clone()],
                &[&seeds.chunks(32).collect::<Vec<&[u8]>>()],
            )?;

            invoke_signed(
                &system_instruction::assign(record_account.key, program_id),
                &[record_account.clone(), system_program.clone()],
                &[&seeds.chunks(32).collect::<Vec<&[u8]>>()],
            )?;
        }

        let name_state = CustomHeader {
            owner: *record_owner.key,
        };
        name_state.pack_into_slice(&mut record_account.data.borrow_mut());

        Ok(())
    }

    pub fn process_instruction(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        msg!("Begin processing");
        let instruction = CustomInstruction::try_from_slice(instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        msg!("Instruction unpacked");

        match instruction {
            CustomInstruction::SampleCreate {
                lamports,
            } => {
                msg!("Instruction: SampleCreate");
                Processor::process_sample_create(program_id, accounts, lamports)?;
            }
        }
        Ok(())
    }
}
