use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        hash::hashv,
        msg,
        program_error::ProgramError,
        program_pack::{IsInitialized, Pack, Sealed},
        pubkey::Pubkey,
    },
};

/// The data for a account is always prefixed a `CustomHeader` structure.
#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub struct CustomHeader {
    // The owner of this record
    pub owner: Pubkey,
}

impl Sealed for CustomHeader {}

impl Pack for CustomHeader {
    const LEN: usize = 32;

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let mut slice = dst;
        self.serialize(&mut slice).unwrap()
    }

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let mut p = src;
        CustomHeader::deserialize(&mut p).map_err(|_| {
            msg!("Failed to deserialize name record");
            ProgramError::InvalidAccountData
        })
    }
}

impl IsInitialized for CustomHeader {
    fn is_initialized(&self) -> bool {
        self.owner == Pubkey::default()
    }
}

pub const HASH_PREFIX: &str = "Custom Service";

pub fn get_seeds_and_key(program_id: &Pubkey, owner: &Pubkey) -> (Pubkey, Vec<u8>) {
    let mut seeds_vec: Vec<u8> = hashv(
        &[(HASH_PREFIX.to_owned() + &owner.to_string()).as_bytes()],
    ).to_bytes().to_vec();

    let (record_account_key, bump) =
        Pubkey::find_program_address(&seeds_vec.chunks(32).collect::<Vec<&[u8]>>(), program_id);
    seeds_vec.push(bump);

    (record_account_key, Vec::from(seeds_vec))
}
