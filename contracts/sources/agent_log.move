// Copyright (c), Trustea, 2026
// SPDX-License-Identifier: Apache-2.0

/// Agent Action Log module.
///
/// Provides an on-chain audit trail of all AI agent decisions. Every significant
/// action taken by the authorized agent is emitted as an event so that the full
/// decision history can be reconstructed off-chain (e.g. via Sui indexers).
///
/// Action types (action_type field):
///   0 = condition_checked      — agent evaluated whether a rule condition is met
///   1 = distribution_proposed  — agent proposed a fund release
///   2 = distribution_executed  — a PendingDistribution was executed
///   3 = yield_action           — agent performed a yield/investment action
///   4 = compliance_review      — agent ran a compliance/regulatory review
module trustea::agent_log;

use std::string::String;
use sui::event;

// ---------------------------------------------------------------------------
// Action type constants
// ---------------------------------------------------------------------------

/// Agent evaluated whether a rule condition is satisfied.
const ACTION_CONDITION_CHECKED: u8 = 0;
/// Agent proposed a fund release (creates PendingDistribution).
const ACTION_DISTRIBUTION_PROPOSED: u8 = 1;
/// A PendingDistribution was executed / funds transferred.
const ACTION_DISTRIBUTION_EXECUTED: u8 = 2;
/// Agent performed a yield/investment action.
const ACTION_YIELD_ACTION: u8 = 3;
/// Agent ran a compliance/regulatory review.
const ACTION_COMPLIANCE_REVIEW: u8 = 4;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/// Action type value is not one of the recognised constants.
const EInvalidActionType: u64 = 1;

// ---------------------------------------------------------------------------
// Event structs
// ---------------------------------------------------------------------------

/// Emitted whenever the AI agent records an action. Indexed off-chain to build
/// a full audit log of every agent decision associated with a trust.
public struct AgentAction has copy, drop {
    /// Object ID of the Trust this action relates to.
    trust_id: ID,
    /// The agent's on-chain address (must match trust.agent_address).
    agent: address,
    /// Numeric action type — see constants above.
    action_type: u8,
    /// Human-readable description of what the agent did / decided.
    description: String,
    /// Optional reference to a beneficiary involved in this action (zero address if N/A).
    beneficiary: address,
    /// Amount in MIST relevant to this action (0 if not applicable).
    amount: u64,
    /// Timestamp in milliseconds at the time the action was taken.
    timestamp_ms: u64,
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/// Emit an AgentAction event.
///
/// Called by the trust module (or directly by the agent) to record a decision.
/// The caller must supply the Clock so the timestamp is authoritative.
public fun emit_action(
    trust_id: ID,
    agent: address,
    action_type: u8,
    description: String,
    beneficiary: address,
    amount: u64,
    timestamp_ms: u64,
) {
    assert!(
        action_type == ACTION_CONDITION_CHECKED
            || action_type == ACTION_DISTRIBUTION_PROPOSED
            || action_type == ACTION_DISTRIBUTION_EXECUTED
            || action_type == ACTION_YIELD_ACTION
            || action_type == ACTION_COMPLIANCE_REVIEW,
        EInvalidActionType,
    );

    event::emit(AgentAction {
        trust_id,
        agent,
        action_type,
        description,
        beneficiary,
        amount,
        timestamp_ms,
    });
}

// ---------------------------------------------------------------------------
// Action-type accessors (useful in tests / off-chain tooling)
// ---------------------------------------------------------------------------

public fun action_condition_checked(): u8 { ACTION_CONDITION_CHECKED }
public fun action_distribution_proposed(): u8 { ACTION_DISTRIBUTION_PROPOSED }
public fun action_distribution_executed(): u8 { ACTION_DISTRIBUTION_EXECUTED }
public fun action_yield_action(): u8 { ACTION_YIELD_ACTION }
public fun action_compliance_review(): u8 { ACTION_COMPLIANCE_REVIEW }
