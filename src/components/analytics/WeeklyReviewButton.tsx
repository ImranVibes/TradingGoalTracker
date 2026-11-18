"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Modal } from "../ui/Modal";
import { Sparkles, CheckCircle2, StickyNote, RefreshCw } from "lucide-react";

interface WeeklyReviewButtonProps {
  accountId: string;
  className?: string;
}

export const WeeklyReviewButton: React.FC<WeeklyReviewButtonProps> = ({
  accountId,
  className = "",
}) => {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<{
    title: string;
    content: string;
    engine: string;
    saved: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setIsOpen(true);
    try {
      const res = await fetch("/api/agent/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId && accountId !== "ALL" ? accountId : "acc_default",
          days: 7,
          saveToNotes: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to generate weekly review");
      setResult({
        title: data.title,
        content: data.content,
        engine: data.engine,
        saved: Boolean(data.note),
      });
    } catch (err: any) {
      setError(err.message || "Error generating review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/20 transition-all inline-flex items-center gap-1.5 disabled:opacity-60 ${className}`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {loading ? "Generating Review..." : "Generate Weekly AI Review"}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={result?.title || "Generating Weekly AI Review..."}
        subtitle={
          result
            ? `Powered by ${result.engine} • Auto-saved to Trading Notes (/notes)`
            : "Analyzing your synced positions, mistake tags, sessions, and Do's & Don'ts..."
        }
        maxWidth="2xl"
      >
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-violet-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300">
              Auditing your trades, mistakes, sessions, and daily accountability logs...
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
            {error}
          </div>
        ) : result ? (
          <div className="space-y-4">
            {result.saved && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Automatically saved &amp; pinned in your Trading Notes!
                </span>
                <Link
                  href="/notes"
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1"
                >
                  <StickyNote className="w-3 h-3" /> Open Notes
                </Link>
              </div>
            )}

            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[55vh] overflow-y-auto font-sans">
              {result.content}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};
