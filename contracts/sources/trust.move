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
///   - Configurable override period, revocability, trust protector, successor
///   - A beneficiary request system for self-service distribution requests
///   - Principal vs income accounting fields
///
/// Distribution flow (human-override model):
///   1. Agent calls `propose_distribution` -> creates a `PendingDistribution`.
///   2. After override_period_ms the grantor has not vetoed it.
///   3. Anyone (or the agent) calls `execute_distribution` to release funds.
///   4. The grantor (or trust_protector) can call `cancel_distribution` at any time before execution.
///
/// Status codes:
///   0 = ACTIVE   -- normal operation
///   1 = PAUSED   -- no new deposits or distributions (emergency brake)
///   2 = CLOSED   -- trust has been wound up; no further changes
///   3 = DMS_TRIGGERED -- Dead Man's Switch activated; successor has control
///
/// Dead Man's Switch (DMS):
///   When enabled, the grantor must periodically call `dms_heartbeat` to prove
///   they are still active. If the heartbeat lapses past a grace period,
///   designated activators (successor, protector, beneficiaries) can vote to
///   trigger the switch. Once threshold votes are reached the successor grantor
///   takes control. The grantor can cancel at any point before execution by
///   calling `dms_heartbeat` (which also clears votes). The trust protector
///   can veto a triggered DMS within a veto window.
module trustea::trust;

use std::string::String;
use std::type_name;
use std::ascii;
use sui::bag::{Self, Bag};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use sui::vec_map::{Self, VecMap};
use trustea::agent_log;
use trustea::beneficiary_nft;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Trust status: normal operation.
const STATUS_ACTIVE: u8 = 0;
/// Trust status: emergency pause -- no deposits/distributions.
const STATUS_PAUSED: u8 = 1;
/// Trust status: closed / wound up -- immutable forever.
const STATUS_CLOSED: u8 = 2;
/// Trust status: Dead Man's Switch triggered -- successor now controls.
const STATUS_DMS_TRIGGERED: u8 = 3;

/// Rule type: age-based (condition_value = birth timestamp; unlocks when now >= condition_value).
const RULE_TYPE_AGE: u8 = 0;
/// Rule type: time-based (condition_value = unlock timestamp ms).
const RULE_TYPE_TIME: u8 = 1;
/// Rule type: credential / off-chain event (always treated as met on-chain; checked off-chain by agent).
const RULE_TYPE_CREDENTIAL: u8 = 2;
/// Rule type: periodic payment (condition_value = period in ms).
const RULE_TYPE_PERIODIC: u8 = 3;

/// Default override period: 48 hours in ms. Used when not specified per-trust.
const DEFAULT_OVERRIDE_PERIOD_MS: u64 = 48 * 60 * 60 * 1_000;

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
const ENotBeneficiary: u64 = 15;
const ERequestAlreadyProcessed: u64 = 16;
const EIrrevocableTrust: u64 = 17;
const ENotGrantorOrProtector: u64 = 18;
const EDMSNotEnabled: u64 = 19;
const EDMSHeartbeatNotExpired: u64 = 20;
const ENotDMSActivator: u64 = 21;
const EDMSAlreadyTriggered: u64 = 22;
const ENoSuccessorGrantor: u64 = 23;
const EDMSNotTriggered: u64 = 24;
const EDMSVetoPeriodExpired: u64 = 25;
const EDMSThresholdNotMet: u64 = 26;
const EAlreadyVoted: u64 = 27;

// ---------------------------------------------------------------------------
// Core data types
// ---------------------------------------------------------------------------

/// A single distribution rule attached to a trust.
public struct Rule has store, copy, drop {
    /// 0=age, 1=time, 2=credential, 3=periodic
    rule_type: u8,
    /// The beneficiary this rule applies to.
    beneficiary: address,
    /// Amount in MIST, OR percentage x 100 (e.g. 5000 = 50%) if is_percentage.
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
    /// Earliest timestamp at which this can be executed (proposed_at + override_period_ms).
    executable_after: u64,
    /// False = pending/open, True = cancelled by grantor.
    is_cancelled: bool,
    /// False = not yet executed, True = executed.
    is_executed: bool,
}

