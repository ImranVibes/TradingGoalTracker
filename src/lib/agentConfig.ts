import { getSettingValue, setSettingValue } from "./db";

export type AiProviderType = "builtin" | "gemini" | "openai" | "anthropic" | "openrouter";

export interface AgentOsConfig {
  // AI Copilot / Weekly Review Provider
  aiProvider: AiProviderType;
  aiApiKey: string;
  aiModel: string;
  // Isolated Binance Agentic Sub-Account & Safety Guardrails
  agenticApiKey: string;
  agenticApiSecret: string;
  agentOsMcpUrl: string;
  executionEnabled: boolean;
  maxOrderNotionalUsd: number;
  maxLeverage: number;
  requireChecklistScore: number;
  dailyLossLimitUsd: number;
}

export const DEFAULT_AGENT_CONFIG: AgentOsConfig = {
  aiProvider: "builtin",
  aiApiKey: "",
  aiModel: "gemini-2.5-flash",
  agenticApiKey: "",
  agenticApiSecret: "",
  agentOsMcpUrl: "https://agent.binance.com/mcp/agentic",
  executionEnabled: false,
  maxOrderNotionalUsd: 200,
  maxLeverage: 10,
  requireChecklistScore: 80,
  dailyLossLimitUsd: 100,
};

export function maskSecret(val: string): string {
  if (!val || val.length < 6) return val ? "••••" : "";
  return `${val.slice(0, 4)}••••${val.slice(-4)}`;
}

export async function getAgentOsConfig(): Promise<AgentOsConfig> {
  const stored = await getSettingValue<Partial<AgentOsConfig>>("agent_os_config");
  const merged: AgentOsConfig = {
    ...DEFAULT_AGENT_CONFIG,
    ...(stored || {}),
  };

  // Fallback to environment variables if user hasn't saved a key in Settings UI
  if (!merged.aiApiKey) {
    if (process.env.GEMINI_API_KEY) {
      merged.aiApiKey = process.env.GEMINI_API_KEY;
      if (merged.aiProvider === "builtin") merged.aiProvider = "gemini";
    } else if (process.env.OPENAI_API_KEY) {
      merged.aiApiKey = process.env.OPENAI_API_KEY;
      if (merged.aiProvider === "builtin") merged.aiProvider = "openai";
    } else if (process.env.ANTHROPIC_API_KEY) {
      merged.aiApiKey = process.env.ANTHROPIC_API_KEY;
      if (merged.aiProvider === "builtin") merged.aiProvider = "anthropic";
    } else if (process.env.OPENROUTER_API_KEY) {
      merged.aiApiKey = process.env.OPENROUTER_API_KEY;
      if (merged.aiProvider === "builtin") merged.aiProvider = "openrouter";
    }
  }

  return merged;
}

export async function saveAgentOsConfig(updates: Partial<AgentOsConfig>): Promise<AgentOsConfig> {
  const current = (await getSettingValue<Partial<AgentOsConfig>>("agent_os_config")) || {};
  const next: AgentOsConfig = {
    ...DEFAULT_AGENT_CONFIG,
    ...current,
    ...updates,
    // Keep existing secrets if client sends empty string (masked placeholder)
    aiApiKey:
      updates.aiApiKey !== undefined && updates.aiApiKey !== "__KEEP__"
        ? updates.aiApiKey.trim()
        : current.aiApiKey || "",
    agenticApiKey:
      updates.agenticApiKey !== undefined && updates.agenticApiKey !== "__KEEP__"
        ? updates.agenticApiKey.trim()
        : current.agenticApiKey || "",
    agenticApiSecret:
      updates.agenticApiSecret !== undefined && updates.agenticApiSecret !== "__KEEP__"
        ? updates.agenticApiSecret.trim()
        : current.agenticApiSecret || "",
  };
  await setSettingValue("agent_os_config", next);
  return getAgentOsConfig();
}

export function sanitizeAgentConfigForClient(cfg: AgentOsConfig) {
  return {
    aiProvider: cfg.aiProvider,
    aiModel: cfg.aiModel,
    hasAiKey: Boolean(cfg.aiApiKey),
    aiApiKeyMasked: maskSecret(cfg.aiApiKey),
    hasAgenticKeys: Boolean(cfg.agenticApiKey && cfg.agenticApiSecret),
    agenticApiKeyMasked: maskSecret(cfg.agenticApiKey),
    agentOsMcpUrl: cfg.agentOsMcpUrl,
    executionEnabled: cfg.executionEnabled,
    maxOrderNotionalUsd: cfg.maxOrderNotionalUsd,
    maxLeverage: cfg.maxLeverage,
    requireChecklistScore: cfg.requireChecklistScore,
    dailyLossLimitUsd: cfg.dailyLossLimitUsd,
  };
}

/**
 * Call configured external LLM (Gemini / OpenAI / Anthropic / OpenRouter).
 * Returns null if no external API key is configured or if provider is "builtin"
 * so callers seamlessly fall back to the built-in Quantitative Engine.
 */
export async function callConfiguredLlm(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ text: string; providerLabel: string } | null> {
  const cfg = await getAgentOsConfig();
  if (!cfg.aiApiKey || cfg.aiProvider === "builtin") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    if (cfg.aiProvider === "gemini") {
      const model = cfg.aiModel || "gemini-2.5-flash";
      const contents = [
        ...history.slice(-8).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: userPrompt }] },
      ];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(cfg.aiApiKey)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.35, maxOutputTokens: 1600 },
          }),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, providerLabel: `Gemini (${model})` };
      return null;
    }

    if (cfg.aiProvider === "openai" || cfg.aiProvider === "openrouter") {
      const url =
        cfg.aiProvider === "openrouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
      const model =
        cfg.aiModel ||
        (cfg.aiProvider === "openrouter" ? "google/gemini-2.0-flash-001" : "gpt-4o-mini");

      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-8),
        { role: "user", content: userPrompt },
      ];

      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.aiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.35,
          max_tokens: 1600,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) {
        return {
          text,
          providerLabel: `${cfg.aiProvider === "openrouter" ? "OpenRouter" : "OpenAI"} (${model})`,
        };
      }
      return null;
    }

    if (cfg.aiProvider === "anthropic") {
      const model = cfg.aiModel || "claude-3-5-sonnet-latest";
      const messages = [
        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userPrompt },
      ];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1600,
          system: systemPrompt,
          messages,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.content?.[0]?.text;
      if (text) return { text, providerLabel: `Anthropic (${model})` };
      return null;
    }

    return null;
  } catch (err) {
    console.error("[AgentConfig] LLM call failed, falling back to quant engine:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
