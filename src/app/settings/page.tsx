"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { ExchangeConnection, UserSettings } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Settings as SettingsIcon,
  Landmark,
  ShieldCheck,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
  KeyRound,
  Sliders,
  Save,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    initial_balance: 10000,
    currency: "USD",
    max_drawdown_limit_pct: 10,
    risk_per_trade_pct: 1.0,
  });
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Connection Form state
  const [exchange, setExchange] = useState<"binance" | "bybit">("binance");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [category, setCategory] = useState("futures");
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmittingConn, setIsSubmittingConn] = useState(false);
  const [connMsg, setConnMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Global modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsRes, connRes] = await Promise.all([
        fetch("/api/settings").then((r) => r.json()),
        fetch("/api/exchanges").then((r) => r.json()),
      ]);

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
      }
      if (connRes.success && connRes.connections) {
        setConnections(connRes.connections);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMsg({ type: "success", text: "Settings saved successfully." });
      } else {
        setSettingsMsg({ type: "error", text: data.error || "Failed to save settings." });
      }
    } catch (err: any) {
      setSettingsMsg({ type: "error", text: err.message || "Failed to save settings." });
    } finally {
      setIsSavingSettings(false);
      setTimeout(() => setSettingsMsg(null), 4000);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey || !apiSecret) {
      setConnMsg({ type: "error", text: "Please enter both API Key and API Secret first." });
      return;
    }
    setIsTesting(true);
    setConnMsg(null);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          exchange,
          api_key: apiKey,
          api_secret: apiSecret,
          category,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnMsg({
          type: "success",
          text: `Success! Connection verified. ${data.balance !== undefined ? `Balance: $${data.balance}` : ""}`,
        });
      } else {
        setConnMsg({ type: "error", text: data.error || "API authentication failed." });
      }
    } catch (err: any) {
      setConnMsg({ type: "error", text: err.message || "Connection check failed." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) {
      setConnMsg({ type: "error", text: "API Key and Secret are required." });
      return;
    }
    setIsSubmittingConn(true);
    setConnMsg(null);
    try {
      const res = await fetch("/api/exchanges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange,
          name: label.trim() || `${exchange.toUpperCase()} Main`,
          label: label.trim() || `${exchange.toUpperCase()} Main`,
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
          account_type: category.toUpperCase() === "SPOT" ? "SPOT" : "FUTURES",
          category,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnMsg({ type: "success", text: "Exchange connection added!" });
        setApiKey("");
        setApiSecret("");
        setLabel("");
        await fetchAll();
      } else {
        setConnMsg({ type: "error", text: data.error || "Failed to save connection." });
      }
    } catch (err: any) {
      setConnMsg({ type: "error", text: err.message || "Failed to add connection." });
    } finally {
      setIsSubmittingConn(false);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Remove this exchange connection? Synced trades will remain in your journal.")) return;
    try {
      await fetch(`/api/exchanges?id=${id}`, { method: "DELETE" });
      await fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncConnection = async (connId?: string) => {
    setSyncingId(connId || "all");
    setSyncStatus(null);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          connection_id: connId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus(`Sync finished! Imported ${data.imported_trades || 0} trades.`);
        await fetchAll();
      } else {
        setSyncStatus(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setSyncStatus(`Sync error: ${err.message}`);
    } finally {
      setSyncingId(null);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleExport = (format: "csv" | "json") => {
    window.open(`/api/export?format=${format}`, "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={fetchAll}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-sky-400" />
              Settings & Exchange Integrations
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure exchange API auto-sync, starting capital, risk parameters, and data backups.
            </p>
          </div>

          {/* SECTION 1: EXCHANGE CONNECTIONS */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-amber-400" />
                  Exchange Connections (Binance & Bybit)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically sync closed trades, realized PnL, cashflows, and live account equity.
                </p>
              </div>

              {connections.length > 0 && (
                <button
                  onClick={() => handleSyncConnection()}
                  disabled={syncingId !== null}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-all flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === "all" ? "animate-spin" : ""}`} />
                  Sync All Exchanges Now
                </button>
              )}
            </div>

            {/* Sync Feedback Alert */}
            {syncStatus && (
              <div className="p-3 rounded-xl bg-slate-900 border border-sky-500/30 text-xs text-sky-300 flex items-center justify-between">
                <span>{syncStatus}</span>
                <button onClick={() => setSyncStatus(null)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>
            )}

            {/* Active Connected Exchanges List */}
            {connections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-4 rounded-xl border border-slate-800 bg-[#0f172a] flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg ${
                            conn.exchange === "binance"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-orange-500/15 text-orange-300"
                          }`}
                        >
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            {conn.label || conn.exchange.toUpperCase()}
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                              {conn.category}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            Key: {conn.api_key_masked}
                          </div>
                        </div>
                      </div>

                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                      <span>
                        Last synced:{" "}
                        {conn.last_synced_at
                          ? new Date(conn.last_synced_at).toLocaleString()
                          : "Never"}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSyncConnection(conn.id)}
                          disabled={syncingId === conn.id}
                          className="px-2 py-1 rounded-lg text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-slate-800 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${syncingId === conn.id ? "animate-spin" : ""}`}
                          />
                          Sync
                        </button>
                        <button
                          onClick={() => handleDeleteConnection(conn.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Remove connection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 text-xs text-slate-400 text-center">
                No exchange API keys connected yet. Add your read-only Binance or Bybit keys below to start auto-syncing.
              </div>
            )}

            {/* Add New Connection Form */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-sky-400" />
                  Connect New Exchange API Key
                </h3>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" /> Read-Only Safe
                </span>
              </div>

              {/* Security Hint */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px] text-slate-400">
                  <strong className="text-slate-200">Security Recommendation:</strong> In your Binance or Bybit API settings, enable <strong>Read-Only</strong> permissions only. Do <strong>NOT</strong> enable withdrawals or trading execution permissions.
                </div>
              </div>

              <form onSubmit={handleAddConnection} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Exchange Platform
                    </label>
                    <select
                      value={exchange}
                      onChange={(e) => setExchange(e.target.value as "binance" | "bybit")}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                    >
                      <option value="binance">Binance (Futures & Spot)</option>
                      <option value="bybit">Bybit (v5 Unified / Linear)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Trading Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="futures">USDT-M Futures (Linear)</option>
                      <option value="spot">Spot Trading</option>
                      <option value="unified">Unified Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Custom Label (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Binance Main Account"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      API Key
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Paste your read-only API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      API Secret
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Paste your API Secret"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {connMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      connMsg.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {connMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{connMsg.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !apiKey || !apiSecret}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-sky-400" : ""}`} />
                    {isTesting ? "Testing..." : "Test Connection"}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingConn}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSubmittingConn ? "Saving..." : "Save Connection"}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* SECTION 2: ACCOUNT CAPITAL & RISK SETTINGS */}
          <section className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                Account Capital & Risk Parameters
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Controls the living account balance baseline, drawdown telemetry, and lot size calculations.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Starting Initial Capital ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settings.initial_balance}
                      onChange={(e) =>
                        setSettings({ ...settings, initial_balance: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Account balance before logged trades
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Account Currency
                    </label>
                    <select
                      value={settings.currency || "USD"}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="USDT">USDT</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Max Drawdown Limit (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={settings.max_drawdown_limit_pct ?? 10}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          max_drawdown_limit_pct: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Prop firm challenge limit (e.g. 5% or 10%)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Default Risk Per Trade (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.risk_per_trade_pct ?? 1.0}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          risk_per_trade_pct: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Recommended risk per setup
                    </span>
                  </div>
                </div>

                {settingsMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      settingsMsg.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{settingsMsg.text}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingSettings ? "Saving..." : "Update Settings"}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* SECTION 3: 1-CLICK DATA BACKUP & CSV EXPORT */}
          <section className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                Data Backup & CSV / Excel Export
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Download your trade journal for tax calculations, Excel spreadsheets, or full JSON database backups.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-slate-800 bg-[#0f172a] flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    Export Trades to CSV / Excel
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Download a clean CSV spreadsheet with all symbols, dates, realized P&L, signal attribution, prices, and autopsy notes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download trades.csv
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-[#0f172a] flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-sky-400" />
                    Full System JSON Backup
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Complete backup dump including trades, cashflow ledger, active goals, and exchange configuration.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExport("json")}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download backup.json
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => fetchAll()}
      />

      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => fetchAll()}
      />

      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => fetchAll()}
      />
    </div>
  );
}
