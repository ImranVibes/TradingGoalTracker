"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Wallet,
  Target,
  BarChart3,
  Calculator,
  Radio,
  Settings,
  Layers,
  CandlestickChart,
  StickyNote,
  CheckSquare,
  Compass,
  ClipboardCheck,
  Bot,
  type LucideIcon,
} from "lucide-react";

export interface SidebarItemDef {
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  category?: "Core" | "Analysis" | "Discipline" | "Finance" | "Tools";
}

export const ALL_SIDEBAR_ITEMS: SidebarItemDef[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    category: "Core",
  },
  {
    id: "copilot",
    name: "AI Copilot",
    href: "/copilot",
    icon: Bot,
    category: "Analysis",
  },
  {
    id: "chart",
    name: "Chart",
    href: "/chart",
    icon: CandlestickChart,
    category: "Analysis",
  },
  {
    id: "sentiment",
    name: "Sentiment Detector",
    href: "/sentiment",
    icon: Compass,
    category: "Analysis",
  },
  {
    id: "checklist",
    name: "Pre-Trade Checklist",
    href: "/checklist",
    icon: CheckSquare,
    category: "Discipline",
  },
  {
    id: "dos-donts",
    name: "Do's & Don'ts",
    href: "/dos-donts",
    icon: ClipboardCheck,
    category: "Discipline",
  },
  {
    id: "accounts",
    name: "Trading Accounts",
    href: "/accounts",
    icon: Layers,
    category: "Finance",
  },
  {
    id: "journal",
    name: "Positions Journal",
    href: "/journal",
    icon: BookOpen,
    category: "Core",
  },
  {
    id: "notes",
    name: "Notes",
    href: "/notes",
    icon: StickyNote,
    category: "Discipline",
  },
  {
    id: "signals",
    name: "Signal Providers",
    href: "/signals",
    icon: Radio,
    category: "Tools",
  },
  {
    id: "calendar",
    name: "Daily & Calendar",
    href: "/calendar",
    icon: CalendarDays,
    category: "Finance",
  },
  {
    id: "cashflow",
    name: "Cashflow & Spending",
    href: "/cashflow",
    icon: Wallet,
    category: "Finance",
  },
  {
    id: "goals",
    name: "Goals & Targets",
    href: "/goals",
    icon: Target,
    category: "Finance",
  },
  {
    id: "calculator",
    name: "Risk & Lot Calculator",
    href: "/calculator",
    icon: Calculator,
    category: "Tools",
  },
  {
    id: "analytics",
    name: "Performance Analytics",
    href: "/analytics",
    icon: BarChart3,
    category: "Finance",
  },
  {
    id: "settings",
    name: "Exchange & Settings",
    href: "/settings",
    icon: Settings,
    category: "Tools",
  },
];

export const DEFAULT_SIDEBAR_ORDER: string[] = ALL_SIDEBAR_ITEMS.map((item) => item.id);

export const PRESET_ORDERS: { name: string; description: string; order: string[] }[] = [
  {
    name: "Positions Journal First (Active Trader)",
    description: "Places Positions Journal directly after Dashboard, followed by Chart & Checklist",
    order: [
      "dashboard",
      "journal",
      "chart",
      "checklist",
      "sentiment",
      "dos-donts",
      "copilot",
      "notes",
      "accounts",
      "calculator",
      "analytics",
      "calendar",
      "cashflow",
      "goals",
      "signals",
      "settings",
    ],
  },
  {
    name: "Analysis & Market Setup",
    description: "Focus on Chart, Sentiment, Copilot, and Checklist before logging trades",
    order: [
      "dashboard",
      "chart",
      "sentiment",
      "copilot",
      "checklist",
      "journal",
      "dos-donts",
      "notes",
      "accounts",
      "analytics",
      "calculator",
      "calendar",
      "cashflow",
      "goals",
      "signals",
      "settings",
    ],
  },
  {
    name: "Default Layout",
    description: "Original navigation layout",
    order: [...DEFAULT_SIDEBAR_ORDER],
  },
];

export interface SidebarConfig {
  order: string[];
  hidden: string[];
}

export const SIDEBAR_STORAGE_KEY = "trading_journal_sidebar_config_v2";
export const SIDEBAR_EVENT_NAME = "trading_journal_sidebar_order_changed";

export function getLocalSidebarConfig(): SidebarConfig {
  if (typeof window === "undefined") {
    return { order: DEFAULT_SIDEBAR_ORDER, hidden: [] };
  }
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return { order: DEFAULT_SIDEBAR_ORDER, hidden: [] };
    const parsed = JSON.parse(raw);
    const order = Array.isArray(parsed.order) ? parsed.order : DEFAULT_SIDEBAR_ORDER;
    const hidden = Array.isArray(parsed.hidden) ? parsed.hidden : [];

    // Ensure any newly added items in ALL_SIDEBAR_ITEMS are preserved at the end
    const missing = DEFAULT_SIDEBAR_ORDER.filter((id) => !order.includes(id));
    return {
      order: [...order.filter((id) => DEFAULT_SIDEBAR_ORDER.includes(id)), ...missing],
      hidden: hidden.filter((id) => id !== "dashboard"), // dashboard can never be hidden
    };
  } catch (err) {
    return { order: DEFAULT_SIDEBAR_ORDER, hidden: [] };
  }
}

export function saveLocalSidebarConfig(config: SidebarConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(
      new CustomEvent(SIDEBAR_EVENT_NAME, { detail: config })
    );
  } catch (err) {}
}

export function resolveSidebarItems(config: SidebarConfig): SidebarItemDef[] {
  const itemMap = new Map<string, SidebarItemDef>();
  ALL_SIDEBAR_ITEMS.forEach((item) => itemMap.set(item.id, item));

  const items: SidebarItemDef[] = [];
  const hiddenSet = new Set(config.hidden || []);

  config.order.forEach((id) => {
    if (!hiddenSet.has(id)) {
      const found = itemMap.get(id);
      if (found) items.push(found);
    }
  });

  // Include any items missing from order that are not hidden
  ALL_SIDEBAR_ITEMS.forEach((item) => {
    if (!config.order.includes(item.id) && !hiddenSet.has(item.id)) {
      items.push(item);
    }
  });

  return items;
}

export function useSidebarNavItems() {
  const [config, setConfig] = useState<SidebarConfig>({
    order: DEFAULT_SIDEBAR_ORDER,
    hidden: [],
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // 1. Initial local load
    const initial = getLocalSidebarConfig();
    setConfig(initial);

    // 2. Fetch server config to reconcile
    fetch("/api/settings/sidebar")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.order)) {
          const remoteConfig: SidebarConfig = {
            order: data.order,
            hidden: Array.isArray(data.hidden) ? data.hidden : [],
          };
          setConfig(remoteConfig);
          try {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(remoteConfig));
          } catch {}
        }
      })
      .catch(() => {});

    // 3. Listen to local updates from other components / modal
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<SidebarConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      } else {
        setConfig(getLocalSidebarConfig());
      }
    };

    window.addEventListener(SIDEBAR_EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(SIDEBAR_EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const items = resolveSidebarItems(config);
  const isCustomized =
    JSON.stringify(config.order) !== JSON.stringify(DEFAULT_SIDEBAR_ORDER) ||
    config.hidden.length > 0;

  return {
    items,
    config,
    isCustomized,
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
  };
}
