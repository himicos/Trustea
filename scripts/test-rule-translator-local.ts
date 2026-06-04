#!/usr/bin/env tsx
/**
 * Test rule translator with local Ollama model (gemma3:27b).
 *
 * Uses the same system prompt and JSON parsing as the real translator,
 * but hits localhost:11434 instead of Anthropic API.
 *
 * Run:
 *   npx tsx scripts/test-rule-translator-local.ts
 */

// Re-use the same prompt and parser from rule-translator
const SYSTEM_PROMPT = `You are a trust fund legal rule interpreter for Trustea, an on-chain family trust platform built on Sui.

Given a plain English rule for a family trust fund, extract structured data and respond in valid JSON ONLY — no markdown, no prose, just JSON.

## Rule Types
- **age**: Distribution triggered when a beneficiary reaches a specific age (e.g., "when she turns 25")
- **time**: Distribution triggered on a specific calendar date (e.g., "on January 1st 2028")
- **credential**: Distribution triggered by holding (or lacking) an on-chain NFT/credential (e.g., university enrollment, professional license, criminal record)
- **periodic**: Recurring distribution on a schedule (e.g., "annually", "monthly", "every quarter")
- **custom**: Complex logic not fitting other categories

## Amount Parsing Rules
- "$50,000" → amount: 50000, isPercentage: false
- "50k" → amount: 50000, isPercentage: false
- "10%" → amount: 10, isPercentage: true
- "half" → amount: 50, isPercentage: true
- "all" or "everything" → amount: 100, isPercentage: true
- If no amount is mentioned → amount: 0, and add a warning

## Period Parsing (for periodic rules)
- "annually" / "yearly" → periodMs: 31536000000 (365 days)
- "monthly" → periodMs: 2592000000 (30 days)
- "quarterly" → periodMs: 7776000000 (90 days)
- "weekly" → periodMs: 604800000 (7 days)

## Response Format (strictly valid JSON)
{
  "ruleType": "age" | "time" | "credential" | "periodic" | "custom",
  "beneficiary": "name or null",
  "amount": number,
  "isPercentage": boolean,
  "conditionDescription": "clear human-readable condition",
  "conditionParams": {
    "type": "same as ruleType",
    "timestamp": number (unix ms, optional),
    "nftType": "string (optional, for credential rules)",
    "periodMs": number (optional, for periodic rules),
    "customLogic": "string (optional, for custom rules)",
    "negativeCheck": boolean (optional)
  },
  "explanation": "Your interpretation in 1-2 sentences",
  "confidence": 0.0 to 1.0,
  "warnings": ["list of warnings"] or []
}`;

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

const TEST_RULES = [
  // Basic rules
  "Release $50,000 to Alice when she turns 25",
  "Send Bob $500 every month",
  "Give Carol 10% of the trust balance each year",
  // Compound rules
  "Release funds to Alice when she graduates college AND turns 21 AND has no criminal record",
  "Distribute everything to my wife if I die",
  // Incentive trust
  "Match Jake's earned income dollar for dollar, up to $50,000 per year",
  // HEMS standard
  "Pay for Alice's medical expenses up to $10,000 per year",
  // Protective
  "Suspend all distributions to Bob if he files for bankruptcy",
  // Business rule
  "Distribute 5% of annual returns only when trust balance exceeds $1 million",
  // Spendthrift
  "Give Carol no more than $3,000 per month for living expenses",
  // Life event
  "Give Alice a $100,000 wedding gift when she gets married",
  // Generation-skipping
  "After my death, split the remainder equally among my grandchildren",
];

// ---------------------------------------------------------------------------
// Ollama call
// ---------------------------------------------------------------------------

async function callOllama(rule: string): Promise<string> {
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma3:27b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Trust rule to interpret: "${rule}"\n\nToday's date: ${new Date().toISOString().split("T")[0]}\n\nExtract the structured rule data and respond with JSON only.`,
        },
      ],
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { message: { content: string } };
  return data.message.content;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Trustea Rule Translator — Local Model Test (gemma3:27b)\n");

let passed = 0;
let failed = 0;

for (const rule of TEST_RULES) {
  console.log(`─── Input: "${rule}"`);

  try {
    const raw = await callOllama(rule);

    // Strip markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.log(`  [FAIL] JSON parse error`);
      console.log(`  Raw: ${raw.slice(0, 200)}`);
      failed++;
      continue;
    }

    const ruleType = parsed.ruleType as string;
    const amount = parsed.amount as number;
    const isPercentage = parsed.isPercentage as boolean;
    const confidence = parsed.confidence as number;
    const beneficiary = parsed.beneficiary as string | null;
    const explanation = parsed.explanation as string;
    const warnings = parsed.warnings as string[];
    const params = parsed.conditionParams as Record<string, unknown>;

    console.log(`  Type: ${ruleType}  |  Amount: ${isPercentage ? `${amount}%` : `$${amount.toLocaleString()}`}  |  Conf: ${(confidence * 100).toFixed(0)}%`);
    console.log(`  Beneficiary: ${beneficiary ?? "—"}`);
    console.log(`  Condition: ${parsed.conditionDescription}`);
    if (params.periodMs) console.log(`  Period: ${Number(params.periodMs) / 86400000} days`);
    if (params.timestamp) console.log(`  Timestamp: ${new Date(params.timestamp as number).toISOString()}`);
    if (params.nftType) console.log(`  NFT type: ${params.nftType}`);
    if (params.negativeCheck) console.log(`  Negative check: true (absence triggers)`);
    if (params.conditions) console.log(`  Sub-conditions: ${(params.conditions as unknown[]).length} (${params.logicOperator ?? "AND"})`);
    if (params.balanceMin) console.log(`  Balance min: $${Number(params.balanceMin).toLocaleString()}`);
    if (params.incomeMatchRatio) console.log(`  Income match: ${Number(params.incomeMatchRatio) * 100}%`);
    if (params.maxPerDistribution) console.log(`  Max/distribution: $${Number(params.maxPerDistribution).toLocaleString()}`);
    if (params.hemsCategory) console.log(`  HEMS: ${params.hemsCategory}`);
    console.log(`  Explanation: ${explanation}`);
    if (warnings.length) console.log(`  Warnings: ${warnings.join("; ")}`);

    // Basic validation
    const valid =
      ["age", "time", "credential", "periodic", "custom"].includes(ruleType) &&
      typeof amount === "number" &&
      typeof isPercentage === "boolean" &&
      typeof confidence === "number" &&
      confidence >= 0 &&
      confidence <= 1;

    if (valid) {
      console.log(`  [PASS]`);
      passed++;
    } else {
      console.log(`  [FAIL] Validation failed`);
      failed++;
    }
  } catch (e) {
    console.log(`  [FAIL] ${e}`);
    failed++;
  }

  console.log();
}

console.log(`${"=".repeat(50)}`);
console.log(`Results: ${passed}/${passed + failed} passed`);
console.log();
