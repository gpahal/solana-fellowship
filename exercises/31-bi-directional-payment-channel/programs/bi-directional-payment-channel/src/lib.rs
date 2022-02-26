use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::{invoke, invoke_signed},
    system_instruction,
};

declare_id!("EUN556Fzp9qKubYWwjUMhcv9AVjvsLhGdFU5CSKj23z");

pub const CHANNEL_SEED: &[u8] = b"channel";
pub const TREASURY_SEED: &[u8] = b"treasury";

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
        require!(expires_at > now, ChannelError::InvalidChallengePeriod);

        let treasury = &mut ctx.accounts.treasury;
        if treasury.owner != &crate::id() && treasury.owner != &System::id() {
            return Err(anchor_lang::error::Error::from(ProgramError::IllegalOwner));
        }
        if treasury.lamports() > 0 || !treasury.data_is_empty() {
            return Err(anchor_lang::error::Error::from(ProgramError::AccountAlreadyInitialized));
        }

        let balance_needed = calculate_total_balance_needed(balances)?;
        let (treasury_key, treasury_bump_seed) = Pubkey::find_program_address(
            &[TREASURY_SEED],
            &crate::id(),
        );
        if &treasury_key != treasury.key {
            msg!("Treasury account is invalid");
            return Err(anchor_lang::error::Error::from(ProgramError::InvalidArgument));
        }

        let authority = &ctx.accounts.authority;
        let system_program = &ctx.accounts.system_program;
        invoke_signed(
            &system_instruction::create_account(
                authority.key,
                treasury.key,
                balance_needed,
                0,
                &crate::id(),
            ),
            &[
                authority.to_account_info(),
                treasury.to_account_info(),
                system_program.to_account_info(),
            ],
            &[&[TREASURY_SEED, &[treasury_bump_seed]]]
        )?;

        let channel = &mut ctx.accounts.channel;
        channel.authority = authority.key();
        channel.users = users;
        channel.balances = balances;
        channel.challenge_period = challenge_period;
        channel.expires_at = expires_at;
        channel.nonce = 0;
        channel.new_proposer = Pubkey::default();
        channel.new_balances = [0, 0];
        channel.new_nonce = 0;
        channel.bump_seed = *ctx.bumps.get("channel").unwrap();
        channel.treasury_bump_seed = treasury_bump_seed;
        Ok(())
    }

    pub fn challenge_exit(
        ctx: Context<ChallengeExit>,
        balances: [u64; 2],
        nonce: u64,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let now = Clock::get()?.unix_timestamp as u64;
        require!(channel.expires_at > now, ChannelError::Expired);
        require!(channel.nonce < nonce, ChannelError::InvalidNonce);

        let treasury = &mut ctx.accounts.treasury;
        verify_balances(treasury, balances)?;

        let user = &ctx.accounts.user;
        verify_user(channel.users, user.key)?;
        if channel.new_proposer != Pubkey::default()
            && channel.new_proposer != user.key()
            && channel.new_balances == balances
            && channel.new_nonce == nonce {
            verify_user(channel.users, &channel.new_proposer)?;

            let new_expires_at = now
                .checked_add(channel.challenge_period)
                .ok_or(error!(ChannelError::ExpiresAtOverflow))?;

            channel.balances = balances;
            channel.expires_at = new_expires_at;
            channel.nonce = nonce;
            channel.new_proposer = Pubkey::default();
            channel.new_balances = [0, 0];
            channel.new_nonce = 0;
        } else {
            channel.new_proposer = user.key();
            channel.new_balances = balances;
            channel.new_nonce = nonce;
        }

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let now = Clock::get()?.unix_timestamp as u64;
        require!(channel.expires_at <= now, ChannelError::NotExpired);

        let user = &ctx.accounts.user;
        let idx = find_user_index(channel.users, user.key)?;
        let balance = channel.balances[idx];

        channel.balances[idx] = 0;

        let treasury = &mut ctx.accounts.treasury;
        if balance > 0 {
            transfer_from_treasury(treasury, user, balance)?;
        }
        Ok(())
    }

    pub fn deposit_treasury(ctx: Context<DepositTreasury>, lamports: u64) -> Result<()> {
        let payer = &ctx.accounts.payer;
        let treasury = &mut ctx.accounts.treasury;
        transfer_to_treasury(treasury, payer, lamports)?;
        Ok(())
    }

    pub fn withdraw_excess_treasury_authority(ctx: Context<WithdrawExcessTreasuryAuthority>) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let treasury = &mut ctx.accounts.treasury;
        let balance_needed = calculate_extra_balance_needed(treasury, channel.balances)?;
        if balance_needed < 0 {
            let authority = &ctx.accounts.authority;
            transfer_from_treasury(
                treasury,
                authority,
                abs_i64_to_u64(balance_needed)?,
            )?;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Channel::LEN, seeds = [CHANNEL_SEED], bump)]
    pub channel: Account<'info, Channel>,
    /// CHECK: Treasury PDA without any associated data.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ChallengeExit<'info> {
    #[account(mut, seeds = [CHANNEL_SEED], bump = channel.bump_seed)]
    pub channel: Account<'info, Channel>,
    /// CHECK: Treasury PDA without any associated data.
    #[account(mut, seeds = [TREASURY_SEED], bump = channel.treasury_bump_seed)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [CHANNEL_SEED], bump = channel.bump_seed)]
    pub channel: Account<'info, Channel>,
    /// CHECK: Treasury PDA without any associated data.
    #[account(mut, seeds = [TREASURY_SEED], bump = channel.treasury_bump_seed)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositTreasury<'info> {
    #[account(mut, seeds = [CHANNEL_SEED], bump = channel.bump_seed)]
    pub channel: Account<'info, Channel>,
    /// CHECK: Treasury PDA without any associated data.
    #[account(mut, seeds = [TREASURY_SEED], bump = channel.treasury_bump_seed)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawExcessTreasuryAuthority<'info> {
    #[account(mut, has_one = authority, seeds = [CHANNEL_SEED], bump = channel.bump_seed)]
    pub channel: Account<'info, Channel>,
    /// CHECK: Treasury PDA without any associated data.
    #[account(mut, seeds = [TREASURY_SEED], bump = channel.treasury_bump_seed)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
