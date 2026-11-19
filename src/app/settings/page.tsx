"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { SelectiveImportModal } from "@/components/exchanges/SelectiveImportModal";
import { AgentOsSettingsSection } from "@/components/settings/AgentOsSettingsSection";
import { SidebarCustomizeModal } from "@/components/layout/SidebarCustomizeModal";
import { useSidebarNavItems } from "@/lib/sidebarConfig";
import { useAccounts } from "@/components/providers/AccountProvider";
import { ExchangeConnection, UserSettings } from "@/lib/types";
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
  Sparkles,
  Layers,
  Calendar,
  RotateCcw,
  CheckSquare,
  Lock,
} from "lucide-react";

export default function SettingsPage() {
  const { accounts, refreshAccounts } = useAccounts();
  const {
    isCustomized: isSidebarCustomized,
    openModal: openSidebarModal,
    isModalOpen: isSidebarModalOpen,
    closeModal: closeSidebarModal,
    items: sidebarNavItems,
  } = useSidebarNavItems();

  const [settings, setSettings] = useState<UserSettings>({
    initial_balance: 10000,
    currency: "USD",
    max_drawdown_limit_pct: 10,
    risk_per_trade_pct: 1.0,
  });
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Connection Form state
  const [exchange, setExchange] = useState<"binance" | "bybit">("binance");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [category, setCategory] = useState("futures");
  const [targetAccountId, setTargetAccountId] = useState("acc_default");
  const [autoSync, setAutoSync] = useState(true);
  const [syncFromDate, setSyncFromDate] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmittingConn, setIsSubmittingConn] = useState(false);
  const [connMsg, setConnMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync & utility state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isCleaningLegacy, setIsCleaningLegacy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Global modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isSelectiveImportOpen, setIsSelectiveImportOpen] = useState(false);
  const [selectiveConnId, setSelectiveConnId] = useState<string | undefined>(undefined);

  // Change PIN / Password state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        setIgnoredCount(connRes.ignored_count || 0);
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
          text: `Success! Connection verified. ${data.balance !== undefined ? `Balance: $${data.balance.toFixed(2)}` : ""}`,
        });
      } else {
        setConnMsg({ type: "error", text: data.error || data.message || "API authentication failed." });
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
          account_id: targetAccountId || "acc_default",
          auto_sync: autoSync,
          sync_from_date: syncFromDate ? new Date(syncFromDate).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnMsg({ type: "success", text: "Exchange connection added! Click Sync Now to import closed positions." });
        setApiKey("");
        setApiSecret("");
        setLabel("");
        setSyncFromDate("");
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

  const handleUpdateConnection = async (
    id: string,
    updates: { account_id?: string; auto_sync?: boolean; sync_from_date?: string | null }
  ) => {
    try {
      await fetch("/api/exchanges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      await fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Remove this exchange connection? Synced positions will remain in your journal.")) return;
    try {
      await fetch(`/api/exchanges?id=${id}`, { method: "DELETE" });
      await fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncConnection = async (connId?: string, forceFull = false) => {
    setSyncingId(connId || "all");
    setSyncStatus(null);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          connection_id: connId,
          forceFull,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus(data.message || `Synced ${data.imported_trades || 0} new closed position(s).`);
        await Promise.all([fetchAll(), refreshAccounts()]);
      } else {
        setSyncStatus(`Sync failed: ${data.error || data.message || "Unknown error"}`);
      }
    } catch (err: any) {
      setSyncStatus(`Sync error: ${err.message}`);
    } finally {
      setSyncingId(null);
      setTimeout(() => setSyncStatus(null), 6000);
    }
  };

  const handleCleanupLegacyFills = async () => {
    if (
      !confirm(
        "Remove any old split partial-fill imports and re-import them cleanly as consolidated Closed Positions with Trading & Funding Fees?"
      )
    ) {
      return;
    }
    setIsCleaningLegacy(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup_legacy_fills" }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus(data.message);
        await Promise.all([fetchAll(), refreshAccounts()]);
      } else {
        setSyncStatus(data.error || "Cleanup failed.");
      }
    } catch (err: any) {
      setSyncStatus(err.message);
    } finally {
      setIsCleaningLegacy(false);
    }
  };

  const handleClearIgnored = async () => {
    if (
      !confirm(
        `Reset ${ignoredCount} ignored deleted position(s)? Next full sync will be allowed to import them again.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_ignored" }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus(data.message);
        await fetchAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = (format: "csv" | "json") => {
    window.open(`/api/export?format=${format}`, "_blank");
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (!currentPin || !newPin) {
      setPinMsg({ type: "error", text: "Enter both your current PIN and new PIN." });
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg({ type: "error", text: "New PIN and confirmation do not match." });
      return;
    }
    setIsUpdatingPin(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPin, new_password: newPin }),
      });
      const data = await res.json();
      if (data.success) {
        setPinMsg({ type: "success", text: data.message || "Access PIN updated." });
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      } else {
        setPinMsg({ type: "error", text: data.error || "Failed to update PIN." });
      }
    } catch (err: any) {
      setPinMsg({ type: "error", text: err.message || "Failed to update PIN." });
    } finally {
      setIsUpdatingPin(false);
    }
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
              Settings & Exchange Position Sync
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Auto-sync consolidated closed positions (with trading & funding fees), choose target accounts, and manage deleted position exclusions.
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
                  Consolidates partial fills into single Closed Positions with exact Trading Fees, Funding Fees, and Entry/Exit prices.
                </p>
              </div>

              {connections.length > 0 && (
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={handleCleanupLegacyFills}
                    disabled={isCleaningLegacy}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    title="Replace any old split partial fills with clean consolidated positions"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isCleaningLegacy ? "Upgrading..." : "Replace Old Partial Fills"}
                  </button>

                  <button
                    onClick={() => handleSyncConnection(undefined, false)}
                    disabled={syncingId !== null}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingId === "all" ? "animate-spin" : ""}`} />
                    Sync Latest Positions
                  </button>
                </div>
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
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-4 rounded-xl border border-slate-800 bg-[#0f172a] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
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
                            {conn.label || conn.name || conn.exchange.toUpperCase()}
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                              {conn.account_type}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            Key: {conn.api_key_masked || conn.api_key}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSyncConnection(conn.id, false)}
                          disabled={syncingId === conn.id}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingId === conn.id ? "animate-spin" : ""}`} />
                          Sync Latest
                        </button>
                        <button
                          onClick={() => {
                            setSelectiveConnId(conn.id);
                            setIsSelectiveImportOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors flex items-center gap-1"
                          title="Open pop-up checklist to pick specific positions (including deleted ones) to import"
                        >
                          <CheckSquare className="w-3 h-3" />
                          Force Sync (Select)
                        </button>
                        <button
                          onClick={() => handleDeleteConnection(conn.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Remove connection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Per-Connection Sync Controls: Target Account, Sync From Date, Auto-Sync Toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                          <Layers className="w-3 h-3 text-sky-400" /> Default Target Account
                        </label>
                        <select
                          value={conn.account_id || "acc_default"}
                          onChange={(e) =>
                            handleUpdateConnection(conn.id, { account_id: e.target.value })
                          }
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                        >
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                          <Calendar className="w-3 h-3 text-amber-400" /> Only Import After Date
                        </label>
                        <input
                          type="date"
                          value={conn.sync_from_date ? conn.sync_from_date.split("T")[0] : ""}
                          onChange={(e) =>
                            handleUpdateConnection(conn.id, {
                              sync_from_date: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 mb-1">
                          Auto-Sync When Viewing
                        </span>
                        <label className="inline-flex items-center gap-2 cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={conn.auto_sync !== false}
                            onChange={(e) =>
                              handleUpdateConnection(conn.id, { auto_sync: e.target.checked })
                            }
                            className="rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-0"
                          />
                          <span className="text-xs text-slate-200">
                            {conn.auto_sync !== false ? "Enabled (auto-fetches new positions)" : "Manual only"}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1">
                      <span>
                        Last synced:{" "}
                        {conn.last_synced_at
                          ? new Date(conn.last_synced_at).toLocaleString()
                          : "Never"}
                      </span>
                      {conn.last_synced_trade_time && (
                        <span>
                          Latest position: {new Date(conn.last_synced_trade_time).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Ignored Deleted Positions Indicator */}
                {ignoredCount > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400">
                      <strong className="text-slate-200">{ignoredCount}</strong> deleted position(s) are permanently excluded and will never be re-imported on future syncs.
                    </span>
                    <button
                      onClick={handleClearIgnored}
                      className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 self-start sm:self-auto"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Exclusion List
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 text-xs text-slate-400 text-center">
                No exchange API keys connected yet. Add your read-only Binance or Bybit keys below to start auto-syncing consolidated positions.
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

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px] text-slate-400">
                  <strong className="text-slate-200">Security Recommendation:</strong> Enable <strong>Read-Only</strong> permissions only. Do <strong>NOT</strong> enable withdrawals or trading execution permissions.
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Import Into Account
                    </label>
                    <select
                      value={targetAccountId}
                      onChange={(e) => setTargetAccountId(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                      {accounts.length === 0 && <option value="acc_default">Main Account</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Only Sync After Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={syncFromDate}
                      onChange={(e) => setSyncFromDate(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-900 text-sky-500"
                      />
                      Auto-sync latest positions on page load
                    </label>
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
                Global Capital & Risk Parameters
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Baseline starting capital for the Combined "All Accounts" view and default risk calculator parameters.
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
                      value={settings.max_drawdown_limit_pct ?? settings.max_drawdown_limit ?? 10}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          max_drawdown_limit_pct: parseFloat(e.target.value) || 0,
                          max_drawdown_limit: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Default Risk Per Trade (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.risk_per_trade_pct ?? settings.risk_percentage ?? 1.0}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          risk_per_trade_pct: parseFloat(e.target.value) || 0,
                          risk_percentage: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
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
                Includes Gross P&L, Trading Fees, Funding Fees, Net P&L, and Account assignment.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-slate-800 bg-[#0f172a] flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    Export Positions to CSV / Excel
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Clean spreadsheet with account names, Gross P&L, Trading Fees, Funding Fees, Net P&L, prices, and notes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download positions.csv
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-[#0f172a] flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-sky-400" />
                    Full System JSON Backup
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Complete backup dump including accounts, positions, cashflow ledger, goals, and settings.
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

          {/* SECTION 3.5: BINANCE AGENT OS, AI COPILOT & DAILY RISK GUARD */}
          <AgentOsSettingsSection />

          {/* SECTION 3.8: NAVIGATION & SIDEBAR CUSTOMIZATION */}
          <section className="space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  Navigation & Sidebar Customization
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reorder menu items to match your trading workflow (e.g. place Positions Journal right after Dashboard).
                </p>
              </div>
              <button
                type="button"
                onClick={openSidebarModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Sliders className="w-3.5 h-3.5" />
                Customize Menu
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-white">Current Sidebar Layout</span>
                    {isSidebarCustomized ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-medium">
                        Customized
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium">
                        Default Order
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Drag and drop or use arrow buttons to place your most critical trading tools at the top. Synced securely to your database and local storage.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openSidebarModal}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors flex items-center gap-1.5"
                >
                  <span>Reorder & Show/Hide Items ({sidebarNavItems.length})</span>
                </button>
              </div>

              {/* Quick sequence preview */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">Current order:</span>
                {sidebarNavItems.map((item, idx) => (
                  <span
                    key={item.id}
                    className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono ${
                      item.id === "journal"
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="text-slate-500">{idx + 1}.</span> {item.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 4: SECURITY & ACCESS PIN */}
          <section className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400" />
                Vault Security & Access PIN
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Protected by 5-attempt brute-force lockout (15-minute cooldown) and signed HTTP-only session cookies.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
              <form onSubmit={handleChangePin} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Current PIN / Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      placeholder="Enter current PIN"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      New PIN / Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Min 4 characters"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Confirm New PIN
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Re-enter new PIN"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {pinMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      pinMsg.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {pinMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{pinMsg.text}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isUpdatingPin}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {isUpdatingPin ? "Updating..." : "Update Access PIN"}
                  </button>
                </div>
              </form>
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

      <SelectiveImportModal
        isOpen={isSelectiveImportOpen}
        onClose={() => setIsSelectiveImportOpen(false)}
        connectionId={selectiveConnId}
        onImported={(msg) => {
          setSyncStatus(msg);
          fetchAll();
          refreshAccounts();
          setTimeout(() => setSyncStatus(null), 5000);
        }}
      />

      <SidebarCustomizeModal
        isOpen={isSidebarModalOpen}
        onClose={closeSidebarModal}
      />
    </div>
  );
}
