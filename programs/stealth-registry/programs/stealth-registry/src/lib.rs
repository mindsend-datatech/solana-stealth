use anchor_lang::prelude::*;

declare_id!("3yLhEZ1di979tt2SrHsPMwvScYD89rGXmMryRhZwtAM2");

/// The maximum length of a stealth handle (e.g., "ariel")
const MAX_HANDLE_LEN: usize = 32;

#[program]
pub mod stealth_registry {
    use super::*;

    /// Registers a new .stealth handle.
    /// Creates a PDA seeded by ["stealth", handle_bytes].
    /// The caller becomes the owner (authority).
    pub fn register(ctx: Context<Register>, handle: String) -> Result<()> {
        require!(handle.len() <= MAX_HANDLE_LEN, StealthError::HandleTooLong);
        require!(!handle.is_empty(), StealthError::HandleEmpty);
        // Basic validation: alphanumeric + underscore only
        require!(
            handle.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'),
            StealthError::InvalidHandleChars
        );

        let registry_entry = &mut ctx.accounts.registry_entry;
        registry_entry.handle = handle.clone();
        registry_entry.authority = ctx.accounts.authority.key();
        registry_entry.bump = ctx.bumps.registry_entry;

        msg!("Registered handle: {}.stealth -> {}", handle, registry_entry.authority);
        Ok(())
    }

    /// Updates the authority of an existing .stealth handle.
    /// Only the current authority can call this.
    pub fn update_authority(ctx: Context<UpdateAuthority>, _handle: String, new_authority: Pubkey) -> Result<()> {
        let registry_entry = &mut ctx.accounts.registry_entry;
        registry_entry.authority = new_authority;
        msg!("Updated {}.stealth -> {}", registry_entry.handle, new_authority);
        Ok(())
    }
}

// --- ACCOUNTS ---

#[derive(Accounts)]
#[instruction(handle: String)]
pub struct Register<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + RegistryEntry::INIT_SPACE,
        seeds = [b"stealth", handle.as_bytes()],
        bump
    )]
    pub registry_entry: Account<'info, RegistryEntry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(handle: String)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"stealth", handle.as_bytes()],
        bump = registry_entry.bump,
        has_one = authority @ StealthError::Unauthorized
    )]
    pub registry_entry: Account<'info, RegistryEntry>,

    pub authority: Signer<'info>,
}

// --- DATA ---

#[account]
#[derive(InitSpace)]
pub struct RegistryEntry {
    /// The human-readable handle (e.g., "ariel")
    #[max_len(32)]
    pub handle: String,
    /// The Solana public key that owns this handle
    pub authority: Pubkey,
    /// PDA bump seed
    pub bump: u8,
}

// --- ERRORS ---

#[error_code]
pub enum StealthError {
    #[msg("Handle exceeds maximum length of 32 characters.")]
    HandleTooLong,
    #[msg("Handle cannot be empty.")]
    HandleEmpty,
    #[msg("Handle contains invalid characters. Use alphanumeric and underscores only.")]
    InvalidHandleChars,
    #[msg("You are not authorized to modify this handle.")]
    Unauthorized,
}
