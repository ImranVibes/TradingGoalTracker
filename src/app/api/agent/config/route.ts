import { NextRequest, NextResponse } from "next/server";
import {
  getAgentOsConfig,
  saveAgentOsConfig,
  sanitizeAgentConfigForClient,
} from "@/lib/agentConfig";
import { BinanceClient } from "@/lib/exchanges";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateConfigSchema = z.object({
  aiProvider: z.enum(["builtin", "gemini", "openai", "anthropic", "openrouter"]).optional(),
  aiApiKey: z.string().max(400).optional(),
  aiModel: z.string().max(100).optional(),
  agenticApiKey: z.string().max(400).optional(),
  agenticApiSecret: z.string().max(400).optional(),
  agentOsMcpUrl: z.string().max(300).optional(),
  executionEnabled: z.boolean().optional(),
  maxOrderNotionalUsd: z.coerce.number().min(10).max(100000).optional(),
  maxLeverage: z.coerce.number().min(1).max(50).optional(),
  requireChecklistScore: z.coerce.number().min(50).max(100).optional(),
  dailyLossLimitUsd: z.coerce.number().min(0).max(1000000).optional(),
  action: z.enum(["save", "test_agentic"]).optional().default("save"),
});

export async function GET() {
  try {
    const cfg = await getAgentOsConfig();
    return NextResponse.json({
      success: true,
      config: sanitizeAgentConfigForClient(cfg),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = UpdateConfigSchema.parse(body);

    if (validated.action === "test_agentic") {
      const current = await getAgentOsConfig();
      const key =
        validated.agenticApiKey && validated.agenticApiKey !== "__KEEP__"
          ? validated.agenticApiKey
          : current.agenticApiKey;
      const secret =
        validated.agenticApiSecret && validated.agenticApiSecret !== "__KEEP__"
          ? validated.agenticApiSecret
          : current.agenticApiSecret;

      if (!key || !secret) {
        return NextResponse.json(
          { success: false, error: "Enter your Binance Agentic Sub-Account API Key & Secret first." },
          { status: 400 }
        );
      }

      const client = new BinanceClient(key, secret);
      const test = await client.testConnection();
      return NextResponse.json({
        success: test.success,
        message: test.message,
        balance: test.balance,
      });
    }

    const { action: _action, ...updates } = validated;
    const saved = await saveAgentOsConfig(updates);
    return NextResponse.json({
      success: true,
      config: sanitizeAgentConfigForClient(saved),
      message: "Agent OS, AI Copilot & Risk Guard settings saved.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
