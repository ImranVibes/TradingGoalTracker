"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Modal } from "../ui/Modal";
import { Trade } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Download, Copy, Check, Eye, EyeOff, Share2, Calendar } from "lucide-react";

interface SharePnlCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: Trade[];
  accountName: string;
  startingBalance?: number;
}

type CardPeriod = "TODAY" | "WEEK" | "MONTH" | "ALL";

export const SharePnlCardModal: React.FC<SharePnlCardModalProps> = ({
  isOpen,
  onClose,
  trades,
  accountName,
  startingBalance = 0,
}) => {
  const [period, setPeriod] = useState<CardPeriod>("MONTH");
  const [hideDollars, setHideDollars] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const periodData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const filtered = trades.filter((t) => {
      const d = new Date(t.trade_date);
      if (isNaN(d.getTime())) return false;
      if (period === "TODAY") {
        return t.trade_date.split("T")[0] === todayStr;
      }
      if (period === "WEEK") {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (period === "MONTH") {
        return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
      }
      return true;
    });

    const sorted = [...filtered].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    let netPnl = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;
    const pairMap: Record<string, number> = {};
    const curve: number[] = [0];

    for (const t of sorted) {
      const pnl = Number(t.pnl || 0);
      netPnl += pnl;
      curve.push(Number(netPnl.toFixed(2)));
      if (t.status === "WON" || pnl > 0) {
        wins++;
        grossProfit += pnl;
      } else if (t.status === "LOST" || pnl < 0) {
        losses++;
        grossLoss += Math.abs(pnl);
      }
      const sym = t.symbol.toUpperCase();
      pairMap[sym] = (pairMap[sym] || 0) + pnl;
    }

    const totalTrades = sorted.length;
    const decided = wins + losses;
    const winRate = decided > 0 ? Number(((wins / decided) * 100).toFixed(1)) : 0;
    const profitFactor =
      grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;

    const topPairEntry = Object.entries(pairMap).sort((a, b) => b[1] - a[1])[0] || null;
    const roiPct =
      startingBalance > 0 ? Number(((netPnl / startingBalance) * 100).toFixed(2)) : null;

    const scoredTrades = sorted.filter(
      (t) => t.discipline_score !== null && t.discipline_score !== undefined
    );
    const avgDiscipline =
      scoredTrades.length > 0
        ? Math.round(
            scoredTrades.reduce((s, t) => s + Number(t.discipline_score || 0), 0) /
              scoredTrades.length
          )
        : null;

    const periodLabel =
      period === "TODAY"
        ? `Daily Report • ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : period === "WEEK"
        ? "Weekly Performance (Last 7 Days)"
        : period === "MONTH"
        ? `Monthly Report • ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
        : "All-Time Trading Performance";

    return {
      netPnl: Number(netPnl.toFixed(2)),
      wins,
      losses,
      totalTrades,
      winRate,
      profitFactor,
      topPair: topPairEntry ? { symbol: topPairEntry[0], pnl: Number(topPairEntry[1].toFixed(2)) } : null,
      roiPct,
      avgDiscipline,
      curve,
      periodLabel,
    };
  }, [trades, period, startingBalance]);

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1200;
    const H = 675;
    canvas.width = W;
    canvas.height = H;

    const isPositive = periodData.netPnl >= 0;
    const accent = isPositive ? "#10b981" : "#f43f5e";
    const accentGlow = isPositive ? "rgba(16, 185, 129, 0.22)" : "rgba(244, 63, 94, 0.22)";
    const accentSoft = isPositive ? "rgba(16, 185, 129, 0.08)" : "rgba(244, 63, 94, 0.08)";

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#060a13");
    bg.addColorStop(0.55, "#0c1425");
    bg.addColorStop(1, "#070c18");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle glowing orb top-right
    const glow = ctx.createRadialGradient(W * 0.82, H * 0.18, 20, W * 0.82, H * 0.18, 420);
    glow.addColorStop(0, accentGlow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Subtle dot grid
    ctx.fillStyle = "rgba(148, 163, 184, 0.06)";
    for (let x = 40; x < W; x += 36) {
      for (let y = 40; y < H; y += 36) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Outer frame border
    ctx.strokeStyle = "rgba(51, 65, 85, 0.7)";
    ctx.lineWidth = 2;
    roundRect(ctx, 24, 24, W - 48, H - 48, 28);
    ctx.stroke();

    // Header Row: Brand + Account Pill
    ctx.fillStyle = "#38bdf8";
    roundRect(ctx, 64, 58, 42, 42, 12);
    ctx.fill();
    ctx.fillStyle = "#090d16";
    ctx.font = "bold 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("TJ", 72, 87);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("TRADING PERFORMANCE CARD", 122, 80);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 15px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(periodData.periodLabel.toUpperCase(), 122, 102);

    // Account Pill (top-right)
    const accText = accountName.toUpperCase();
    ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
    const accWidth = Math.min(280, ctx.measureText(accText).width + 36);
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, W - 64 - accWidth, 62, accWidth, 36, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7dd3fc";
    ctx.textAlign = "center";
    ctx.fillText(accText, W - 64 - accWidth / 2, 85);
    ctx.textAlign = "left";

    // Left Hero Metric: Net P&L (or ROI %)
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 15px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(hideDollars ? "NET PERFORMANCE RETURN" : "REALIZED NET P&L", 64, 178);

    const heroText = hideDollars
      ? periodData.roiPct !== null
        ? `${periodData.roiPct >= 0 ? "+" : ""}${periodData.roiPct}%`
        : `${periodData.winRate}% WR`
      : formatCurrency(periodData.netPnl, true);

    ctx.fillStyle = accent;
    ctx.font = "900 84px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(heroText, 64, 266);

    // Sub-badge next to hero
    const badgeText =
      periodData.roiPct !== null && !hideDollars
        ? `${periodData.roiPct >= 0 ? "+" : ""}${periodData.roiPct}% ROI  •  ${periodData.totalTrades} POSITIONS`
        : `${periodData.wins}W  /  ${periodData.losses}L  •  ${periodData.totalTrades} POSITIONS`;

    ctx.fillStyle = accentSoft;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.font = "bold 15px ui-monospace, SFMono-Regular, monospace";
    const badgeW = ctx.measureText(badgeText).width + 28;
    roundRect(ctx, 64, 290, badgeW, 34, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isPositive ? "#6ee7b7" : "#fda4af";
    ctx.fillText(badgeText, 78, 312);

    // Right Side: Mini Equity Curve Box
    const chartX = 650;
    const chartY = 148;
    const chartW = 486;
    const chartH = 220;

    ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
    ctx.strokeStyle = "rgba(51, 65, 85, 0.75)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, chartX, chartY, chartW, chartH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("EQUITY CURVE", chartX + 20, chartY + 30);

    const pts = periodData.curve;
    if (pts.length >= 2) {
      const minV = Math.min(...pts);
      const maxV = Math.max(...pts);
      const span = maxV - minV || 1;
      const padL = 22;
      const padR = 22;
      const padT = 48;
      const padB = 26;
      const plotW = chartW - padL - padR;
      const plotH = chartH - padT - padB;

      // Baseline zero line if in range
      if (minV < 0 && maxV > 0) {
        const zeroY = chartY + padT + ((maxV - 0) / span) * plotH;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(chartX + padL, zeroY);
        ctx.lineTo(chartX + chartW - padR, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Area Fill
      const areaGrad = ctx.createLinearGradient(0, chartY + padT, 0, chartY + chartH - padB);
      areaGrad.addColorStop(0, isPositive ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)");
      areaGrad.addColorStop(1, "rgba(15, 23, 42, 0.0)");

      ctx.beginPath();
      pts.forEach((v, idx) => {
        const px = chartX + padL + (idx / (pts.length - 1)) * plotW;
        const py = chartY + padT + ((maxV - v) / span) * plotH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.lineTo(chartX + chartW - padR, chartY + chartH - padB);
      ctx.lineTo(chartX + padL, chartY + chartH - padB);
      ctx.closePath();
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Curve Line
      ctx.beginPath();
      pts.forEach((v, idx) => {
        const px = chartX + padL + (idx / (pts.length - 1)) * plotW;
        const py = chartY + padT + ((maxV - v) / span) * plotH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // End dot
      const lastX = chartX + chartW - padR;
      const lastY = chartY + padT + ((maxV - pts[pts.length - 1]) / span) * plotH;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#475569";
      ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("Not enough trades in this period", chartX + 20, chartY + 115);
    }

    // Bottom 4 Stat Boxes
    const statCards = [
      {
        label: "WIN RATE",
        value: `${periodData.winRate}%`,
        sub: `${periodData.wins}W / ${periodData.losses}L`,
        color: periodData.winRate >= 50 ? "#34d399" : "#f87171",
      },
      {
        label: "PROFIT FACTOR",
        value: periodData.profitFactor >= 99 ? "∞" : String(periodData.profitFactor),
        sub: "Gross Profit / Loss",
        color: periodData.profitFactor >= 1.5 ? "#38bdf8" : "#e2e8f0",
      },
      {
        label: "TOP PERFORMING COIN",
        value: periodData.topPair ? periodData.topPair.symbol : "—",
        sub: periodData.topPair
          ? hideDollars
            ? "Best Edge Pair"
            : formatCurrency(periodData.topPair.pnl, true)
          : "No trades yet",
        color: "#fbbf24",
      },
      {
        label: periodData.avgDiscipline !== null ? "DISCIPLINE SCORE" : "TOTAL EXECUTIONS",
        value:
          periodData.avgDiscipline !== null
            ? `${periodData.avgDiscipline}%`
            : String(periodData.totalTrades),
        sub: periodData.avgDiscipline !== null ? "Pre-Trade Checklist Avg" : "Closed Positions",
        color: "#a78bfa",
      },
    ];

    const boxY = 415;
    const boxW = 252;
    const boxH = 148;
    const gap = 22;
    statCards.forEach((c, i) => {
      const bx = 64 + i * (boxW + gap);
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "rgba(51, 65, 85, 0.7)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, bx, boxY, boxW, boxH, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(c.label, bx + 20, boxY + 34);

      ctx.fillStyle = c.color;
      ctx.font = "900 32px ui-monospace, SFMono-Regular, monospace";
      ctx.fillText(c.value, bx + 20, boxY + 86);

      ctx.fillStyle = "#64748b";
      ctx.font = "600 13px ui-monospace, SFMono-Regular, monospace";
      ctx.fillText(c.sub, bx + 20, boxY + 122);
    });

    // Footer Strip
    ctx.fillStyle = "#475569";
    ctx.font = "500 13px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText("VERIFIED JOURNAL SNAPSHOT  •  TRADING.VIBETOOLS.DIGITAL", 64, H - 52);

    ctx.textAlign = "right";
    ctx.fillText(new Date().toISOString().split("T")[0], W - 64, H - 52);
    ctx.textAlign = "left";
  }, [periodData, accountName, hideDollars]);

  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(drawCard);
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, drawCard]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `pnl-card-${period.toLowerCase()}-${new Date().toISOString().split("T")[0]}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob && navigator.clipboard && "ClipboardItem" in window) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Shareable Performance Card (PNG)"
      subtitle="Export a crisp high-resolution trading card for Discord, X, Telegram, or your review journal"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-sky-400 ml-2 mr-1" />
            {(
              [
                { id: "TODAY", label: "Daily" },
                { id: "WEEK", label: "Weekly" },
                { id: "MONTH", label: "Monthly" },
                { id: "ALL", label: "All Time" },
              ] as { id: CardPeriod; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  period === p.id
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setHideDollars((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              hideDollars
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:text-white"
            }`}
          >
            {hideDollars ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {hideDollars ? "Privacy Mode ($ Hidden)" : "Show Dollar Amounts"}
          </button>
        </div>

        {/* High-Res Canvas Preview */}
        <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#060a13] shadow-2xl">
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        {/* Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-sky-400" />
            1200 × 675 HD PNG • Account: <strong className="text-slate-200">{accountName}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyImage}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Image!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-400" /> Copy PNG
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download PNG
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