/// A distribution request created by a beneficiary.
public struct DistributionRequest has key, store {
    id: UID,
    trust_id: ID,
    beneficiary: address,
    amount: u64,
    reason: String,
    /// "health" | "education" | "maintenance" | "support" | "other"
    category: String,
    requested_at: u64,
    is_approved: bool,
    is_denied: bool,
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
    /// Configurable override period in ms (default 48hr).
    override_period_ms: u64,
    /// If true, grantor can close/withdraw. If false, trust is irrevocable.
    is_revocable: bool,
    /// Takes over grantor role if grantor cannot act.
    successor_grantor: Option<address>,
    /// Separate oversight role: can veto distributions, pause/resume, rotate agent.
    trust_protector: Option<address>,
    /// Cumulative deposits (principal tracking).
    total_deposited: u64,
    /// Cumulative distributions (principal tracking).
    total_distributed: u64,
    /// Holds Balance<T> for non-SUI coin types, keyed by type name string.
    additional_balances: Bag,
    // -- Dead Man's Switch (DMS) fields --
    /// Whether the DMS is enabled for this trust.
    dms_enabled: bool,
    /// How often (ms) the grantor must call dms_heartbeat (e.g. 90 days).
    dms_heartbeat_period_ms: u64,
    /// Grace period (ms) after heartbeat expires before votes can trigger DMS.
    dms_grace_period_ms: u64,
    /// Timestamp (ms) of last heartbeat from the grantor.
    dms_last_heartbeat_at: u64,
    /// Number of votes required to trigger the DMS.
    dms_activation_threshold: u8,
    /// Addresses authorized to vote for DMS activation.
    dms_activators: vector<address>,
    /// Current votes: activator address -> true.
    dms_votes: VecMap<address, bool>,
    /// Timestamp when DMS was triggered (0 if not triggered).
    dms_triggered_at: u64,
    /// Veto window (ms) after trigger during which protector can veto.
    dms_veto_period_ms: u64,
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

public struct DistributionRequested has copy, drop {
    trust_id: ID,
    request_id: ID,
    beneficiary: address,
    amount: u64,
    category: String,
}

public struct DistributionRequestApproved has copy, drop {
    trust_id: ID,
    request_id: ID,
    approved_by: address,
}

public struct DistributionRequestDenied has copy, drop {
    trust_id: ID,
    request_id: ID,
    denied_by: address,
}

public struct CoinDeposited has copy, drop {
    trust_id: ID,
    depositor: address,
    amount: u64,
    coin_type: ascii::String,
}

public struct AgentRotated has copy, drop {
    trust_id: ID,
    old_agent: address,
    new_agent: address,
    rotated_by: address,
}

public struct SuccessorGrantorSet has copy, drop {
    trust_id: ID,
    new_successor: Option<address>,
    set_by: address,
}

public struct DMSHeartbeat has copy, drop {
    trust_id: ID,
    grantor: address,
    timestamp: u64,
    next_deadline: u64,
}

public struct DMSVoteCast has copy, drop {
    trust_id: ID,
    voter: address,
    total_votes: u64,
    threshold: u8,
}

public struct DMSTriggered has copy, drop {
    trust_id: ID,
    triggered_by: address,
    new_grantor: address,
    timestamp: u64,
}

public struct DMSVetoed has copy, drop {
    trust_id: ID,
    vetoed_by: address,
    timestamp: u64,
}

public struct DMSConfigured has copy, drop {
    trust_id: ID,
    heartbeat_period_ms: u64,
    grace_period_ms: u64,
    activation_threshold: u8,
    activator_count: u64,
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

/// Create a new trust and share it on-chain.
///
/// The trust starts ACTIVE with zero balance. The grantor must call `deposit`
/// to fund it. A `TrustCreated` event is emitted.
///
/// Parameters:
///   - override_period_ms: how long (ms) the grantor has to veto. 0 = use default (48hr).
///   - is_revocable: true = grantor can close/withdraw, false = irrevocable.
///   - successor_grantor: optional address that takes over if grantor cannot act.
///   - trust_protector: optional oversight role address.
public fun create_trust(
    name: String,
    description: String,
    agent_address: address,
    override_period_ms: u64,
    is_revocable: bool,
    successor_grantor: Option<address>,
    trust_protector: Option<address>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let grantor = ctx.sender();
    let now = clock.timestamp_ms();

    let period = if (override_period_ms == 0) {
        DEFAULT_OVERRIDE_PERIOD_MS
    } else {
        override_period_ms
    };

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
        override_period_ms: period,
        is_revocable,
        successor_grantor,
        trust_protector,
        total_deposited: 0,
        total_distributed: 0,
        additional_balances: bag::new(ctx),
        dms_enabled: false,
        dms_heartbeat_period_ms: 0,
        dms_grace_period_ms: 0,
        dms_last_heartbeat_at: 0,
        dms_activation_threshold: 0,
        dms_activators: vector[],
        dms_votes: vec_map::empty(),
        dms_triggered_at: 0,
        dms_veto_period_ms: 0,
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

    trust.total_deposited = trust.total_deposited + amount;
    balance::join(&mut trust.balance, coin::into_balance(payment));

    event::emit(TrustDeposit {
        trust_id: object::id(trust),
        depositor: ctx.sender(),
        amount,
        new_balance: trust.balance.value(),
    });
}

// ---------------------------------------------------------------------------
// Multi-asset deposits and distributions
// ---------------------------------------------------------------------------

/// Deposit any coin type T into the trust's additional balances bag.
///
/// Anyone may deposit. Trust must not be CLOSED.
/// SUI can also be deposited here (it goes into the Bag, not the primary balance).
public fun deposit_coin<T>(trust: &mut Trust, payment: Coin<T>, ctx: &mut TxContext) {
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);
    let amount = payment.value();
    assert!(amount > 0, EZeroAmount);

