import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import { AccountProvider } from "@/components/providers/AccountProvider";
import { CoinIconProvider } from "@/components/providers/CoinIconProvider";

export const metadata: Metadata = {
  title: "Trading & Goal Tracker",
  description: "Personal trading journal, profit goals, multi-account tracker, and exchange auto-sync",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased">
        <AccountProvider>
          <CoinIconProvider>{children}</CoinIconProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
