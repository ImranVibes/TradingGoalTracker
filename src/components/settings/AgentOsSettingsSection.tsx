"use client";

import React, { useState, useEffect } from "react";
import { Bot, ShieldCheck, CheckCircle2, AlertTriangle, Save, Zap, RefreshCw } from "lucide-react";

export const AgentOsSettingsSection: React.FC = () => {
  const [aiProvider, setAiProvider] = useState("builtin");
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiKeyMasked, setAiKeyMasked] = useState("");
  const [hasAiKey, setHasAiKey] = useState(false);

  const [agenticApiKey, setAgenticApiKey] = useState("");
  const [agenticApiSecret, setAgenticApiSecret] = useState("");
  const [agenticKeyMasked, setAgenticKeyMasked] = useState("");
  const [hasAgenticKeys, setHasAgenticKeys] = useState(false);
  const [agentOsMcpUrl, setAgentOsMcpUrl] = useState("https://agent.binance.com/mcp/agentic");
  const [executionEnabled, setExecutionEnabled] = useState(false);
  const [maxOrderNotionalUsd, setMaxOrderNotionalUsd] = useState("200");
  const [maxLeverage, setMaxLeverage] = useState("10");
  const [requireChecklistScore, setRequireChecklistScore] = useState("80");
  const [dailyLossLimitUsd, setDailyLossLimitUsd] = useState("100");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/agent/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.config) {
          const c = data.config;
          setAiProvider(c.aiProvider || "builtin");
          setAiModel(c.aiModel || "gemini-2.5-flash");
          setHasAiKey(Boolean(c.hasAiKey));
          setAiKeyMasked(c.aiApiKeyMasked || "");
          setHasAgenticKeys(Boolean(c.hasAgenticKeys));
          setAgenticKeyMasked(c.agenticApiKeyMasked || "");
          setAgentOsMcpUrl(c.agentOsMcpUrl || "https://agent.binance.com/mcp/agentic");
          setExecutionEnabled(Boolean(c.executionEnabled));
          setMaxOrderNotionalUsd(String(c.maxOrderNotionalUsd ?? 200));
          setMaxLeverage(String(c.maxLeverage ?? 10));
          setRequireChecklistScore(String(c.requireChecklistScore ?? 80));
          setDailyLossLimitUsd(String(c.dailyLossLimitUsd ?? 100));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          aiProvider,
          aiModel: aiModel.trim(),
          aiApiKey: aiApiKey.trim() ? aiApiKey.trim() : "__KEEP__",
          agenticApiKey: agenticApiKey.trim() ? agenticApiKey.trim() : "__KEEP__",
          agenticApiSecret: agenticApiSecret.trim() ? agenticApiSecret.trim() : "__KEEP__",
          agentOsMcpUrl: agentOsMcpUrl.trim(),
          executionEnabled,
          maxOrderNotionalUsd: parseFloat(maxOrderNotionalUsd) || 200,
          maxLeverage: parseInt(maxLeverage, 10) || 10,
          requireChecklistScore: parseInt(requireChecklistScore, 10) || 80,
          dailyLossLimitUsd: parseFloat(dailyLossLimitUsd) || 100,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save settings");
      if (data.config) {
        setHasAiKey(Boolean(data.config.hasAiKey));
        setAiKeyMasked(data.config.aiApiKeyMasked || "");
        setHasAgenticKeys(Boolean(data.config.hasAgenticKeys));
        setAgenticKeyMasked(data.config.agenticApiKeyMasked || "");
      }
      setAiApiKey("");
      setAgenticApiKey("");
      setAgenticApiSecret("");
      setMsg({ type: "success", text: data.message || "Agent OS & Risk Guard settings saved." });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestAgentic = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_agentic",
          agenticApiKey: agenticApiKey.trim() || "__KEEP__",
          agenticApiSecret: agenticApiSecret.trim() || "__KEEP__",
        }),
      });
      const data = await res.json();
      setMsg({
        type: data.success ? "success" : "error",
        text: data.message || data.error || "Test completed.",
      });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Connection test failed." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" />
          Binance Agent OS, AI Copilot &amp; Daily Risk Guard
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Connect an optional LLM API key (Gemini / OpenAI / Anthropic / OpenRouter) for conversational AI Coaching, configure your isolated Binance Agentic Sub-Account (zero withdrawal scope), and set your Daily Loss Limit.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-5"
      >
        {/* Part 1: AI Trading Coach Provider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300">
              1. AI Trading Copilot &amp; Weekly Review Brain
            </h3>
            {hasAiKey && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                API Key Saved ({aiKeyMasked})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                AI Engine Provider
              </label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiProvider(val);
                  if (val === "gemini") setAiModel("gemini-2.5-flash");
                  else if (val === "openai") setAiModel("gpt-4o-mini");
                  else if (val === "anthropic") setAiModel("claude-3-5-sonnet-latest");
                  else if (val === "openrouter") setAiModel("google/gemini-2.0-flash-001");
                }}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="builtin">Built-in Quant Intelligence (No Key Needed)</option>
                <option value="gemini">Google Gemini API</option>
                <option value="openai">OpenAI API</option>
                <option value="anthropic">Anthropic Claude API</option>
                <option value="openrouter">OpenRouter API</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                disabled={aiProvider === "builtin"}
                placeholder="gemini-2.5-flash"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white disabled:opacity-50 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                LLM API Key {hasAiKey ? "(Leave blank to keep saved)" : ""}
              </label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                disabled={aiProvider === "builtin"}
                placeholder={hasAiKey ? "•••••••• (saved)" : "Paste Gemini / OpenAI key..."}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white disabled:opacity-50 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Part 2: Isolated Binance Agentic Sub-Account & Risk Guardrails */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                2. Isolated Binance Agentic Sub-Account &amp; Safety Guardrails
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Use a dedicated isolated sub-account with capped funds and <strong>Withdrawals DISABLED</strong>. Orders require passing your Checklist + typing <code className="text-amber-300">CONFIRM</code>.
              </p>
            </div>
            {hasAgenticKeys && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Sub-Account Key Saved ({agenticKeyMasked})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Agentic Sub-Account API Key
              </label>
              <input
                type="password"
                value={agenticApiKey}
                onChange={(e) => setAgenticApiKey(e.target.value)}
                placeholder={hasAgenticKeys ? "•••••••• (saved)" : "Binance Sub-Account API Key"}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Agentic Sub-Account API Secret
              </label>
              <input
                type="password"
                value={agenticApiSecret}
                onChange={(e) => setAgenticApiSecret(e.target.value)}
                placeholder={hasAgenticKeys ? "•••••••• (saved)" : "Binance Sub-Account Secret"}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Binance Agent OS MCP Endpoint
              </label>
              <input
                type="text"
                value={agentOsMcpUrl}
                onChange={(e) => setAgentOsMcpUrl(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-slate-300 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-rose-300 mb-1">
                Daily Loss Limit ($)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={dailyLossLimitUsd}
                onChange={(e) => setDailyLossLimitUsd(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-rose-500/40 px-3 py-2 text-xs font-mono font-bold text-white focus:border-rose-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Max Order Notional ($)
              </label>
              <input
                type="number"
                min={10}
                step="any"
                value={maxOrderNotionalUsd}
                onChange={(e) => setMaxOrderNotionalUsd(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono font-bold text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Max Leverage Cap (x)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono font-bold text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Min Checklist Score (%)
              </label>
              <input
                type="number"
                min={50}
                max={100}
                value={requireChecklistScore}
                onChange={(e) => setRequireChecklistScore(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono font-bold text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer text-xs text-slate-200">
            <input
              type="checkbox"
              checked={executionEnabled}
              onChange={(e) => setExecutionEnabled(e.target.checked)}
              className="rounded border-slate-600"
            />
            <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Enable Checklist-Gated Assisted Order Execution</strong> (Still requires ≥{" "}
              {requireChecklistScore}% checklist score + daily loss guard + typing{" "}
              <code className="text-amber-300">CONFIRM</code> before every live order)
            </span>
          </label>
        </div>

        {msg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              msg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {msg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleTestAgentic}
            disabled={testing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin text-amber-400" : ""}`} />
            {testing ? "Testing Sub-Account..." : "Test Agentic Sub-Account"}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Agent OS & Risk Settings"}
          </button>
        </div>
      </form>
    </section>
  );
};