#[derive(Default)]
pub struct Channel {
    pub authority: Pubkey,      // 32

    pub users: [Pubkey; 2],     // 64
    pub balances: [u64; 2],     // 16

    pub challenge_period: u64,  // 8
    pub expires_at: u64,        // 8
    pub nonce: u64,             // 8

    // Challenge exit with updated balances.
    pub new_proposer: Pubkey,   // 32
    pub new_balances: [u64; 2], // 16
    pub new_nonce: u64,         // 8

    pub bump_seed: u8,          // 1
    pub treasury_bump_seed: u8, // 1
}

impl Channel {
    pub const LEN: usize = std::mem::size_of::<Channel>();
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

fn transfer_to_treasury<'info>(
    treasury: &UncheckedAccount<'info>,
    from: &Signer<'info>,
    lamports: u64,
) -> Result<()> {
    msg!("Transfer {} lamports to channel", lamports);
    let transfer_ix = system_instruction::transfer(
        from.key,
        treasury.to_account_info().key,
        lamports,
    );
    invoke(
        &transfer_ix,
        &[
            from.to_account_info(),
            treasury.to_account_info(),
        ],
    ).map_err(|err| err.into())
}

fn transfer_from_treasury<'info>(
    treasury: &UncheckedAccount<'info>,
    to: &Signer<'info>,
    lamports: u64,
) -> Result<()> {
    msg!("Transfer {} lamports from channel", lamports);
    **to.try_borrow_mut_lamports()? += lamports;
    **treasury.try_borrow_mut_lamports()? -= lamports;
    Ok(())
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
        Ok(())
    } else {
        err!(ChannelError::NotUser)
    }
}

fn calculate_total_balance_needed(balances: [u64; 2]) -> Result<u64> {
    if let Some(balance_required) = balances[0].checked_add(balances[1]) {
        let rent = Rent::get()?.minimum_balance(0);
        balance_required.checked_add(rent).ok_or(error!(ChannelError::BalanceOverflow))
    } else {
        err!(ChannelError::BalanceOverflow)
    }
}

fn calculate_extra_balance_needed(
    treasury: &UncheckedAccount,
    balances: [u64; 2],
) -> Result<i64> {
    if let Ok(total_balance_needed) = calculate_total_balance_needed(balances) {
        let lamports: u64 = treasury.to_account_info().lamports();
        subtract_u64_to_i64(total_balance_needed, lamports)
    } else {
        err!(ChannelError::BalanceOverflow)
    }
}

fn verify_balances(
    treasury: &UncheckedAccount,
    balances: [u64; 2],
) -> Result<()> {
    let balance_needed = calculate_extra_balance_needed(treasury, balances)?;
    if balance_needed > 0 {
        err!(ChannelError::InsufficientBalance)
    } else {
        Ok(())
    }
}

pub fn abs_i64_to_u64(a: i64) -> Result<u64> {
    if a == i64::MIN {
        err!(ChannelError::BalanceOverflow)
    } else {
        Ok((-a) as u64)
    }
}

pub fn subtract_u64_to_i64(a: u64, b: u64) -> Result<i64> {
    if a >= b {
        let ans = a - b;
        if ans > i64::MAX as u64 {
            err!(ChannelError::BalanceOverflow)
        } else {
            Ok(ans as i64)
        }
    } else {
        let abs_ans = b - a;
        if abs_ans > i64::MAX as u64 + 1 {
            err!(ChannelError::BalanceOverflow)
        } else {
            Ok(-(abs_ans as i64))
        }
    }
}
