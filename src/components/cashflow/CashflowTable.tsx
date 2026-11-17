"use client";

import React, { useState } from "react";
import { Cashflow, CashflowType } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ArrowDownLeft, ShoppingBag, ArrowUpRight, Trash2, Filter, Wallet } from "lucide-react";

interface CashflowTableProps {
  cashflows: Cashflow[];
  onDelete: (id: string) => void;
  onOpenModal: () => void;
}

export const CashflowTable: React.FC<CashflowTableProps> = ({
  cashflows,
  onDelete,
  onOpenModal,
}) => {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = cashflows.filter((item) => {
    if (filterType !== "ALL" && item.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.source && item.source.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0f172a] shadow-xl overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Cashflow & Spending Ledger
            </h3>
            <p className="text-xs text-slate-400">
              Track money withdrawn from trading, expenses, and spent breakdown
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "WITHDRAWAL", "EXPENSE", "DEPOSIT"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                filterType === t
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              {t === "ALL" ? "All Cashflows" : t}
            </button>
          ))}
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />}
            onClick={onOpenModal}
          >
            + Record
          </Button>
        </div>
      </div>

      {/* Table Body */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-500 text-xs">
          No cashflow records matching your filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Spent On What / Description</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">
                    {formatDate(item.date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        item.type === "WITHDRAWAL"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : item.type === "EXPENSE"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {item.type === "WITHDRAWAL" ? (
                        <ArrowDownLeft className="w-3 h-3" />
                      ) : (
                        <ShoppingBag className="w-3 h-3" />
                      )}
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-200">{item.category}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-xs">{item.description}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono">{item.source || "Trading"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-sm text-white num-tabular whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        if (confirm("Delete this cashflow entry?")) onDelete(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
