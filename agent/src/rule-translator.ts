/**
 * Rule Translator — Hero Feature
 *
 * Translates plain English trust rules into structured TrustRule objects using Claude.
 * Handles amounts like "$50,000", "50k", "10%", time references like "when she turns 25",
 * credentials like "enrolled in university", and recurring rules like "annually".
 */

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All supported rule categories. */
export type RuleType = "age" | "time" | "credential" | "periodic" | "custom";

/** Structured representation of a single trust distribution rule. */
export interface TrustRule {
  ruleType: RuleType;
  /** Beneficiary name or identifier extracted from the rule text. */
  beneficiary?: string;
  /** Dollar amount or percentage value. */
  amount: number;
  /** True when amount is a percentage of trust balance, false for fixed dollar. */
  isPercentage: boolean;
  /** Human-readable description of the triggering condition. */
  conditionDescription: string;
  conditionParams: {
    type: string;
    /** Unix timestamp (ms) for age/time based triggers. */
    timestamp?: number;
    /** NFT type identifier for credential-based rules. */
    nftType?: string;
    /** Recurrence period in milliseconds for periodic rules. */
    periodMs?: number;
    /** Free-form logic description for custom rules. */
    customLogic?: string;
    /** Whether the credential check is a negative check (absence = trigger). */
    negativeCheck?: boolean;
  };
}

/** Result of translating a single plain English rule. */
export interface TranslationResult {
  rule: TrustRule;
  /** The AI's explanation of how it interpreted the rule. */
  explanation: string;
  /** 0–1 confidence score. */
  confidence: number;
  /** Ambiguities, missing info, or concerns about the rule. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Prompt engineering
// ---------------------------------------------------------------------------

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

## Confidence Scoring
- 0.9–1.0: All fields clearly specified
- 0.7–0.89: Minor ambiguities (e.g., missing exact date, ambiguous beneficiary)
- 0.5–0.69: Multiple ambiguities requiring assumptions
- Below 0.5: Significant missing info

## Credential NFT Types
Map to these standard nftType identifiers:
- University enrollment → "university_enrollment"
- Professional license → "professional_license"
- Marriage certificate → "marriage_certificate"
- Criminal conviction → "criminal_conviction"
- Death certificate → "death_certificate"
- Military service → "military_service"
- Drug test pass → "drug_test_pass"

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
    "negativeCheck": boolean (optional, true means absence of credential triggers rule)
  },
  "explanation": "Your interpretation of the rule in 1-2 sentences",
  "confidence": 0.0 to 1.0,
  "warnings": ["list", "of", "warnings"] or []
}`;

/**
 * Build the user turn for the translate prompt.
 */
function buildUserPrompt(input: string): string {
  return `Trust rule to interpret: "${input}"

Today's date for reference: ${new Date().toISOString().split("T")[0]}

Extract the structured rule data and respond with JSON only.`;
}

// ---------------------------------------------------------------------------
// Core translation logic
// ---------------------------------------------------------------------------

/**
 * Parse and validate the raw JSON response from Claude into a TranslationResult.
 * Falls back gracefully on parse errors, returning a low-confidence custom rule.
 */
function parseClaudeResponse(
  raw: string,
  originalInput: string
): TranslationResult {
  // Strip any accidental markdown fences Claude might add
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      rule: {
        ruleType: "custom",
        amount: 0,
        isPercentage: false,
        conditionDescription: originalInput,
        conditionParams: { type: "custom", customLogic: originalInput },
      },
      explanation: "Failed to parse AI response — rule stored as custom.",
      confidence: 0.1,
      warnings: [
        "Could not parse AI response. Manual review required.",
        `Raw response: ${raw.slice(0, 200)}`,
      ],
    };
  }

  const rule: TrustRule = {
    ruleType: (parsed.ruleType as RuleType) ?? "custom",
    beneficiary:
      parsed.beneficiary != null && parsed.beneficiary !== ""
        ? (parsed.beneficiary as string)
        : undefined,
    amount: typeof parsed.amount === "number" ? parsed.amount : 0,
    isPercentage:
      typeof parsed.isPercentage === "boolean" ? parsed.isPercentage : false,
    conditionDescription:
      typeof parsed.conditionDescription === "string"
        ? parsed.conditionDescription
        : originalInput,
    conditionParams: {
      type: (parsed.ruleType as string) ?? "custom",
      ...(parsed.conditionParams as object),
    },
  };

  return {
    rule,
    explanation:
      typeof parsed.explanation === "string"
        ? parsed.explanation
        : "No explanation provided.",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    warnings: Array.isArray(parsed.warnings)
      ? (parsed.warnings as string[])
      : [],
  };
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Translate a single plain English trust rule into a structured TrustRule.
 *
 * @param input - Plain English rule (e.g. "Release $50,000 to Alice when she turns 25")
 * @param apiKey - Anthropic API key (falls back to ANTHROPIC_API_KEY env var)
 * @returns Structured rule, explanation, confidence score, and any warnings
 *
 * @example
 * const result = await translateRule("Distribute 10% annually to Carol");
 * // result.rule.ruleType === 'periodic'
 * // result.rule.amount === 10
 * // result.rule.isPercentage === true
 * // result.rule.conditionParams.periodMs === 31536000000
 */
export async function translateRule(
  input: string,
  apiKey?: string
): Promise<TranslationResult> {
  const client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  return parseClaudeResponse(rawText, input);
}

/**
 * Batch translate multiple plain English rules in parallel.
 * Each rule is translated independently so failures are isolated.
 *
 * @param inputs - Array of plain English rule strings
 * @param apiKey - Anthropic API key (falls back to ANTHROPIC_API_KEY env var)
 * @returns Array of TranslationResult, one per input (same order)
 */
export async function translateRules(
  inputs: string[],
  apiKey?: string
): Promise<TranslationResult[]> {
  // Translate in parallel — each call is independent
  return Promise.all(inputs.map((input) => translateRule(input, apiKey)));
}