    let type_name = type_name::with_defining_ids<T>().into_string();

    if (bag::contains<ascii::String>(&trust.additional_balances, type_name)) {
        let existing = bag::borrow_mut<ascii::String, Balance<T>>(
            &mut trust.additional_balances,
            type_name,
        );
        balance::join(existing, coin::into_balance(payment));
    } else {
        bag::add(&mut trust.additional_balances, type_name, coin::into_balance(payment));
    };

    trust.total_deposited = trust.total_deposited + amount;

    event::emit(CoinDeposited {
        trust_id: object::id(trust),
        depositor: ctx.sender(),
        amount,
        coin_type: type_name::with_defining_ids<T>().into_string(),
    });
}

/// Distribute a non-SUI coin type from the trust's additional balances.
///
/// Same authorization and timing checks as execute_distribution.
public fun distribute_coin<T>(
    trust: &mut Trust,
    dist: &mut PendingDistribution,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(object::id(trust) == dist.trust_id, ERuleNotFound);
    assert!(!dist.is_cancelled, EDistributionAlreadyCancelled);
    assert!(!dist.is_executed, EDistributionAlreadyExecuted);
    assert!(clock.timestamp_ms() >= dist.executable_after, EOverridePeriodNotElapsed);
    assert!(amount > 0, EZeroAmount);

    let type_name = type_name::with_defining_ids<T>().into_string();
    assert!(bag::contains<ascii::String>(&trust.additional_balances, type_name), EInsufficientBalance);

    let bal = bag::borrow_mut<ascii::String, Balance<T>>(
        &mut trust.additional_balances,
        type_name,
    );
    assert!(bal.value() >= amount, EInsufficientBalance);

    dist.is_executed = true;
    trust.total_distributed = trust.total_distributed + amount;

    let payout = coin::from_balance(balance::split(bal, amount), ctx);

    event::emit(DistributionExecuted {
        trust_id: object::id(trust),
        distribution_id: object::id(dist),
        beneficiary: dist.beneficiary,
        amount,
        executed_by: ctx.sender(),
    });

    transfer::public_transfer(payout, dist.beneficiary);
}

/// Read the balance of a coin type T held in the trust's additional balances.
/// Returns 0 if the coin type has never been deposited.
public fun coin_balance<T>(trust: &Trust): u64 {
    let type_name = type_name::with_defining_ids<T>().into_string();
    if (bag::contains<ascii::String>(&trust.additional_balances, type_name)) {
        let bal = bag::borrow<ascii::String, Balance<T>>(&trust.additional_balances, type_name);
        bal.value()
    } else {
        0
    }
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
// Distribution -- propose
// ---------------------------------------------------------------------------

/// AI agent proposes a fund distribution.
///
/// Creates a `PendingDistribution` shared object. The grantor has
/// override_period_ms to cancel it; after that window expires it can be
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
    // Either the AI agent OR the grantor may propose distributions.
    let caller = ctx.sender();
    assert!(caller == trust.agent_address || caller == trust.grantor, ENotAgent);
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(amount > 0, EZeroAmount);
    assert!(trust.balance.value() >= amount, EInsufficientBalance);

    let (ben_found, _) = find_beneficiary(&trust.beneficiaries, beneficiary);
    assert!(ben_found, EBeneficiaryNotFound);

    let now = clock.timestamp_ms();
    let executable_after = now + trust.override_period_ms;
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
// Distribution -- execute
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
    trust.total_distributed = trust.total_distributed + dist.amount;

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
// Distribution -- cancel (grantor or trust protector veto)
// ---------------------------------------------------------------------------

/// Grantor or trust protector cancels a pending distribution within the override period.
public fun cancel_distribution(
    trust: &Trust,
    dist: &mut PendingDistribution,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(
        caller == trust.grantor
            || (trust.trust_protector.is_some() && caller == *trust.trust_protector.borrow()),
        ENotGrantorOrProtector,
    );
    assert!(object::id(trust) == dist.trust_id, ERuleNotFound);
    assert!(!dist.is_cancelled, EDistributionAlreadyCancelled);
    assert!(!dist.is_executed, EDistributionAlreadyExecuted);

    dist.is_cancelled = true;

    event::emit(DistributionCancelled {
        trust_id: object::id(trust),
        distribution_id: object::id(dist),
        cancelled_by: caller,
    });
}

// ---------------------------------------------------------------------------
// Beneficiary Request System
// ---------------------------------------------------------------------------

/// Beneficiary requests a distribution from the trust.
/// Creates a shared DistributionRequest object for grantor/agent review.
public fun request_distribution(
    trust: &Trust,
    amount: u64,
    reason: String,
    category: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(trust.beneficiaries.contains(&caller), ENotBeneficiary);
    assert!(amount > 0, EZeroAmount);

    let now = clock.timestamp_ms();
    let trust_id = object::id(trust);

    let request = DistributionRequest {
        id: object::new(ctx),
        trust_id,
        beneficiary: caller,
        amount,
        reason,
        category,
        requested_at: now,
        is_approved: false,
        is_denied: false,
    };

    let request_id = object::id(&request);

    event::emit(DistributionRequested {
        trust_id,
        request_id,
        beneficiary: caller,
        amount,
        category: request.category,
    });

    transfer::share_object(request);
}

/// Grantor or agent approves a beneficiary's distribution request.
/// This creates a PendingDistribution that goes through the normal override flow.
public fun approve_request(
    trust: &mut Trust,
    request: &mut DistributionRequest,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    let caller = ctx.sender();
    assert!(caller == trust.grantor || caller == trust.agent_address, ENotGrantor);
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);
    assert!(object::id(trust) == request.trust_id, ERuleNotFound);
    assert!(!request.is_approved && !request.is_denied, ERequestAlreadyProcessed);

    request.is_approved = true;

    let trust_id = object::id(trust);
    let request_id = object::id(request);

    event::emit(DistributionRequestApproved {
        trust_id,
        request_id,
        approved_by: caller,
    });

    // Create a PendingDistribution from the request (goes through normal override flow).
    let now = clock.timestamp_ms();
    let executable_after = now + trust.override_period_ms;

    let dist = PendingDistribution {
        id: object::new(ctx),
        trust_id,
        rule_index: 0, // no specific rule for request-based distributions
        beneficiary: request.beneficiary,
        amount: request.amount,
        reason: request.reason,
        proposed_at: now,
        executable_after,
        is_cancelled: false,
        is_executed: false,
    };

    let distribution_id = object::id(&dist);

    event::emit(DistributionProposed {
        trust_id,
        distribution_id,
        beneficiary: request.beneficiary,
        amount: request.amount,
        proposed_by: caller,
        executable_after,
    });

    transfer::share_object(dist);
    distribution_id
}

/// Grantor denies a beneficiary's distribution request.
public fun deny_request(
    trust: &Trust,
    request: &mut DistributionRequest,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(caller == trust.grantor, ENotGrantor);
    assert!(object::id(trust) == request.trust_id, ERuleNotFound);
    assert!(!request.is_approved && !request.is_denied, ERequestAlreadyProcessed);

    request.is_denied = true;

    event::emit(DistributionRequestDenied {
        trust_id: object::id(trust),
        request_id: object::id(request),
        denied_by: caller,
    });
}

// ---------------------------------------------------------------------------
// Trust Protector Role
// ---------------------------------------------------------------------------

/// Set or rotate the agent address. Only trust_protector or grantor can call.
public fun set_agent_address(
    trust: &mut Trust,
    new_agent: address,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(
        caller == trust.grantor
            || (trust.trust_protector.is_some() && caller == *trust.trust_protector.borrow()),
        ENotGrantorOrProtector,
    );
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);

