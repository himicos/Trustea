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
///   - Beneficiary requests a distribution
///   - Grantor approves/denies request
///   - Trust protector cancels a distribution
///   - Agent rotation
///   - Irrevocable trust restrictions
#[test_only]
module trustea::trust_tests;

use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use trustea::seal_policy;
use trustea::trust::{Self, Trust, PendingDistribution, DistributionRequest};

/// Test-only coin type for multi-asset tests.
public struct USDC has drop {}

// ---------------------------------------------------------------------------
// Test addresses
// ---------------------------------------------------------------------------

const GRANTOR: address = @0xAAAA;
const BENEFICIARY: address = @0xBBBB;
const AGENT: address = @0xCCCC;
const STRANGER: address = @0xDDDD;
const PROTECTOR: address = @0xEEEE;
const NEW_AGENT: address = @0xFFFF;
const SUCCESSOR: address = @0x1111;

/// 90 days in ms.
const DMS_HEARTBEAT_PERIOD: u64 = 90 * 24 * 60 * 60 * 1_000;
/// 14 days in ms.
const DMS_GRACE_PERIOD: u64 = 14 * 24 * 60 * 60 * 1_000;
/// 7 days in ms.
const DMS_VETO_PERIOD: u64 = 7 * 24 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Helper: create a trust and return its ID (revocable, default params)
// ---------------------------------------------------------------------------

