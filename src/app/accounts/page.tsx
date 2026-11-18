"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { useAccounts } from "@/components/providers/AccountProvider";
import { TradingAccount, AccountType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Layers,
  PlusCircle,
  Target,
  RotateCcw,
  Briefcase,
  Award,
  Edit2,
  Trash2,
  ArrowRight,
  CheckCircle2,
  X,
} from "lucide-react";

const ACCOUNT_COLORS = [
  { id: "emerald", bg: "bg-emerald-500", ring: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  { id: "amber", bg: "bg-amber-500", ring: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { id: "sky", bg: "bg-sky-500", ring: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  { id: "violet", bg: "bg-violet-500", ring: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
  { id: "rose", bg: "bg-rose-500", ring: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
];

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, activeAccountId, setActiveAccountId, refreshAccounts } = useAccounts();

  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("TARGET");
  const [startingBalance, setStartingBalance] = useState("0");
  const [targetAmount, setTargetAmount] = useState("200");
  const [initialLoss, setInitialLoss] = useState("0");
  const [color, setColor] = useState("emerald");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Global modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const openNewForm = (preset?: AccountType) => {
    setEditingAccount(null);
    setErrorMsg(null);
    if (preset === "RECOVERY") {
      setName("Loss Recovery Account");
      setType("RECOVERY");
      setStartingBalance("0");
      setTargetAmount("800");
      setInitialLoss("800");
      setColor("amber");
      setNotes("Dedicated account to gradually recover previous losses separately.");
    } else if (preset === "TARGET") {
      setName("$200 Fresh Profit Target");
      setType("TARGET");
      setStartingBalance("0");
      setTargetAmount("200");
      setInitialLoss("0");
      setColor("emerald");
      setNotes("Fresh profit goal account starting cleanly from $0.");
    } else if (preset === "FUNDED") {
      setName("Prop / Funded Account");
      setType("FUNDED");
      setStartingBalance("10000");
      setTargetAmount("800");
      setInitialLoss("0");
      setColor("violet");
      setNotes("");
    } else {
      setName("");
      setType("TARGET");
      setStartingBalance("0");
      setTargetAmount("200");
      setInitialLoss("0");
      setColor("emerald");
      setNotes("");
    }
    setShowForm(true);
  };

  const openEditForm = (acc: TradingAccount) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setStartingBalance(String(acc.starting_balance ?? 0));
    setTargetAmount(String(acc.target_amount ?? 0));
    setInitialLoss(String(acc.initial_loss ?? 0));
    setColor(acc.color || "sky");
    setNotes(acc.notes || "");
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter an account name.");
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        id: editingAccount?.id,
        name: name.trim(),
        type,
        starting_balance: parseFloat(startingBalance) || 0,
        target_amount: parseFloat(targetAmount) || 0,
        initial_loss: type === "RECOVERY" ? parseFloat(initialLoss || targetAmount) || 0 : 0,
        color,
        notes: notes.trim(),
      };

      const res = await fetch("/api/accounts", {
        method: editingAccount ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || "Failed to save account.");
      } else {
        await refreshAccounts();
        setShowForm(false);
        setEditingAccount(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error saving account.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (acc: TradingAccount) => {
    if (acc.is_default || acc.id === "acc_default") return;
    if (!confirm(`Delete "${acc.name}"? Any positions inside it will be safely moved to Main Account.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/accounts?id=${acc.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (activeAccountId === acc.id) {
          setActiveAccountId("ALL");
        }
        await refreshAccounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeMeta = (t: AccountType) => {
    if (t === "RECOVERY") return { label: "Loss Recovery", icon: RotateCcw, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
    if (t === "TARGET") return { label: "Profit Target", icon: Target, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    if (t === "FUNDED") return { label: "Funded / Prop", icon: Award, cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" };
    return { label: "Personal", icon: Briefcase, cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
  };

  const handleRefresh = useCallback(async () => {
    await refreshAccounts();
  }, [refreshAccounts]);

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={handleRefresh}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" />
                Trading Accounts & Separate Targets
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Keep profit targets and loss recovery completely separate. Assign any manual or auto-synced position to any account.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => openNewForm("RECOVERY")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                + Loss Recovery Account
              </button>

              <button
                onClick={() => openNewForm("TARGET")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                + New Target Account
              </button>
            </div>
          </div>

          {/* Create / Edit Account Form */}
          {showForm && (
            <div className="rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white">
                  {editingAccount ? `Edit "${editingAccount.name}"` : "Create New Trading Account"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets for New Account */}
              {!editingAccount && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400">Quick Templates:</span>
                  <button
                    type="button"
                    onClick={() => openNewForm("TARGET")}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    🎯 Fresh $200 Target
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewForm("RECOVERY")}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20"
                  >
                    🔄 $800 Loss Recovery
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewForm("FUNDED")}
                    className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/20"
                  >
                    🏆 Funded Challenge
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. $200 Profit Target or $800 Loss Recovery"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Account Purpose
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as AccountType)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="TARGET">Profit Target Account</option>
                      <option value="RECOVERY">Loss Recovery Account</option>
                      <option value="PERSONAL">Personal / Main Account</option>
                      <option value="FUNDED">Funded / Prop Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Badge Color
                    </label>
                    <div className="flex items-center gap-2 pt-1.5">
                      {ACCOUNT_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColor(c.id)}
                          className={`w-6 h-6 rounded-full ${c.bg} transition-transform ${
                            color === c.id ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Starting Balance ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={startingBalance}
                      onChange={(e) => setStartingBalance(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Capital allocated to this account (can be 0 for pure P&L tracking)
                    </span>
                  </div>

                  {type === "RECOVERY" ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                        Past Loss To Recover ($)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={initialLoss}
                        onChange={(e) => {
                          setInitialLoss(e.target.value);
                          setTargetAmount(e.target.value);
                        }}
                        placeholder="e.g. 800"
                        className="w-full rounded-xl bg-slate-900 border border-amber-500/40 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Tracks how much of your loss is recovered
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                        Profit Target ($)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={targetAmount}
                        onChange={(e) => setTargetAmount(e.target.value)}
                        placeholder="e.g. 200"
                        className="w-full rounded-xl bg-slate-900 border border-emerald-500/40 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Set 0 if no fixed profit target
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Strategy, rules, or goal notes"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                    {errorMsg}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : editingAccount ? "Save Changes" : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => {
              const meta = getTypeMeta(acc.type);
              const Icon = meta.icon;
              const isActive = activeAccountId === acc.id;
              const netPnl = acc.net_pnl || 0;
              const goalTarget =
                acc.type === "RECOVERY"
                  ? acc.initial_loss || acc.target_amount || 0
                  : acc.target_amount || 0;
              const remaining = Math.max(0, goalTarget - netPnl);
              const pct = acc.progress_pct || 0;

              return (
                <div
                  key={acc.id}
                  className={`rounded-2xl border p-5 bg-[#0f172a] flex flex-col justify-between space-y-4 transition-all ${
                    isActive
                      ? "border-sky-500/60 ring-1 ring-sky-500/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="text-base font-bold text-white">{acc.name}</h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase flex items-center gap-1 ${meta.cls}`}
                        >
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Active View
                          </span>
                        )}
                      </div>
                      {acc.notes && <p className="text-xs text-slate-400">{acc.notes}</p>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditForm(acc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit Account"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!acc.is_default && acc.id !== "acc_default" && (
                        <button
                          onClick={() => handleDelete(acc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">Net P&L</span>
                      <span
                        className={`text-sm font-black font-mono mt-0.5 block ${
                          netPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(netPnl, true)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">Win Rate</span>
                      <span className="text-sm font-bold font-mono text-white mt-0.5 block">
                        {acc.win_rate || 0}%{" "}
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({acc.total_trades || 0})
                        </span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">Fees Paid</span>
                      <span className="text-sm font-bold font-mono text-amber-300 mt-0.5 block">
                        {formatCurrency(acc.total_fees || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Target / Recovery Progress Bar */}
                  {goalTarget > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">
                          {acc.type === "RECOVERY" ? "Recovery Progress" : "Target Progress"}
                        </span>
                        <span className="font-mono font-bold text-white">
                          {formatCurrency(Math.max(0, netPnl))} / {formatCurrency(goalTarget)}{" "}
                          <span className="text-sky-400">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            acc.type === "RECOVERY" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {remaining <= 0
                          ? acc.type === "RECOVERY"
                            ? "Loss 100% recovered!"
                            : "Profit target achieved!"
                          : `${formatCurrency(remaining)} remaining to ${
                              acc.type === "RECOVERY" ? "full recovery" : "hit target"
                            }`}
                      </div>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400 font-mono">
                      Balance: <strong className="text-slate-200">{formatCurrency(acc.current_balance || 0)}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveAccountId(acc.id);
                          router.push("/journal");
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                      >
                        Positions
                      </button>
                      <button
                        onClick={() => {
                          setActiveAccountId(acc.id);
                          router.push("/");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-1 transition-colors"
                      >
                        Open View <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={handleRefresh}
      />

      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={handleRefresh}
      />

      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
