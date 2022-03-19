use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("7W4Y4uNcffFFusKuxEbZr22CcjU1819LNK3iyVSqBRhb");

pub const WALLET_ACCOUNT_SEED: &[u8] = b"wallet";

#[program]
pub mod shared_wallet {
    use super::*;

    pub fn create(ctx: Context<Create>, users: Vec<Pubkey>) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet;
        wallet.users = users.clone();
        wallet.bump = *ctx.bumps.get("wallet").unwrap();
        Ok(())
    }

    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let accounts = ctx.accounts;
        let cpi_program = accounts.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: accounts.wallet_token.to_account_info(),
            to: accounts.destination_token.to_account_info(),
            authority: accounts.wallet.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                cpi_program,
                cpi_accounts,
                &[&[WALLET_ACCOUNT_SEED, &[accounts.wallet.bump]]],
            ),
            amount,
        )
    }
}

#[derive(Accounts)]
#[instruction(users: Vec<Pubkey>)]
pub struct Create<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [
            WALLET_ACCOUNT_SEED,
        ],
        space = Wallet::space(users.len()),
        bump,
    )]
    pub wallet: Account<'info, Wallet>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(
        seeds = [
            WALLET_ACCOUNT_SEED,
        ],
        bump,
    )]
    pub wallet: Account<'info, Wallet>,

    #[account(constraint = wallet.users.contains(user.key))]
    pub user: Signer<'info>,
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint =
            wallet_token.mint == mint.key()
            && wallet_token.owner == wallet.key(),
    )]
    pub wallet_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = destination_token.mint == mint.key(),
    )]
    pub destination_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Wallet {
    pub users: Vec<Pubkey>,
    pub bump: u8,
}

impl Wallet {
    pub fn space(num_owners: usize) -> usize {
        8 + 4 + num_owners * 32 + 1
    }
}