    let old_agent = trust.agent_address;
    trust.agent_address = new_agent;

    event::emit(AgentRotated {
        trust_id: object::id(trust),
        old_agent,
        new_agent,
        rotated_by: caller,
    });
}

/// Set or update the successor grantor. Only the grantor can call.
public fun set_successor_grantor(
    trust: &mut Trust,
    new_successor: Option<address>,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(caller == trust.grantor, ENotGrantor);
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);

    trust.successor_grantor = new_successor;

    event::emit(SuccessorGrantorSet {
        trust_id: object::id(trust),
        new_successor,
        set_by: caller,
    });
}

// ---------------------------------------------------------------------------
// Trust amendment
// ---------------------------------------------------------------------------

/// Amend the trust metadata and/or deactivate rules.
///
/// For revocable trusts: grantor can amend.
/// For irrevocable trusts: only trust_protector can amend.
/// Trust must be ACTIVE.
public fun amend_trust(
    trust: &mut Trust,
    new_name: Option<String>,
    new_description: Option<String>,
    rule_index: Option<u64>,
    set_rule_active: Option<bool>,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(trust.status == STATUS_ACTIVE, ETrustNotActive);

    if (trust.is_revocable) {
        // Revocable: grantor can amend
        assert!(caller == trust.grantor, ENotGrantor);
    } else {
        // Irrevocable: only trust_protector can amend
        assert!(
            trust.trust_protector.is_some() && caller == *trust.trust_protector.borrow(),
            EIrrevocableTrust,
        );
    };

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
        amended_by: caller,
    });
}

