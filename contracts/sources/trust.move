// Copyright (c), Trustea, 2026
// SPDX-License-Identifier: Apache-2.0

/// Main Trust module for the Trustea platform.
///
/// A `Trust` is a shared Sui object that holds:
///   - Metadata (name, description, grantor)
///   - SUI balance managed by the trust
///   - A list of beneficiaries (each gets a BeneficiaryNFT)
///   - Distribution rules (age, time, credential, periodic)
///   - References to encrypted documents stored on Walrus
///   - An AI agent address that may propose distributions
///
/// Distribution flow (human-override model):
///   1. Agent calls `propose_distribution` → creates a `PendingDistribution`.
///   2. After OVERRIDE_PERIOD_MS the grantor has not vetoed it.
///   3. Anyone (or the agent) calls `execute_distribution` to release funds.
///   4. The grantor can call `cancel_distribution` at any time before execution.
///
/// Status codes:
///   0 = ACTIVE   — normal operation
///   1 = PAUSED   — no new deposits or distributions (emergency brake)
///   2 = CLOSED   — trust has been wound up; no further changes
module trustea::trust;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use trustea::agent_log;
use trustea::beneficiary_nft;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Trust status: normal operation.
const STATUS_ACTIVE: u8 = 0;
/// Trust status: emergency pause — no deposits/distributions.
const STATUS_PAUSED: u8 = 1;
/// Trust status: closed / wound up — immutable forever.
const STATUS_CLOSED: u8 = 2;

/// Rule type: age-based (condition_value = birth timestamp; unlocks when now >= condition_value).
const RULE_TYPE_AGE: u8 = 0;
/// Rule type: time-based (condition_value = unlock timestamp ms).
const RULE_TYPE_TIME: u8 = 1;
/// Rule type: credential / off-chain event (always treated as met on-chain; checked off-chain by agent).
const RULE_TYPE_CREDENTIAL: u8 = 2;
/// Rule type: periodic payment (condition_value = period in ms).
const RULE_TYPE_PERIODIC: u8 = 3;

/// How long (in ms) the grantor has to veto a proposed distribution before it becomes executable.
/// Set to 48 hours for hackathon demo; production would make this configurable per trust.
const OVERRIDE_PERIOD_MS: u64 = 48 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

const ENotGrantor: u64 = 1;
const ENotAgent: u64 = 2;
const ETrustNotActive: u64 = 3;
const ETrustClosed: u64 = 4;
const EBeneficiaryNotFound: u64 = 5;
const EBeneficiaryAlreadyExists: u64 = 6;
const ERuleNotFound: u64 = 7;
const EOverridePeriodNotElapsed: u64 = 8;
const EDistributionAlreadyCancelled: u64 = 9;
const EDistributionAlreadyExecuted: u64 = 10;
const EInsufficientBalance: u64 = 11;
const EInvalidRuleType: u64 = 12;
const EZeroAmount: u64 = 13;
const EInvalidStatus: u64 = 14;

// ---------------------------------------------------------------------------
// Core data types
// ---------------------------------------------------------------------------

/// A single distribution rule attached to a trust.
public struct Rule has store, copy, drop {
    /// 0=age, 1=time, 2=credential, 3=periodic
    rule_type: u8,
    /// The beneficiary this rule applies to.
    beneficiary: address,
    /// Amount in MIST, OR percentage × 100 (e.g. 5000 = 50%) if is_percentage.
    amount: u64,
    /// Whether `amount` is a percentage of the trust balance.
    is_percentage: bool,
    /// For age/time rules: the timestamp (ms) that must be reached.
    /// For periodic rules: the period in ms between allowed payments.
    condition_value: u64,
    /// Human-readable description of this rule's intent.
    description: String,
    /// Whether this rule is currently active.
    is_active: bool,
}

/// A distribution proposed by the AI agent, subject to grantor override.
public struct PendingDistribution has key, store {
    id: UID,
    /// The trust this distribution belongs to.
    trust_id: ID,
    /// The rule index that triggered this proposal.
    rule_index: u64,
    /// Destination beneficiary.
    beneficiary: address,
    /// Amount to distribute in MIST.
    amount: u64,
    /// Reason / description provided by the agent.
    reason: String,
    /// Timestamp when this proposal was created (ms).
    proposed_at: u64,
    /// Earliest timestamp at which this can be executed (proposed_at + OVERRIDE_PERIOD_MS).
    executable_after: u64,
    /// False = pending/open, True = cancelled by grantor.
    is_cancelled: bool,
    /// False = not yet executed, True = executed.
    is_executed: bool,
}

