// Copyright (c), Trustea, 2026
// SPDX-License-Identifier: Apache-2.0

/// Integration tests for the Trustea smart contracts.
///
/// Tests cover the full lifecycle:
///   - Create trust
///   - Add beneficiary (+ NFT mint)
///   - Deposit funds
///   - Add rule
///   - Propose distribution
///   - Execute distribution after override period
///   - Grantor veto (cancel) of a proposed distribution
///   - Pause / resume trust
///   - Seal policy key-id helpers
#[test_only]
module trustea::trust_tests;

use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use trustea::seal_policy;
use trustea::trust::{Self, Trust, PendingDistribution};

// ---------------------------------------------------------------------------
// Test addresses
// ---------------------------------------------------------------------------

const GRANTOR: address = @0xAAAA;
const BENEFICIARY: address = @0xBBBB;
const AGENT: address = @0xCCCC;
const STRANGER: address = @0xDDDD;

// ---------------------------------------------------------------------------
// Helper: create a trust and return its ID
// ---------------------------------------------------------------------------

fun setup_trust(scenario: &mut Scenario): ID {
    ts::next_tx(scenario, GRANTOR);
    let ctx = scenario.ctx();
    let clk = clock::create_for_testing(ctx);

    trust::create_trust(
        b"Family Trust Alpha".to_string(),
        b"For the benefit of our children".to_string(),
        AGENT,
        &clk,
        ctx,
    );

    clock::destroy_for_testing(clk);

    // Return the shared object ID from the next transaction's perspective.
    ts::next_tx(scenario, GRANTOR);
    let trust_obj = ts::take_shared<Trust>(scenario);
    let id = object::id(&trust_obj);
    ts::return_shared(trust_obj);
    id
}

// ---------------------------------------------------------------------------
// Test 1: Create trust
// ---------------------------------------------------------------------------

#[test]
fun test_create_trust() {
    let mut scenario = ts::begin(GRANTOR);

    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let trust = ts::take_shared<Trust>(&scenario);
        assert!(trust.name() == b"Family Trust Alpha".to_string(), 0);
        assert!(trust.grantor() == GRANTOR, 1);
        assert!(trust.agent_address() == AGENT, 2);
        assert!(trust.status() == trust::status_active(), 3);
        assert!(trust.balance_value() == 0, 4);
        assert!(trust.beneficiary_count() == 0, 5);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 2: Deposit funds
// ---------------------------------------------------------------------------

#[test]
fun test_deposit() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        let payment = coin::mint_for_testing<SUI>(1_000_000_000, ctx); // 1 SUI
        trust::deposit(&mut trust, payment, ctx);

        assert!(trust.balance_value() == 1_000_000_000, 0);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 3: Add beneficiary
// ---------------------------------------------------------------------------

#[test]
fun test_add_beneficiary() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);

        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Receives funds upon reaching age 18".to_string(),
            500_000_000, // 0.5 SUI
            false,       // not a percentage
            &clk,
            ctx,
        );

        assert!(trust.beneficiary_count() == 1, 0);
        assert!(trust.is_beneficiary(BENEFICIARY), 1);

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 4: Add rule
// ---------------------------------------------------------------------------

#[test]
fun test_add_rule() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    // First add beneficiary.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Age unlock".to_string(),
            500_000_000,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Now add a time-based rule.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        // Rule: release 500_000_000 MIST to BENEFICIARY after timestamp 10_000 ms.
        trust::add_rule(
            &mut trust,
            1,              // RULE_TYPE_TIME
            BENEFICIARY,
            500_000_000,
            false,          // not a percentage
            10_000,         // unlock at timestamp 10_000 ms
            b"Time-based release after 10 seconds".to_string(),
            ctx,
        );

        assert!(trust.rule_count() == 1, 0);
        let rules = trust.rules();
        let rule = rules.borrow(0);
        assert!(trust::rule_type(rule) == 1, 1);
        assert!(trust::rule_beneficiary(rule) == BENEFICIARY, 2);
        assert!(trust::rule_amount(rule) == 500_000_000, 3);
        assert!(trust::rule_is_active(rule), 4);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 5: Propose and execute distribution
// ---------------------------------------------------------------------------

