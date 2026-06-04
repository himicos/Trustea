// Copyright (c), Trustea, 2026
// SPDX-License-Identifier: Apache-2.0

/// Beneficiary NFT module.
///
/// When the grantor adds a beneficiary to a Trust, a `BeneficiaryNFT` is minted
/// and transferred to that beneficiary's wallet. The NFT:
///   - Identifies the trust and the beneficiary's relationship to it.
///   - Summarises the applicable rules and allocation.
///   - Is displayed in any Sui-compatible wallet via the `sui::display` framework.
///   - Is intentionally non-transferable (soulbound by convention): no `store`
///     ability is added, so it cannot be placed in generic containers or sent
///     with `public_transfer`. The trust module uses `transfer::transfer` (the
///     privileged form available within the same package) to deliver it exactly
///     once to the beneficiary.
///
/// Design note: true soulbound enforcement in Sui requires a TransferPolicy that
/// refuses all transfer requests. For hackathon scope we use the simpler approach
/// of omitting `store` so accidental transfers via third-party tooling are blocked
/// at the type-system level, while the package itself retains the ability to send
/// the NFT during minting.
module trustea::beneficiary_nft;

use std::string::String;
use sui::display;
use sui::event;
use sui::package;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/// Caller is not the trust package (only the trust module may mint/burn NFTs).
const EUnauthorized: u64 = 1;

// ---------------------------------------------------------------------------
// One-Time Witness (required for Display setup)
// ---------------------------------------------------------------------------

/// OTW consumed by `init` to claim the Publisher object.
public struct BENEFICIARY_NFT has drop {}

// ---------------------------------------------------------------------------
// Core struct
// ---------------------------------------------------------------------------

/// Soulbound NFT held by a trust beneficiary.
///
/// Abilities: `key` only — intentionally no `store` to prevent transfers via
/// third-party packages. The trust module's privileged `transfer::transfer`
/// is used at mint time to deliver the NFT to the beneficiary.
public struct BeneficiaryNFT has key {
    id: UID,
    /// Object ID of the parent Trust (as a hex string for display purposes).
    trust_id: ID,
    /// On-chain address of this beneficiary.
    beneficiary: address,
    /// Human-readable name of the beneficiary (provided by the grantor).
    beneficiary_name: String,
    /// Short summary of the conditions governing this beneficiary's allocation.
    conditions_summary: String,
    /// Allocated amount in MIST (0 if percentage-based; see is_percentage).
    allocation_amount: u64,
    /// True if `allocation_amount` represents a percentage (× 100) rather than MIST.
    is_percentage: bool,
    /// Timestamp (ms) at which this NFT was minted.
    minted_at: u64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/// Emitted when a BeneficiaryNFT is minted and sent to a beneficiary.
public struct BeneficiaryNFTMinted has copy, drop {
    nft_id: ID,
    trust_id: ID,
    beneficiary: address,
    beneficiary_name: String,
}

/// Emitted when a BeneficiaryNFT is burned (beneficiary removed from trust).
public struct BeneficiaryNFTBurned has copy, drop {
    nft_id: ID,
    trust_id: ID,
    beneficiary: address,
}

// ---------------------------------------------------------------------------
// Init — sets up Display metadata
// ---------------------------------------------------------------------------

fun init(otw: BENEFICIARY_NFT, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);

    let mut display_obj = display::new<BeneficiaryNFT>(&publisher, ctx);
    display_obj.add(b"name".to_string(), b"Trustea Beneficiary NFT".to_string());
    display_obj.add(b"description".to_string(), b"{conditions_summary}".to_string());
    display_obj.add(
        b"image_url".to_string(),
        b"https://trustea.io/nft/{trust_id}".to_string(),
    );
    display_obj.add(b"project_url".to_string(), b"https://trustea.io".to_string());
    display_obj.update_version();

    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display_obj, ctx.sender());
}

// ---------------------------------------------------------------------------
// Package-internal mint / burn (called exclusively from trust.move)
// ---------------------------------------------------------------------------

/// Mint a new BeneficiaryNFT and transfer it to `beneficiary`.
///
/// This function is `public(package)` so only modules within the `trustea`
/// package (i.e. `trust.move`) can call it — external callers are rejected at
/// compile time.
public(package) fun mint(
    trust_id: ID,
    beneficiary: address,
    beneficiary_name: String,
    conditions_summary: String,
    allocation_amount: u64,
    is_percentage: bool,
    minted_at: u64,
    ctx: &mut TxContext,
) {
    let nft = BeneficiaryNFT {
        id: object::new(ctx),
        trust_id,
        beneficiary,
        beneficiary_name,
        conditions_summary,
        allocation_amount,
        is_percentage,
        minted_at,
    };

    let nft_id = object::id(&nft);

    event::emit(BeneficiaryNFTMinted {
        nft_id,
        trust_id,
        beneficiary,
        beneficiary_name,
    });

    // Privileged transfer — works because BeneficiaryNFT has `key` only
    // (no `store`), and we are in the same package.
    transfer::transfer(nft, beneficiary);
}

/// Burn a BeneficiaryNFT (called when a beneficiary is removed from the trust).
///
/// Also `public(package)` — only trust.move can call this.
/// Note: The NFT must be passed in by value, which means the beneficiary (or
/// the trust module acting on their behalf) must supply it. In practice the
/// grantor calls `remove_beneficiary` and the Move VM requires the NFT object
/// to be provided in the same PTB so it can be destroyed.
public(package) fun burn(nft: BeneficiaryNFT) {
    let BeneficiaryNFT { id, trust_id, beneficiary, .. } = nft;
    let nft_id = id.uid_to_inner();
    event::emit(BeneficiaryNFTBurned { nft_id, trust_id, beneficiary });
    object::delete(id);
}

// ---------------------------------------------------------------------------
// Read-only accessors
// ---------------------------------------------------------------------------

public fun trust_id(nft: &BeneficiaryNFT): ID { nft.trust_id }
public fun beneficiary(nft: &BeneficiaryNFT): address { nft.beneficiary }
public fun beneficiary_name(nft: &BeneficiaryNFT): String { nft.beneficiary_name }
public fun conditions_summary(nft: &BeneficiaryNFT): String { nft.conditions_summary }
public fun allocation_amount(nft: &BeneficiaryNFT): u64 { nft.allocation_amount }
public fun is_percentage(nft: &BeneficiaryNFT): bool { nft.is_percentage }
public fun minted_at(nft: &BeneficiaryNFT): u64 { nft.minted_at }

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

#[test_only]
public fun burn_for_testing(nft: BeneficiaryNFT) {
    burn(nft);
}
