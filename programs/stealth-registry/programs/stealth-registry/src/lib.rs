use anchor_lang::prelude::*;

declare_id!("DbGF7nB2kuMpRxwm4b6n11XcWzwvysDGQGztJ4Wvvu13");

/// The maximum length of a stealth handle (e.g., "ariel")
const MAX_HANDLE_LEN: usize = 32;

#[program]
pub mod stealth_registry {
    use super::*;

    /// Registers a new .stealth handle.
    /// Creates a PDA seeded by ["stealth", handle_bytes].
    /// The caller becomes the owner (authority).
    pub fn register(ctx: Context<Register>, handle: String, destination_pubkey: Pubkey) -> Result<()> {
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
        registry_entry.destination_pubkey = destination_pubkey;
        registry_entry.bump = ctx.bumps.registry_entry;

        msg!("Registered handle: {}.stealth -> {} (Dest: {})", handle, registry_entry.authority, destination_pubkey);
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

    /// Updates the destination public key for payments.
    /// Only the current authority can call this.
    pub fn update_destination(ctx: Context<UpdateAuthority>, _handle: String, new_destination: Pubkey) -> Result<()> {
        let registry_entry = &mut ctx.accounts.registry_entry;
        registry_entry.destination_pubkey = new_destination;
        msg!("Updated destination for {}.stealth -> {}", registry_entry.handle, new_destination);
        Ok(())
    }
}

// --- ACCOUNTS ---

#[derive(Accounts)]
#[instruction(handle: String, destination_pubkey: Pubkey)]
pub struct Register<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    #[account(
        init,
        payer = payer,
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
    /// The destination public key for incoming funds (can be different from authority)
    pub destination_pubkey: Pubkey,
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