/// The central Trust shared object.
public struct Trust has key {
    id: UID,
    /// Human-readable name of this trust.
    name: String,
    /// Description of the trust's purpose.
    description: String,
    /// Address of the grantor who created the trust.
    grantor: address,
    /// SUI balance held by the trust.
    balance: Balance<SUI>,
    /// Ordered list of beneficiary addresses.
    beneficiaries: vector<address>,
    /// Distribution rules.
    rules: vector<Rule>,
    /// 0=ACTIVE, 1=PAUSED, 2=CLOSED
    status: u8,
    /// Walrus blob IDs referencing encrypted trust documents.
    walrus_blob_ids: vector<String>,
    /// Timestamp (ms) when this trust was created.
    created_at: u64,
    /// Address of the AI agent authorized to propose distributions.
    agent_address: address,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

public struct TrustCreated has copy, drop {
    trust_id: ID,
    grantor: address,
    name: String,
    created_at: u64,
}

public struct TrustDeposit has copy, drop {
    trust_id: ID,
    depositor: address,
    amount: u64,
    new_balance: u64,
}

public struct BeneficiaryAdded has copy, drop {
    trust_id: ID,
    beneficiary: address,
    added_by: address,
}

public struct BeneficiaryRemoved has copy, drop {
    trust_id: ID,
    beneficiary: address,
    removed_by: address,
}

public struct RuleAdded has copy, drop {
    trust_id: ID,
    rule_index: u64,
    rule_type: u8,
    beneficiary: address,
    amount: u64,
}

public struct WalrusRefAdded has copy, drop {
    trust_id: ID,
    blob_id: String,
}

public struct DistributionProposed has copy, drop {
    trust_id: ID,
    distribution_id: ID,
    beneficiary: address,
    amount: u64,
    proposed_by: address,
    executable_after: u64,
}

public struct DistributionExecuted has copy, drop {
    trust_id: ID,
    distribution_id: ID,
    beneficiary: address,
    amount: u64,
    executed_by: address,
}

public struct DistributionCancelled has copy, drop {
    trust_id: ID,
    distribution_id: ID,
    cancelled_by: address,
}

public struct TrustStatusChanged has copy, drop {
    trust_id: ID,
    old_status: u8,
    new_status: u8,
    changed_by: address,
}

public struct TrustAmended has copy, drop {
    trust_id: ID,
    amended_by: address,
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

/// Create a new trust and share it on-chain.
///
/// The trust starts ACTIVE with zero balance. The grantor must call `deposit`
/// to fund it. A `TrustCreated` event is emitted.
public fun create_trust(
    name: String,
    description: String,
    agent_address: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let grantor = ctx.sender();
    let now = clock.timestamp_ms();

    let trust = Trust {
        id: object::new(ctx),
        name,
        description,
        grantor,
        balance: balance::zero(),
        beneficiaries: vector[],
        rules: vector[],
        status: STATUS_ACTIVE,
        walrus_blob_ids: vector[],
        created_at: now,
        agent_address,
    };

    let trust_id = object::id(&trust);

    event::emit(TrustCreated {
        trust_id,
        grantor,
        name: trust.name,
        created_at: now,
    });

    transfer::share_object(trust);
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

/// Deposit SUI into the trust.
///
/// Anyone may deposit (e.g. family members funding the trust). The trust must
/// not be CLOSED.
public fun deposit(trust: &mut Trust, payment: Coin<SUI>, ctx: &mut TxContext) {
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);

    balance::join(&mut trust.balance, coin::into_balance(payment));

    event::emit(TrustDeposit {
        trust_id: object::id(trust),
        depositor: ctx.sender(),
        amount,
        new_balance: trust.balance.value(),
    });
}

// ---------------------------------------------------------------------------
// Beneficiary management
// ---------------------------------------------------------------------------

/// Add a beneficiary to the trust and mint them a BeneficiaryNFT.
///
/// Only the grantor may call this. Trust must be ACTIVE.
public fun add_beneficiary(
    trust: &mut Trust,
    beneficiary: address,
    beneficiary_name: String,
    conditions_summary: String,
    allocation_amount: u64,
    is_percentage: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(!trust.beneficiaries.contains(&beneficiary), EBeneficiaryAlreadyExists);

    trust.beneficiaries.push_back(beneficiary);

    let trust_id = object::id(trust);

    event::emit(BeneficiaryAdded {
        trust_id,
        beneficiary,
        added_by: ctx.sender(),
    });

    // Mint the soulbound NFT and transfer it directly to the beneficiary.
    beneficiary_nft::mint(
        trust_id,
        beneficiary,
        beneficiary_name,
        conditions_summary,
        allocation_amount,
        is_percentage,
        clock.timestamp_ms(),
        ctx,
    );
}

/// Remove a beneficiary from the trust.
///
/// Only the grantor may call this. The caller must also supply the beneficiary's
/// `BeneficiaryNFT` so it can be burned, completing the soulbound lifecycle.
/// Trust must be ACTIVE.
public fun remove_beneficiary(
    trust: &mut Trust,
    beneficiary: address,
    nft: beneficiary_nft::BeneficiaryNFT,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);

