// Copyright (c), Trustea, 2026
// SPDX-License-Identifier: Apache-2.0

/// Real World Asset (RWA) Token module.
///
/// Soulbound tokens representing ownership/rights to real-world assets held
/// by a trust. The RWA documentation is stored encrypted on Walrus; the token
/// is the on-chain proof of the trust's claim to the asset.
///
/// Supported asset types: "real_estate", "securities", "vehicle",
/// "business_interest", "other".
module trustea::rwa_token;

use std::string::String;
use sui::clock::Clock;
use sui::event;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

const ENotHolder: u64 = 1;
const ENotHolderOrAgent: u64 = 2;

// ---------------------------------------------------------------------------
// Core struct
// ---------------------------------------------------------------------------

/// Soulbound token representing ownership/rights to a real-world asset.
/// Has `key` only (no `store`) to prevent transfers -- same pattern as BeneficiaryNFT.
public struct RWAToken has key {
    id: UID,
    /// Trust this asset belongs to.
    trust_id: ID,
    /// Asset category: "real_estate" | "securities" | "vehicle" | "business_interest" | "other"
    asset_type: String,
    /// Human-readable description.
    description: String,
    /// Estimated value in USD (updated periodically by agent).
    estimated_value_usd: u64,
    /// Walrus blob ID containing the encrypted asset documentation.
    documentation_blob_id: String,
    /// Timestamp of last valuation update.
    last_valued_at: u64,
    /// Who holds this token (the trust's grantor address).
    holder: address,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

public struct RWATokenMinted has copy, drop {
    token_id: ID,
    trust_id: ID,
    asset_type: String,
    estimated_value_usd: u64,
    holder: address,
}

public struct RWAValuationUpdated has copy, drop {
    token_id: ID,
    trust_id: ID,
    old_value: u64,
    new_value: u64,
    updated_by: address,
}

public struct RWATokenBurned has copy, drop {
    token_id: ID,
    trust_id: ID,
    holder: address,
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/// Mint a new RWA token. Only the grantor (holder) should call this.
/// The token is transferred to the caller (grantor).
public fun mint_rwa_token(
    trust_id: ID,
    asset_type: String,
    description: String,
    estimated_value_usd: u64,
    documentation_blob_id: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let holder = ctx.sender();
    let now = clock.timestamp_ms();

    let token = RWAToken {
        id: object::new(ctx),
        trust_id,
        asset_type,
        description,
        estimated_value_usd,
        documentation_blob_id,
        last_valued_at: now,
        holder,
    };

    let token_id = object::id(&token);

    event::emit(RWATokenMinted {
        token_id,
        trust_id,
        asset_type: token.asset_type,
        estimated_value_usd,
        holder,
    });

    // Privileged transfer (key only, no store) -- soulbound to holder.
    transfer::transfer(token, holder);
}

/// Update the valuation of an RWA token. Grantor or agent can call.
/// The caller must be the holder (grantor). For agent updates, the grantor
/// must pass the token in a PTB where the agent calls this function.
/// We check that caller == holder for simplicity.
public fun update_valuation(
    token: &mut RWAToken,
    new_value: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    // In practice, both grantor and agent should be able to update.
    // Since the token is owned by the holder, only they can pass &mut.
    // This assertion is a safety check.
    assert!(caller == token.holder, ENotHolderOrAgent);

    let old_value = token.estimated_value_usd;
    token.estimated_value_usd = new_value;
    token.last_valued_at = clock.timestamp_ms();

    event::emit(RWAValuationUpdated {
        token_id: object::id(token),
        trust_id: token.trust_id,
        old_value,
        new_value,
        updated_by: caller,
    });
}

/// Burn an RWA token (when the asset is sold/transferred out of the trust).
/// Only the holder (grantor) can call.
public fun burn_rwa_token(token: RWAToken, ctx: &TxContext) {
    assert!(ctx.sender() == token.holder, ENotHolder);

    let RWAToken { id, trust_id, holder, .. } = token;
    let token_id = id.uid_to_inner();

    event::emit(RWATokenBurned {
        token_id,
        trust_id,
        holder,
    });

    object::delete(id);
}

// ---------------------------------------------------------------------------
// Read-only accessors
// ---------------------------------------------------------------------------

public fun trust_id(token: &RWAToken): ID { token.trust_id }
public fun asset_type(token: &RWAToken): String { token.asset_type }
public fun token_description(token: &RWAToken): String { token.description }
public fun estimated_value_usd(token: &RWAToken): u64 { token.estimated_value_usd }
public fun documentation_blob_id(token: &RWAToken): String { token.documentation_blob_id }
public fun last_valued_at(token: &RWAToken): u64 { token.last_valued_at }
public fun holder(token: &RWAToken): address { token.holder }
