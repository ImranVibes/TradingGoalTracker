export interface Candle {
  time: number; // UNIX timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PlotPoint {
  time: number;
  value: number;
  color?: string;
}

export interface IndicatorLineOutput {
  id: string;
  title: string;
  color: string;
  lineWidth: number;
  style: "line" | "histogram" | "stepline" | "circles";
  overlay: boolean;
  data: PlotPoint[];
}

export interface IndicatorMarkerOutput {
  time: number;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  text: string;
}

export interface IndicatorHLineOutput {
  price: number;
  title: string;
  color: string;
  overlay: boolean;
}

export interface IndicatorRunResult {
  success: boolean;
  name: string;
  overlay: boolean;
  lines: IndicatorLineOutput[];
  markers: IndicatorMarkerOutput[];
  hlines: IndicatorHLineOutput[];
  warnings: string[];
  error?: string;
}

// -----------------------------------------------------------------------------
// PINE COLOR PALETTE & HELPERS
// -----------------------------------------------------------------------------
const PINE_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  lime: "#4ade80",
  teal: "#14b8a6",
  blue: "#3b82f6",
  aqua: "#06b6d4",
  cyan: "#22d3ee",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  maroon: "#991b1b",
  navy: "#1e3a8a",
  olive: "#84cc16",
  white: "#f8fafc",
  silver: "#cbd5e1",
  gray: "#64748b",
  grey: "#64748b",
  black: "#0f172a",
};

function hexToRgba(hex: string, transparency = 0): string {
  if (!hex || typeof hex !== "string") return "#38bdf8";
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const alpha = Math.max(0, Math.min(1, 1 - Number(transparency || 0) / 100));
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

// -----------------------------------------------------------------------------
// SECURITY GUARD FOR SANDBOXED EXECUTION
// -----------------------------------------------------------------------------
const FORBIDDEN_PATTERNS = [
  /\bwindow\b/,
  /\bdocument\b/,
  /\bglobalThis\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bFunction\b/,
  /\beval\b/,
  /\bconstructor\b/,
  /__proto__/,
  /\bprototype\b/,
  /\bprocess\b/,
  /\brequire\b/,
  /\bcookie\b/i,
];

function checkSandboxSafety(code: string): string | null {
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(code)) {
      return `Blocked unsafe token matching ${re.source} in indicator script.`;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// HELPER: SPLIT TOP-LEVEL COMMA ARGUMENTS (RESPECTING PARENS & QUOTES)
// -----------------------------------------------------------------------------
function splitArgs(argStr: string): string[] {
  const result: string[] = [];
  let cur = "";
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < argStr.length; i++) {
    const ch = argStr[i];
    const prev = i > 0 ? argStr[i - 1] : "";
    if (ch === "'" && !inDouble && prev !== "\\") inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
      else if (ch === "," && depth === 0) {
        result.push(cur.trim());
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) result.push(cur.trim());
  return result;
}

// Parse positional & named Pine args: `plot(ema20, title="EMA", color=color.blue, linewidth=2)`
function buildArgObject(argStr: string, positionalNames: string[]): string {
  const parts = splitArgs(argStr);
  const entries: string[] = [];
  let posIdx = 0;

  for (const p of parts) {
    // Check named arg `key = value` (not `==`, `!=`, `<=`, `>=`, `:=`)
    const m = p.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)\s*([\s\S]+)$/);
    if (m) {
      entries.push(`${m[1]}: (${m[2]})`);
    } else if (posIdx < positionalNames.length) {
      entries.push(`${positionalNames[posIdx]}: (${p})`);
      posIdx++;
    }
  }
  return `{ ${entries.join(", ")} }`;
}

// -----------------------------------------------------------------------------
// PINE SCRIPT v4/v5/v6 -> SANDBOXED BAR-BY-BAR JS TRANSPILER
// -----------------------------------------------------------------------------
interface TranspileResult {
  name: string;
  overlay: boolean;
  varDecls: string[];
  bodyJs: string;
  warnings: string[];
}

function stripComments(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    if (ch === "'" && !inDouble && prev !== "\\") inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble && ch === "/" && line[i + 1] === "/") {
      return line.slice(0, i);
    }
  }
  return line;
}

function joinMultilineStatements(rawLines: string[]): { indent: number; text: string }[] {
  const joined: { indent: number; text: string }[] = [];
  let pending: { indent: number; text: string } | null = null;
  let parenDepth = 0;

  const countParens = (s: string) => {
    let d = 0;
    let inS = false;
    let inD = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const prev = i > 0 ? s[i - 1] : "";
      if (ch === "'" && !inD && prev !== "\\") inS = !inS;
      else if (ch === '"' && !inS && prev !== "\\") inD = !inD;
      else if (!inS && !inD) {
        if (ch === "(" || ch === "[") d++;
        else if (ch === ")" || ch === "]") d--;
      }
    }
    return d;
  };

  for (const raw of rawLines) {
    const expanded = raw.replace(/\t/g, "    ");
    const noComment = stripComments(expanded);
    if (!noComment.trim()) continue;

    const indent = noComment.length - noComment.trimStart().length;
    const trimmed = noComment.trim();

    if (pending) {
      pending.text += " " + trimmed;
      parenDepth += countParens(trimmed);
      if (parenDepth <= 0) {
        joined.push(pending);
        pending = null;
        parenDepth = 0;
      }
    } else {
      const d = countParens(trimmed);
      // Also join if next line starts with `?` or `:` (multiline ternary handled in pass 2)
      if (d > 0) {
        pending = { indent, text: trimmed };
        parenDepth = d;
      } else {
        joined.push({ indent, text: trimmed });
      }
    }
  }
  if (pending) joined.push(pending);

  // Merge multiline ternary continuations starting with `?` or `:` or operators
  const merged: { indent: number; text: string }[] = [];
  for (const item of joined) {
    if (
      merged.length > 0 &&
      (/^(\?|:|and\b|or\b|\+|-|\*|\/)/.test(item.text) ||
        /(\?|\belse\b|and|or|\+|-|\*|\/|=)$/.test(merged[merged.length - 1].text)) &&
      !/^else\b/.test(item.text) &&
      !/^if\b/.test(item.text)
    ) {
      merged[merged.length - 1].text += " " + item.text;
    } else {
      merged.push(item);
    }
  }

  return merged;
}