    let (found, idx) = find_beneficiary(&trust.beneficiaries, beneficiary);
    assert!(found, EBeneficiaryNotFound);

    trust.beneficiaries.remove(idx);

    event::emit(BeneficiaryRemoved {
        trust_id: object::id(trust),
        beneficiary,
        removed_by: ctx.sender(),
    });

    // Burn the NFT to complete the removal.
    beneficiary_nft::burn(nft);
}

// ---------------------------------------------------------------------------
// Rule management
// ---------------------------------------------------------------------------

/// Add a distribution rule to the trust.
///
/// Only the grantor may call this. Trust must be ACTIVE.
/// The beneficiary must already be in the trust's beneficiary list.
public fun add_rule(
    trust: &mut Trust,
    rule_type: u8,
    beneficiary: address,
    amount: u64,
    is_percentage: bool,
    condition_value: u64,
    description: String,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(
        rule_type == RULE_TYPE_AGE
            || rule_type == RULE_TYPE_TIME
            || rule_type == RULE_TYPE_CREDENTIAL
            || rule_type == RULE_TYPE_PERIODIC,
        EInvalidRuleType,
    );
    assert!(amount > 0, EZeroAmount);

    let (ben_found, _) = find_beneficiary(&trust.beneficiaries, beneficiary);
    assert!(ben_found, EBeneficiaryNotFound);

    let rule = Rule {
        rule_type,
        beneficiary,
        amount,
        is_percentage,
        condition_value,
        description,
        is_active: true,
    };

    let rule_index = trust.rules.length();
    trust.rules.push_back(rule);

    event::emit(RuleAdded {
        trust_id: object::id(trust),
        rule_index,
        rule_type,
        beneficiary,
        amount,
    });
}

// ---------------------------------------------------------------------------
// Walrus document references
// ---------------------------------------------------------------------------

/// Store a Walrus blob ID reference in the trust.
///
/// Only the grantor or agent may call this. Used to attach pointers to encrypted
/// trust documents (wills, legal agreements, identity proofs) stored on Walrus.
public fun add_walrus_ref(trust: &mut Trust, blob_id: String, ctx: &mut TxContext) {
    let caller = ctx.sender();
    assert!(
        caller == trust.grantor || caller == trust.agent_address,
        ENotGrantor,
    );
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);

    trust.walrus_blob_ids.push_back(blob_id);

    event::emit(WalrusRefAdded {
        trust_id: object::id(trust),
        blob_id: *trust.walrus_blob_ids.borrow(trust.walrus_blob_ids.length() - 1),
    });
}

// ---------------------------------------------------------------------------
// Distribution — propose
// ---------------------------------------------------------------------------

/// AI agent proposes a fund distribution.
///
/// Creates a `PendingDistribution` shared object. The grantor has
/// OVERRIDE_PERIOD_MS to cancel it; after that window expires it can be
/// executed by anyone (typically the agent itself).
///
/// The trust must be ACTIVE and have sufficient balance.
public fun propose_distribution(
    trust: &mut Trust,
    rule_index: u64,
    beneficiary: address,
    amount: u64,
    reason: String,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    assert!(ctx.sender() == trust.agent_address, ENotAgent);
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(amount > 0, EZeroAmount);
    assert!(trust.balance.value() >= amount, EInsufficientBalance);

    let (ben_found, _) = find_beneficiary(&trust.beneficiaries, beneficiary);
    assert!(ben_found, EBeneficiaryNotFound);

    let now = clock.timestamp_ms();
    let executable_after = now + OVERRIDE_PERIOD_MS;
    let trust_id = object::id(trust);

    let dist = PendingDistribution {
        id: object::new(ctx),
        trust_id,
        rule_index,
        beneficiary,
        amount,
        reason,
        proposed_at: now,
        executable_after,
        is_cancelled: false,
        is_executed: false,
    };

    let distribution_id = object::id(&dist);

    event::emit(DistributionProposed {
        trust_id,
        distribution_id,
        beneficiary,
        amount,
        proposed_by: ctx.sender(),
        executable_after,
    });

    // Log agent action.
    agent_log::emit_action(
        trust_id,
        ctx.sender(),
        agent_log::action_distribution_proposed(),
        reason,
        beneficiary,
        amount,
        now,
    );

    transfer::share_object(dist);
    distribution_id
}