#[test]
fun test_propose_and_execute_distribution() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    // Setup: add beneficiary + deposit.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Periodic allowance".to_string(),
            500_000_000,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);

        let payment = coin::mint_for_testing<SUI>(2_000_000_000, ctx);
        trust::deposit(&mut trust, payment, ctx);
        ts::return_shared(trust);
    };

    // Agent proposes distribution.
    ts::next_tx(&mut scenario, AGENT);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx); // time = 0

        trust::propose_distribution(
            &mut trust,
            0,               // rule_index (no rule required for agent proposals)
            BENEFICIARY,
            500_000_000,
            b"Monthly allowance — conditions met".to_string(),
            &clk,
            ctx,
        );

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Advance time past override period and execute.
    ts::next_tx(&mut scenario, AGENT);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let mut dist = ts::take_shared<PendingDistribution>(&scenario);
        let ctx = scenario.ctx();

        // Override period = 48 hours = 172_800_000 ms.
        // We simulate time at 172_800_001 ms.
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(172_800_001);

        assert!(!trust::dist_is_executed(&dist), 0);

        trust::execute_distribution(&mut trust, &mut dist, &clk, ctx);

        assert!(trust::dist_is_executed(&dist), 1);
        // Balance should have decreased by 500_000_000.
        assert!(trust.balance_value() == 1_500_000_000, 2);

        clock::destroy_for_testing(clk);
        ts::return_shared(dist);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 6: Grantor cancels a distribution within override period
// ---------------------------------------------------------------------------

#[test]
fun test_cancel_distribution() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    // Setup: add beneficiary + deposit.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Bob".to_string(),
            b"Allowance".to_string(),
            300_000_000,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        let payment = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
        trust::deposit(&mut trust, payment, ctx);
        ts::return_shared(trust);
    };

    // Agent proposes.
    ts::next_tx(&mut scenario, AGENT);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::propose_distribution(
            &mut trust,
            0,
            BENEFICIARY,
            300_000_000,
            b"Suspicious activity — should be vetoed".to_string(),
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Grantor cancels before override period ends.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let trust = ts::take_shared<Trust>(&scenario);
        let mut dist = ts::take_shared<PendingDistribution>(&scenario);
        let ctx = scenario.ctx();

        assert!(!trust::dist_is_cancelled(&dist), 0);
        trust::cancel_distribution(&trust, &mut dist, ctx);
        assert!(trust::dist_is_cancelled(&dist), 1);

        ts::return_shared(dist);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 7: Pause and resume trust
// ---------------------------------------------------------------------------

#[test]
fun test_pause_resume() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        assert!(trust.status() == trust::status_active(), 0);

        trust::pause_trust(&mut trust, ctx);
        assert!(trust.status() == trust::status_paused(), 1);

        trust::resume_trust(&mut trust, ctx);
        assert!(trust.status() == trust::status_active(), 2);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 8: Seal policy key-id helpers
// ---------------------------------------------------------------------------

#[test]
fun test_seal_key_id_helpers() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let trust = ts::take_shared<Trust>(&scenario);

        let plain_id = seal_policy::build_key_id_plain(&trust);
        // Plain key-id should be exactly 32 bytes (object ID only).
        assert!(plain_id.length() == 32, 0);

        let tl_id = seal_policy::build_key_id_timelocked(&trust, 9_999_999_999u64);
        // Time-locked key-id = 32 (prefix) + 8 (u64 BCS) = 40 bytes.
        assert!(tl_id.length() == 40, 1);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 9: Walrus ref storage
// ---------------------------------------------------------------------------

#[test]
fun test_add_walrus_ref() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        trust::add_walrus_ref(
            &mut trust,
            b"blobid_abc123_encrypted_will".to_string(),
            ctx,
        );

        assert!(trust.walrus_blob_ids().length() == 1, 0);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 10: Non-grantor cannot add beneficiary (negative test)
// ---------------------------------------------------------------------------

#[test]
#[expected_failure(abort_code = trustea::trust::ENotGrantor)]
fun test_stranger_cannot_add_beneficiary() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, STRANGER); // wrong caller
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        // This should abort with ENotGrantor.
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Mallory".to_string(),
            b"Unauthorized".to_string(),
            0,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 11: Cannot execute distribution before override period
// ---------------------------------------------------------------------------

#[test]
#[expected_failure(abort_code = trustea::trust::EOverridePeriodNotElapsed)]
fun test_cannot_execute_before_override_period() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Carol".to_string(),
            b"Early release attempt".to_string(),
            100_000_000,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        let payment = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
        trust::deposit(&mut trust, payment, ctx);
        ts::return_shared(trust);
    };

    ts::next_tx(&mut scenario, AGENT);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::propose_distribution(
            &mut trust,
            0,
            BENEFICIARY,
            100_000_000,
            b"Test early execution".to_string(),
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    ts::next_tx(&mut scenario, AGENT);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let mut dist = ts::take_shared<PendingDistribution>(&scenario);
        let ctx = scenario.ctx();

        // Time = 0, override period not elapsed → should abort.
        let clk = clock::create_for_testing(ctx);
        trust::execute_distribution(&mut trust, &mut dist, &clk, ctx);

        clock::destroy_for_testing(clk);
        ts::return_shared(dist);
        ts::return_shared(trust);
    };

    scenario.end();
}
