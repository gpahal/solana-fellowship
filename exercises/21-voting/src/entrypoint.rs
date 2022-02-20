use {
    crate::error::VotingError,
    crate::processor::Processor,
    solana_program::{
        account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, msg,
        program_error::PrintProgramError, pubkey::Pubkey,
    },
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Entrypoint: {}", program_id);
    if let Err(error) = Processor::process_instruction(program_id, accounts, instruction_data) {
        error.print::<VotingError>();
        Err(error)
    } else {
        Ok(())
    }
}