// ---------------------------------------------------------------------------
// Distribution — execute
// ---------------------------------------------------------------------------

/// Execute a pending distribution once the override period has elapsed.
///
/// Anyone may call this (usually the agent) once `executable_after` has passed
/// and the grantor has not cancelled. Funds are sent directly to the beneficiary.
public fun execute_distribution(
    trust: &mut Trust,
    dist: &mut PendingDistribution,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(object::id(trust) == dist.trust_id, ERuleNotFound);
    assert!(!dist.is_cancelled, EDistributionAlreadyCancelled);
    assert!(!dist.is_executed, EDistributionAlreadyExecuted);
    assert!(clock.timestamp_ms() >= dist.executable_after, EOverridePeriodNotElapsed);
    assert!(trust.balance.value() >= dist.amount, EInsufficientBalance);

    dist.is_executed = true;

    let payout = coin::from_balance(
        balance::split(&mut trust.balance, dist.amount),
        ctx,
    );

    let trust_id = object::id(trust);
    let distribution_id = object::id(dist);
    let now = clock.timestamp_ms();

    event::emit(DistributionExecuted {
        trust_id,
        distribution_id,
        beneficiary: dist.beneficiary,
        amount: dist.amount,
        executed_by: ctx.sender(),
    });

    // Log agent action for audit trail.
    agent_log::emit_action(
        trust_id,
        trust.agent_address,
        agent_log::action_distribution_executed(),
        b"Distribution executed after override period".to_string(),
        dist.beneficiary,
        dist.amount,
        now,
    );

    transfer::public_transfer(payout, dist.beneficiary);
}

// ---------------------------------------------------------------------------
// Distribution — cancel (grantor veto)
// ---------------------------------------------------------------------------

/// Grantor cancels a pending distribution within the override period.
public fun cancel_distribution(
    trust: &Trust,
    dist: &mut PendingDistribution,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(object::id(trust) == dist.trust_id, ERuleNotFound);
    assert!(!dist.is_cancelled, EDistributionAlreadyCancelled);
    assert!(!dist.is_executed, EDistributionAlreadyExecuted);

    dist.is_cancelled = true;

    event::emit(DistributionCancelled {
        trust_id: object::id(trust),
        distribution_id: object::id(dist),
        cancelled_by: ctx.sender(),
    });
}

// ---------------------------------------------------------------------------
// Trust amendment
// ---------------------------------------------------------------------------

/// Grantor amends the trust metadata and/or deactivates rules.
///
/// Provides a simple amendment pathway: update name/description and toggle
/// individual rules on/off. For more structural changes (adding/removing
/// beneficiaries, adding rules) use the dedicated functions.
/// Trust must be ACTIVE.
public fun amend_trust(
    trust: &mut Trust,
    new_name: Option<String>,
    new_description: Option<String>,
    rule_index: Option<u64>,
    set_rule_active: Option<bool>,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);

    if (new_name.is_some()) {
        trust.name = new_name.destroy_some();
    };

    if (new_description.is_some()) {
        trust.description = new_description.destroy_some();
    };

    if (rule_index.is_some() && set_rule_active.is_some()) {
        let idx = rule_index.destroy_some();
        let active = set_rule_active.destroy_some();
        assert!(idx < trust.rules.length(), ERuleNotFound);
        trust.rules.borrow_mut(idx).is_active = active;
    };

    event::emit(TrustAmended {
        trust_id: object::id(trust),
        amended_by: ctx.sender(),
    });
}

// ---------------------------------------------------------------------------
// Emergency controls
// ---------------------------------------------------------------------------

