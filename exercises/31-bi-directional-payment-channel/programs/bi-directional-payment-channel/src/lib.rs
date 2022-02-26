use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use anchor_lang::solana_program::system_instruction;

use crate::program::BiDirectionalPaymentChannel;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bi_directional_payment_channel {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        users: [Pubkey; 2],
        balances: [u64; 2],
        challenge_period: u64,
        expires_at: u64,
    ) -> Result<()> {
        require!(
            users[0] != users[1],
            ChannelError::DuplicateUsers,
        );
        require!(challenge_period > 0, ChannelError::InvalidChallengePeriod);

        let now = Clock::get()?.unix_timestamp as u64;
        require!(expires_at > now,ChannelError::InvalidChallengePeriod);

        let program = &ctx.accounts.program;
        verify_balances(program, balances)?;

        let channel = &mut ctx.accounts.channel;
        channel.users = users;
        channel.balances = balances;
        channel.challenge_period = challenge_period;
        channel.expires_at = expires_at;
        channel.nonce = 0;
        Ok(())
    }

    pub fn challenge_exit(
        ctx: Context<ChallengeExit>,
        balances: [u64; 2],
        nonce: u64,
        signatures: [[u8; 32]; 2],
    ) -> Result<()> {
        let program = &ctx.accounts.program;
        verify_balances(program, balances)?;

        let channel = &mut ctx.accounts.channel;
        let now = Clock::get()?.unix_timestamp as u64;
        require!(channel.expires_at > now, ChannelError::Expired);
        require!(channel.nonce < nonce, ChannelError::InvalidNonce);

        let user = &ctx.accounts.user;
        verify_user(channel.users, user.key)?;
        verify_signatures(channel.balances, nonce, &signatures)?;

        let new_expires_at = now
            .checked_add(channel.challenge_period)
            .ok_or(error!(ChannelError::ExpiresAtOverflow))?;

        channel.balances = balances;
        channel.nonce = nonce;
        channel.expires_at = new_expires_at;
        Ok(())
    }

    pub fn withdraw(ctx: Context<ChallengeExit>) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let now = Clock::get()?.unix_timestamp as u64;
        require!(channel.expires_at <= now, ChannelError::NotExpired);

        let user = &ctx.accounts.user;
        let idx = find_user_index(channel.users, user.key)?;
        let balance = channel.balances[idx];

        channel.balances[idx] = 0;
        if balance > 0 {
            let transfer_ix = system_instruction::transfer(

            );
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, seeds = ["channel"], bump)]
    pub channel: Account<'info, Channel>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub program: Program<'info, BiDirectionalPaymentChannel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]

pub struct ChallengeExit<'info> {
    #[account(mut, seeds = ["channel"], bump = bump)]
    pub channel: Account<'info, Channel>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub program: Program<'info, BiDirectionalPaymentChannel>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub channel: Account<'info, Channel>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[account]
#[derive(Default)]
pub struct Channel {
    pub users: [Pubkey; 2],
    pub balances: [u64; 2],

    pub challenge_period: u64,
    pub expires_at: u64,
    pub nonce: u64,
}

#[error_code]
pub enum ChannelError {
    InsufficientBalance,
    BalanceOverflow,
    InvalidChallengePeriod,
    InvalidExpiresAt,
    InvalidNonce,
    InvalidSignature,
    DuplicateUsers,
    NotUser,
    Expired,
    NotExpired,
    ExpiresAtOverflow,
}

fn find_user_index(
    users: [Pubkey; 2],
    user: &Pubkey,
) -> Result<usize> {
    users.iter().position(|u| u == user).ok_or(error!(ChannelError::NotUser))
}

fn verify_user(
    users: [Pubkey; 2],
    user: &Pubkey,
) -> Result<()> {
    if users.contains(user) {
        err!(ChannelError::NotUser)
    } else {
        Ok(())
    }
}

fn verify_balances(
    program: &Program<'_, BiDirectionalPaymentChannel>,
    balances: [u64; 2],
) -> Result<()> {
    let lamports: u64 = **program.lamports.borrow();
    let lamports_required_option = balances[0].checked_add(balances[1]);
    if let Some(lamports_required) = lamports_required_option {
        if lamports < lamports_required {
            err!(ChannelError::InsufficientBalance)
        } else {
            Ok(())
        }
    } else {
        err!(ChannelError::BalanceOverflow)
    }
}

fn verify_signatures(
    balances: [u64; 2],
    nonce: u64,
    signatures: &[[u8; 32]; 2],
) -> Result<()> {
    signatures
        .iter()
        .try_fold(
            (),
            |_acc, signature| verify_signature(balances, nonce, signature),
        )
}

fn verify_signature(
    balances: [u64; 2],
    nonce: u64,
    signature: &[u8; 32],
) -> Result<()> {
    let hash = keccak::hashv(&[
        &crate::id().to_bytes(),
        &balances[0].to_le_bytes(),
        &balances[0].to_le_bytes(),
        &nonce.to_le_bytes(),
    ]);

    if &hash.to_bytes() == signature {
        Ok(())
    } else {
        err!(ChannelError::InvalidSignature)
    }
}
