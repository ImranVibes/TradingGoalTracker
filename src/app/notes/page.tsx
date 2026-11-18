"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TradeFormModal } from "@/components/journal/TradeFormModal";
import { CashflowFormModal } from "@/components/cashflow/CashflowFormModal";
import { GoalFormModal } from "@/components/goals/GoalFormModal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAccounts } from "@/components/providers/AccountProvider";
import { TradingNote } from "@/lib/types";
import { formatDate, toDateInputValue } from "@/lib/utils";
import {
  StickyNote,
  PlusCircle,
  Search,
  Calendar,
  Pin,
  PinOff,
  Tag,
  Trash2,
  Edit3,
  Layers,
  Image as ImageIcon,
  UploadCloud,
  X,
  LayoutGrid,
  List,
  Copy,
  Check,
  Sparkles,
  Filter,
} from "lucide-react";

const NOTE_CATEGORIES = [
  { id: "GENERAL", label: "General", badge: "bg-slate-800 text-slate-300 border-slate-700" },
  { id: "MARKET_ANALYSIS", label: "Market Analysis", badge: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { id: "STRATEGY_RULES", label: "Strategy / Rules", badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  { id: "PSYCHOLOGY", label: "Psychology", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  { id: "LESSON_LEARNED", label: "Lesson Learned", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { id: "WATCHLIST", label: "Watchlist", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { id: "DAILY_REVIEW", label: "Daily Review", badge: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
];

type DatePreset = "ALL" | "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

function getCategoryMeta(catId: string) {
  return (
    NOTE_CATEGORIES.find((c) => c.id === catId?.toUpperCase()) || {
      id: catId || "GENERAL",
      label: catId || "General",
      badge: "bg-slate-800 text-slate-300 border-slate-700",
    }
  );
}

function isSafeImageUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith("/uploads/") ||
    url.startsWith("data:image/") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  );
}

export default function NotesPage() {
  const { accounts, activeAccountId, activeAccount } = useAccounts();

  const [notes, setNotes] = useState<TradingNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<TradingNote | null>(null);
  const [viewingNote, setViewingNote] = useState<TradingNote | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Navbar quick modals
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // Editor form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [symbol, setSymbol] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [noteDate, setNoteDate] = useState(toDateInputValue());
  const [noteAccountId, setNoteAccountId] = useState("acc_default");
  const [isPinned, setIsPinned] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const accountNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const acc of accounts) map[acc.id] = acc.name;
    return map;
  }, [accounts]);

  const computeDateRange = useCallback((): { start?: string; end?: string } => {
    const now = new Date();
    if (datePreset === "TODAY") {
      const d = toDateInputValue(now);
      return { start: `${d}T00:00:00.000Z`, end: `${d}T23:59:59.999Z` };
    }
    if (datePreset === "WEEK") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      return {
        start: `${toDateInputValue(weekAgo)}T00:00:00.000Z`,
        end: `${toDateInputValue(now)}T23:59:59.999Z`,
      };
    }
    if (datePreset === "MONTH") {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: `${toDateInputValue(firstOfMonth)}T00:00:00.000Z`,
        end: `${toDateInputValue(now)}T23:59:59.999Z`,
      };
    }
    if (datePreset === "CUSTOM") {
      return {
        start: startDate ? `${startDate}T00:00:00.000Z` : undefined,
        end: endDate ? `${endDate}T23:59:59.999Z` : undefined,
      };
    }
    return {};
  }, [datePreset, startDate, endDate]);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeAccountId && activeAccountId !== "ALL") {
        params.set("account_id", activeAccountId);
      }
      if (categoryFilter !== "ALL") {
        params.set("category", categoryFilter);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      const { start, end } = computeDateRange();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);

      const qs = params.toString();
      const res = await fetch(`/api/notes${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.notes)) {
        setNotes(data.notes);
      }
    } catch (err) {
      console.error("[Notes] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, categoryFilter, searchQuery, computeDateRange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotes();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchNotes]);

  const displayedNotes = useMemo(() => {
    if (!pinnedOnly) return notes;
    return notes.filter((n) => n.is_pinned);
  }, [notes, pinnedOnly]);

  const openCreateModal = () => {
    setEditingNote(null);
    setTitle("");
    setContent("");
    setCategory("GENERAL");
    setSymbol("");
    setTagsInput("");
    setNoteDate(toDateInputValue());
    setNoteAccountId(activeAccountId && activeAccountId !== "ALL" ? activeAccountId : "acc_default");
    setIsPinned(false);
    setImageUrl("");
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (note: TradingNote) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content || "");
    setCategory(note.category || "GENERAL");
    setSymbol(note.symbol || "");
    setTagsInput((note.tags || []).join(", "));
    setNoteDate(toDateInputValue(note.note_date));
    setNoteAccountId(note.account_id || "acc_default");
    setIsPinned(Boolean(note.is_pinned));
    setImageUrl(note.image_url || "");
    setFormError(null);
    setViewingNote(null);
    setIsEditorOpen(true);
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setFormError("Please upload or paste a valid image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setFormError("Image must be under 6 MB.");
      return;
    }
    setUploadingImage(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success || !data.url) {
        throw new Error(data.error || "Image upload failed");
      }
      setImageUrl(data.url);
    } catch (err: any) {
      setFormError(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await handleImageFile(file);
          break;
        }
      }
    }
  };

  const insertSnippet = (snippet: string) => {
    setContent((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${snippet}` : snippet));
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError("Please give your note a title.");
      return;
    }

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = {
        ...(editingNote ? { id: editingNote.id } : {}),
        account_id: noteAccountId || "acc_default",
        title: title.trim(),
        content,
        category,
        symbol: symbol.trim().toUpperCase(),
        tags: parsedTags,
        is_pinned: isPinned,
        note_date: `${noteDate}T12:00:00.000Z`,
        image_url: imageUrl,
      };

      const res = await fetch("/api/notes", {
        method: editingNote ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save note");
      }

      setIsEditorOpen(false);
      await fetchNotes();
    } catch (err: any) {
      setFormError(err.message || "Could not save note");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (note: TradingNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, is_pinned: !note.is_pinned }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) =>
          prev
            .map((n) => (n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n))
            .sort((a, b) => {
              if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
              return new Date(b.note_date).getTime() - new Date(a.note_date).getTime();
            })
        );
        if (viewingNote?.id === note.id) {
          setViewingNote({ ...note, is_pinned: !note.is_pinned });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete this note permanently?")) return;
    try {
      const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (viewingNote?.id === id) setViewingNote(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyNote = async (note: TradingNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const text = `${note.title}\n${formatDate(note.note_date)}${note.symbol ? ` • ${note.symbol}` : ""}\n\n${note.content}`;
      await navigator.clipboard.writeText(text);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {}
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("ALL");
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setPinnedOnly(false);
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    categoryFilter !== "ALL" ||
    datePreset !== "ALL" ||
    pinnedOnly;

  const pinnedCount = notes.filter((n) => n.is_pinned).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16]">
      <Navbar
        onOpenTradeModal={() => setIsTradeModalOpen(true)}
        onOpenCashflowModal={() => setIsCashflowModalOpen(true)}
        onOpenGoalModal={() => setIsGoalModalOpen(true)}
        onRefresh={fetchNotes}
      />

      <div className="flex-1 flex">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <StickyNote className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Trading Notes & Playbook
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <Layers className="w-3 h-3" />
                    {activeAccount ? activeAccount.name : "All Accounts (Combined)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Write market breakdowns, setups, checklists, lessons, and paste chart screenshots — filtered by date and searchable anytime.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                New Note
              </button>
            </div>
          </div>

          {/* Search & Date Filter Bar */}
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 space-y-3 shadow-lg">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes by title, content, symbol (BTCUSDT), or #tag..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Date Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mr-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" /> Date:
                </span>
                {(
                  [
                    { id: "ALL", label: "All Time" },
                    { id: "TODAY", label: "Today" },
                    { id: "WEEK", label: "Last 7 Days" },
                    { id: "MONTH", label: "This Month" },
                    { id: "CUSTOM", label: "Custom" },
                  ] as { id: DatePreset; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDatePreset(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                      datePreset === p.id
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPinnedOnly((p) => !p)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1 ${
                    pinnedOnly
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Pin className="w-3 h-3" />
                  Pinned ({pinnedCount})
                </button>
              </div>
            </div>

            {/* Custom Date Range Pickers */}
            {datePreset === "CUSTOM" && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-400">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-400">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Category Pills + Result Count */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500 mr-0.5" />
                <button
                  type="button"
                  onClick={() => setCategoryFilter("ALL")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    categoryFilter === "ALL"
                      ? "bg-white/10 text-white border-slate-600"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  All Categories
                </button>
                {NOTE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      categoryFilter === cat.id
                        ? cat.badge
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span>
                  {displayedNotes.length} {displayedNotes.length === 1 ? "note" : "notes"}
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sky-400 hover:underline font-sans font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notes Content */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-48 rounded-2xl border border-slate-800 bg-[#0f172a] animate-pulse p-4"
                />
              ))}
            </div>
          ) : displayedNotes.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <StickyNote className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {hasActiveFilters
                    ? "No notes match your search or date filter"
                    : `No notes yet in ${activeAccount ? activeAccount.name : "this workspace"}`}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {hasActiveFilters
                    ? "Try adjusting your search keywords, date range, or category."
                    : "Capture trading ideas, pre-market plans, risk rules, mistakes, or paste chart screenshots directly into a note."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    Reset Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Create First Note
                </button>
              </div>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3"
              }
            >
              {displayedNotes.map((note) => {
                const catMeta = getCategoryMeta(note.category);
                const accLabel = accountNameMap[note.account_id || "acc_default"] || "Main Account";
                const hasImg = isSafeImageUrl(note.image_url);

                return (
                  <div
                    key={note.id}
                    onClick={() => setViewingNote(note)}
                    className={`group rounded-2xl border bg-[#0f172a] hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between shadow-lg overflow-hidden ${
                      note.is_pinned ? "border-amber-500/40 ring-1 ring-amber-500/15" : "border-slate-800"
                    }`}
                  >
                    <div className="p-4 space-y-3">
                      {/* Top Meta Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${catMeta.badge}`}
                          >
                            {catMeta.label}
                          </span>
                          {note.symbol && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-sky-300 border border-slate-700">
                              {note.symbol}
                            </span>
                          )}
                          {activeAccountId === "ALL" && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                              {accLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(note, e)}
                            className={`p-1 rounded-lg transition-colors ${
                              note.is_pinned
                                ? "text-amber-400 bg-amber-500/10"
                                : "text-slate-500 hover:text-amber-400 hover:bg-slate-800"
                            }`}
                            title={note.is_pinned ? "Unpin Note" : "Pin to Top"}
                          >
                            {note.is_pinned ? (
                              <Pin className="w-3.5 h-3.5 fill-amber-400/30" />
                            ) : (
                              <Pin className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(note);
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                            title="Edit Note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNote(note.id, e)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-white leading-snug group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {note.title}
                      </h3>

                      {/* Content Preview */}
                      {note.content && (
                        <p className="text-xs text-slate-300/90 whitespace-pre-line line-clamp-5 leading-relaxed">
                          {note.content}
                        </p>
                      )}

                      {/* Attached Image Preview */}
                      {hasImg && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-40">
                          <img
                            src={note.image_url}
                            alt={note.title}
                            className="w-full h-36 object-cover hover:scale-[1.02] transition-transform"
                          />
                        </div>
                      )}
                    </div>

                    {/* Footer: Tags + Date */}
                    <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1 min-w-0">
                        {note.tags && note.tags.length > 0 ? (
                          note.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded"
                            >
                              #{tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-600">No tags</span>
                        )}
                        {note.tags && note.tags.length > 3 && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            +{note.tags.length - 3}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 flex-shrink-0">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {formatDate(note.note_date)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Create / Edit Note Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingNote ? "Edit Trading Note" : "Create New Trading Note"}
        subtitle="Write detailed notes, rules, checklists, and paste chart screenshots with Ctrl+V"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveNote} onPaste={handlePaste} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {formError}
            </div>
          )}

          {/* Title + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Note Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. BTC London Session Plan / Key Mistake to Avoid"
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Note Date</label>
              <input
                type="date"
                required
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Category + Account + Symbol */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Trading Account</label>
              <select
                value={noteAccountId}
                onChange={(e) => setNoteAccountId(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Symbol / Pair (Optional)
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. BTCUSDT, XAUUSD"
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white font-mono uppercase focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Templates & Formatting Helpers */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300">Note Content</label>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => insertSnippet("• ")}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                >
                  + Bullet
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("☐ Rule / Check 1\n☐ Rule / Check 2\n☐ Rule / Check 3")}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                >
                  + Checklist
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet(
                      "Setup Bias:\nKey Levels (Support / Resistance):\nEntry Trigger:\nInvalidation / Stop Loss:\nTarget:"
                    )
                  }
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5" /> Setup Template
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertSnippet(
                      "What went well:\nWhat went wrong:\nEmotional state:\nRule to follow tomorrow:"
                    )
                  }
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                >
                  + Daily Review
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your full analysis, trading rules, lessons, watchlist levels, or ideas here... (Tip: press Ctrl+V anywhere in this dialog to attach a chart screenshot)"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none leading-relaxed font-sans"
            />
          </div>

          {/* Tags + Pin Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="breakout, fomo, london-session, rules"
                className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsPinned((p) => !p)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                isPinned
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                  : "bg-slate-900 text-slate-400 border-slate-700/80 hover:text-white"
              }`}
            >
              {isPinned ? <Pin className="w-3.5 h-3.5 fill-amber-400/30" /> : <PinOff className="w-3.5 h-3.5" />}
              {isPinned ? "Pinned to Top" : "Pin Note"}
            </button>
          </div>

          {/* Image / Chart Screenshot Attachment */}
          <div className="rounded-xl border border-slate-800 bg-[#0b101d] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                Attach Chart / Screenshot (Optional — Ctrl+V supported)
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                  {uploadingImage ? "Uploading..." : "Upload Image"}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {isSafeImageUrl(imageUrl) && (
              <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 max-h-52">
                <img src={imageUrl} alt="Attachment preview" className="w-full max-h-52 object-contain" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || uploadingImage}>
              {saving ? "Saving..." : editingNote ? "Update Note" : "Save Note"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Full Note Reader Modal */}
      <Modal
        isOpen={!!viewingNote}
        onClose={() => setViewingNote(null)}
        title={viewingNote?.title || "Note"}
        subtitle={
          viewingNote
            ? `${formatDate(viewingNote.note_date)} • ${getCategoryMeta(viewingNote.category).label}${
                viewingNote.symbol ? ` • ${viewingNote.symbol}` : ""
              }`
            : ""
        }
        maxWidth="2xl"
      >
        {viewingNote && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                    getCategoryMeta(viewingNote.category).badge
                  }`}
                >
                  {getCategoryMeta(viewingNote.category).label}
                </span>
                {viewingNote.symbol && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-800 text-sky-300 border border-slate-700">
                    {viewingNote.symbol}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-900 text-slate-400 border border-slate-800">
                  {accountNameMap[viewingNote.account_id || "acc_default"] || "Main Account"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyNote(viewingNote)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1"
                >
                  {copiedId === viewingNote.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePin(viewingNote)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${
                    viewingNote.is_pinned
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300"
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                  {viewingNote.is_pinned ? "Pinned" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(viewingNote)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(viewingNote.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            {viewingNote.content ? (
              <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[55vh] overflow-y-auto">
                {viewingNote.content}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No text content in this note.</p>
            )}

            {isSafeImageUrl(viewingNote.image_url) && (
              <div
                onClick={() => setLightboxImage(viewingNote.image_url || null)}
                className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 cursor-zoom-in"
                title="Click to inspect full size"
              >
                <img
                  src={viewingNote.image_url}
                  alt={viewingNote.title}
                  className="w-full max-h-96 object-contain"
                />
              </div>
            )}

            {viewingNote.tags && viewingNote.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
                {viewingNote.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setViewingNote(null);
                      setSearchQuery(tag);
                    }}
                    className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-800 hover:bg-slate-700 text-sky-300"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 text-white border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Full chart view"
            className="max-w-full max-h-[90vh] object-contain rounded-xl border border-slate-800 shadow-2xl"
          />
        </div>
      )}

      {/* Global Quick Modals */}
      <TradeFormModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        onSuccess={() => {}}
      />
      <CashflowFormModal
        isOpen={isCashflowModalOpen}
        onClose={() => setIsCashflowModalOpen(false)}
        onSuccess={() => {}}
      />
      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