// ---------------------------------------------------------------------------
// Emergency controls
// ---------------------------------------------------------------------------

/// Pause the trust (grantor or trust protector). No distributions can be executed while paused.
public fun pause_trust(trust: &mut Trust, ctx: &mut TxContext) {
    let caller = ctx.sender();
    assert!(
        caller == trust.grantor
            || (trust.trust_protector.is_some() && caller == *trust.trust_protector.borrow()),
        ENotGrantorOrProtector,
    );
    assert!(trust.status == STATUS_ACTIVE, EInvalidStatus);

    let old = trust.status;
    trust.status = STATUS_PAUSED;

    event::emit(TrustStatusChanged {
        trust_id: object::id(trust),
        old_status: old,
        new_status: STATUS_PAUSED,
        changed_by: caller,
    });
}

/// Resume a paused trust (grantor or trust protector).
public fun resume_trust(trust: &mut Trust, ctx: &mut TxContext) {
    let caller = ctx.sender();
    assert!(
        caller == trust.grantor
            || (trust.trust_protector.is_some() && caller == *trust.trust_protector.borrow()),
        ENotGrantorOrProtector,
    );
    assert!(trust.status == STATUS_PAUSED, EInvalidStatus);

    let old = trust.status;
    trust.status = STATUS_ACTIVE;

    event::emit(TrustStatusChanged {
        trust_id: object::id(trust),
        old_status: old,
        new_status: STATUS_ACTIVE,
        changed_by: caller,
    });
}

