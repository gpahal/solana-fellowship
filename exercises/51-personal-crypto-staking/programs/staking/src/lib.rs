use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub const ESCROW_ACCOUNT_SEED: &[u8] = b"escrow";
pub const STAKE_ACCOUNT_SEED: &[u8] = b"stake";

// Reward percent per 5 second =
//     REWARD_PERCENT_PER_5_SECONDS_SIGNIFICAND * 10 ^ -REWARD_PERCENT_PER_5_SECONDS_DECIMAL
const REWARD_PERCENT_PER_5_SECONDS_SIGNIFICAND: u128 = 2;
const REWARD_PERCENT_PER_5_SECONDS_DECIMAL: u32 = 8;
const REWARD_PERCENT_PER_5_SECONDS_DIVISOR: u128 = 10u128.pow(REWARD_PERCENT_PER_5_SECONDS_DECIMAL);

#[program]
pub mod staking {
    use super::*;

    pub fn create_escrow_account(ctx: Context<CreateEscrowAccount>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.payer = ctx.accounts.payer.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.bump = *ctx.bumps.get("escrow").unwrap();
        Ok(())
    }

    pub fn fund_escrow_account(ctx: Context<FundEscrowAccount>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.payer_token.amount >= amount,
            StakingError::InsufficientFunds
        );
        ctx.accounts.transfer_to_escrow(amount)
    }

    pub fn create_stake_account(ctx: Context<CreateStakeAccount>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        require!(
            ctx.accounts.owner_token.amount >= amount,
            StakingError::InsufficientFunds
        );

        let stake = &mut ctx.accounts.stake;
        stake.owner = ctx.accounts.owner.key();
        stake.mint = ctx.accounts.mint.key();
        stake.amount = amount;
        stake.created_at = get_current_time()?;
        stake.bump = *ctx.bumps.get("stake").unwrap();

        ctx.accounts.transfer_to_escrow(amount)
    }

    pub fn close_stake_account(ctx: Context<CloseStakeAccount>) -> Result<()> {
        ctx.accounts.transfer_from_escrow(
            ctx.accounts.escrow.bump,
            ctx.accounts.stake.calculate_total_amount()?,
        )
    }
}

#[derive(Accounts)]
pub struct CreateEscrowAccount<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [
            ESCROW_ACCOUNT_SEED,
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        has_one = mint,
        constraint = escrow_token.owner == escrow.key(),
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundEscrowAccount<'info> {
    #[account(
        seeds = [
            ESCROW_ACCOUNT_SEED,
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        has_one = mint,
        constraint = escrow_token.owner == escrow.key(),
    )]
    pub escrow_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = mint,
        constraint = payer_token.owner == payer.key(),
    )]
    pub payer_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateStakeAccount<'info> {
    #[account(
        init,
        payer = owner,
        seeds = [
            STAKE_ACCOUNT_SEED,
            owner.key.as_ref(),
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub stake: Account<'info, Stake>,
    #[account(
        seeds = [
            ESCROW_ACCOUNT_SEED,
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        has_one = mint,
        constraint = escrow_token.owner == escrow.key(),
    )]
    pub escrow_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = owner,
        has_one = mint,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseStakeAccount<'info> {
    #[account(
        mut,
        close = owner,
        seeds = [
            STAKE_ACCOUNT_SEED,
            owner.key.as_ref(),
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub stake: Account<'info, Stake>,
    #[account(
        seeds = [
            ESCROW_ACCOUNT_SEED,
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        has_one = mint,
        constraint = escrow_token.owner == escrow.key(),
    )]
    pub escrow_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = owner,
        has_one = mint,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> FundEscrowAccount<'info> {
    pub fn transfer_to_escrow(&self, amount: u64) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.payer_token.to_account_info(),
            to: self.escrow_token.to_account_info(),
            authority: self.payer.to_account_info(),
        };
        transfer(CpiContext::new(cpi_program, cpi_accounts), amount)
    }
}

impl<'info> CreateStakeAccount<'info> {
    pub fn transfer_to_escrow(&self, amount: u64) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.owner_token.to_account_info(),
            to: self.escrow_token.to_account_info(),
            authority: self.owner.to_account_info(),
        };
        transfer(CpiContext::new(cpi_program, cpi_accounts), amount)
    }
}

impl<'info> CloseStakeAccount<'info> {
    pub fn transfer_from_escrow(&self, bump: u8, amount: u64) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.escrow_token.to_account_info(),
            to: self.owner_token.to_account_info(),
            authority: self.escrow.to_account_info(),
        };
        transfer(
            CpiContext::new_with_signer(
                cpi_program,
                cpi_accounts,
                &[&[ESCROW_ACCOUNT_SEED, self.mint.key().as_ref(), &[bump]]],
            ),
            amount,
        )
    }
}

#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Escrow {
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Stake {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub created_at: u64,
    pub bump: u8,
}

impl Stake {
    pub fn calculate_total_amount(&self) -> Result<u64> {
        self.amount
            .checked_add(self.calculate_reward()?)
            .ok_or(error!(StakingError::TotalAmountOutOfBounds))
    }

    pub fn calculate_reward(&self) -> Result<u64> {
        let now = get_current_time()?;
        if now <= self.created_at {
            return Ok(0);
        }

        let time_elapsed = (now - self.created_at) as u128;
        let reward = (time_elapsed / 5)
            * (self.amount as u128 * REWARD_PERCENT_PER_5_SECONDS_SIGNIFICAND)
            / (REWARD_PERCENT_PER_5_SECONDS_DIVISOR);
        if reward > u64::MAX as u128 {
            err!(StakingError::RewardOutOfBounds)
        } else {
            Ok(reward as u64)
        }
    }
}

fn get_current_time() -> Result<u64> {
    Ok(Clock::get()?.unix_timestamp as u64)
}

#[error_code]
enum StakingError {
    #[msg("The amount cannot be zero.")]
    ZeroAmount,
    #[msg("The reward amount is out of bounds.")]
    RewardOutOfBounds,
    #[msg("The total amount is out of bounds.")]
    TotalAmountOutOfBounds,
    #[msg("The paying account has insufficient funds.")]
    InsufficientFunds,
}
