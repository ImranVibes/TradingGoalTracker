"use client";

import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Cashflow, CashflowType } from "@/lib/types";
import { toDateInputValue } from "@/lib/utils";
import { ArrowDownLeft, ShoppingBag, ArrowUpRight } from "lucide-react";

interface CashflowFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: Cashflow) => void;
}

const CATEGORY_SUGGESTIONS = [
  "Trading Tools & Subscriptions",
  "Hardware & Desk Setup",
  "Personal Living & Rent",
  "Lifestyle & Reward",
  "Taxes & Legal",
  "Trading Account Deposit",
  "Savings & Investment",
  "Other",
];

export const CashflowFormModal: React.FC<CashflowFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<CashflowType>("WITHDRAWAL");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Trading Tools & Subscriptions");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("Trading Account");
  const [date, setDate] = useState(toDateInputValue());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    if (!description.trim()) {
      setError("Please describe what this transaction was for (spent on what).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: numAmount,
          category,
          description,
          source,
          date: new Date(date).toISOString(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save cashflow entry");
      }

      onSuccess(data.cashflow);
      onClose();
      // Reset form
      setAmount("");
      setDescription("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Cashflow & Spending"
      subtitle="Track your trading withdrawals, life expenses, and what money was spent on"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Transaction Type Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Transaction Type *
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setType("WITHDRAWAL");
                setCategory("Personal Living & Rent");
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold border transition-all ${
                type === "WITHDRAWAL"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 mb-1 text-amber-400" />
              WITHDRAWAL
            </button>

            <button
              type="button"
              onClick={() => {
                setType("EXPENSE");
                setCategory("Trading Tools & Subscriptions");
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold border transition-all ${
                type === "EXPENSE"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-sm"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ShoppingBag className="w-4 h-4 mb-1 text-rose-400" />
              EXPENSE (Spent)
            </button>

            <button
              type="button"
              onClick={() => {
                setType("DEPOSIT");
                setCategory("Trading Account Deposit");
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold border transition-all ${
                type === "DEPOSIT"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ArrowUpRight className="w-4 h-4 mb-1 text-emerald-400" />
              DEPOSIT
            </button>
          </div>
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Amount ($) *</label>
            <input
              type="number"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500.00"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono font-bold focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
          >
            {CATEGORY_SUGGESTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* SPENT ON WHAT / DESCRIPTION */}
        <div>
          <label className="block text-xs font-semibold text-sky-400 mb-1 uppercase tracking-wider">
            Spent On What / Description *
          </label>
          <textarea
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Withdrew $1,200 from broker to bank for rent and groceries, or bought TradingView annual plan."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-3 text-sm text-slate-200 focus:border-sky-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Account / Source */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Account Source</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Trading Account, Crypto Wallet, Main Bank..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Recording..." : "Save Transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
