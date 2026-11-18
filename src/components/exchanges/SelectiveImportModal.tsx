"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useAccounts } from "../providers/AccountProvider";
import { Trade } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Radio,
  Download,
} from "lucide-react";

interface PreviewPosition extends Partial<Trade> {
  connection_id: string;
  connection_name: string;
  default_account_id: string;
  alreadyImported: boolean;
  wasDeleted: boolean;
}

interface SelectiveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
  onImported: (message: string) => void;
}

type FilterTab = "IMPORTABLE" | "DELETED" | "NEW" | "ALL";

export const SelectiveImportModal: React.FC<SelectiveImportModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  onImported,
}) => {
  const { accounts, activeAccountId, refreshAccounts } = useAccounts();

  const [positions, setPositions] = useState<PreviewPosition[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>("IMPORTABLE");
  const [search, setSearch] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("acc_default");
  const [targetProvider, setTargetProvider] = useState("Self");
  const [providers, setProviders] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedKeys([]);
    try {
      const [previewRes, provRes] = await Promise.all([
        fetch("/api/exchanges/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "preview",
            connection_id: connectionId,
          }),
        }).then((r) => r.json()),
        fetch("/api/providers").then((r) => r.json()),
      ]);

      if (provRes.success && Array.isArray(provRes.providers)) {
        setProviders(
          provRes.providers
            .map((p: any) => p.name?.trim())
            .filter((n: string) => Boolean(n && n.toLowerCase() !== "self"))
        );
      }

      if (!previewRes.success) {
        setError(previewRes.errors?.[0] || previewRes.error || "Could not load positions from exchange.");
        setPositions([]);
      } else {
        setPositions(previewRes.positions || []);
        if (previewRes.errors && previewRes.errors.length > 0) {
          setError(previewRes.errors.join(" | "));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch positions from exchange.");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (isOpen) {
      setTargetAccountId(activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default");
      setTargetProvider("Self");
      setSearch("");
      setFilterTab("IMPORTABLE");
      loadPreview();
    }
  }, [isOpen, activeAccountId, loadPreview]);

  const counts = {
    importable: positions.filter((p) => !p.alreadyImported).length,
    deleted: positions.filter((p) => !p.alreadyImported && p.wasDeleted).length,
    newOnly: positions.filter((p) => !p.alreadyImported && !p.wasDeleted).length,
    all: positions.length,
  };

  const visiblePositions = positions.filter((p) => {
    if (filterTab === "IMPORTABLE" && p.alreadyImported) return false;
    if (filterTab === "DELETED" && (!p.wasDeleted || p.alreadyImported)) return false;
    if (filterTab === "NEW" && (p.alreadyImported || p.wasDeleted)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (p.symbol || "").toLowerCase().includes(q) ||
        (p.trade_date || "").toLowerCase().includes(q) ||
        (p.exchange || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectableVisible = visiblePositions.filter((p) => !p.alreadyImported && p.exchange_trade_id);

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleKeys = selectableVisible
      .map((p) => p.exchange_trade_id!)
      .filter(Boolean);
    const allSelected =
      visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys((prev) => prev.filter((k) => !visibleKeys.includes(k)));
    } else {
      setSelectedKeys(Array.from(new Set([...selectedKeys, ...visibleKeys])));
    }
  };

  const selectedPositions = positions.filter(
    (p) => p.exchange_trade_id && selectedKeys.includes(p.exchange_trade_id)
  );
  const selectedTotalPnl = selectedPositions.reduce((sum, p) => sum + Number(p.pnl || 0), 0);

  const handleImportSelected = async () => {
    if (selectedPositions.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/exchanges/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_selected",
          positions: selectedPositions,
          account_id: targetAccountId,
          signal_provider: targetProvider,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Import failed");
      }
      await refreshAccounts();
      onImported(data.message || `Imported ${data.imported_trades || selectedPositions.length} selected position(s)!`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to import selected positions.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Force Sync — Select Positions to Import"
      subtitle="Pick specific closed positions (including accidentally deleted ones) without importing everything else"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Tabs + Search + Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            {(
              [
                { id: "IMPORTABLE", label: `Importable (${counts.importable})` },
                { id: "DELETED", label: `Deleted Earlier (${counts.deleted})` },
                { id: "NEW", label: `New (${counts.newOnly})` },
                { id: "ALL", label: `All (${counts.all})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterTab === tab.id
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter symbol..."
                className="w-full rounded-lg bg-slate-900 border border-slate-800 pl-8 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="button"
              onClick={loadPreview}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Re-fetch live positions from exchange"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Select All / Clear Row */}
        {!loading && selectableVisible.length > 0 && (
          <div className="flex items-center justify-between text-xs px-1">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {selectableVisible.every((p) => selectedKeys.includes(p.exchange_trade_id!))
                ? "Unselect Visible"
                : `Select All Visible (${selectableVisible.length})`}
            </button>
            {selectedKeys.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedKeys([])}
                className="text-slate-400 hover:text-white"
              >
                Clear Selection
              </button>
            )}
          </div>
        )}

        {/* Positions List */}
        <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">
                Fetching closed positions & fee breakdown from exchange...
              </p>
            </div>
          ) : visiblePositions.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-1">
              <p className="text-sm font-semibold text-slate-300">No positions in this view</p>
              <p className="text-xs text-slate-500">
                {filterTab === "IMPORTABLE"
                  ? "All recent exchange positions are already in your journal. Switch to 'All' to view them."
                  : "Try switching tabs or clearing your search."}
              </p>
            </div>
          ) : (
            visiblePositions.map((pos) => {
              const key = pos.exchange_trade_id || `${pos.symbol}_${pos.trade_date}`;
              const isChecked = selectedKeys.includes(key);
              const disabled = pos.alreadyImported;
              const pnl = Number(pos.pnl || 0);
              const tFee = Math.abs(Number(pos.trading_fee || 0));
              const fFee = Number(pos.funding_fee || 0);

              return (
                <div
                  key={key}
                  onClick={() => {
                    if (!disabled) toggleKey(key);
                  }}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border text-xs transition-all ${
                    disabled
                      ? "bg-slate-900/30 border-slate-800/60 opacity-55 cursor-not-allowed"
                      : isChecked
                      ? "bg-sky-500/15 border-sky-500/50 cursor-pointer"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700 cursor-pointer"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="mt-0.5 sm:mt-0 flex-shrink-0">
                      {disabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
                      ) : isChecked ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    <div
                      className={`p-1 rounded-md flex-shrink-0 ${
                        pos.direction === "LONG"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {pos.direction === "LONG" ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-mono font-bold text-white">{pos.symbol}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{pos.direction}</span>

                        {pos.alreadyImported ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                            Already Imported
                          </span>
                        ) : pos.wasDeleted ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                            Deleted Earlier
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                            New
                          </span>
                        )}

                        {pos.exchange && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {pos.exchange}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        {formatDate(pos.trade_date || new Date().toISOString(), true)}
                        {pos.entry_price ? ` • ${pos.entry_price} → ${pos.exit_price}` : ""}
                        {pos.quantity ? ` • Qty: ${pos.quantity}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-6 sm:pl-0 flex-shrink-0">
                    <span
                      className={`font-mono font-bold text-sm ${
                        pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCurrency(pnl, true)}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                      {tFee > 0 && <span className="text-amber-300">Fee: -{formatCurrency(tFee)}</span>}
                      {fFee !== 0 && (
                        <span className={fFee < 0 ? "text-rose-300" : "text-emerald-300"}>
                          Fund: {formatCurrency(fFee, true)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Target Account & Trader Selector before Importing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Layers className="w-3 h-3 text-sky-400" /> Import Into Account
            </label>
            <select
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
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
            <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Radio className="w-3 h-3 text-violet-400" /> Assign Signal Provider
            </label>
            <select
              value={targetProvider}
              onChange={(e) => setTargetProvider(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="Self">Self (My Own)</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-400 font-mono">
            {selectedPositions.length > 0 ? (
              <span>
                Selected <strong className="text-white">{selectedPositions.length}</strong> position(s) • Net:{" "}
                <strong className={selectedTotalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {formatCurrency(selectedTotalPnl, true)}
                </strong>
              </span>
            ) : (
              <span>Select the specific positions you want to import</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="profit"
              disabled={importing || selectedPositions.length === 0}
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleImportSelected}
            >
              {importing
                ? "Importing..."
                : `Import Selected (${selectedPositions.length})`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
