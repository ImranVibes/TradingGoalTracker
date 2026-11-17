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

const CATEGORIES = [
  "Personal Living & Rent",
  "Trading Tools & Data",
  "Hardware & Desk Setup",
  "Dining & Lifestyle",
  "Taxes & Savings",
  "Account Refill",
  "Other",
];

export const CashflowFormModal: React.FC<CashflowFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<CashflowType>("WITHDRAWAL");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Personal Living & Rent");
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
      setError("Please enter a valid amount.");
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
          description: description.trim(),
          source: source.trim() || "Trading Account",
          date: new Date(date).toISOString(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to record cashflow");
      }

      onSuccess(data.cashflow);
      onClose();
      setAmount("");
      setDescription("");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Cashflow & Spending"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Type Toggle */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setType("WITHDRAWAL");
              setCategory("Personal Living & Rent");
            }}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold border transition-all ${
              type === "WITHDRAWAL"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
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
              setCategory("Dining & Lifestyle");
            }}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold border transition-all ${
              type === "EXPENSE"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/60"
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
              setCategory("Account Refill");
            }}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-bold border transition-all ${
              type === "DEPOSIT"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <ArrowUpRight className="w-4 h-4 mb-1 text-emerald-400" />
            DEPOSIT
          </button>
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Amount ($) *</label>
            <input
              type="number"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500.00"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white font-mono font-bold focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
            <input
              type="date"
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
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Spent on what (optional) */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Note / Spent On What (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rent, monitor, broker withdrawal..."
            className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
