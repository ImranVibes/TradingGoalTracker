"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Sparkles,
  SlidersHorizontal,
  BookmarkCheck,
  Search,
} from "lucide-react";
import {
  ALL_SIDEBAR_ITEMS,
  DEFAULT_SIDEBAR_ORDER,
  PRESET_ORDERS,
  SidebarConfig,
  SidebarItemDef,
  getLocalSidebarConfig,
  saveLocalSidebarConfig,
} from "@/lib/sidebarConfig";
import { Button } from "../ui/Button";

interface SidebarCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SidebarCustomizeModal: React.FC<SidebarCustomizeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [order, setOrder] = useState<string[]>(DEFAULT_SIDEBAR_ORDER);
  const [hidden, setHidden] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load configuration on open
  useEffect(() => {
    if (isOpen) {
      const cfg = getLocalSidebarConfig();
      setOrder(cfg.order);
      setHidden(cfg.hidden);
      setSavedSuccess(false);

      // Also reconcile with server
      fetch("/api/settings/sidebar")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.order)) {
            setOrder(data.order);
            if (Array.isArray(data.hidden)) setHidden(data.hidden);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const itemMap = new Map<string, SidebarItemDef>();
  ALL_SIDEBAR_ITEMS.forEach((i) => itemMap.set(i.id, i));

  // Full ordered items
  const fullOrderedItems: SidebarItemDef[] = order
    .map((id) => itemMap.get(id))
    .filter((i): i is SidebarItemDef => Boolean(i));

  // Add any items missing from order
  ALL_SIDEBAR_ITEMS.forEach((item) => {
    if (!order.includes(item.id)) {
      fullOrderedItems.push(item);
    }
  });

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fullOrderedItems.length) return;

    const newOrder = fullOrderedItems.map((i) => i.id);
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    setOrder(newOrder);
  };

  const handleToggleHide = (id: string) => {
    if (id === "dashboard") return; // Dashboard is protected
    setHidden((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id && dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!draggedId || draggedId === dropTargetId) {
      setDraggedId(null);
      return;
    }

    const currentIds = fullOrderedItems.map((i) => i.id);
    const fromIndex = currentIds.indexOf(draggedId);
    const toIndex = currentIds.indexOf(dropTargetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...currentIds];
      const [item] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, item);
      setOrder(newOrder);
    }
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const applyPreset = (presetOrder: string[]) => {
    setOrder([...presetOrder]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const config: SidebarConfig = {
      order,
      hidden: hidden.filter((id) => id !== "dashboard"),
    };

    // Save locally first for instant zero-lag updates
    saveLocalSidebarConfig(config);

    try {
      await fetch("/api/settings/sidebar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      // Local save already succeeded
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = fullOrderedItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    return (
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.href.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0b101b] border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Customize Sidebar Navigation
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {fullOrderedItems.length - hidden.length} active
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Drag items or click arrows to reorder. Toggle the eye icon to hide.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick Reorder Presets:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset(PRESET_ORDERS[0].order)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 transition-colors flex items-center gap-1.5"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-sky-400" />
              Positions Journal 2nd (Active Trader)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(PRESET_ORDERS[1].order)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              Analysis First
            </button>
            <button
              type="button"
              onClick={() => {
                setOrder([...DEFAULT_SIDEBAR_ORDER]);
                setHidden([]);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800/50 text-slate-400 border border-slate-700/60 hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset Default
            </button>
          </div>
        </div>

        {/* Search filter for long list */}
        <div className="px-5 pt-3 pb-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Reorderable List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {filteredItems.map((item, index) => {
            const Icon = item.icon;
            const isHidden = hidden.includes(item.id);
            const isDragging = draggedId === item.id;
            const isOver = dragOverId === item.id;
            const isProtected = item.id === "dashboard";

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl border transition-all select-none ${
                  isDragging
                    ? "opacity-40 border-sky-500 bg-sky-950/20 scale-[0.98]"
                    : isOver
                    ? "border-sky-400 bg-sky-900/30 ring-1 ring-sky-400"
                    : isHidden
                    ? "border-slate-800/40 bg-slate-950/40 opacity-50"
                    : "border-slate-800/80 bg-slate-900/50 hover:bg-slate-800/50 hover:border-slate-700"
                }`}
              >
                {/* Drag Handle & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="cursor-grab active:cursor-grabbing text-slate-500 group-hover:text-slate-300 transition-colors p-1"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 w-4 text-center">
                    {index + 1}
                  </span>

                  <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={`text-xs font-medium truncate ${
                        isHidden ? "text-slate-500 line-through" : "text-white"
                      }`}
                    >
                      {item.name}
                    </span>
                    {item.id === "journal" && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                        Key
                      </span>
                    )}
                    {item.category && (
                      <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Controls: Up, Down, Eye Toggle */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-20 disabled:pointer-events-none transition-colors"
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMove(index, "down")}
                    disabled={index === fullOrderedItems.length - 1}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-20 disabled:pointer-events-none transition-colors"
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {!isProtected ? (
                    <button
                      type="button"
                      onClick={() => handleToggleHide(item.id)}
                      className={`p-1.5 rounded transition-colors ${
                        isHidden
                          ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                      title={isHidden ? "Show in sidebar" : "Hide from sidebar"}
                    >
                      {isHidden ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <div
                      className="p-1.5 text-slate-600"
                      title="Dashboard cannot be hidden"
                    >
                      <Eye className="w-4 h-4 opacity-40" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Changes apply instantly to desktop sidebar and mobile menu.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-sky-500/20"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" /> Saved!
                </>
              ) : isSaving ? (
                "Saving..."
              ) : (
                "Save Order"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
