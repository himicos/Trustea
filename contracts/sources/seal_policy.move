// Copyright (c), Trustea, 2026
// SPDX-License-Identifier: Apache-2.0

/// Seal Policy module for Trustea.
///
/// Implements the Seal (threshold encryption key management) access policy
/// for encrypted trust documents stored on Walrus. Two access patterns are
/// combined:
///
/// 1. **Whitelist pattern** — only the grantor and the trust's beneficiaries
///    may request the decryption key. All other callers are rejected.
///
/// 2. **Time-lock pattern** — some key-ids encode a timestamp. Access to those
///    keys is additionally gated on the current time being >= that timestamp.
///    This lets the grantor encrypt documents that become readable only after a
///    specific date (e.g. after the grantor's death, after a child's 18th birthday).
///
/// Key-id format used by this module:
///   [trust_policy object id bytes] ++ [optional 8-byte little-endian u64 timestamp]
///
///   - If the suffix is empty → pure whitelist check (caller in beneficiaries or grantor).
///   - If the suffix is 8 bytes → time-lock check (timestamp must have elapsed) AND
///     whitelist check.
///
/// The `seal_approve` entry function follows the exact Seal SDK conventions:
///   - First parameter is `id: vector<u8>` (the key-id requested by the client).
///   - Function must be `entry`.
///   - Must abort (not return false) when access is denied.
///
/// Reference patterns:
///   - whitelist.move  (MystenLabs/seal) — prefix check + address membership
///   - tle.move        (MystenLabs/seal) — BCS-encoded timestamp in key-id
module trustea::seal_policy;

use sui::bcs::{Self, BCS};
use sui::clock::Clock;
use trustea::trust::Trust;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/// Caller is not on the whitelist (not grantor and not a beneficiary).
const ENoAccess: u64 = 1;
/// The key-id suffix is malformed (not 0 or 8 bytes after the prefix).
const EInvalidKeyId: u64 = 2;
/// The time-lock timestamp has not yet been reached.
const ETimeLockNotReached: u64 = 3;

// ---------------------------------------------------------------------------
// Internal: prefix check
// ---------------------------------------------------------------------------

/// Check that `id` begins with the bytes of `trust`'s object ID.
///
/// The object ID of the Trust acts as the namespace for all key-ids associated
/// with that trust, exactly mirroring the whitelist pattern where the whitelist's
/// own ID is the namespace prefix.
fun has_trust_prefix(id: &vector<u8>, trust: &Trust): bool {
    let prefix = object::id(trust).to_bytes();
    let prefix_len = prefix.length();

    if (prefix_len > id.length()) {
        return false
    };

    let mut i = 0;
    while (i < prefix_len) {
        if (*prefix.borrow(i) != *id.borrow(i)) {
            return false
        };
        i = i + 1;
    };
    true
}

// ---------------------------------------------------------------------------
// Internal: suffix parsing
// ---------------------------------------------------------------------------

/// Parse the suffix of a key-id (everything after the 32-byte trust object ID
/// prefix). Returns:
///   - `option::none()` if no suffix (pure whitelist key-id).
///   - `option::some(timestamp_ms)` if exactly 8 bytes (time-lock key-id).
/// Aborts with `EInvalidKeyId` if the suffix has any other length.
fun parse_suffix(id: &vector<u8>): Option<u64> {
    // Trust object IDs are always 32 bytes on Sui.
    let prefix_len = 32u64;
    let total_len = id.length();

    if (total_len == prefix_len) {
        // No suffix — pure whitelist.
        return option::none()
    };

    // Must be exactly prefix + 8 bytes for a u64 timestamp.
    assert!(total_len == prefix_len + 8, EInvalidKeyId);

    // Extract the 8-byte suffix as a BCS-encoded u64.
    let mut suffix: vector<u8> = vector[];
    let mut i = prefix_len;
    while (i < total_len) {
        suffix.push_back(*id.borrow(i));
        i = i + 1;
    };

    let mut bcs_data: BCS = bcs::new(suffix);
    let timestamp = bcs_data.peel_u64();
    // Ensure no leftover bytes after peeling the u64.
    assert!(bcs_data.into_remainder_bytes().length() == 0, EInvalidKeyId);

    option::some(timestamp)
}

// ---------------------------------------------------------------------------
// Internal: combined policy check
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Entry function — called by the Seal SDK
// ---------------------------------------------------------------------------

/// Seal approval gate for Trustea trust documents.
///
/// Called by the Seal server when a client requests the decryption key for a
/// given key-id. Aborts (denying access) unless:
///   - `id` has the correct trust namespace prefix, AND
///   - the time-lock timestamp (if present) has been reached, AND
///   - the caller is the grantor or a beneficiary.
///
/// Conventions (matching MystenLabs/seal patterns):
///   - `id` is the first parameter.
///   - Function is `entry`.
///   - Abort on failure (never return a boolean to the Seal server).
entry fun seal_approve(id: vector<u8>, trust: &Trust, clock: &Clock, ctx: &TxContext) {
    let caller = ctx.sender();

    // Prefix check.
    assert!(has_trust_prefix(&id, trust), ENoAccess);

    // Time-lock check (if suffix present).
    let maybe_ts = parse_suffix(&id);
    if (maybe_ts.is_some()) {
        let unlock_ts = *maybe_ts.borrow();
        assert!(clock.timestamp_ms() >= unlock_ts, ETimeLockNotReached);
    };

    // Whitelist check.
    assert!(
        caller == trust.grantor() || trust.is_beneficiary(caller),
        ENoAccess,
    );
}

// ---------------------------------------------------------------------------
// Read helpers (useful off-chain / in tests)
// ---------------------------------------------------------------------------

/// Build a whitelist key-id for a given trust (no time-lock).
public fun build_key_id_plain(trust: &Trust): vector<u8> {
    object::id(trust).to_bytes()
}

/// Build a time-locked key-id for a given trust and unlock timestamp.
public fun build_key_id_timelocked(trust: &Trust, unlock_timestamp_ms: u64): vector<u8> {
    let mut id = object::id(trust).to_bytes();
    let ts_bytes = bcs::to_bytes(&unlock_timestamp_ms);
    id.append(ts_bytes);
    id
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fun test_bcs_u64_encoding() {
    // Validate that BCS-encoding a u64 produces exactly 8 bytes,
    // which is the expected time-lock suffix length.
    let ts_bytes = bcs::to_bytes(&1_000u64);
    assert!(ts_bytes.length() == 8, 0);

    let ts_bytes2 = bcs::to_bytes(&9_999_999_999u64);
    assert!(ts_bytes2.length() == 8, 1);
}