fun setup_trust(scenario: &mut Scenario): ID {
    ts::next_tx(scenario, GRANTOR);
    let ctx = scenario.ctx();
    let clk = clock::create_for_testing(ctx);

    trust::create_trust(
        b"Family Trust Alpha".to_string(),
        b"For the benefit of our children".to_string(),
        AGENT,
        0, // use default override period
        true, // revocable
        option::none(),
        option::none(),
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

/// Helper: create a trust with a trust protector (revocable).
fun setup_trust_with_protector(scenario: &mut Scenario): ID {
    ts::next_tx(scenario, GRANTOR);
    let ctx = scenario.ctx();
    let clk = clock::create_for_testing(ctx);

    trust::create_trust(
        b"Protected Trust".to_string(),
        b"Trust with protector oversight".to_string(),
        AGENT,
        0,
        true,
        option::none(),
        option::some(PROTECTOR),
        &clk,
        ctx,
    );

    clock::destroy_for_testing(clk);

    ts::next_tx(scenario, GRANTOR);
    let trust_obj = ts::take_shared<Trust>(scenario);
    let id = object::id(&trust_obj);
    ts::return_shared(trust_obj);
    id
}

/// Helper: create an irrevocable trust with protector.
fun setup_irrevocable_trust(scenario: &mut Scenario): ID {
    ts::next_tx(scenario, GRANTOR);
    let ctx = scenario.ctx();
    let clk = clock::create_for_testing(ctx);

    trust::create_trust(
        b"Irrevocable Trust".to_string(),
        b"Cannot be withdrawn".to_string(),
        AGENT,
        0,
        false, // irrevocable
        option::none(),
        option::some(PROTECTOR),
        &clk,
        ctx,
    );

    clock::destroy_for_testing(clk);

    ts::next_tx(scenario, GRANTOR);
    let trust_obj = ts::take_shared<Trust>(scenario);
    let id = object::id(&trust_obj);
    ts::return_shared(trust_obj);
    id
}

/// Helper: create a trust with DMS enabled (successor + protector + beneficiary as activators).
fun setup_trust_with_dms(scenario: &mut Scenario): ID {
    ts::next_tx(scenario, GRANTOR);
    let ctx = scenario.ctx();
    let clk = clock::create_for_testing(ctx);

    trust::create_trust(
        b"DMS Trust".to_string(),
        b"Trust with Dead Man's Switch".to_string(),
        AGENT,
        0,
        true,
        option::some(SUCCESSOR),
        option::some(PROTECTOR),
        &clk,
        ctx,
    );

    clock::destroy_for_testing(clk);

    ts::next_tx(scenario, GRANTOR);
    let mut trust_obj = ts::take_shared<Trust>(scenario);
    let id = object::id(&trust_obj);

    // Configure DMS: 2-of-3 threshold (successor, protector, beneficiary).
    let ctx2 = scenario.ctx();
    let clk2 = clock::create_for_testing(ctx2);
    trust::configure_dms(
        &mut trust_obj,
        DMS_HEARTBEAT_PERIOD,
        DMS_GRACE_PERIOD,
        DMS_VETO_PERIOD,
        2, // threshold
        vector[SUCCESSOR, PROTECTOR, BENEFICIARY],
        &clk2,
        ctx2,
    );
    clock::destroy_for_testing(clk2);

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
        assert!(trust.is_revocable() == true, 6);
        assert!(trust.total_deposited() == 0, 7);
        assert!(trust.total_distributed() == 0, 8);
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
        assert!(trust.total_deposited() == 1_000_000_000, 1);
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
        assert!(trust.total_distributed() == 500_000_000, 3);

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

        // Time = 0, override period not elapsed -> should abort.
        let clk = clock::create_for_testing(ctx);
        trust::execute_distribution(&mut trust, &mut dist, &clk, ctx);

        clock::destroy_for_testing(clk);
        ts::return_shared(dist);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 12: Beneficiary requests a distribution
// ---------------------------------------------------------------------------

#[test]
fun test_beneficiary_request_distribution() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    // Add beneficiary.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Education fund".to_string(),
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

    // Beneficiary requests distribution.
    ts::next_tx(&mut scenario, BENEFICIARY);
    {
        let trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);

        trust::request_distribution(
            &trust,
            200_000_000,
            b"Tuition payment for fall semester".to_string(),
            b"education".to_string(),
            &clk,
            ctx,
        );

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Verify the request was created.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let request = ts::take_shared<DistributionRequest>(&scenario);
        assert!(trust::req_beneficiary(&request) == BENEFICIARY, 0);
        assert!(trust::req_amount(&request) == 200_000_000, 1);
        assert!(trust::req_category(&request) == b"education".to_string(), 2);
        assert!(!trust::req_is_approved(&request), 3);
        assert!(!trust::req_is_denied(&request), 4);
        ts::return_shared(request);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 13: Grantor approves a beneficiary request
// ---------------------------------------------------------------------------

#[test]
fun test_grantor_approves_request() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    // Add beneficiary + deposit.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Health fund".to_string(),
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

    // Beneficiary requests.
    ts::next_tx(&mut scenario, BENEFICIARY);
    {
        let trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::request_distribution(
            &trust,
            100_000_000,
            b"Medical expenses".to_string(),
            b"health".to_string(),
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Grantor approves the request.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let mut request = ts::take_shared<DistributionRequest>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);

        trust::approve_request(&mut trust, &mut request, &clk, ctx);

        assert!(trust::req_is_approved(&request), 0);

        clock::destroy_for_testing(clk);
        ts::return_shared(request);
        ts::return_shared(trust);
    };

    // Verify a PendingDistribution was created.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let dist = ts::take_shared<PendingDistribution>(&scenario);
        assert!(trust::dist_beneficiary(&dist) == BENEFICIARY, 0);
        assert!(trust::dist_amount(&dist) == 100_000_000, 1);
        assert!(!trust::dist_is_executed(&dist), 2);
        ts::return_shared(dist);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 14: Grantor denies a beneficiary request
// ---------------------------------------------------------------------------

#[test]
fun test_grantor_denies_request() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    // Add beneficiary.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Maintenance".to_string(),
            500_000_000,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Beneficiary requests.
    ts::next_tx(&mut scenario, BENEFICIARY);
    {
        let trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::request_distribution(
            &trust,
            999_000_000,
            b"Vacation funds".to_string(),
            b"other".to_string(),
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Grantor denies.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let trust = ts::take_shared<Trust>(&scenario);
        let mut request = ts::take_shared<DistributionRequest>(&scenario);
        let ctx = scenario.ctx();

        trust::deny_request(&trust, &mut request, ctx);
        assert!(trust::req_is_denied(&request), 0);

        ts::return_shared(request);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 15: Trust protector cancels a distribution
// ---------------------------------------------------------------------------

#[test]
fun test_protector_cancels_distribution() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_protector(&mut scenario);

    // Add beneficiary + deposit.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Allowance".to_string(),
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
            500_000_000,
            b"Suspicious large distribution".to_string(),
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Trust protector cancels.
    ts::next_tx(&mut scenario, PROTECTOR);
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
// Test 16: Agent rotation
// ---------------------------------------------------------------------------

#[test]
fun test_agent_rotation_by_grantor() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        assert!(trust.agent_address() == AGENT, 0);
        trust::set_agent_address(&mut trust, NEW_AGENT, ctx);
        assert!(trust.agent_address() == NEW_AGENT, 1);

        ts::return_shared(trust);
    };

    scenario.end();
}

#[test]
fun test_agent_rotation_by_protector() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_protector(&mut scenario);

    ts::next_tx(&mut scenario, PROTECTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        assert!(trust.agent_address() == AGENT, 0);
        trust::set_agent_address(&mut trust, NEW_AGENT, ctx);
        assert!(trust.agent_address() == NEW_AGENT, 1);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 17: Irrevocable trust - close does not return funds
// ---------------------------------------------------------------------------

#[test]
fun test_irrevocable_trust_close_keeps_balance() {
    let mut scenario = ts::begin(GRANTOR);
    setup_irrevocable_trust(&mut scenario);

    // Deposit funds.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let payment = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
        trust::deposit(&mut trust, payment, ctx);
        assert!(trust.balance_value() == 1_000_000_000, 0);
        ts::return_shared(trust);
    };

    // Close the irrevocable trust -- balance should remain locked.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        trust::close_trust(&mut trust, ctx);

        assert!(trust.status() == trust::status_closed(), 0);
        // Balance stays locked for irrevocable trusts.
        assert!(trust.balance_value() == 1_000_000_000, 1);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 18: Irrevocable trust - grantor cannot amend (only protector can)
// ---------------------------------------------------------------------------

#[test]
#[expected_failure(abort_code = trustea::trust::EIrrevocableTrust)]
fun test_irrevocable_trust_grantor_cannot_amend() {
    let mut scenario = ts::begin(GRANTOR);
    setup_irrevocable_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        // Grantor should NOT be able to amend an irrevocable trust.
        trust::amend_trust(
            &mut trust,
            option::some(b"New Name".to_string()),
            option::none(),
            option::none(),
            option::none(),
            ctx,
        );

        ts::return_shared(trust);
    };

    scenario.end();
}

#[test]
fun test_irrevocable_trust_protector_can_amend() {
    let mut scenario = ts::begin(GRANTOR);
    setup_irrevocable_trust(&mut scenario);

    ts::next_tx(&mut scenario, PROTECTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        // Protector CAN amend an irrevocable trust.
        trust::amend_trust(
            &mut trust,
            option::some(b"Updated Irrevocable Trust".to_string()),
            option::none(),
            option::none(),
            option::none(),
            ctx,
        );

        assert!(trust.name() == b"Updated Irrevocable Trust".to_string(), 0);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 19: Trust protector can pause/resume
// ---------------------------------------------------------------------------

#[test]
fun test_protector_pause_resume() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_protector(&mut scenario);

    ts::next_tx(&mut scenario, PROTECTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        trust::pause_trust(&mut trust, ctx);
        assert!(trust.status() == trust::status_paused(), 0);

        trust::resume_trust(&mut trust, ctx);
        assert!(trust.status() == trust::status_active(), 1);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 20: Set successor grantor
// ---------------------------------------------------------------------------

#[test]
fun test_set_successor_grantor() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        assert!(trust.successor_grantor().is_none(), 0);

        trust::set_successor_grantor(
            &mut trust,
            option::some(STRANGER),
            ctx,
        );

        assert!(trust.successor_grantor().is_some(), 1);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 21: Multi-asset deposit (deposit_coin<T> + coin_balance<T>)
// ---------------------------------------------------------------------------

#[test]
fun test_multi_asset_deposit() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();

        // Deposit a non-SUI coin type (USDC)
        let usdc_coin = coin::mint_for_testing<USDC>(500_000_000, ctx);
        trust::deposit_coin<USDC>(&mut trust, usdc_coin, ctx);

        // Read the balance back
        assert!(trust::coin_balance<USDC>(&trust) == 500_000_000, 0);
        // SUI primary balance should still be zero
        assert!(trust.balance_value() == 0, 1);
        // total_deposited should include the USDC deposit
        assert!(trust.total_deposited() == 500_000_000, 2);

        // Deposit more USDC — should accumulate
        let usdc_coin2 = coin::mint_for_testing<USDC>(200_000_000, ctx);
        trust::deposit_coin<USDC>(&mut trust, usdc_coin2, ctx);
        assert!(trust::coin_balance<USDC>(&trust) == 700_000_000, 3);
        assert!(trust.total_deposited() == 700_000_000, 4);

        // SUI balance via coin_balance should be 0 (not deposited via deposit_coin)
        assert!(trust::coin_balance<SUI>(&trust) == 0, 5);

        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 22: Principal vs income tracking across deposits and distributions
// ---------------------------------------------------------------------------

#[test]
fun test_principal_income_tracking() {
    // (renumbered from test 21)
    let mut scenario = ts::begin(GRANTOR);
    setup_trust(&mut scenario);

    // Add beneficiary + deposit.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"Income beneficiary".to_string(),
            0,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);

        // First deposit.
        let payment1 = coin::mint_for_testing<SUI>(1_000_000_000, ctx);
        trust::deposit(&mut trust, payment1, ctx);
        assert!(trust.total_deposited() == 1_000_000_000, 0);

        // Second deposit.
        let payment2 = coin::mint_for_testing<SUI>(500_000_000, ctx);
        trust::deposit(&mut trust, payment2, ctx);
        assert!(trust.total_deposited() == 1_500_000_000, 1);
        assert!(trust.total_distributed() == 0, 2);

        ts::return_shared(trust);
    };

    // Propose + execute a distribution to verify total_distributed tracks.
    ts::next_tx(&mut scenario, AGENT);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::propose_distribution(
            &mut trust,
            0,
            BENEFICIARY,
            200_000_000,
            b"Income distribution".to_string(),
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
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(172_800_001);
        trust::execute_distribution(&mut trust, &mut dist, &clk, ctx);

        assert!(trust.total_deposited() == 1_500_000_000, 0);
        assert!(trust.total_distributed() == 200_000_000, 1);
        assert!(trust.balance_value() == 1_300_000_000, 2);

        clock::destroy_for_testing(clk);
        ts::return_shared(dist);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 23: Configure DMS
// ---------------------------------------------------------------------------

#[test]
fun test_configure_dms() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let trust = ts::take_shared<Trust>(&scenario);
        assert!(trust::dms_enabled(&trust), 0);
        assert!(trust::dms_heartbeat_period_ms(&trust) == DMS_HEARTBEAT_PERIOD, 1);
        assert!(trust::dms_grace_period_ms(&trust) == DMS_GRACE_PERIOD, 2);
        assert!(trust::dms_activation_threshold(&trust) == 2, 3);
        assert!(trust::dms_activators(&trust).length() == 3, 4);
        assert!(trust::dms_veto_period_ms(&trust) == DMS_VETO_PERIOD, 5);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 24: DMS heartbeat resets timer and clears votes
// ---------------------------------------------------------------------------

#[test]
fun test_dms_heartbeat() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(1_000_000);

        trust::dms_heartbeat(&mut trust, &clk, ctx);

        assert!(trust::dms_last_heartbeat_at(&trust) == 1_000_000, 0);
        assert!(trust::dms_vote_count(&trust) == 0, 1);

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 25: Full DMS flow — heartbeat expires → votes → trigger → execute
// ---------------------------------------------------------------------------

#[test]
fun test_dms_full_flow() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    // Add beneficiary so they can vote.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"DMS beneficiary".to_string(),
            1_000_000_000,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Advance time past heartbeat + grace period.
    let expire_time = DMS_HEARTBEAT_PERIOD + DMS_GRACE_PERIOD + 1;

    // Successor votes.
    ts::next_tx(&mut scenario, SUCCESSOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time);

        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        assert!(trust::dms_vote_count(&trust) == 1, 0);
        assert!(trust::dms_triggered_at(&trust) == 0, 1);

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Protector votes (reaches threshold of 2).
    ts::next_tx(&mut scenario, PROTECTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time + 1_000);

        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        assert!(trust::dms_vote_count(&trust) == 2, 0);
        assert!(trust::dms_triggered_at(&trust) > 0, 1);

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Execute after veto period passes.
    ts::next_tx(&mut scenario, SUCCESSOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time + 1_000 + DMS_VETO_PERIOD + 1);

        trust::dms_execute(&mut trust, &clk);

        assert!(trust.status() == trust::status_dms_triggered(), 0);
        assert!(trust.grantor() == SUCCESSOR, 1);
        assert!(trust.successor_grantor().is_none(), 2);

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 26: DMS vote before expiry fails
// ---------------------------------------------------------------------------

#[test]
#[expected_failure(abort_code = trustea::trust::EDMSHeartbeatNotExpired)]
fun test_dms_vote_before_expiry_fails() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    ts::next_tx(&mut scenario, SUCCESSOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(1_000);

        trust::dms_vote_trigger(&mut trust, &clk, ctx);

        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 27: Grantor heartbeat clears pending votes
// ---------------------------------------------------------------------------

#[test]
fun test_heartbeat_clears_votes() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    let expire_time = DMS_HEARTBEAT_PERIOD + DMS_GRACE_PERIOD + 1;

    // Successor votes after expiry.
    ts::next_tx(&mut scenario, SUCCESSOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time);
        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        assert!(trust::dms_vote_count(&trust) == 1, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Grantor comes back and heartbeats — clears everything.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time + 500);
        trust::dms_heartbeat(&mut trust, &clk, ctx);
        assert!(trust::dms_vote_count(&trust) == 0, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 28: Trust protector vetoes triggered DMS
// ---------------------------------------------------------------------------

#[test]
fun test_dms_protector_veto() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    let expire_time = DMS_HEARTBEAT_PERIOD + DMS_GRACE_PERIOD + 1;

    // Add beneficiary so they can vote.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"DMS test".to_string(),
            0,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Two votes to trigger.
    ts::next_tx(&mut scenario, SUCCESSOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time);
        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    ts::next_tx(&mut scenario, BENEFICIARY);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time + 1_000);
        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        assert!(trust::dms_triggered_at(&trust) > 0, 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Protector vetoes within veto window.
    ts::next_tx(&mut scenario, PROTECTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time + 2_000);
        trust::dms_veto(&mut trust, &clk, ctx);
        assert!(trust::dms_triggered_at(&trust) == 0, 0);
        assert!(trust::dms_vote_count(&trust) == 0, 1);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 29: Non-activator cannot vote
// ---------------------------------------------------------------------------

#[test]
#[expected_failure(abort_code = trustea::trust::ENotDMSActivator)]
fun test_stranger_cannot_vote_dms() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    let expire_time = DMS_HEARTBEAT_PERIOD + DMS_GRACE_PERIOD + 1;

    ts::next_tx(&mut scenario, STRANGER);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time);
        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}

// ---------------------------------------------------------------------------
// Test 30: Cannot execute DMS before veto period expires
// ---------------------------------------------------------------------------

#[test]
#[expected_failure(abort_code = trustea::trust::EDMSVetoPeriodExpired)]
fun test_dms_execute_before_veto_period_fails() {
    let mut scenario = ts::begin(GRANTOR);
    setup_trust_with_dms(&mut scenario);

    let expire_time = DMS_HEARTBEAT_PERIOD + DMS_GRACE_PERIOD + 1;

    // Add beneficiary for second vote.
    ts::next_tx(&mut scenario, GRANTOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let clk = clock::create_for_testing(ctx);
        trust::add_beneficiary(
            &mut trust,
            BENEFICIARY,
            b"Alice".to_string(),
            b"DMS test".to_string(),
            0,
            false,
            &clk,
            ctx,
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Two votes to trigger.
    ts::next_tx(&mut scenario, SUCCESSOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time);
        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    ts::next_tx(&mut scenario, BENEFICIARY);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time + 1_000);
        trust::dms_vote_trigger(&mut trust, &clk, ctx);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    // Try to execute immediately (within veto period) — should fail.
    ts::next_tx(&mut scenario, SUCCESSOR);
    {
        let mut trust = ts::take_shared<Trust>(&scenario);
        let ctx = scenario.ctx();
        let mut clk = clock::create_for_testing(ctx);
        clk.increment_for_testing(expire_time + 2_000);
        trust::dms_execute(&mut trust, &clk);
        clock::destroy_for_testing(clk);
        ts::return_shared(trust);
    };

    scenario.end();
}
