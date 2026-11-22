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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased font-sans selection:bg-amber-500/30 selection:text-amber-200">
        <AccountProvider>
          <CoinIconProvider>{children}</CoinIconProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