/// Pause the trust (grantor only). No distributions can be executed while paused.
public fun pause_trust(trust: &mut Trust, ctx: &mut TxContext) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status == STATUS_ACTIVE, EInvalidStatus);

    let old = trust.status;
    trust.status = STATUS_PAUSED;

    event::emit(TrustStatusChanged {
        trust_id: object::id(trust),
        old_status: old,
        new_status: STATUS_PAUSED,
        changed_by: ctx.sender(),
    });
}

/// Resume a paused trust (grantor only).
public fun resume_trust(trust: &mut Trust, ctx: &mut TxContext) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status == STATUS_PAUSED, EInvalidStatus);

    let old = trust.status;
    trust.status = STATUS_ACTIVE;

    event::emit(TrustStatusChanged {
        trust_id: object::id(trust),
        old_status: old,
        new_status: STATUS_ACTIVE,
        changed_by: ctx.sender(),
    });
}

/// Close the trust permanently (grantor only).
///
/// Any remaining balance is returned to the grantor. The trust cannot be
/// reopened after this call.
public fun close_trust(trust: &mut Trust, ctx: &mut TxContext) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);

    // Return any remaining balance to the grantor.
    let remaining = trust.balance.value();
    if (remaining > 0) {
        let payout = coin::from_balance(
            balance::split(&mut trust.balance, remaining),
            ctx,
        );
        transfer::public_transfer(payout, trust.grantor);
    };

    let old = trust.status;
    trust.status = STATUS_CLOSED;

    event::emit(TrustStatusChanged {
        trust_id: object::id(trust),
        old_status: old,
        new_status: STATUS_CLOSED,
        changed_by: ctx.sender(),
    });
}

// ---------------------------------------------------------------------------
// Read-only accessors
// ---------------------------------------------------------------------------

public fun name(trust: &Trust): String { trust.name }
public fun description(trust: &Trust): String { trust.description }
public fun grantor(trust: &Trust): address { trust.grantor }
public fun balance_value(trust: &Trust): u64 { trust.balance.value() }
public fun beneficiaries(trust: &Trust): &vector<address> { &trust.beneficiaries }
public fun rules(trust: &Trust): &vector<Rule> { &trust.rules }
public fun status(trust: &Trust): u8 { trust.status }
public fun walrus_blob_ids(trust: &Trust): &vector<String> { &trust.walrus_blob_ids }
public fun created_at(trust: &Trust): u64 { trust.created_at }
public fun agent_address(trust: &Trust): address { trust.agent_address }
public fun beneficiary_count(trust: &Trust): u64 { trust.beneficiaries.length() }
public fun rule_count(trust: &Trust): u64 { trust.rules.length() }

/// Check whether an address is a beneficiary of this trust.
public fun is_beneficiary(trust: &Trust, addr: address): bool {
    trust.beneficiaries.contains(&addr)
}

// Rule field accessors
public fun rule_type(rule: &Rule): u8 { rule.rule_type }
public fun rule_beneficiary(rule: &Rule): address { rule.beneficiary }
public fun rule_amount(rule: &Rule): u64 { rule.amount }
public fun rule_is_percentage(rule: &Rule): bool { rule.is_percentage }
public fun rule_condition_value(rule: &Rule): u64 { rule.condition_value }
public fun rule_description(rule: &Rule): String { rule.description }
public fun rule_is_active(rule: &Rule): bool { rule.is_active }

// PendingDistribution accessors
public fun dist_trust_id(dist: &PendingDistribution): ID { dist.trust_id }
public fun dist_beneficiary(dist: &PendingDistribution): address { dist.beneficiary }
public fun dist_amount(dist: &PendingDistribution): u64 { dist.amount }
public fun dist_proposed_at(dist: &PendingDistribution): u64 { dist.proposed_at }
public fun dist_executable_after(dist: &PendingDistribution): u64 { dist.executable_after }
public fun dist_is_cancelled(dist: &PendingDistribution): bool { dist.is_cancelled }
public fun dist_is_executed(dist: &PendingDistribution): bool { dist.is_executed }

// Status constants (for external consumers)
public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_paused(): u8 { STATUS_PAUSED }
public fun status_closed(): u8 { STATUS_CLOSED }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Linear scan for a beneficiary address; returns (found, index).
fun find_beneficiary(beneficiaries: &vector<address>, target: address): (bool, u64) {
    let len = beneficiaries.length();
    let mut i = 0;
    while (i < len) {
        if (*beneficiaries.borrow(i) == target) {
            return (true, i)
        };
        i = i + 1;
    };
    (false, 0)
}
