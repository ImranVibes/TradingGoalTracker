"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { TradingAccount } from "@/lib/types";

interface AccountContextValue {
  accounts: TradingAccount[];
  activeAccountId: string; // "ALL" or specific account ID
  activeAccount: TradingAccount | null;
  setActiveAccountId: (id: string) => void;
  refreshAccounts: () => Promise<void>;
  autoSyncStatus: "idle" | "syncing" | "synced";
  autoSyncMessage: string | null;
  triggerAutoSync: (onNewPositions?: () => void) => Promise<void>;
  dismissSyncMessage: () => void;
}

const AccountContext = createContext<AccountContextValue>({
  accounts: [],
  activeAccountId: "ALL",
  activeAccount: null,
  setActiveAccountId: () => {},
  refreshAccounts: async () => {},
  autoSyncStatus: "idle",
  autoSyncMessage: null,
  triggerAutoSync: async () => {},
  dismissSyncMessage: () => {},
});

const STORAGE_KEY = "trading_tracker_active_account";

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string>("ALL");
  const [autoSyncStatus, setAutoSyncStatus] = useState<"idle" | "syncing" | "synced">("idle");
  const [autoSyncMessage, setAutoSyncMessage] = useState<string | null>(null);
  const lastClientAutoSyncRef = useRef<number>(0);

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      if (data.success && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error("[AccountProvider] Failed to fetch accounts:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setActiveAccountIdState(saved);
      }
    }
    refreshAccounts();
  }, [refreshAccounts]);

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const triggerAutoSync = useCallback(
    async (onNewPositions?: () => void) => {
      // Client-side guard: don't re-fire auto sync more than once every 45 seconds
      const now = Date.now();
      if (now - lastClientAutoSyncRef.current < 45_000) return;
      lastClientAutoSyncRef.current = now;

      setAutoSyncStatus("syncing");
      try {
        const res = await fetch("/api/exchanges/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", auto: true }),
        });
        const data = await res.json();
        if (data.success && !data.skipped_cooldown && data.imported_trades > 0) {
          setAutoSyncMessage(`Auto-synced ${data.imported_trades} new closed position(s)!`);
          setAutoSyncStatus("synced");
          await refreshAccounts();
          if (onNewPositions) onNewPositions();
          setTimeout(() => setAutoSyncMessage(null), 6000);
        } else {
          setAutoSyncStatus("idle");
        }
      } catch {
        setAutoSyncStatus("idle");
      }
    },
    [refreshAccounts]
  );

  const dismissSyncMessage = useCallback(() => {
    setAutoSyncMessage(null);
  }, []);

  const activeAccount =
    activeAccountId === "ALL"
      ? null
      : accounts.find((a) => a.id === activeAccountId) || null;

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccountId,
        activeAccount,
        setActiveAccountId,
        refreshAccounts,
        autoSyncStatus,
        autoSyncMessage,
        triggerAutoSync,
        dismissSyncMessage,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccounts = () => useContext(AccountContext);
