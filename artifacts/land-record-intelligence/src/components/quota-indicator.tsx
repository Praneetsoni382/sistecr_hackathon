import React, { useEffect, useState } from "react";
import { getQuotaStats, QUOTA_LIMITS, QuotaStats, resetQuotaStats } from "../lib/quota-tracker";
import { Gauge, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, RotateCcw } from "lucide-react";
import { useLanguage } from "../lib/language-context";

export function QuotaIndicator() {
  const [stats, setStats] = useState<QuotaStats>(() => getQuotaStats());
  const { t } = useLanguage();

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setStats(detail);
      }
    };
    window.addEventListener("quota_stats_updated", handleUpdate);
    return () => {
      window.removeEventListener("quota_stats_updated", handleUpdate);
    };
  }, []);

  const readPercent = Math.min(100, (stats.reads / QUOTA_LIMITS.reads) * 100);
  const writePercent = Math.min(100, (stats.writes / QUOTA_LIMITS.writes) * 100);

  // Status styling
  let statusColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  let statusText = "System Healthy";
  let StatusIcon = CheckCircle2;

  if (readPercent >= 90) {
    statusColor = "text-red-500 bg-red-500/10 border-red-500/20 animate-pulse";
    statusText = "Critical Quota Alert";
    StatusIcon = ShieldAlert;
  } else if (readPercent >= 70) {
    statusColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
    statusText = "Approaching Quota Limit";
    StatusIcon = AlertTriangle;
  }

  return (
    <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-4 font-sans text-sidebar-foreground shadow-sm">
      <div className="mb-3.5 flex items-center justify-between border-b border-sidebar-border/40 pb-2.5">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-sidebar-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-sidebar-foreground/80">
            {t("Resource Usage Monitor")}
          </span>
        </div>
        <span className="font-mono text-[10px] text-sidebar-foreground/50">{stats.date}</span>
      </div>

      <div className="mb-2 flex justify-end">
        <button
          onClick={() => {
            if (confirm("Reset current session usage counter to 0?")) {
              resetQuotaStats();
            }
          }}
          className="inline-flex items-center gap-1 text-[10px] text-sidebar-foreground/60 hover:text-sidebar-foreground hover:underline transition-colors"
          title="Reset session counter for the fresh database"
        >
          <RotateCcw size={10} /> {t("Reset Session Count")}
        </button>
      </div>

      {/* Main Quota Status Alert */}
      <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${statusColor}`}>
        <StatusIcon size={14} className="shrink-0" />
        <span>{t(statusText)}</span>
      </div>

      {/* Reads Stats */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-medium">
          <span>{t("Daily Reads (Firestore)")}</span>
          <span className="mono text-[11px]">
            {stats.reads.toLocaleString()} / <span className="text-sidebar-foreground/50">{QUOTA_LIMITS.reads.toLocaleString()}</span>
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-sidebar-border/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              readPercent >= 90
                ? "bg-red-500"
                : readPercent >= 70
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${readPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-sidebar-foreground/60">
          <span>{readPercent.toFixed(1)}% {t("of free quota")}</span>
          <span>{t("Reset: Midnight")}</span>
        </div>
      </div>

      {/* Writes Stats */}
      <div className="mt-3.5 space-y-1">
        <div className="flex items-center justify-between text-xs font-medium">
          <span>{t("Daily Writes")}</span>
          <span className="mono text-[11px]">
            {stats.writes.toLocaleString()} / <span className="text-sidebar-foreground/50">{QUOTA_LIMITS.writes.toLocaleString()}</span>
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-sidebar-border/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#f2ba49] transition-all duration-300"
            style={{ width: `${writePercent}%` }}
          />
        </div>
      </div>

      {/* Informational tips */}
      <div className="mt-3.5 rounded-lg bg-sidebar-accent/50 p-2.5 text-[10px] leading-relaxed text-sidebar-foreground/70">
        <div className="flex gap-1.5">
          <HelpCircle size={13} className="shrink-0 text-sidebar-primary" />
          <p>
            This monitor estimates your usage locally to protect against standard Spark plan caps (50,000 reads/day). Keep pages closed when idle.
          </p>
        </div>
      </div>
    </div>
  );
}