/// Close the trust permanently (grantor only).
///
/// For revocable trusts: remaining balance is returned to the grantor.
/// For irrevocable trusts: balance stays locked (cannot be withdrawn).
/// The trust cannot be reopened after this call.
public fun close_trust(trust: &mut Trust, ctx: &mut TxContext) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);

    // Only return balance to grantor if the trust is revocable.
    if (trust.is_revocable) {
        let remaining = trust.balance.value();
        if (remaining > 0) {
            let payout = coin::from_balance(
                balance::split(&mut trust.balance, remaining),
                ctx,
            );
            transfer::public_transfer(payout, trust.grantor);
        };
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
// Dead Man's Switch (DMS)
// ---------------------------------------------------------------------------

/// Enable and configure the Dead Man's Switch.
///
/// Only the grantor can enable DMS. A successor_grantor must already be set.
/// Activators are the addresses allowed to vote for DMS trigger (typically
/// the successor, trust protector, and/or beneficiaries).
/// activation_threshold is how many activator votes are required (e.g. 2 of 3).
public fun configure_dms(
    trust: &mut Trust,
    heartbeat_period_ms: u64,
    grace_period_ms: u64,
    veto_period_ms: u64,
    activation_threshold: u8,
    activators: vector<address>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);
    assert!(trust.successor_grantor.is_some(), ENoSuccessorGrantor);
    assert!((activation_threshold as u64) <= activators.length(), EDMSThresholdNotMet);
    assert!(activation_threshold > 0, EDMSThresholdNotMet);

    trust.dms_enabled = true;
    trust.dms_heartbeat_period_ms = heartbeat_period_ms;
    trust.dms_grace_period_ms = grace_period_ms;
    trust.dms_veto_period_ms = veto_period_ms;
    trust.dms_activation_threshold = activation_threshold;
    trust.dms_activators = activators;
    trust.dms_last_heartbeat_at = clock.timestamp_ms();
    trust.dms_votes = vec_map::empty();
    trust.dms_triggered_at = 0;

    event::emit(DMSConfigured {
        trust_id: object::id(trust),
        heartbeat_period_ms,
        grace_period_ms,
        activation_threshold,
        activator_count: trust.dms_activators.length(),
    });
}

/// Grantor confirms they are alive. Resets the heartbeat timer and clears
/// any pending DMS votes. Can be called at any time before DMS execution
/// completes — this is the safety valve against accidental triggers.
public fun dms_heartbeat(
    trust: &mut Trust,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == trust.grantor, ENotGrantor);
    assert!(trust.dms_enabled, EDMSNotEnabled);
    assert!(trust.status != STATUS_CLOSED, ETrustClosed);
    assert!(trust.status != STATUS_DMS_TRIGGERED, EDMSAlreadyTriggered);

    let now = clock.timestamp_ms();
    trust.dms_last_heartbeat_at = now;

    // Clear any pending votes — grantor is alive, reset everything.
    trust.dms_votes = vec_map::empty();
    // Clear any pending trigger.
    trust.dms_triggered_at = 0;

    event::emit(DMSHeartbeat {
        trust_id: object::id(trust),
        grantor: trust.grantor,
        timestamp: now,
        next_deadline: now + trust.dms_heartbeat_period_ms,
    });
}

/// An authorized activator votes to trigger the DMS.
///
/// Can only be called after the heartbeat has expired AND the grace period
/// has passed. Once the activation_threshold is met, the DMS enters a
/// "triggered pending" state where the trust protector has a veto window.
public fun dms_vote_trigger(
    trust: &mut Trust,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(trust.dms_enabled, EDMSNotEnabled);
    assert!(trust.status == STATUS_ACTIVE || trust.status == STATUS_PAUSED, ETrustNotActive);
    assert!(trust.dms_triggered_at == 0, EDMSAlreadyTriggered);

    // Caller must be an authorized activator.
    assert!(trust.dms_activators.contains(&caller), ENotDMSActivator);

    // Heartbeat must have expired + grace period passed.
    let now = clock.timestamp_ms();
    let deadline = trust.dms_last_heartbeat_at + trust.dms_heartbeat_period_ms + trust.dms_grace_period_ms;
    assert!(now >= deadline, EDMSHeartbeatNotExpired);

    // Must not have already voted.
    assert!(!vec_map::contains(&trust.dms_votes, &caller), EAlreadyVoted);

    vec_map::insert(&mut trust.dms_votes, caller, true);
    let total_votes = vec_map::length(&trust.dms_votes);

    event::emit(DMSVoteCast {
        trust_id: object::id(trust),
        voter: caller,
        total_votes,
        threshold: trust.dms_activation_threshold,
    });

    // If threshold met, mark as triggered (starts veto window).
    if (total_votes >= (trust.dms_activation_threshold as u64)) {
        trust.dms_triggered_at = now;

        event::emit(DMSTriggered {
            trust_id: object::id(trust),
            triggered_by: caller,
            new_grantor: *trust.successor_grantor.borrow(),
            timestamp: now,
        });
    };
}