const TA_FUNC_NAMES = [
  "sma",
  "ema",
  "rma",
  "wma",
  "vwma",
  "rsi",
  "atr",
  "tr",
  "stdev",
  "highest",
  "lowest",
  "crossover",
  "crossunder",
  "cross",
  "supertrend",
  "macd",
  "bb",
  "kc",
  "stoch",
  "pivothigh",
  "pivotlow",
  "change",
  "mom",
  "roc",
  "rising",
  "falling",
  "cum",
  "barssince",
  "valuewhen",
  "linreg",
  "median",
  "dmi",
];

function transpilePineScript(source: string): TranspileResult {
  const warnings: string[] = [];
  let name = "Custom Pine Indicator";
  let overlay = true;
  let callCounter = 0;
  const nextId = () => `c${++callCounter}`;

  // Extract indicator() / study() / strategy() metadata
  const headerMatch = source.match(/\b(?:indicator|study|strategy)\s*\(([\s\S]*?)\)/);
  if (headerMatch) {
    const args = splitArgs(headerMatch[1]);
    for (const a of args) {
      const overlayMatch = a.match(/^overlay\s*=\s*(true|false)/i);
      if (overlayMatch) overlay = overlayMatch[1].toLowerCase() === "true";
      const titleNamed = a.match(/^(?:title|shorttitle)\s*=\s*["']([^"']+)["']/);
      if (titleNamed && name === "Custom Pine Indicator") name = titleNamed[1];
    }
    if (args[0] && /^["']([^"']+)["']$/.test(args[0])) {
      name = args[0].slice(1, -1);
    }
  }

  const lines = joinMultilineStatements(source.split(/\r?\n/));
  const declaredVars = new Set<string>();
  const persistentVars = new Set<string>();
  const historyVars = new Set<string>([
    "open",
    "high",
    "low",
    "close",
    "volume",
    "hl2",
    "hlc3",
    "ohlc4",
    "hlcc4",
    "time",
  ]);

  // Helper to transform a Pine expression into JS expression for bar `i`
  const transformExpr = (expr: string): string => {
    let out = expr;

    // Normalize Pine v4/v5/v6 boolean operators (outside strings)
    out = out.replace(/\band\b/g, "&&");
    out = out.replace(/\bor\b/g, "||");
    out = out.replace(/\bnot\s+/g, "!");

    // Replace `input.int(...)`, `input.float(...)`, `input.bool(...)`, `input.source(...)`, `input.string(...)`, `input.color(...)`, `input(...)`
    out = out.replace(/\binput(?:\.(?:int|float|bool|source|string|color|timeframe|session))?\s*\(([^()]*)\)/g, (_, inner) => {
      const args = splitArgs(inner);
      for (const a of args) {
        const m = a.match(/^defval\s*=\s*([\s\S]+)$/);
        if (m) return `(${m[1]})`;
      }
      return args[0] ? `(${args[0]})` : "0";
    });

    // Replace `ta.vwap` property access
    out = out.replace(/\bta\.vwap\b/g, "__ta.vwap(i)");
    out = out.replace(/\bta\.tr\b(?!\s*\()/g, "__ta.tr(i)");

    // Replace `ta.<fn>(...)` with stateful call-site ID
    out = out.replace(
      new RegExp(`\\bta\\.(${TA_FUNC_NAMES.join("|")})\\s*\\(`, "g"),
      (_, fn) => `__ta.${fn}("${nextId()}", i, `
    );

    // Also support Pine v4 unprefixed TA calls like `ema(close, 20)` (not preceded by `.` or word char)
    out = out.replace(
      new RegExp(`(?<![.\\w])(${TA_FUNC_NAMES.join("|")})\\s*\\(`, "g"),
      (_, fn) => `__ta.${fn}("${nextId()}", i, `
    );

    // Replace `math.<fn>` -> `__math.<fn>`
    out = out.replace(/\bmath\.([a-zA-Z_]+)/g, "__math.$1");

    // Replace `nz(x, y)` / `na(x)` / `fixnan(x)`
    out = out.replace(/\bnz\s*\(/g, "__nz(");
    out = out.replace(/(?<![.\w])na\s*\(/g, "__isNa(");
    out = out.replace(/(?<![.\w])na(?![.\w(])/g, "NaN");
    out = out.replace(/\bfixnan\s*\(/g, `__fixnan("${nextId()}", i, `);

    // Replace `color.new(...)` and `color.<name>`
    out = out.replace(/\bcolor\.new\s*\(/g, "__color.new(");
    out = out.replace(/\bcolor\.rgb\s*\(/g, "__color.rgb(");
    out = out.replace(/\bcolor\.([a-zA-Z_]+)/g, "__color.$1");

    // Replace `shape.*`, `location.*`, `size.*`, `plot.style_*`, `strategy.long/short`
    out = out.replace(/\bshape\.([a-zA-Z_]+)/g, `"$1"`);
    out = out.replace(/\blocation\.([a-zA-Z_]+)/g, `"$1"`);
    out = out.replace(/\bsize\.([a-zA-Z_]+)/g, `"$1"`);
    out = out.replace(/\bplot\.style_([a-zA-Z_]+)/g, `"$1"`);
    out = out.replace(/\bhlinestyle\.([a-zA-Z_]+)/g, `"$1"`);
    out = out.replace(/\bstrategy\.long\b/g, `"LONG"`);
    out = out.replace(/\bstrategy\.short\b/g, `"SHORT"`);

    // Replace historical series indexing: `varName[offset]` -> `__at(__h.varName, i, offset)`
    out = out.replace(
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*([^\]]+)\s*\]/g,
      (full, vName, offsetExpr) => {
        if (historyVars.has(vName) || declaredVars.has(vName)) {
          return `__at(__h["${vName}"], i, ${offsetExpr})`;
        }
        return full;
      }
    );

    return out;
  };

  const jsLines: string[] = [];
  const indentStack: number[] = [0];

  const closeIndentsTo = (targetIndent: number) => {
    while (indentStack.length > 1 && indentStack[indentStack.length - 1] > targetIndent) {
      indentStack.pop();
      jsLines.push("}");
    }
  };

  for (const { indent, text } of lines) {
    // Skip directive/header/UI-only statements gracefully
    if (
      /^(?:indicator|study|strategy|import|library|export)\s*\(/.test(text) ||
      /^\/\/@/.test(text) ||
      /^(?:alertcondition|alert|table\.|box\.|line\.|label\.|polyline\.|fill\s*\(|bgcolor\s*\(|barcolor\s*\()/.test(
        text
      )
    ) {
      if (/^(?:table\.|box\.|line\.|label\.)/.test(text)) {
        const prefix = text.split("(")[0];
        if (!warnings.includes(`Skipped TradingView drawing call (${prefix})`)) {
          warnings.push(`Skipped TradingView drawing call (${prefix})`);
        }
      }
      continue;
    }

    closeIndentsTo(indent);

    // Handle `plot(...)`
    const plotMatch = text.match(/^plot\s*\(([\s\S]*)\)$/);
    if (plotMatch) {
      const argObj = buildArgObject(transformExpr(plotMatch[1]), [
        "series",
        "title",
        "color",
        "linewidth",
        "style",
      ]);
      jsLines.push(`__plot("${nextId()}", i, ${argObj});`);
      continue;
    }

    // Handle `plotshape(...)`
    const shapeMatch = text.match(/^plotshape\s*\(([\s\S]*)\)$/);
    if (shapeMatch) {
      const argObj = buildArgObject(transformExpr(shapeMatch[1]), [
        "series",
        "title",
        "style",
        "location",
        "color",
        "offset",
        "text",
        "textcolor",
      ]);
      jsLines.push(`__plotshape("${nextId()}", i, ${argObj});`);
      continue;
    }

    // Handle `plotchar(...)`
    const charMatch = text.match(/^plotchar\s*\(([\s\S]*)\)$/);
    if (charMatch) {
      const argObj = buildArgObject(transformExpr(charMatch[1]), [
        "series",
        "title",
        "char",
        "location",
        "color",
        "offset",
        "text",
      ]);
      jsLines.push(`__plotshape("${nextId()}", i, ${argObj});`);
      continue;
    }

    // Handle `hline(...)`
    const hlineMatch = text.match(/^hline\s*\(([\s\S]*)\)$/);
    if (hlineMatch) {
      const argObj = buildArgObject(transformExpr(hlineMatch[1]), ["price", "title", "color"]);
      jsLines.push(`if (i === 0) __hline(${argObj});`);
      continue;
    }

    // Handle `strategy.entry(...)` -> plots BUY/SELL markers!
    const stratEntry = text.match(/^strategy\.entry\s*\(([\s\S]*)\)$/);
    if (stratEntry) {
      const argObj = buildArgObject(transformExpr(stratEntry[1]), ["id", "direction"]);
      jsLines.push(`__strategyEntry(i, ${argObj});`);
      continue;
    }

    // Handle `strategy.close(...)` / `strategy.exit(...)`
    if (/^strategy\.(?:close|exit|close_all)\s*\(/.test(text)) {
      continue;
    }

    // Handle `if <cond>` block
    const ifMatch = text.match(/^if\s+([\s\S]+)$/);
    if (ifMatch) {
      jsLines.push(`if (${transformExpr(ifMatch[1])}) {`);
      indentStack.push(indent + 1);
      continue;
    }

    // Handle `else if <cond>`
    const elifMatch = text.match(/^else\s+if\s+([\s\S]+)$/);
    if (elifMatch) {
      jsLines.push(`else if (${transformExpr(elifMatch[1])}) {`);
      indentStack.push(indent + 1);
      continue;
    }

    // Handle `else`
    if (text === "else") {
      jsLines.push(`else {`);
      indentStack.push(indent + 1);
      continue;
    }

    // Handle tuple destructuring: `[a, b, c] = expr`
    const tupleMatch = text.match(/^\[\s*([a-zA-Z0-9_,\s]+)\s*\]\s*=\s*([\s\S]+)$/);
    if (tupleMatch) {
      const vars = tupleMatch[1]
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const rhs = transformExpr(tupleMatch[2]);
      const tmp = `__t${++callCounter}`;
      jsLines.push(`const ${tmp} = ${rhs};`);
      vars.forEach((v, idx) => {
        if (v !== "_") {
          declaredVars.add(v);
          historyVars.add(v);
          jsLines.push(`${v} = Array.isArray(${tmp}) ? ${tmp}[${idx}] : NaN; __rec("${v}", i, ${v});`);
        }
      });
      continue;
    }

    // Handle `var [type] name = expr` (persistent across bars!)
    const varMatch = text.match(
      /^var(?:ip)?\s+(?:(?:int|float|bool|string|color)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/
    );
    if (varMatch) {
      const vName = varMatch[1];
      const rhs = transformExpr(varMatch[2]);
      declaredVars.add(vName);
      persistentVars.add(vName);
      historyVars.add(vName);
      jsLines.push(`if (i === 0) { ${vName} = ${rhs}; } __rec("${vName}", i, ${vName});`);
      continue;
    }

    // Handle reassignment: `name := expr`
    const reassignMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:=\s*([\s\S]+)$/);
    if (reassignMatch) {
      const vName = reassignMatch[1];
      const rhs = transformExpr(reassignMatch[2]);
      declaredVars.add(vName);
      historyVars.add(vName);
      jsLines.push(`${vName} = ${rhs}; __rec("${vName}", i, ${vName});`);
      continue;
    }

    // Handle normal declaration/assignment: `[type] name = expr`
    const assignMatch = text.match(
      /^(?:(?:int|float|bool|string|color|series\s+\w+)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)\s*([\s\S]+)$/
    );
    if (assignMatch) {
      const vName = assignMatch[1];
      const rhs = transformExpr(assignMatch[2]);
      declaredVars.add(vName);
      historyVars.add(vName);
      jsLines.push(`${vName} = ${rhs}; __rec("${vName}", i, ${vName});`);
      continue;
    }
  }

  closeIndentsTo(0);

  return {
    name,
    overlay,
    varDecls: Array.from(declaredVars),
    bodyJs: jsLines.join("\n"),
    warnings,
  };
}

// -----------------------------------------------------------------------------
// EXECUTE PINE SCRIPT OR CUSTOM JAVASCRIPT ON LIVE CANDLES
// -----------------------------------------------------------------------------
export function runIndicatorScript(
  code: string,
  candles: Candle[],
  language: "pine" | "js" = "pine",
  overrideOverlay?: boolean
): IndicatorRunResult {
  if (!candles || candles.length === 0) {
    return {
      success: false,
      name: "Indicator",
      overlay: true,
      lines: [],
      markers: [],
      hlines: [],
      warnings: [],
      error: "No candle data loaded yet.",
    };
  }

  const safetyErr = checkSandboxSafety(code);
  if (safetyErr) {
    return {
      success: false,
      name: "Indicator",
      overlay: true,
      lines: [],
      markers: [],
      hlines: [],
      warnings: [],
      error: safetyErr,
    };
  }

  const N = candles.length;
  const openArr = candles.map((c) => c.open);
  const highArr = candles.map((c) => c.high);
  const lowArr = candles.map((c) => c.low);
  const closeArr = candles.map((c) => c.close);
  const volArr = candles.map((c) => c.volume);
  const hl2Arr = candles.map((c) => (c.high + c.low) / 2);
  const hlc3Arr = candles.map((c) => (c.high + c.low + c.close) / 3);
  const ohlc4Arr = candles.map((c) => (c.open + c.high + c.low + c.close) / 4);
  const hlcc4Arr = candles.map((c) => (c.high + c.low + c.close + c.close) / 4);
  const timeArr = candles.map((c) => c.time * 1000);

  // Per-variable history store
  const __h: Record<string, number[]> = {
    open: openArr,
    high: highArr,
    low: lowArr,
    close: closeArr,
    volume: volArr,
    hl2: hl2Arr,
    hlc3: hlc3Arr,
    ohlc4: ohlc4Arr,
    hlcc4: hlcc4Arr,
    time: timeArr,
  };

  const __rec = (name: string, i: number, val: any) => {
    if (!__h[name]) __h[name] = new Array(N).fill(NaN);
    __h[name][i] = typeof val === "number" ? val : val ? 1 : 0;
  };

  const __at = (arr: number[] | undefined, i: number, offset: number): number => {
    if (!arr) return NaN;
    const idx = i - Math.floor(Number(offset) || 0);
    if (idx < 0 || idx >= arr.length) return NaN;
    return arr[idx];
  };

  const __nz = (x: any, rep = 0): number => (x === null || x === undefined || Number.isNaN(Number(x)) ? rep : Number(x));
  const __isNa = (x: any): boolean => x === null || x === undefined || Number.isNaN(Number(x));

  // Stateful TA engine keyed by call-site ID
  const state: Record<string, any> = {};

  const getBuf = (id: string): number[] => {
    if (!state[id]) state[id] = new Array(N).fill(NaN);
    return state[id];
  };

  const __fixnan = (id: string, i: number, val: number): number => {
    const buf = getBuf(id);
    if (!Number.isNaN(val) && val !== null && val !== undefined) {
      buf[i] = val;
      return val;
    }
    const prev = i > 0 ? buf[i - 1] : NaN;
    buf[i] = prev;
    return prev;
  };

  // Precompute True Range & VWAP once
  const trSeries = new Array(N).fill(NaN);
  const vwapSeries = new Array(N).fill(NaN);
  let cumPV = 0;
  let cumV = 0;
  let lastDay = -1;
  for (let k = 0; k < N; k++) {
    const prevC = k > 0 ? closeArr[k - 1] : closeArr[k];
    trSeries[k] = Math.max(
      highArr[k] - lowArr[k],
      Math.abs(highArr[k] - prevC),
      Math.abs(lowArr[k] - prevC)
    );
    const day = Math.floor(candles[k].time / 86400);
    if (day !== lastDay) {
      cumPV = 0;
      cumV = 0;
      lastDay = day;
    }
    cumPV += hlc3Arr[k] * volArr[k];
    cumV += volArr[k];
    vwapSeries[k] = cumV > 0 ? cumPV / cumV : hlc3Arr[k];
  }

  const __ta: Record<string, any> = {
    vwap: (i: number) => vwapSeries[i],
    tr: (i: number) => trSeries[i],

    sma: (id: string, i: number, val: number, length: number) => {
      const len = Math.max(1, Math.floor(length || 14));
      const src = getBuf(id + "_src");
      src[i] = val;
      if (i < len - 1) return NaN;
      let sum = 0;
      for (let k = i - len + 1; k <= i; k++) {
        if (Number.isNaN(src[k])) return NaN;
        sum += src[k];
      }
      return sum / len;
    },

    ema: (id: string, i: number, val: number, length: number) => {
      const len = Math.max(1, Math.floor(length || 14));
      const out = getBuf(id + "_out");
      if (Number.isNaN(val)) {
        out[i] = i > 0 ? out[i - 1] : NaN;
        return out[i];
      }
      const alpha = 2 / (len + 1);
      if (i === 0 || Number.isNaN(out[i - 1])) {
        out[i] = val;
      } else {
        out[i] = alpha * val + (1 - alpha) * out[i - 1];
      }
      return out[i];
    },

    rma: (id: string, i: number, val: number, length: number) => {
      const len = Math.max(1, Math.floor(length || 14));
      const out = getBuf(id + "_out");
      if (Number.isNaN(val)) {
        out[i] = i > 0 ? out[i - 1] : NaN;
        return out[i];
      }
      const alpha = 1 / len;
      if (i === 0 || Number.isNaN(out[i - 1])) {
        out[i] = val;
      } else {
        out[i] = alpha * val + (1 - alpha) * out[i - 1];
      }
      return out[i];
    },

    wma: (id: string, i: number, val: number, length: number) => {
      const len = Math.max(1, Math.floor(length || 14));
      const src = getBuf(id + "_src");
      src[i] = val;
      if (i < len - 1) return NaN;
      let sum = 0;
      let wSum = 0;
      for (let k = 0; k < len; k++) {
        const w = len - k;
        sum += src[i - k] * w;
        wSum += w;
      }
      return sum / wSum;
    },

    vwma: (id: string, i: number, val: number, length: number) => {
      const len = Math.max(1, Math.floor(length || 14));
      const src = getBuf(id + "_src");
      src[i] = val;
      if (i < len - 1) return NaN;
      let num = 0;
      let den = 0;
      for (let k = i - len + 1; k <= i; k++) {
        num += src[k] * volArr[k];
        den += volArr[k];
      }
      return den > 0 ? num / den : NaN;
    },

    rsi: (id: string, i: number, val: number, length: number) => {
      const len = Math.max(1, Math.floor(length || 14));
      const src = getBuf(id + "_src");
      src[i] = val;
      if (i === 0) return NaN;
      const diff = src[i] - src[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      const avgGain = __ta.rma(id + "_g", i, gain, len);
      const avgLoss = __ta.rma(id + "_l", i, loss, len);
      if (i < len) return NaN;
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
    },

    atr: (id: string, i: number, length: number) => {
      return __ta.rma(id + "_atr", i, trSeries[i], length || 14);
    },

    stdev: (id: string, i: number, val: number, length: number) => {
      const len = Math.max(1, Math.floor(length || 20));
      const src = getBuf(id + "_src");
      src[i] = val;
      if (i < len - 1) return NaN;
      let sum = 0;
      for (let k = i - len + 1; k <= i; k++) sum += src[k];
      const mean = sum / len;
      let sq = 0;
      for (let k = i - len + 1; k <= i; k++) sq += (src[k] - mean) ** 2;
      return Math.sqrt(sq / len);
    },

    highest: (id: string, i: number, a: number, b?: number) => {
      const hasSrc = b !== undefined;
      const val = hasSrc ? a : highArr[i];
      const len = Math.max(1, Math.floor(hasSrc ? b! : a));
      const src = getBuf(id + "_src");
      src[i] = val;
      if (i < len - 1) return NaN;
      let m = -Infinity;
      for (let k = i - len + 1; k <= i; k++) if (src[k] > m) m = src[k];
      return m;
    },

    lowest: (id: string, i: number, a: number, b?: number) => {
      const hasSrc = b !== undefined;
      const val = hasSrc ? a : lowArr[i];
      const len = Math.max(1, Math.floor(hasSrc ? b! : a));
      const src = getBuf(id + "_src");
      src[i] = val;
      if (i < len - 1) return NaN;
      let m = Infinity;
      for (let k = i - len + 1; k <= i; k++) if (src[k] < m) m = src[k];
      return m;
    },

    crossover: (id: string, i: number, a: number, b: number) => {
      const ba = getBuf(id + "_a");
      const bb = getBuf(id + "_b");
      ba[i] = a;
      bb[i] = b;
      if (i === 0) return false;
      return ba[i - 1] <= bb[i - 1] && a > b;
    },

    crossunder: (id: string, i: number, a: number, b: number) => {
      const ba = getBuf(id + "_a");
      const bb = getBuf(id + "_b");
      ba[i] = a;
      bb[i] = b;
      if (i === 0) return false;
      return ba[i - 1] >= bb[i - 1] && a < b;
    },

    cross: (id: string, i: number, a: number, b: number) => {
      return __ta.crossover(id + "_up", i, a, b) || __ta.crossunder(id + "_dn", i, a, b);
    },

    supertrend: (id: string, i: number, factor = 3, atrPeriod = 10) => {
      const atrVal = __ta.atr(id + "_atr", i, atrPeriod);
      const upperBand = getBuf(id + "_ub");
      const lowerBand = getBuf(id + "_lb");
      const dir = getBuf(id + "_dir");
      const st = getBuf(id + "_st");

      const src = hl2Arr[i];
      const basicUpper = src + factor * atrVal;
      const basicLower = src - factor * atrVal;

      if (i === 0 || Number.isNaN(upperBand[i - 1])) {
        upperBand[i] = basicUpper;
        lowerBand[i] = basicLower;
        dir[i] = 1;
        st[i] = basicUpper;
        return [st[i], dir[i]];
      }

      lowerBand[i] =
        basicLower > lowerBand[i - 1] || closeArr[i - 1] < lowerBand[i - 1]
          ? basicLower
          : lowerBand[i - 1];
      upperBand[i] =
        basicUpper < upperBand[i - 1] || closeArr[i - 1] > upperBand[i - 1]
          ? basicUpper
          : upperBand[i - 1];

      const prevSt = st[i - 1];
      let d = dir[i - 1];
      if (prevSt === upperBand[i - 1]) {
        d = closeArr[i] > upperBand[i] ? -1 : 1;
      } else {
        d = closeArr[i] < lowerBand[i] ? 1 : -1;
      }
      dir[i] = d;
      st[i] = d === -1 ? lowerBand[i] : upperBand[i];
      return [st[i], dir[i]];
    },

    macd: (id: string, i: number, src: number, fastLen = 12, slowLen = 26, sigLen = 9) => {
      const fast = __ta.ema(id + "_f", i, src, fastLen);
      const slow = __ta.ema(id + "_s", i, src, slowLen);
      const macdLine = fast - slow;
      const sigLine = __ta.ema(id + "_sig", i, macdLine, sigLen);
      const hist = macdLine - sigLine;
      return [macdLine, sigLine, hist];
    },

    bb: (id: string, i: number, src: number, length = 20, mult = 2) => {
      const basis = __ta.sma(id + "_b", i, src, length);
      const dev = mult * __ta.stdev(id + "_d", i, src, length);
      return [basis, basis + dev, basis - dev];
    },

    kc: (id: string, i: number, src: number, length = 20, mult = 1.5) => {
      const basis = __ta.ema(id + "_b", i, src, length);
      const range = mult * __ta.atr(id + "_r", i, length);
      return [basis, basis + range, basis - range];
    },

    stoch: (id: string, i: number, src: number, h: number, l: number, length = 14) => {
      const hh = __ta.highest(id + "_h", i, h, length);
      const ll = __ta.lowest(id + "_l", i, l, length);
      if (hh === ll || Number.isNaN(hh) || Number.isNaN(ll)) return NaN;
      return (100 * (src - ll)) / (hh - ll);
    },

    change: (id: string, i: number, src: number, len = 1) => {
      const buf = getBuf(id + "_src");
      buf[i] = src;
      return i >= len ? src - buf[i - len] : NaN;
    },

    mom: (id: string, i: number, src: number, len = 10) => __ta.change(id, i, src, len),

    roc: (id: string, i: number, src: number, len = 9) => {
      const buf = getBuf(id + "_src");
      buf[i] = src;
      if (i < len || buf[i - len] === 0) return NaN;
      return ((src - buf[i - len]) / buf[i - len]) * 100;
    },

    rising: (id: string, i: number, src: number, len = 1) => {
      const buf = getBuf(id + "_src");
      buf[i] = src;
      if (i < len) return false;
      for (let k = i - len + 1; k <= i; k++) if (buf[k] <= buf[k - 1]) return false;
      return true;
    },

    falling: (id: string, i: number, src: number, len = 1) => {
      const buf = getBuf(id + "_src");
      buf[i] = src;
      if (i < len) return false;
      for (let k = i - len + 1; k <= i; k++) if (buf[k] >= buf[k - 1]) return false;
      return true;
    },

    cum: (id: string, i: number, src: number) => {
      const buf = getBuf(id + "_cum");
      const prev = i > 0 ? buf[i - 1] : 0;
      buf[i] = (Number.isNaN(prev) ? 0 : prev) + (Number.isNaN(src) ? 0 : src);
      return buf[i];
    },

    barssince: (id: string, i: number, cond: boolean) => {
      const buf = getBuf(id + "_bs");
      if (cond) {
        buf[i] = 0;
      } else {
        buf[i] = i > 0 && !Number.isNaN(buf[i - 1]) ? buf[i - 1] + 1 : NaN;
      }
      return buf[i];
    },

    valuewhen: (id: string, i: number, cond: boolean, src: number, occ = 0) => {
      if (!state[id + "_vw"]) state[id + "_vw"] = [];
      const vals: number[] = state[id + "_vw"];
      if (cond) vals.unshift(src);
      return vals[occ] ?? NaN;
    },

    pivothigh: (id: string, i: number, a: number, b: number, c?: number) => {
      const hasSrc = c !== undefined;
      const val = hasSrc ? a : highArr[i];
      const left = Math.max(1, Math.floor(hasSrc ? b : a));
      const right = Math.max(1, Math.floor(hasSrc ? c! : b));
      const buf = getBuf(id + "_ph");
      buf[i] = val;
      const pivotIdx = i - right;
      if (pivotIdx < left) return NaN;
      const candidate = buf[pivotIdx];
      for (let k = pivotIdx - left; k <= i; k++) {
        if (k !== pivotIdx && buf[k] >= candidate) return NaN;
      }
      return candidate;
    },

    pivotlow: (id: string, i: number, a: number, b: number, c?: number) => {
      const hasSrc = c !== undefined;
      const val = hasSrc ? a : lowArr[i];
      const left = Math.max(1, Math.floor(hasSrc ? b : a));
      const right = Math.max(1, Math.floor(hasSrc ? c! : b));
      const buf = getBuf(id + "_pl");
      buf[i] = val;
      const pivotIdx = i - right;
      if (pivotIdx < left) return NaN;
      const candidate = buf[pivotIdx];
      for (let k = pivotIdx - left; k <= i; k++) {
        if (k !== pivotIdx && buf[k] <= candidate) return NaN;
      }
      return candidate;
    },

    linreg: (id: string, i: number, src: number, length = 14, offset = 0) => {
      const len = Math.max(2, Math.floor(length));
      const buf = getBuf(id + "_lr");
      buf[i] = src;
      if (i < len - 1) return NaN;
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumXX = 0;
      for (let k = 0; k < len; k++) {
        const y = buf[i - len + 1 + k];
        sumX += k;
        sumY += y;
        sumXY += k * y;
        sumXX += k * k;
      }
      const slope = (len * sumXY - sumX * sumY) / (len * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / len;
      return intercept + slope * (len - 1 - offset);
    },
  };

  const __math = {
    abs: Math.abs,
    max: Math.max,
    min: Math.min,
    sqrt: Math.sqrt,
    pow: Math.pow,
    log: Math.log,
    exp: Math.exp,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sign: Math.sign,
    avg: (...nums: number[]) => nums.reduce((a, b) => a + b, 0) / (nums.length || 1),
    sum: (a: number, b: number) => a + b,
  };

  const __color: Record<string, any> = {
    ...PINE_COLORS,
    new: (col: string, transp = 0) => hexToRgba(col, transp),
    rgb: (r: number, g: number, b: number, transp = 0) =>
      `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, 1 - transp / 100)).toFixed(2)})`,
  };

  const plotMap = new Map<string, IndicatorLineOutput>();
  const markers: IndicatorMarkerOutput[] = [];
  const hlines: IndicatorHLineOutput[] = [];
  let isOverlay = overrideOverlay ?? true;

  const __plot = (id: string, i: number, args: any) => {
    const val = Number(args.series);
    const col = typeof args.color === "string" ? args.color : "#38bdf8";
    const styleRaw = String(args.style || "line").toLowerCase();
    const style: "line" | "histogram" | "stepline" | "circles" =
      styleRaw.includes("hist") || styleRaw.includes("col")
        ? "histogram"
        : styleRaw.includes("step")
        ? "stepline"
        : styleRaw.includes("circle")
        ? "circles"
        : "line";

    if (!plotMap.has(id)) {
      plotMap.set(id, {
        id,
        title: String(args.title || `Plot ${plotMap.size + 1}`),
        color: col,
        lineWidth: Math.max(1, Math.min(4, Number(args.linewidth || 2))),
        style,
        overlay: isOverlay,
        data: [],
      });
    }
    if (!Number.isNaN(val) && Number.isFinite(val)) {
      plotMap.get(id)!.data.push({
        time: candles[i].time,
        value: Number(val.toFixed(6)),
        color: col,
      });
    }
  };

  const __plotshape = (_id: string, i: number, args: any) => {
    if (!args.series) return;
    const loc = String(args.location || "abovebar").toLowerCase();
    const shp = String(args.style || "circle").toLowerCase();
    const position: "aboveBar" | "belowBar" | "inBar" = loc.includes("below")
      ? "belowBar"
      : loc.includes("in")
      ? "inBar"
      : "aboveBar";
    const shape: "arrowUp" | "arrowDown" | "circle" | "square" = shp.includes("up")
      ? "arrowUp"
      : shp.includes("down")
      ? "arrowDown"
      : shp.includes("square")
      ? "square"
      : "circle";
    const color =
      typeof args.color === "string"
        ? args.color
        : shape === "arrowUp"
        ? "#22c55e"
        : shape === "arrowDown"
        ? "#ef4444"
        : "#38bdf8";
    const text = String(args.text || args.char || args.title || (shape === "arrowUp" ? "BUY" : shape === "arrowDown" ? "SELL" : ""));
    markers.push({
      time: candles[i].time,
      position,
      color,
      shape,
      text,
    });
  };

  const __strategyEntry = (i: number, args: any) => {
    const dir = String(args.direction || "LONG").toUpperCase();
    const isLong = dir === "LONG" || dir === "BUY";
    markers.push({
      time: candles[i].time,
      position: isLong ? "belowBar" : "aboveBar",
      color: isLong ? "#22c55e" : "#ef4444",
      shape: isLong ? "arrowUp" : "arrowDown",
      text: String(args.id || (isLong ? "LONG" : "SHORT")),
    });
  };

  const __hline = (args: any) => {
    const price = Number(args.price);
    if (!Number.isNaN(price) && Number.isFinite(price)) {
      hlines.push({
        price,
        title: String(args.title || `${price}`),
        color: typeof args.color === "string" ? args.color : "#64748b",
        overlay: isOverlay,
      });
    }
  };

  try {
    if (language === "js") {
      // Direct JavaScript indicator mode: user receives (candles, helpers)
      const fn = new Function(
        "candles",
        "ta",
        "plot",
        "marker",
        "hline",
        "window",
        "document",
        "fetch",
        "globalThis",
        `"use strict";\n${code}`
      );
      let jsPlotIdx = 0;
      fn(
        candles,
        __ta,
        (title: string, values: (number | null)[], color = "#38bdf8", lineWidth = 2) => {
          const id = `js_${++jsPlotIdx}`;
          const pts: PlotPoint[] = [];
          for (let i = 0; i < Math.min(candles.length, values.length); i++) {
            const v = values[i];
            if (v !== null && v !== undefined && !Number.isNaN(Number(v))) {
              pts.push({ time: candles[i].time, value: Number(v) });
            }
          }
          plotMap.set(id, {
            id,
            title: title || `Series ${jsPlotIdx}`,
            color,
            lineWidth,
            style: "line",
            overlay: isOverlay,
            data: pts,
          });
        },
        (time: number, text: string, position: "aboveBar" | "belowBar" = "belowBar", color = "#22c55e") => {
          markers.push({
            time,
            position,
            color,
            shape: position === "belowBar" ? "arrowUp" : "arrowDown",
            text,
          });
        },
        (price: number, title = "", color = "#64748b") => {
          hlines.push({ price, title, color, overlay: isOverlay });
        },
        undefined,
        undefined,
        undefined,
        undefined
      );

      return {
        success: true,
        name: "JS Indicator",
        overlay: isOverlay,
        lines: Array.from(plotMap.values()),
        markers,
        hlines,
        warnings: [],
      };
    }

    // Pine Script transpilation + bar-by-bar execution
    const transpiled = transpilePineScript(code);
    isOverlay = overrideOverlay !== undefined ? overrideOverlay : transpiled.overlay;

    const varDeclsCode = transpiled.varDecls.length > 0 ? `let ${transpiled.varDecls.join(", ")};` : "";
    const runnerSource = `
      "use strict";
      ${varDeclsCode}
      for (let i = 0; i < N; i++) {
        const open = openArr[i];
        const high = highArr[i];
        const low = lowArr[i];
        const close = closeArr[i];
        const volume = volArr[i];
        const hl2 = hl2Arr[i];
        const hlc3 = hlc3Arr[i];
        const ohlc4 = ohlc4Arr[i];
        const hlcc4 = hlcc4Arr[i];
        const time = timeArr[i];
        const bar_index = i;
        ${transpiled.bodyJs}
      }
    `;

    const runner = new Function(
      "N",
      "openArr",
      "highArr",
      "lowArr",
      "closeArr",
      "volArr",
      "hl2Arr",
      "hlc3Arr",
      "ohlc4Arr",
      "hlcc4Arr",
      "timeArr",
      "__h",
      "__rec",
      "__at",
      "__nz",
      "__isNa",
      "__fixnan",
      "__ta",
      "__math",
      "__color",
      "__plot",
      "__plotshape",
      "__strategyEntry",
      "__hline",
      "window",
      "document",
      "fetch",
      "globalThis",
      runnerSource
    );

    runner(
      N,
      openArr,
      highArr,
      lowArr,
      closeArr,
      volArr,
      hl2Arr,
      hlc3Arr,
      ohlc4Arr,
      hlcc4Arr,
      timeArr,
      __h,
      __rec,
      __at,
      __nz,
      __isNa,
      __fixnan,
      __ta,
      __math,
      __color,
      __plot,
      __plotshape,
      __strategyEntry,
      __hline,
      undefined,
      undefined,
      undefined,
      undefined
    );

    return {
      success: true,
      name: transpiled.name,
      overlay: isOverlay,
      lines: Array.from(plotMap.values()),
      markers,
      hlines,
      warnings: transpiled.warnings,
    };
  } catch (err: any) {
    return {
      success: false,
      name: "Pine Script Error",
      overlay: isOverlay,
      lines: [],
      markers: [],
      hlines: [],
      warnings: [],
      error: `Compile/Runtime error: ${err.message}`,
    };
  }
}

// -----------------------------------------------------------------------------
// BUILT-IN PRO INDICATOR TEMPLATES (REAL PINE SCRIPT v5 CODE)
// -----------------------------------------------------------------------------
export const PINE_TEMPLATES: { id: string; name: string; overlay: boolean; code: string }[] = [
  {
    id: "ema_cross",
    name: "EMA 9 / 21 Crossover Signals",
    overlay: true,
    code: `//@version=5
indicator("EMA 9 / 21 Cross Signals", overlay=true)
fastLen = input.int(9, title="Fast EMA")
slowLen = input.int(21, title="Slow EMA")
emaFast = ta.ema(close, fastLen)
emaSlow = ta.ema(close, slowLen)
plot(emaFast, title="EMA 9", color=color.aqua, linewidth=2)
plot(emaSlow, title="EMA 21", color=color.orange, linewidth=2)
longSig = ta.crossover(emaFast, emaSlow)
shortSig = ta.crossunder(emaFast, emaSlow)
plotshape(longSig, title="Buy", style=shape.triangleup, location=location.belowbar, color=color.green, text="BUY")
plotshape(shortSig, title="Sell", style=shape.triangledown, location=location.abovebar, color=color.red, text="SELL")`,
  },
  {
    id: "supertrend",
    name: "SuperTrend (10, 3)",
    overlay: true,
    code: `//@version=5
indicator("SuperTrend", overlay=true)
atrPeriod = input.int(10, "ATR Length")
factor = input.float(3.0, "Factor")
[supertrend, direction] = ta.supertrend(factor, atrPeriod)
stColor = direction < 0 ? color.green : color.red
plot(supertrend, title="SuperTrend", color=stColor, linewidth=2)
buySignal = ta.crossunder(direction, 0)
sellSignal = ta.crossover(direction, 0)
plotshape(buySignal, title="Long", style=shape.triangleup, location=location.belowbar, color=color.lime, text="LONG")
plotshape(sellSignal, title="Short", style=shape.triangledown, location=location.abovebar, color=color.red, text="SHORT")`,
  },
  {
    id: "bollinger",
    name: "Bollinger Bands (20, 2)",
    overlay: true,
    code: `//@version=5
indicator("Bollinger Bands", overlay=true)
length = input.int(20, "Length")
mult = input.float(2.0, "Multiplier")
[basis, upper, lower] = ta.bb(close, length, mult)
plot(basis, title="Basis", color=color.yellow, linewidth=1)
plot(upper, title="Upper Band", color=color.blue, linewidth=1)
plot(lower, title="Lower Band", color=color.blue, linewidth=1)`,
  },
  {
    id: "vwap_ema200",
    name: "Session VWAP + EMA 200",
    overlay: true,
    code: `//@version=5
indicator("VWAP + EMA 200", overlay=true)
v = ta.vwap
e200 = ta.ema(close, 200)
plot(v, title="VWAP", color=color.purple, linewidth=2)
plot(e200, title="EMA 200", color=color.white, linewidth=2)`,
  },
  {
    id: "rsi_osc",
    name: "RSI (14) Oscillator",
    overlay: false,
    code: `//@version=5
indicator("RSI (14)", overlay=false)
len = input.int(14, "RSI Length")
r = ta.rsi(close, len)
plot(r, title="RSI", color=color.purple, linewidth=2)
hline(70, title="Overbought", color=color.red)
hline(30, title="Oversold", color=color.green)`,
  },
  {
    id: "macd_osc",
    name: "MACD (12, 26, 9)",
    overlay: false,
    code: `//@version=5
indicator("MACD", overlay=false)
[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)
histColor = histLine >= 0 ? color.teal : color.red
plot(histLine, title="Histogram", color=histColor, style=plot.style_histogram)
plot(macdLine, title="MACD", color=color.blue, linewidth=2)
plot(signalLine, title="Signal", color=color.orange, linewidth=2)
hline(0, title="Zero", color=color.gray)`,
  },
];
