use {
    thiserror::Error,
    solana_program::{
        decode_error::DecodeError, msg, program_error::{PrintProgramError, ProgramError},
    },
};

#[derive(Clone, Debug, PartialEq, Eq, num_derive::FromPrimitive, Error)]
pub enum VotingError {
    #[error("No proposal given")]
    NoProposals,
    #[error("Too many proposals given")]
    TooManyProposals,
    #[error("Already voted")]
    AlreadyVoted,
    #[error("Delegate chain has a cycle")]
    DelegateChainCycle,
    #[error("Max delegate chain limit exceeded")]
    MaxDelegateChainLimitExceeded,
    #[error("Invalid vote")]
    InvalidVote,
}

impl From<VotingError> for ProgramError {
    fn from(e: VotingError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for VotingError {
    fn type_of() -> &'static str {
        "VotingError"
    }
}

impl PrintProgramError for VotingError {
    fn print<E>(&self)
        where
            E: 'static + std::error::Error + DecodeError<E> + PrintProgramError +
            num_traits::FromPrimitive,
    {
        match self {
            VotingError::NoProposals => msg!("Error: EmptyProposals"),
            VotingError::TooManyProposals => msg!("Error: TooManyProposals"),
            VotingError::AlreadyVoted => msg!("Error: AlreadyVoted"),
            VotingError::DelegateChainCycle => msg!("Error: DelegateChainCycle"),
            VotingError::MaxDelegateChainLimitExceeded =>
                msg!("Error: MaxDelegateChainLimitExceeded"),
            VotingError::InvalidVote => msg!("Error: InvalidVote"),
        }
    }
}
