"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_SIDEBAR_ITEMS,
  useSidebarNavItems,
} from "@/lib/sidebarConfig";
import { SidebarCustomizeModal } from "./SidebarCustomizeModal";

// Export NAV_ITEMS for backwards compatibility
export const NAV_ITEMS = ALL_SIDEBAR_ITEMS;

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { items, isCustomized, isModalOpen, openModal, closeModal } =
    useSidebarNavItems();

  return (
    <>
      <aside className="w-56 flex-shrink-0 hidden lg:flex flex-col justify-between border-r border-slate-800 bg-[#090d16] min-h-[calc(100vh-3.5rem)] p-3">
        <nav className="space-y-1 overflow-y-auto pr-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                  isActive
                    ? "bg-slate-800 text-white font-semibold shadow-xs shadow-sky-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0 transition-colors",
                      isActive
                        ? "text-sky-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                {item.id === "journal" && (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Trade
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Customize Sidebar Bar */}
        <div className="pt-3 mt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={openModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all group cursor-pointer shadow-xs"
            title="Reorder and customize sidebar items"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400 group-hover:rotate-45 transition-transform" />
              <span>Customize Menu</span>
            </div>
            {isCustomized ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                Custom
              </span>
            ) : (
              <Sparkles className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
            )}
          </button>
        </div>
      </aside>

      {/* Customize Modal */}
      <SidebarCustomizeModal isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
};
