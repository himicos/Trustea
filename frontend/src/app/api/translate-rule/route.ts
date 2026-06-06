import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/translate-rule
 *
 * Translates a plain English trust rule into structured parameters.
 * Uses the Trustea rule translator (Claude API or local LLM fallback).
 *
 * Body: { rule: string }
 * Returns: TranslationResult
 */
export async function POST(request: NextRequest) {
  const { rule } = (await request.json()) as { rule?: string };

  if (!rule || typeof rule !== "string" || rule.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or empty 'rule' in request body" },
      { status: 400 },
    );
  }

  // Use local ollama or ANTHROPIC_API_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL || "gemma3:27b";

  try {
    if (apiKey) {
      // Use Claude via the agent's rule translator (spawned as subprocess)
      const { execSync } = await import("child_process");
      const result = execSync(
        `npx tsx -e "import{translateRule}from'./agent/src/rule-translator.js';translateRule('${rule.replace(/'/g, "\\'")}','${apiKey}').then(r=>console.log(JSON.stringify(r)))"`,
        { cwd: process.cwd().replace("/frontend", ""), encoding: "utf-8", timeout: 30000 },
      );
      return NextResponse.json(JSON.parse(result.trim().split("\n").pop()!));
    }

    // Fallback: local ollama
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          {
            role: "user",
            content: `You are a trust fund rule interpreter. Translate this rule to JSON with fields: ruleType, beneficiary, amount, isPercentage, conditionDescription, conditionParams, explanation, confidence, warnings. Respond with JSON only.\n\nRule: "${rule}"`,
          },
        ],
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "LLM unavailable" },
        { status: 503 },
      );
    }

    const data = (await response.json()) as { message: { content: string } };
    const cleaned = data.message.content
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    return NextResponse.json({
      rule: JSON.parse(cleaned),
      explanation: "Translated by local LLM",
      confidence: 0.8,
      warnings: ["Using local model"],
    });
  } catch (error) {
    console.error("[translate-rule] Error:", error);
    return NextResponse.json(
      { error: "Translation failed", details: String(error) },
      { status: 500 },
    );
  }
}