/// Execute the DMS after the trigger + veto period has passed.
///
/// Transfers grantor role to the successor. Anyone can call this once
/// conditions are met (typically the successor or agent).
public fun dms_execute(
    trust: &mut Trust,
    clock: &Clock,
) {
    assert!(trust.dms_enabled, EDMSNotEnabled);
    assert!(trust.dms_triggered_at > 0, EDMSNotTriggered);
    assert!(trust.status != STATUS_DMS_TRIGGERED, EDMSAlreadyTriggered);
    assert!(trust.successor_grantor.is_some(), ENoSuccessorGrantor);

    let now = clock.timestamp_ms();
    let veto_deadline = trust.dms_triggered_at + trust.dms_veto_period_ms;
    assert!(now >= veto_deadline, EDMSVetoPeriodExpired);

    // Transfer control to successor.
    let old_status = trust.status;
    let new_grantor = *trust.successor_grantor.borrow();
    trust.grantor = new_grantor;
    trust.successor_grantor = option::none();
    trust.status = STATUS_DMS_TRIGGERED;

    event::emit(TrustStatusChanged {
        trust_id: object::id(trust),
        old_status,
        new_status: STATUS_DMS_TRIGGERED,
        changed_by: new_grantor,
    });
}

/// Trust protector vetoes a triggered DMS within the veto window.
///
/// This resets the DMS to pre-trigger state (votes cleared, trigger timestamp
/// cleared). The heartbeat timer is NOT reset — the grantor still needs to
/// call dms_heartbeat to prove they're alive, or activators can vote again.
public fun dms_veto(
    trust: &mut Trust,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let caller = ctx.sender();
    assert!(
        trust.trust_protector.is_some() && caller == *trust.trust_protector.borrow(),
        ENotGrantorOrProtector,
    );
    assert!(trust.dms_triggered_at > 0, EDMSNotTriggered);
    assert!(trust.status != STATUS_DMS_TRIGGERED, EDMSAlreadyTriggered);

    // Must be within veto window.
    let now = clock.timestamp_ms();
    let veto_deadline = trust.dms_triggered_at + trust.dms_veto_period_ms;
    assert!(now < veto_deadline, EDMSVetoPeriodExpired);

    // Reset trigger state.
    trust.dms_triggered_at = 0;
    trust.dms_votes = vec_map::empty();

    event::emit(DMSVetoed {
        trust_id: object::id(trust),
        vetoed_by: caller,
        timestamp: now,
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
public fun override_period_ms(trust: &Trust): u64 { trust.override_period_ms }
public fun is_revocable(trust: &Trust): bool { trust.is_revocable }
public fun successor_grantor(trust: &Trust): &Option<address> { &trust.successor_grantor }
public fun trust_protector(trust: &Trust): &Option<address> { &trust.trust_protector }
public fun total_deposited(trust: &Trust): u64 { trust.total_deposited }
public fun total_distributed(trust: &Trust): u64 { trust.total_distributed }

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

// DistributionRequest accessors
public fun req_trust_id(req: &DistributionRequest): ID { req.trust_id }
public fun req_beneficiary(req: &DistributionRequest): address { req.beneficiary }
public fun req_amount(req: &DistributionRequest): u64 { req.amount }
public fun req_reason(req: &DistributionRequest): String { req.reason }
public fun req_category(req: &DistributionRequest): String { req.category }
public fun req_requested_at(req: &DistributionRequest): u64 { req.requested_at }
public fun req_is_approved(req: &DistributionRequest): bool { req.is_approved }
public fun req_is_denied(req: &DistributionRequest): bool { req.is_denied }

// DMS accessors
public fun dms_enabled(trust: &Trust): bool { trust.dms_enabled }
public fun dms_heartbeat_period_ms(trust: &Trust): u64 { trust.dms_heartbeat_period_ms }
public fun dms_grace_period_ms(trust: &Trust): u64 { trust.dms_grace_period_ms }
public fun dms_last_heartbeat_at(trust: &Trust): u64 { trust.dms_last_heartbeat_at }
public fun dms_activation_threshold(trust: &Trust): u8 { trust.dms_activation_threshold }
public fun dms_activators(trust: &Trust): &vector<address> { &trust.dms_activators }
public fun dms_vote_count(trust: &Trust): u64 { vec_map::length(&trust.dms_votes) }
public fun dms_triggered_at(trust: &Trust): u64 { trust.dms_triggered_at }
public fun dms_veto_period_ms(trust: &Trust): u64 { trust.dms_veto_period_ms }

// Status constants (for external consumers)
public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_paused(): u8 { STATUS_PAUSED }
public fun status_closed(): u8 { STATUS_CLOSED }
public fun status_dms_triggered(): u8 { STATUS_DMS_TRIGGERED }

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
