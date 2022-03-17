use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const USERNAME_ACCOUNT_SEED: &[u8] = b"username";

#[program]
pub mod identity_verification_system {
    use super::*;

    pub fn claim_username(ctx: Context<ClaimUsername>, username: String) -> Result<()> {
        if username.len() >= UserAccount::MAX_USERNAME_LEN {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.user.username = username.clone();
        ctx.accounts.user.authority = ctx.accounts.authority.key();
        ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(username: String)]
pub struct ClaimUsername<'info> {
    #[account(
        init,
        seeds = [USERNAME_ACCOUNT_SEED, username.as_bytes()],
        payer = authority,
        space = UserAccount::SPACE,
        bump,
    )]
    user: Account<'info, UserAccount>,

    #[account(mut)]
    authority: Signer<'info>,

    system_program: Program<'info, System>,
}

#[account]
pub struct UserAccount {
    pub username: String,
    pub authority: Pubkey,
    pub bump: u8,
}

impl UserAccount {
    pub const MAX_USERNAME_LEN: usize = 140;

    pub const SPACE: usize = 8 + 4 + Self::MAX_USERNAME_LEN + 32 + 1;
}
