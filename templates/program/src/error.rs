use {
    thiserror::Error,
    solana_program::{
        decode_error::DecodeError, msg, program_error::{PrintProgramError, ProgramError},
    },
};

#[derive(Clone, Debug, PartialEq, Eq, num_derive::FromPrimitive, Error)]
pub enum CustomError {
    #[error("Too few lamports for record creation")]
    TooFewLamports,
}

pub type CustomProgramResult = Result<(), CustomError>;

impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for CustomError {
    fn type_of() -> &'static str {
        "CustomError"
    }
}

impl PrintProgramError for CustomError {
    fn print<E>(&self)
        where
            E: 'static + std::error::Error + DecodeError<E> + PrintProgramError +
            num_traits::FromPrimitive,
    {
        match self {
            CustomError::TooFewLamports => msg!("Error: Too few lamports for record creation"),
        }
    }
}
