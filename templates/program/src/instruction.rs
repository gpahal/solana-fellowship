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
pub enum CustomInstruction {
    /// Create an empty record.
    ///
    /// Accounts expected by this instruction:
    ///   0. `[writeable, signer]` Funding account (must be a system account)
    ///   1. `[writeable]` User record to be created (program-derived address)
    ///   2. `[]` Account owner (written into `CustomHeader::owner`)
    ///   3. `[]` System program
    SampleCreate {
        /// Number of lamports to fund the record with
        lamports: u64,
    },
}

pub fn sample_create(
    program_id: Pubkey,
    instruction_data: CustomInstruction,
    payer_key: Pubkey,
    record_account_key: Pubkey,
    record_owner_key: Pubkey,
) -> Result<Instruction, ProgramError> {
    let data = instruction_data.try_to_vec()?;
    let accounts = vec![
        AccountMeta::new(payer_key, true),
        AccountMeta::new(record_account_key, false),
        AccountMeta::new_readonly(record_owner_key, false),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    Ok(Instruction {
        program_id,
        accounts,
        data,
    })
}
