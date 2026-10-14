import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  CloudUpload,
  Database,
  FileText,
  FolderOpen,
  Gauge,
  House,
  Landmark,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  Settings,
  LayoutGrid,
  Scan,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  Clock3,
  Activity as ActivityIcon,
  Cpu,
  RefreshCw,
  AlertTriangle,
  Scale,
  FileCheck2,
  ToggleLeft,
  ToggleRight,
  Eye,
  BookOpen,
  User,
  Edit3,
  Save,
  Volume2,
  Play,
  Mic,
  ChevronLeft,
  Music,
  Camera,
  Info,
  CheckCircle2,
} from "lucide-react";
import { CartoonOfficerAvatar } from "./cartoon-officer-avatar";
import { LiveCameraScannerModal } from "./live-camera-scanner";
import {
  VOICE_PRESETS,
  VoicePresetKey,
  getSelectedVoicePreset,
  setSelectedVoicePreset,
  playScanSpeechNotification,
  getCustomMp3Audio,
  getCustomMp3Filename,
  setCustomMp3Audio,
} from "@/lib/audio-speech";
import { useAppAuth, isClerkConfigured } from "@/lib/auth-context";
import { DEV_OFFICER } from "@/lib/auth";
import type {
  Case,
  CaseDocument,
  DocumentExtraction,
  DocumentType,
  VerificationRun,
  VerificationFieldResult,
  LegacyLandRecord,
  VerifiedLandRecord,
  ProcessingStep,
  AuditLog,
  DashboardSummary,
  VerificationStatus,
  AadhaarVerificationResult,
} from "@/lib/types";
import {
  subscribeCases,
  getCase,
  subscribeCase,
  createCase,
  deleteCasePermanently,
  subscribeCaseDocuments,
  createCaseDocument,
  deleteCaseDocument,
  subscribeProcessingSteps,
  subscribeDocumentExtraction,
  subscribeLegacyLandRecords,
  subscribeVerificationRuns,
  subscribeVerificationFieldResults,
  subscribeVerifiedLandRecords,
  saveVerifiedLandRecord,
  subscribeDashboardSummary,
  subscribeAllLegacyLandRecords,
  subscribeAadhaarVerification,
} from "@/lib/firestore";
import { AadhaarVerificationDashboard } from "./aadhaar-verification-dashboard";
import { uploadDocumentFile } from "@/lib/storage";
import { subscribeRecentAuditLogs, subscribeCaseAuditLogs } from "@/lib/audit";
import { ensureDemoDataSeeded } from "@/lib/seed-data";
import { DocumentScanner } from "./document-scanner";
import { QuotaIndicator } from "./quota-indicator";
import { getQuotaStats, QUOTA_LIMITS, type QuotaStats } from "@/lib/quota-tracker";
import { useSystemCache } from "@/lib/system-cache-context";
import { useLanguage, LanguageToggle } from "@/lib/language-context";
import { calculateFieldSimilarity } from "@/lib/similarity";

const nav = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/cases", label: "Cases", icon: ClipboardList },
  { href: "/records", label: "Verified Records", icon: Database },
  { href: "/existing-records", label: "Existing Records", icon: BookOpen },
  { href: "/audit-trail", label: "Audit trail", icon: Archive },
];

function Mark({ small = false }: { small?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className={`flex items-center gap-2.5 ${small ? "scale-90 origin-left" : ""}`}>
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))] shadow-[0_4px_14px_hsl(var(--accent)/.25)]">
        <Landmark size={19} strokeWidth={2.5} />
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[hsl(var(--sidebar-primary))]" />
      </div>
      <div className="leading-none">
        <div className="text-[13px] font-bold tracking-[.08em] text-[hsl(var(--sidebar-foreground))]">{t("Vision Vault")}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.52)]">
          {t("Land Record Intelligence")}
        </div>
      </div>
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
  testId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "quiet" | "outline" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  testId?: string;
}) {
  const styles = {
    primary: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110 shadow-sm",
    quiet: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))]",
    outline: "border border-[hsl(var(--border))] bg-transparent text-foreground hover:bg-[hsl(var(--secondary))]",
    danger: "bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.16)]",
  };
  return (
    <button
      data-testid={testId}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function PageTitle({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mono mb-2 text-[10px] font-medium uppercase tracking-[.18em] text-[hsl(var(--primary))]">
          {t(eyebrow)}
        </div>
        <h1 className="display text-4xl leading-none text-foreground sm:text-5xl">{t(title)}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t(detail)}</p>
      </div>
      {action}
    </div>
  );
}

function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="state-loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-14 rounded-lg" />
      ))}
    </div>
  );
}

function ErrorState({ message = "We couldn't load this workspace." }: { message?: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] p-6 text-sm" data-testid="state-error">
      <CircleAlert className="mb-3 text-[hsl(var(--destructive))]" size={20} />
      <div className="font-semibold">Connection issue</div>
      <p className="mt-1 text-muted-foreground">{message} Try refreshing when your connection is ready.</p>
    </div>
  );
}

function EmptyState({
  icon: Icon = FolderOpen,
  title,
  detail,
  action,
}: {
  icon?: typeof FolderOpen;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.52)] p-8 text-center" data-testid="state-empty">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
        <Icon size={22} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function VoiceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activePreset, setActivePreset] = useState<VoicePresetKey>(getSelectedVoicePreset());
  const [customMp3Data, setCustomMp3Data] = useState<string | null>(getCustomMp3Audio());
  const [customFilename, setCustomFilename] = useState<string | null>(getCustomMp3Filename());
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSelect = (key: VoicePresetKey) => {
    setActivePreset(key);
    setSelectedVoicePreset(key);
    playScanSpeechNotification(key);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === "string") {
          setCustomMp3Audio(reader.result, file.name);
          setCustomMp3Data(reader.result);
          setCustomFilename(file.name);
          setActivePreset("CUSTOM_MP3");
          setSelectedVoicePreset("CUSTOM_MP3");
          playScanSpeechNotification("CUSTOM_MP3");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveMp3 = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomMp3Audio(null);
    setCustomMp3Data(null);
    setCustomFilename(null);
    if (activePreset === "CUSTOM_MP3") {
      setActivePreset("PROVIDED_OFFICIAL_AUDIO");
      setSelectedVoicePreset("PROVIDED_OFFICIAL_AUDIO");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Top Header with Responsive Back Button */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-5 bg-card shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              data-testid="button-voice-modal-back-header"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary hover:text-foreground transition active:scale-95"
              title="Return to previous screen"
            >
              <ArrowLeft size={15} />
              <span className="font-medium">Back</span>
            </button>

            <div className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
              <Volume2 size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">Scanner Voice Options</h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Select preset or provide custom MP3 audio</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* Hidden File Input for Custom MP3 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/*,.mp3,.wav,.m4a"
            className="hidden"
            onChange={handleFileUpload}
          />

          {VOICE_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.key;
            const isCustom = preset.key === "CUSTOM_MP3";

            return (
              <div
                key={preset.key}
                onClick={() => {
                  if (isCustom && !customMp3Data) {
                    fileInputRef.current?.click();
                  } else {
                    handleSelect(preset.key);
                  }
                }}
                className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border p-3.5 sm:p-4 cursor-pointer transition-all gap-3 ${
                  isSelected
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.06)] shadow-xs"
                    : "border-border bg-card hover:border-[hsl(var(--primary)/.4)] hover:bg-secondary/40"
                }`}
              >
                <div className="space-y-1 flex-1 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{preset.label}</span>
                    {preset.badge && (
                      <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                        {preset.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="rounded-md bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-bold text-slate-950 uppercase">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  
                  {isCustom ? (
                    <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                      {customMp3Data ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Music size={13} />
                          <span className="font-mono text-[11px] truncate max-w-[200px]">
                            {customFilename || "custom-scan-voice.mp3"}
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveMp3}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10 transition"
                            title="Remove MP3"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-500 flex items-center gap-1 font-medium">
                          <Upload size={12} /> Click here to upload your .mp3 audio file
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="font-mono text-xs font-semibold text-amber-500/90 pt-0.5">
                      "{preset.phrase}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isCustom && (
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="text-xs gap-1 h-8"
                    >
                      <Upload size={12} /> {customMp3Data ? "Change MP3" : "Upload MP3"}
                    </Button>
                  )}

                  {(!isCustom || customMp3Data) && (
                    <Button
                      type="button"
                      variant={isSelected ? "accent" : "quiet"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(preset.key);
                      }}
                      className="text-xs gap-1.5 h-8"
                    >
                      <Play size={12} /> {isSelected ? "Playing" : "Preview"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Bottom Footer with Responsive Back Button and Done */}
        <div className="flex items-center justify-between border-t border-border p-3.5 sm:p-4 bg-card shrink-0">
          <Button
            type="button"
            variant="quiet"
            onClick={onClose}
            data-testid="button-voice-modal-back-footer"
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <ChevronLeft size={16} /> Back
          </Button>

          <Button type="button" onClick={onClose} className="px-6 font-semibold text-xs h-9">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
  showDemoToggle?: boolean;
  includeDemo?: boolean;
  onToggleDemo?: () => void;
}) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const { officer } = useAppAuth();
  const { t } = useLanguage();
  const safeName = officer?.fullName || "Development Officer";

  const handleReturnToWorkspace = () => {
    if (location === "/dashboard") {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
      } else {
        setLocation("/");
      }
    } else {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
      } else {
        setLocation("/dashboard");
      }
    }
  };

  return (
    <div className="noise min-h-[100dvh] bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[hsl(var(--sidebar))] px-4 py-5 transition-transform md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-10 px-2">
          <Mark />
        </div>
        <div className="mono px-3 pb-3 text-[9px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.4)]">
          {t("Workspace")}
        </div>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              data-testid={`link-nav-${label.toLowerCase().replace(" ", "-")}`}
              className={`sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                location === href
                  ? "bg-[hsl(var(--sidebar-accent))] font-semibold text-[hsl(var(--sidebar-accent-foreground))]"
                  : "text-[hsl(var(--sidebar-foreground)/.67)] hover:bg-[hsl(var(--sidebar-accent)/.65)] hover:text-[hsl(var(--sidebar-foreground))]"
              }`}
            >
              <Icon size={17} strokeWidth={location === href ? 2.4 : 1.8} />
              <span>{t(label)}</span>
              {location === href && <ChevronRight size={14} className="ml-auto text-[hsl(var(--sidebar-primary))]" />}
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t border-[hsl(var(--sidebar-border))] pt-6">
          <div className="mono px-3 pb-3 text-[9px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.4)]">
            {t("System")}
          </div>
          <Link
            href="/settings"
            data-testid="link-nav-settings"
            className={`sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
              location === "/settings"
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                : "text-[hsl(var(--sidebar-foreground)/.67)] hover:bg-[hsl(var(--sidebar-accent)/.65)]"
            }`}
          >
            <Settings size={17} />
            <span>{t("Settings")}</span>
          </Link>
          <Link
            href="/usage-monitor"
            data-testid="link-nav-usage-monitor"
            className={`sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
              location === "/usage-monitor"
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
                : "text-[hsl(var(--sidebar-foreground)/.67)] hover:bg-[hsl(var(--sidebar-accent)/.65)]"
            }`}
          >
            <Gauge size={17} />
            <span>{t("Firebase Usage Monitor")}</span>
          </Link>
        </div>

        <div className="mt-4 mb-4">
          <QuotaIndicator />
        </div>

        {/* Profile Card in Sidebar - Responsive link to Settings Profile View */}
        <Link
          href="/settings#profile"
          data-testid="link-sidebar-profile"
          title="Open Officer Profile"
          className="group mt-auto block rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.4)] p-2.5 transition hover:border-[hsl(var(--sidebar-primary)/.6)] hover:bg-[hsl(var(--sidebar-accent))] active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <CartoonOfficerAvatar size={36} animated />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[hsl(var(--sidebar))]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-[hsl(var(--sidebar-foreground))] group-hover:text-[hsl(var(--sidebar-primary))] transition-colors">
                {t(safeName)}
              </div>
              <div className="mono mt-0.5 truncate text-[10px] text-[hsl(var(--sidebar-foreground)/.6)]">
                {t(officer?.role || "Revenue Officer")}
              </div>
            </div>
            <ChevronRight size={15} className="text-[hsl(var(--sidebar-foreground)/.4)] group-hover:translate-x-0.5 group-hover:text-[hsl(var(--sidebar-primary))] transition-transform" />
          </div>
        </Link>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close navigation"
          data-testid="button-close-navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[hsl(var(--sidebar)/.5)] md:hidden"
        />
      )}

      <main className="min-h-[100dvh] md:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-4 sm:px-8 backdrop-blur-md">
          {/* Top Left Navigation: Menu + Return to Workspace Button */}
          <div className="flex items-center gap-2.5">
            <button
              aria-label="Open navigation"
              data-testid="button-open-navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu size={20} />
            </button>

            {/* RETURN TO WORKSPACE / PREVIOUS PAGE BUTTON - Always Visible on Top Left */}
            <button
              type="button"
              onClick={handleReturnToWorkspace}
              data-testid="button-return-to-workspace"
              aria-label="Return to Workspace or Previous Page"
              className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-primary/40 hover:bg-secondary hover:text-primary active:scale-95"
              title="Return to Workspace / Previous Page"
            >
              <ArrowLeft size={15} className="text-primary transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">{t("Return to Workspace")}</span>
              <span className="sm:hidden">{t("Return")}</span>
            </button>

            <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex ml-2">
              <ShieldCheck size={15} className="text-[hsl(var(--primary))]" />
              <span className="font-semibold text-foreground">{t("Vision Vault")}</span>
              <span className="mx-1 text-border">·</span> {t("Land Record Intelligence")}
            </div>
          </div>

          {/* Top Right: Language Toggle + Status + Voice Settings + Responsive Profile Icon Button */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LanguageToggle />

            <button
              type="button"
              onClick={() => setVoiceModalOpen(true)}
              data-testid="button-scan-voice-options"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-500 active:scale-95"
              title="Change Scanner Voice Option"
            >
              <Volume2 size={14} className="text-amber-500" />
              <span className="hidden sm:inline">{t("Scan Voice")}</span>
            </button>

            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
              <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
              {t("System Ready")}
            </div>
            <Link
              href="/settings#profile"
              data-testid="link-header-profile"
              title="Open Officer Profile"
              className="group flex items-center gap-2 rounded-full border border-border bg-card p-1 pr-3 text-xs font-semibold text-foreground shadow-2xs transition hover:border-primary/50 hover:bg-secondary/60 hover:text-primary active:scale-95"
            >
              <CartoonOfficerAvatar size={34} animated />
              <div className="hidden text-left sm:block">
                <div className="max-w-[130px] truncate text-xs font-semibold leading-none group-hover:text-primary transition-colors">
                  {t(safeName)}
                </div>
                <div className="mt-0.5 text-[9px] text-muted-foreground leading-none">
                  {t(officer?.role || "Revenue Officer")}
                </div>
              </div>
            </Link>
          </div>
        </header>
        <div className="page-enter mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12">{children}</div>
      </main>

      <VoiceSettingsModal open={voiceModalOpen} onClose={() => setVoiceModalOpen(false)} />
    </div>
  );
}

function CadastralSurveyBackgroundMap() {
  // Pre-calculated coordinates for subtle tiny shimmering starry background dots
  const shimmerDots = [
    { x: 45, y: 75, r: 1.2, color: "#93c5fd", dur: "3.2s", delay: "0s" },
    { x: 110, y: 190, r: 1.0, color: "#fef08a", dur: "4.5s", delay: "0.8s" },
    { x: 180, y: 95, r: 1.4, color: "#bae6fd", dur: "2.8s", delay: "1.4s" },
    { x: 260, y: 280, r: 1.1, color: "#ffffff", dur: "3.9s", delay: "0.3s" },
    { x: 340, y: 140, r: 1.3, color: "#fde047", dur: "5.1s", delay: "2.1s" },
    { x: 420, y: 310, r: 0.9, color: "#7dd3fc", dur: "3.4s", delay: "1.1s" },
    { x: 490, y: 110, r: 1.5, color: "#ffffff", dur: "4.1s", delay: "0.5s" },
    { x: 560, y: 240, r: 1.0, color: "#fef08a", dur: "3.6s", delay: "1.9s" },
    { x: 630, y: 80, r: 1.2, color: "#38bdf8", dur: "4.8s", delay: "0.2s" },
    { x: 710, y: 290, r: 1.4, color: "#ffffff", dur: "2.9s", delay: "1.7s" },
    { x: 790, y: 130, r: 1.0, color: "#fde047", dur: "4.3s", delay: "0.9s" },
    { x: 860, y: 220, r: 1.3, color: "#bae6fd", dur: "3.7s", delay: "2.4s" },
    { x: 930, y: 65, r: 1.1, color: "#ffffff", dur: "5.0s", delay: "1.3s" },
    { x: 1010, y: 180, r: 1.5, color: "#fef08a", dur: "3.1s", delay: "0.7s" },
    { x: 1080, y: 310, r: 1.0, color: "#7dd3fc", dur: "4.6s", delay: "2.0s" },
    { x: 1160, y: 115, r: 1.3, color: "#ffffff", dur: "3.5s", delay: "0.4s" },
    { x: 1240, y: 250, r: 1.2, color: "#fde047", dur: "4.0s", delay: "1.6s" },
    { x: 1320, y: 90, r: 1.4, color: "#38bdf8", dur: "3.3s", delay: "2.7s" },
    { x: 1390, y: 210, r: 1.1, color: "#ffffff", dur: "4.7s", delay: "1.0s" },
    // Lower quadrant dots
    { x: 60, y: 460, r: 1.1, color: "#fef08a", dur: "3.8s", delay: "1.2s" },
    { x: 135, y: 620, r: 1.3, color: "#7dd3fc", dur: "4.4s", delay: "0.6s" },
    { x: 210, y: 510, r: 1.0, color: "#ffffff", dur: "3.0s", delay: "2.2s" },
    { x: 295, y: 740, r: 1.4, color: "#fde047", dur: "5.2s", delay: "1.5s" },
    { x: 375, y: 590, r: 1.2, color: "#bae6fd", dur: "3.6s", delay: "0.1s" },
    { x: 460, y: 810, r: 1.0, color: "#ffffff", dur: "4.2s", delay: "2.5s" },
    { x: 530, y: 670, r: 1.3, color: "#fef08a", dur: "2.7s", delay: "0.9s" },
    { x: 615, y: 520, r: 1.1, color: "#38bdf8", dur: "4.9s", delay: "1.8s" },
    { x: 695, y: 760, r: 1.5, color: "#ffffff", dur: "3.3s", delay: "0.4s" },
    { x: 770, y: 630, r: 1.0, color: "#fde047", dur: "4.1s", delay: "2.0s" },
    { x: 845, y: 840, r: 1.2, color: "#7dd3fc", dur: "3.5s", delay: "1.1s" },
    { x: 920, y: 570, r: 1.4, color: "#ffffff", dur: "4.7s", delay: "0.3s" },
    { x: 1005, y: 710, r: 1.1, color: "#fef08a", dur: "3.1s", delay: "2.6s" },
    { x: 1075, y: 860, r: 1.3, color: "#bae6fd", dur: "5.3s", delay: "1.4s" },
    { x: 1150, y: 540, r: 1.0, color: "#ffffff", dur: "3.9s", delay: "0.7s" },
    { x: 1225, y: 780, r: 1.4, color: "#fde047", dur: "4.3s", delay: "1.9s" },
    { x: 1305, y: 620, r: 1.2, color: "#38bdf8", dur: "2.9s", delay: "0.5s" },
    { x: 1380, y: 750, r: 1.1, color: "#ffffff", dur: "4.5s", delay: "2.3s" },
    { x: 1420, y: 480, r: 1.3, color: "#fef08a", dur: "3.7s", delay: "1.3s" },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* Navy Dark Blue Base with Cadastral Blueprint Golden Vector Grid */}
      <svg
        className="absolute inset-0 w-full h-full object-cover opacity-85"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Deep Navy Dark Blue Radial Gradient */}
          <radialGradient id="navyDarkBaseGrad" cx="50%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#0d234d" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#081838" stopOpacity="0.95" />
            <stop offset="75%" stopColor="#051026" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#030a18" stopOpacity="1" />
          </radialGradient>

          <linearGradient id="goldRoadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5c862" stopOpacity="0.88" />
            <stop offset="50%" stopColor="#d4a337" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#9b7320" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="plotBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#eab338" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#7a5513" stopOpacity="0.28" />
          </linearGradient>
          <radialGradient id="navyFadeLeft" cx="20%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#040c1c" stopOpacity="0.94" />
            <stop offset="45%" stopColor="#06142e" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#0a2048" stopOpacity="0.25" />
          </radialGradient>
        </defs>

        {/* Background Deep Navy Dark Blue Base */}
        <rect width="1440" height="900" fill="url(#navyDarkBaseGrad)" />

        {/* Subtle Ambient Navy Spotlight Blobs */}
        <circle cx="280" cy="220" r="320" fill="#13336c" opacity="0.18" filter="blur(60px)" />
        <circle cx="1120" cy="380" r="380" fill="#153b7c" opacity="0.22" filter="blur(70px)" />
        <circle cx="700" cy="750" r="300" fill="#0f2b60" opacity="0.16" filter="blur(50px)" />

        {/* Subtle Tiny Shimmering Star Dots */}
        <g id="shimmering-dots">
          {shimmerDots.map((dot, idx) => (
            <circle
              key={idx}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill={dot.color}
            >
              <animate
                attributeName="opacity"
                values="0.15;0.9;0.15"
                dur={dot.dur}
                begin={dot.delay}
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values={`${dot.r * 0.8};${dot.r * 1.35};${dot.r * 0.8}`}
                dur={dot.dur}
                begin={dot.delay}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {/* Diagonal Arterial Cadastral Avenues (Double Gold Lines) */}
        <g stroke="url(#goldRoadGrad)" fill="none">
          {/* Main Diagonal Highway 1 */}
          <path d="M-100,200 L1600,1050" strokeWidth="4.5" strokeOpacity="0.68" />
          <path d="M-90,220 L1610,1070" strokeWidth="1.5" strokeOpacity="0.42" />

          {/* Diagonal Road 2 */}
          <path d="M200,-100 L1650,750" strokeWidth="3.5" strokeOpacity="0.62" />
          <path d="M215,-85 L1665,765" strokeWidth="1.2" strokeOpacity="0.38" />

          {/* Transverse Cross Avenues */}
          <path d="M600,-100 L-100,800" strokeWidth="3" strokeOpacity="0.58" />
          <path d="M1100,-100 L300,950" strokeWidth="3.5" strokeOpacity="0.62" />
          <path d="M1500,50 L750,950" strokeWidth="3" strokeOpacity="0.58" />
          <path d="M1600,450 L1050,950" strokeWidth="2.5" strokeOpacity="0.52" />
        </g>

        {/* Geometric Cadastral Parcel Blocks */}
        <g stroke="url(#plotBorderGrad)" strokeWidth="1.2" fill="none">
          {/* Plot Block Cluster Right Top */}
          <polygon points="780,80 920,150 860,260 720,190" fill="rgba(212,163,55,0.035)" />
          <polygon points="940,160 1080,230 1020,340 880,270" fill="rgba(212,163,55,0.045)" />
          <polygon points="1100,240 1240,310 1180,420 1040,350" fill="rgba(212,163,55,0.035)" />
          <polygon points="1260,320 1400,390 1340,500 1200,430" fill="rgba(212,163,55,0.055)" />

          {/* Plot Subdivisions and Internal Survey Lines */}
          <line x1="850" y1="115" x2="790" y2="225" strokeDasharray="3 3" />
          <line x1="1010" y1="195" x2="950" y2="305" strokeDasharray="3 3" />
          <line x1="1170" y1="275" x2="1110" y2="385" strokeDasharray="3 3" />
          <line x1="1330" y1="355" x2="1270" y2="465" strokeDasharray="3 3" />

          {/* Plot Block Cluster Center Right */}
          <polygon points="620,280 760,350 700,460 560,390" fill="rgba(212,163,55,0.045)" />
          <polygon points="780,360 920,430 860,540 720,470" fill="rgba(212,163,55,0.055)" />
          <polygon points="940,440 1080,510 1020,620 880,550" fill="rgba(212,163,55,0.045)" />
          <polygon points="1100,520 1240,590 1180,700 1040,630" fill="rgba(212,163,55,0.055)" />
          <polygon points="1260,600 1400,670 1340,780 1200,710" fill="rgba(212,163,55,0.045)" />

          {/* Lower Plot Cluster */}
          <polygon points="680,560 820,630 760,740 620,670" fill="rgba(212,163,55,0.035)" />
          <polygon points="840,640 980,710 920,820 780,750" fill="rgba(212,163,55,0.045)" />
          <polygon points="1000,720 1140,790 1080,900 940,830" fill="rgba(212,163,55,0.035)" />
          <polygon points="1160,800 1300,870 1240,980 1100,910" fill="rgba(212,163,55,0.045)" />

          {/* Additional Intersecting Parcel Survey Vectors */}
          <line x1="450" y1="0" x2="1350" y2="900" strokeWidth="1" strokeOpacity="0.4" />
          <line x1="750" y1="0" x2="1650" y2="900" strokeWidth="1" strokeOpacity="0.35" />
          <line x1="150" y1="0" x2="1050" y2="900" strokeWidth="1" strokeOpacity="0.3" />
        </g>

        {/* Survey Markers & Diamond Crosses on Intersections */}
        {[
          [780, 80], [920, 150], [860, 260], [1080, 230], [1240, 310],
          [760, 350], [920, 430], [1080, 510], [1240, 590], [820, 630],
          [980, 710], [1140, 790], [1300, 870], [600, 200], [1150, 120]
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x}, ${y})`}>
            {/* 4-point Diamond Star Survey Marker */}
            <path
              d="M0,-5 L1.5,-1.5 L5,0 L1.5,1.5 L0,5 L-1.5,1.5 L-5,0 L-1.5,-1.5 Z"
              fill="#f5c862"
              opacity="0.88"
            />
            <circle cx="0" cy="0" r="1" fill="#fff" />
          </g>
        ))}

        {/* Large Decorative 4-Point Shimmering Star at Bottom Right */}
        <g transform="translate(1310, 830)">
          <path
            d="M0,-24 Q0,-3 24,0 Q3,0 0,24 Q0,3 -24,0 Q-3,0 0,-24 Z"
            fill="#f5c862"
            opacity="0.7"
          />
          <circle cx="0" cy="0" r="3" fill="#ffffff" />
        </g>

        {/* Navy Vignette Overlay on Left to keep hero typography 100% crisp & readable */}
        <rect width="1440" height="900" fill="url(#navyFadeLeft)" />
      </svg>
    </div>
  );
}

function AshokaEmblem() {
  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        viewBox="0 0 100 110"
        className="h-11 w-11 text-[#b38938] drop-shadow-xs"
        fill="currentColor"
      >
        {/* Ashoka Lion Capital stylized vector */}
        <path d="M50 8 C46 8 43 11 43 15 C43 18 45 20 48 21 C45 23 42 27 42 32 C42 36 45 40 48 42 C44 44 41 48 41 53 C41 57 43 60 46 62 C43 64 41 68 41 73 L59 73 C59 68 57 64 54 62 C57 60 59 57 59 53 C59 48 56 44 52 42 C55 40 58 36 58 32 C58 27 55 23 52 21 C55 20 57 18 57 15 C57 11 54 8 50 8 Z" opacity="0.95" />
        {/* Left Lion Head */}
        <path d="M36 22 C32 22 29 25 29 29 C29 33 32 36 35 37 C32 39 30 43 30 47 C30 52 33 55 37 57 L41 53 C38 51 36 48 36 45 C36 42 38 40 40 38 L38 34 C36 33 35 31 35 29 C35 27 36 25 38 24 Z" opacity="0.9" />
        {/* Right Lion Head */}
        <path d="M64 22 C68 22 71 25 71 29 C71 33 68 36 65 37 C68 39 70 43 70 47 C70 52 67 55 63 57 L59 53 C62 51 64 48 64 45 C64 42 62 40 60 38 L62 34 C64 33 65 31 65 29 C65 27 64 25 62 24 Z" opacity="0.9" />
        {/* Abacus Base with Ashoka Chakra Wheel */}
        <rect x="24" y="74" width="52" height="8" rx="2" fill="#b38938" />
        <circle cx="50" cy="78" r="3.5" fill="#FAF9F5" stroke="#b38938" strokeWidth="1" />
        <circle cx="50" cy="78" r="1" fill="#b38938" />
        <rect x="28" y="84" width="44" height="4" rx="1" fill="#b38938" opacity="0.8" />
        {/* Satyameva Jayate Devnagari styling hint */}
        <text x="50" y="98" fontSize="7" textAnchor="middle" fontFamily="serif" fontWeight="bold" fill="#b38938" letterSpacing="0.5">
          सत्यमेव जयते
        </text>
      </svg>
    </div>
  );
}

function CadastralBlueprintSketchSvg() {
  return (
    <div className="relative w-full rounded-md border border-sky-800/30 bg-sky-950/5 p-2 font-mono text-[9px] text-sky-900 dark:text-sky-800">
      <svg viewBox="0 0 240 130" className="w-full h-auto text-sky-800/90" fill="none" stroke="currentColor" strokeWidth="1">
        {/* Coordinate Axes */}
        <line x1="15" y1="115" x2="15" y2="10" strokeWidth="1.2" />
        <polygon points="15,6 12,12 18,12" fill="currentColor" />
        <text x="8" y="16" fontSize="8" fill="currentColor" fontWeight="bold">y</text>

        <line x1="15" y1="115" x2="225" y2="115" strokeWidth="1.2" />
        <polygon points="230,115 224,112 224,118" fill="currentColor" />
        <text x="220" y="125" fontSize="8" fill="currentColor" fontWeight="bold">x</text>

        {/* Plot 7A / 7B / 7C Subdivided Parcel Area */}
        <rect x="30" y="25" width="80" height="75" strokeWidth="1.2" fill="rgba(56, 189, 248, 0.05)" />
        <line x1="30" y1="65" x2="110" y2="65" strokeDasharray="3 2" />
        <line x1="70" y1="25" x2="70" y2="100" strokeDasharray="3 2" />
        
        {/* Parcel Labels & Hatching */}
        <text x="45" y="48" fontSize="8" fill="currentColor" fontWeight="bold">7.A</text>
        <text x="85" y="48" fontSize="8" fill="currentColor" fontWeight="bold">7.B</text>
        <text x="85" y="85" fontSize="8" fill="currentColor" fontWeight="bold">7.C</text>
        
        {/* Dimension Lines */}
        <line x1="30" y1="18" x2="110" y2="18" strokeWidth="0.75" />
        <text x="65" y="15" fontSize="7" fill="currentColor" textAnchor="middle">18.5m</text>
        
        <line x1="118" y1="25" x2="118" y2="100" strokeWidth="0.75" />
        <text x="122" y="65" fontSize="7" fill="currentColor">15.0m</text>

        {/* Adjacent Layout Plan */}
        <rect x="145" y="25" width="70" height="75" strokeWidth="1.2" fill="rgba(56, 189, 248, 0.03)" />
        <line x1="145" y1="55" x2="195" y2="55" strokeWidth="0.75" />
        <line x1="175" y1="55" x2="175" y2="100" strokeWidth="0.75" />
        <rect x="180" y="65" width="25" height="25" strokeWidth="0.75" strokeDasharray="2 2" />
        <circle cx="160" cy="40" r="4" strokeWidth="0.75" />
        <text x="180" y="112" fontSize="7" fill="currentColor" textAnchor="middle" fontWeight="bold" letterSpacing="0.5">
          BLUEPRINT SKETCH
        </text>
      </svg>
    </div>
  );
}

{/* 3D FRAMER MOTION ANIMATED LAND DEED DOCUMENT COMPONENT */}
function LandDeedDocument3D({
  isStandalone = false,
  className = "",
}: {
  isStandalone?: boolean;
  className?: string;
}) {
  const [isScanning, setIsScanning] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateZ: -4 }}
      animate={{
        opacity: 1,
        y: [-6, 6, -6],
        rotateZ: isStandalone ? [-0.5, 0.5, -0.5] : [-2.4, -1.2, -2.4],
        rotateX: [1.2, -1.2, 1.2],
      }}
      transition={{
        y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
        rotateZ: { duration: 6, repeat: Infinity, ease: "easeInOut" },
        rotateX: { duration: 6, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: 0.6 },
      }}
      whileHover={{
        scale: 1.025,
        rotateZ: 0,
        rotateX: 0,
        transition: { duration: 0.3 },
      }}
      className={`relative z-10 rounded-xs bg-[#FAF9F5] p-6 sm:p-7 text-slate-900 shadow-[0_30px_90px_rgba(0,0,0,0.85),0_15px_35px_rgba(0,0,0,0.5)] border border-slate-300 transition-all duration-300 ${
        isStandalone ? "w-full max-w-[430px]" : "w-[320px] sm:w-[380px] xl:w-[410px]"
      } ${className}`}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {/* Laser OCR Scanning Line Animation */}
      {isScanning && (
        <motion.div
          animate={{
            top: ["0%", "96%", "0%"],
            opacity: [0.3, 0.9, 0.3],
          }}
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="pointer-events-none absolute left-0 right-0 z-30 h-[2.5px] bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_12px_rgba(245,158,11,0.8)]"
        />
      )}

      {/* Ashoka National Seal Header */}
      <AshokaEmblem />

      <div className="mt-2 text-center">
        <h2 className="font-serif text-lg sm:text-xl font-bold tracking-widest text-slate-900 uppercase">
          LAND DEED
        </h2>
        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#8c6b23] font-semibold mt-0.5">
          LAND RECORD VERIFICATION
        </div>
      </div>

      {/* Simulated Official Legal Text */}
      <div className="mt-4 space-y-2 text-[8.5px] sm:text-[9px] leading-relaxed text-slate-700 font-serif">
        <p className="font-medium text-slate-800 italic">
          Welcome here land record verification
        </p>
        <p className="line-clamp-2">
          Welcome the government purchases land from citizens, official officers must carefully verify before releasing compensation.
        </p>
        <div className="text-[7.5px] text-slate-500 font-mono tracking-tighter">
          ............. official officers, official record search .............
          <br />
          ...........................................................................................
        </div>
        <p className="line-clamp-2 text-[7.5px] sm:text-[8px] text-slate-600">
          We the need accord to set per mutation order act expedients registration throughout the district. The revenue office coordinates and holds unalterable confirmation.
        </p>
      </div>

      {/* Cadastral Blueprint / Sketch */}
      <div className="mt-3.5">
        <CadastralBlueprintSketchSvg />
      </div>

      {/* Official Certified Seal */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-[7px] font-mono text-slate-500 uppercase tracking-widest">
        <span>LATERAL SURVEY RECORD REGISTERED</span>
        <span className="font-bold text-[#8c6b23]">OFFICIAL REVENUE DIVISION</span>
      </div>

      {isStandalone && (
        <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[8px] font-mono text-emerald-700 font-bold">
            <Check size={10} /> Certified Document
          </span>
          <button
            type="button"
            onClick={() => setIsScanning(!isScanning)}
            className="text-[8px] font-mono font-semibold text-[#8c6b23] hover:underline"
          >
            {isScanning ? "Pause Scan Beam" : "Start Scan Beam"}
          </button>
        </div>
      )}
    </motion.div>
  );
}

{/* 3D FRAMER MOTION ANIMATED SMARTPHONE MOBILE SCREEN COMPONENT */}
function MobileScreenDevice3D({
  isStandalone = false,
  className = "",
}: {
  isStandalone?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateZ: 5 }}
      animate={{
        opacity: 1,
        y: [7, -7, 7],
        rotateZ: isStandalone ? [0.5, -0.5, 0.5] : [3.2, 4.5, 3.2],
        rotateX: [-1.8, 1.8, -1.8],
      }}
      transition={{
        y: { duration: 4.8, repeat: Infinity, ease: "easeInOut" },
        rotateZ: { duration: 5.2, repeat: Infinity, ease: "easeInOut" },
        rotateX: { duration: 5.2, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: 0.6, delay: 0.1 },
      }}
      whileHover={{
        scale: 1.04,
        rotateZ: 1.5,
        rotateX: 0,
        transition: { duration: 0.3 },
      }}
      className={`relative z-20 rounded-[38px] border-[5px] border-slate-800 bg-slate-950 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.95),0_0_30px_rgba(56,189,248,0.2)] ring-1 ring-white/15 backdrop-blur-2xl transition-all duration-300 ${
        isStandalone ? "w-full max-w-[310px]" : "w-[230px] sm:w-[255px]"
      } ${className}`}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {/* Dynamic Island / Top Speaker Notch */}
      <div className="mx-auto mb-3 h-4 w-20 rounded-full bg-black border border-slate-800 flex items-center justify-center shadow-inner">
        <div className="h-2 w-2 rounded-full bg-slate-900 border border-slate-700 mr-2" />
        <div className="h-1.5 w-1.5 rounded-full bg-blue-950" />
      </div>

      {/* Phone Screen Internal UI */}
      <div className="space-y-2.5 font-sans">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 px-1">
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="h-2 w-2 rounded-full bg-emerald-400"
            />
            <span className="font-mono text-[9px] font-bold text-cyan-400 uppercase tracking-wider">
              3D VERIFICATION ENGINE
            </span>
          </div>
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[8px] font-bold text-amber-300 border border-amber-500/30 shadow-xs">
            REALTIME
          </span>
        </div>

        {/* Parameter Progress Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="text-[8.5px] font-mono text-slate-400">Cadastral Revenue Parameters</div>
            <span className="font-mono text-[8px] text-emerald-400 font-bold">100%</span>
          </div>
          <div className="mt-0.5 text-base font-bold text-white font-serif">14 Fields Mapped</div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            />
          </div>
        </div>

        {/* Verification Checklist Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 shadow-inner">
          <div className="flex items-center justify-between text-[8.5px] font-mono font-semibold text-slate-300 mb-1.5">
            <span>Verification Pipeline</span>
            <span className="text-[8px] text-cyan-400 font-mono">5/5 Passed</span>
          </div>
          <div className="space-y-1 text-[9px]">
            {[
              { label: "Field", status: "Verified" },
              { label: "Fields", status: "Verified" },
              { label: "Revenue", status: "Verified" },
              { label: "Data Field", status: "Verified" },
              { label: "Title", status: "Verified" },
            ].map((row, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center justify-between rounded bg-slate-950/70 px-2 py-1 border border-slate-800/60 transition-colors hover:border-slate-700"
              >
                <span className="text-slate-300">{row.label}</span>
                <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-emerald-400">
                  <Check size={10} className="stroke-[3]" /> {row.status}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Zero Hallucination Pill */}
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-2 py-1 text-center font-mono text-[8.5px] font-semibold text-cyan-300 shadow-xs">
          Zero-Hallucination OCR
        </div>

        {/* Verification Keys Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-[8px] font-mono text-slate-300 space-y-1">
          <div className="text-[8.5px] font-bold text-cyan-400 flex items-center justify-between pb-0.5 border-b border-slate-800">
            <span>VERIFICATION KEYS</span>
            <FileText size={10} />
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="text-emerald-400">🔑</span>
            <span>Verification Key: #OV-A123-B</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <ShieldCheck size={9} className="text-cyan-400 shrink-0" />
            <span>Verification Key: #OV-A123-C</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="text-amber-400">🔑</span>
            <span>Verification Key: #OV-A123-D</span>
          </div>
        </div>

      </div>

      {isStandalone && (
        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[8px] font-mono text-cyan-400">● Live Encrypted Ledger</span>
          <span className="text-[8px] font-mono text-slate-400">Latency: 14ms</span>
        </div>
      )}
    </motion.div>
  );
}

export function PublicHome() {
  const enterHref = "/dashboard";
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [heroViewMode, setHeroViewMode] = useState<"composite" | "document" | "mobile">("composite");

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -6, y: x * 6 });
  };

  const handleContainerMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={handleContainerMouseLeave}
      className="relative min-h-[100dvh] bg-[#040b18] bg-gradient-to-b from-[#081736] via-[#051126] to-[#030914] text-white overflow-x-hidden selection:bg-amber-400 selection:text-slate-950 font-sans"
    >
      {/* Cadastral Blueprint Golden Vector Grid Background with Shimmering Dots */}
      <CadastralSurveyBackgroundMap />

      {/* Top Navbar Header */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-10">
        {/* Left Branding */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#f2ba49] via-[#e2a838] to-[#c78b20] text-slate-950 shadow-[0_0_25px_rgba(226,168,56,0.45)]">
            <ShieldCheck size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-serif text-2xl font-bold tracking-tight text-white drop-shadow-md">Vision Vault</span>
              <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-amber-300">
                V1.2
              </span>
            </div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-amber-400/90">
              LAND RECORD INTELLIGENCE
            </p>
          </div>
        </div>

        {/* Right Action: Bold & Highly Visible Enter Officer Workspace Button */}
        <Link
          href={enterHref}
          data-testid="link-public-enter-workspace-top"
          className="group relative inline-flex items-center gap-2.5 rounded-xl bg-[#e5b342] hover:bg-[#f2c254] px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-[0_0_30px_rgba(229,179,66,0.45)] transition-all hover:scale-[1.03] active:scale-[0.98]"
        >
          <LayoutGrid size={16} className="text-slate-950 stroke-[2.5]" />
          <span className="tracking-tight">Enter Officer Workspace</span>
          <ArrowRight size={16} className="text-slate-950 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      {/* Main Hero Section with 3D Perspective Tilt and Side-by-Side Objects */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-6 sm:px-10 sm:pt-10">
        <div
          className="transition-transform duration-300 ease-out grid lg:grid-cols-[1.05fr_1.15fr] gap-10 lg:gap-12 items-center"
          style={{
            transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          {/* Left Column Text & Controls */}
          <div>
            {/* Eyebrow Badge */}
            <div className="mb-6 sm:mb-8 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-mono font-bold tracking-wider text-amber-300 uppercase backdrop-blur-md shadow-[0_0_15px_rgba(226,168,56,0.2)]">
              <span className="text-amber-400">#</span>
              <span>AI-POWERED TITLE & REVENUE RECONCILIATION</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-serif text-5xl sm:text-7xl lg:text-[84px] font-normal tracking-tight text-white leading-[1.04] drop-shadow-xl">
              The verified <br />
              record <br />
              <span className="italic text-[#e5b854] font-serif underline decoration-[#e5b854]/60 decoration-2 underline-offset-8">
                holds its
              </span>{" "}
              <br />
              <span className="italic text-[#e5b854] font-serif">
                ground.
              </span>
            </h1>

            {/* Subtitle Description */}
            <div className="mt-6 sm:mt-8 max-w-2xl space-y-3.5 text-base sm:text-lg font-bold leading-relaxed text-slate-100 tracking-normal antialiased drop-shadow-md">
              <p className="font-bold text-white leading-relaxed">
                When the government purchases land from citizens, official officers must carefully verify every document before releasing compensation.
              </p>
              <p className="font-bold text-slate-200 text-sm sm:text-base leading-relaxed">
                Right now, this means manually checking thousands of scanned paper deeds and handwritten records—causing huge delays and mistakes. Our AI platform solves this bottleneck using a multi-stage validation engine with human-in-the-loop verification, transforming weeks of error-prone paperwork into instant, reliable digital records.
              </p>
            </div>

            {/* Workflow Pipeline Line */}
            <div className="mt-8 sm:mt-10 font-mono text-xs sm:text-sm font-medium tracking-wide text-amber-300/90 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span>document ingestion</span>
              <span className="text-amber-500/40">|</span>
              <span>extraction</span>
              <span className="text-amber-500/40">|</span>
              <span>cross record verification</span>
              <span className="text-amber-500/40">|</span>
              <span>existing database verification</span>
              <span className="text-amber-500/40">|</span>
              <span>human approval</span>
            </div>

            {/* Action Buttons */}
            <div className="mt-10 sm:mt-12 flex flex-wrap items-center gap-4">
              <Link
                href={enterHref}
                data-testid="link-public-enter-workspace-hero"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-[#e5b342] hover:bg-[#f2c254] px-7 py-3.5 text-sm sm:text-base font-bold text-slate-950 shadow-[0_0_35px_rgba(229,179,66,0.45)] transition-all hover:scale-[1.03] active:scale-[0.98]"
              >
                <LayoutGrid size={18} className="text-slate-950 stroke-[2.5]" />
                <span>Enter Officer Workspace</span>
                <ArrowRight size={18} className="text-slate-950 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href={enterHref}
                data-testid="link-public-scan-sample-hero"
                className="inline-flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-slate-900/60 px-6 py-3.5 text-sm sm:text-base font-semibold text-amber-200 backdrop-blur-md transition-all hover:bg-slate-800/80 hover:border-amber-400 hover:text-white shadow-lg"
              >
                <Scan size={18} className="text-amber-400" />
                <span>Scan Sample Deed</span>
              </Link>
            </div>
          </div>

          {/* Right Column: 3D Animated Land Deed Document + 3D Smartphone Verification Object */}
          <div className="relative select-none mt-10 lg:mt-0">
            {/* View Mode Switcher Header */}
            <div className="mb-4 flex items-center justify-center lg:justify-end gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-2">
                3D Perspective:
              </span>
              <button
                type="button"
                onClick={() => setHeroViewMode("composite")}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition ${
                  heroViewMode === "composite"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                Composite (Reference)
              </button>
              <button
                type="button"
                onClick={() => setHeroViewMode("document")}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition ${
                  heroViewMode === "document"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                Land Deed
              </button>
              <button
                type="button"
                onClick={() => setHeroViewMode("mobile")}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition ${
                  heroViewMode === "mobile"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                Mobile Engine
              </button>
            </div>

            <div className="relative mx-auto flex items-center justify-center min-h-[580px] sm:min-h-[640px]">
              <AnimatePresence mode="wait">
                {heroViewMode === "composite" && (
                  <motion.div
                    key="composite"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="relative flex items-center justify-center w-full"
                  >
                    {/* OBJECT 1: Physical Parchment Land Deed Document */}
                    <LandDeedDocument3D />

                    {/* OBJECT 2: 3D Floating Smartphone Frame with Live Verification Engine UI */}
                    <MobileScreenDevice3D className="absolute -right-2 sm:right-2 xl:right-6 top-6 sm:top-10" />
                  </motion.div>
                )}

                {heroViewMode === "document" && (
                  <motion.div
                    key="document-only"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center w-full"
                  >
                    <LandDeedDocument3D isStandalone />
                    <p className="mt-4 font-mono text-xs text-amber-300/80">
                      Isolated Physical Land Deed with Cadastral Coordinates & Ashoka Seal
                    </p>
                  </motion.div>
                )}

                {heroViewMode === "mobile" && (
                  <motion.div
                    key="mobile-only"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center w-full"
                  >
                    <MobileScreenDevice3D isStandalone />
                    <p className="mt-4 font-mono text-xs text-cyan-300/80">
                      Isolated Edge Mobile Engine with Realtime 14-Field Revenue Pipeline
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* DEDICATED SEPARATE SHOWCASE SECTION: LAND DEED & MOBILE SCREEN */}
        <section className="mt-28 border-t border-amber-500/20 pt-16">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-mono font-bold tracking-wider text-amber-300 uppercase">
              <Sparkles size={14} className="text-amber-400" />
              <span>3D DUAL-ENGINE ARCHITECTURE</span>
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-serif font-bold text-white">
              Parchment Deed Meets Live Mobile Intelligence
            </h2>
            <p className="mt-3 text-sm text-slate-300 font-sans">
              Experience the transition from centuries-old cadastral deed parchment to real-time, zero-hallucination optical verification on officer edge devices.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-stretch">
            
            {/* SEPARATE COMPONENT 1: Land Deed Document Showcase Card */}
            <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-[#0a1c3f]/90 via-[#071632]/95 to-[#040e22] p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-blue-900/40">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-amber-400">01</span>
                    <span className="font-serif text-lg font-bold text-white">Land Deed Document</span>
                  </div>
                  <span className="font-mono text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
                    Physical Source
                  </span>
                </div>

                <p className="mt-4 text-xs text-slate-300 leading-relaxed">
                  Authentic parchment deed layout modeled after official revenue registry documents. Features the Ashoka National Seal, statutory declaration clauses, coordinate dimensions, and CAD blueprint partitioning.
                </p>
              </div>

              {/* 3D Render Canvas for Deed */}
              <div className="my-8 flex justify-center items-center min-h-[420px] py-4 bg-[#030914]/60 rounded-xl border border-blue-900/30 p-4">
                <LandDeedDocument3D isStandalone />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-blue-900/40 font-mono text-[11px]">
                <div className="rounded-lg bg-[#06142e]/90 p-2.5 border border-blue-900/40">
                  <div className="text-slate-400 text-[9px] uppercase">Cadastral Grid</div>
                  <div className="font-bold text-white mt-0.5">18.5m × 15.0m</div>
                </div>
                <div className="rounded-lg bg-[#06142e]/90 p-2.5 border border-blue-900/40">
                  <div className="text-slate-400 text-[9px] uppercase">Legal Status</div>
                  <div className="font-bold text-amber-300 mt-0.5">Registered Title</div>
                </div>
              </div>
            </div>

            {/* SEPARATE COMPONENT 2: Mobile Verification Engine Showcase Card */}
            <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-[#0a1c3f]/90 via-[#071632]/95 to-[#040e22] p-8 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between pb-4 border-b border-blue-900/40">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-cyan-400">02</span>
                    <span className="font-serif text-lg font-bold text-white">Mobile Verification Engine</span>
                  </div>
                  <span className="font-mono text-[10px] text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded-full uppercase">
                    Edge Terminal
                  </span>
                </div>

                <p className="mt-4 text-xs text-slate-300 leading-relaxed">
                  Real-time officer verification interface featuring dynamic 14-parameter field extraction, automated cross-record baseline checks, zero-hallucination guardrails, and cryptographic audit signatures.
                </p>
              </div>

              {/* 3D Render Canvas for Mobile */}
              <div className="my-8 flex justify-center items-center min-h-[420px] py-4 bg-[#030914]/60 rounded-xl border border-blue-900/30 p-4">
                <MobileScreenDevice3D isStandalone />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-blue-900/40 font-mono text-[11px]">
                <div className="rounded-lg bg-[#06142e]/90 p-2.5 border border-blue-900/40">
                  <div className="text-slate-400 text-[9px] uppercase">Processing Latency</div>
                  <div className="font-bold text-emerald-400 mt-0.5">&lt; 1.2s Optical OCR</div>
                </div>
                <div className="rounded-lg bg-[#06142e]/90 p-2.5 border border-blue-900/40">
                  <div className="text-slate-400 text-[9px] uppercase">Audit Security</div>
                  <div className="font-bold text-cyan-300 mt-0.5">SHA-256 Encrypted</div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Supporting Architecture Cards in Dark Navy */}
        <section id="architecture" className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              num: "01",
              title: "Multi-Deed OCR Ingestion",
              desc: "Store original deeds securely. High-precision optical scanning analyzes layout, extracts revenue fields, and tags document types.",
            },
            {
              num: "02",
              title: "Cross-Record Verification",
              desc: "Automated engine correlates seller/buyer names, Khasra numbers, and parcel areas against governmental registry baselines.",
            },
            {
              num: "03",
              title: "Officer Approval & Audit",
              desc: "Revenue officers designate verified land records with full audit trail tracking, maintaining institutional accountability.",
            },
          ].map((item) => (
            <div
              key={item.num}
              className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#091b3d]/85 via-[#06142f]/90 to-[#030b1a]/95 p-7 backdrop-blur-md transition-all hover:border-amber-500/50 hover:scale-[1.02] shadow-xl group"
            >
              <div className="font-mono text-xs font-bold text-amber-400">{item.num}</div>
              <h2 className="mt-4 text-lg font-bold text-white font-serif group-hover:text-amber-200 transition-colors">
                {item.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-300 font-sans">{item.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto flex max-w-7xl flex-wrap justify-between gap-4 border-t border-amber-500/20 px-6 py-8 text-xs font-mono text-slate-400 sm:px-10">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-amber-400" />
          <span>Vision Vault V1.2 · Land Record Intelligence</span>
        </div>
        <span>Authorized Revenue Officer Access Only</span>
      </footer>
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const { t } = useLanguage();
  const safeStatus = status || "DRAFT";
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    PROCESSING: "Processing",
    READY_FOR_VERIFICATION: "Ready for Verification",
    VERIFIED: "Verified",
    MANUAL_REVIEW: "Review Required",
    INCONSISTENT: "Inconsistent",
  };
  const isVerified = safeStatus === "VERIFIED";
  const isWarning = safeStatus === "MANUAL_REVIEW" || safeStatus === "INCONSISTENT";
  const rawLabel = labels[safeStatus] || safeStatus;
  return (
    <span
      data-testid={`status-case-${safeStatus.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        safeStatus === "DRAFT"
          ? "bg-[hsl(var(--secondary))] text-muted-foreground"
          : isVerified
          ? "bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"
          : isWarning
          ? "bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]"
          : "bg-[hsl(var(--accent)/.18)] text-[hsl(var(--foreground))]"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(rawLabel)}
    </span>
  );
}

function CaseForm({ onClose, onCreated }: { onClose: () => void; onCreated?: (c: Case) => void }) {
  const [form, setForm] = useState({
    projectName: "",
    district: "",
    village: "",
    acquisitionReference: "",
    description: "",
  });
  const [busy, setBusy] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await createCase({
        projectName: form.projectName,
        district: form.district,
        village: form.village,
        acquisitionReference: form.acquisitionReference,
        description: form.description,
        isDemo: false,
      });
      if (onCreated) onCreated(created);
      onClose();
    } catch (err) {
      console.error("Case creation failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--sidebar)/.55)] p-0 sm:items-center sm:p-6">
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-card p-6 shadow-2xl sm:rounded-2xl sm:p-8">
        <div className="mb-7 flex items-start justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">New intake</div>
            <h2 className="display mt-2 text-3xl">Establish a case</h2>
          </div>
          <button data-testid="button-close-case-form" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              Project name
              <input
                data-testid="input-case-project-name"
                required
                value={form.projectName}
                onChange={update("projectName")}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                placeholder="e.g. North Canal Extension"
              />
            </label>
            <label className="text-sm font-semibold">
              District
              <input
                data-testid="input-case-district"
                required
                value={form.district}
                onChange={update("district")}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                placeholder="District"
              />
            </label>
            <label className="text-sm font-semibold">
              Village
              <input
                data-testid="input-case-village"
                required
                value={form.village}
                onChange={update("village")}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                placeholder="Village"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Acquisition reference<span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              <input
                data-testid="input-case-reference"
                value={form.acquisitionReference}
                onChange={update("acquisitionReference")}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                placeholder="Notification or file reference"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Description<span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              <textarea
                data-testid="input-case-description"
                value={form.description}
                onChange={update("description")}
                className="focus-ring mt-2 min-h-24 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none"
                placeholder="What should another officer know at intake?"
              />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} testId="button-submit-case">
              {busy ? "Creating…" : "Create draft case"} <ArrowRight size={15} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteCaseModal({
  targetCase,
  onClose,
  onDeleted,
}: {
  targetCase: Case | null;
  onClose: () => void;
  onDeleted?: (caseId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  if (!targetCase) return null;

  async function handleDelete() {
    if (!targetCase) return;
    setDeleting(true);
    setErrorNotice(null);
    try {
      await deleteCasePermanently(targetCase.id);
      if (onDeleted) onDeleted(targetCase.id);
      onClose();
    } catch (err: any) {
      console.warn("Notice during case deletion:", err);
      // Remove locally from UI state
      if (onDeleted) onDeleted(targetCase.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive shadow-sm">
            <Trash2 size={24} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Permanently Delete Case?
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-foreground">{targetCase.caseNumber}</strong> ({targetCase.projectName})?
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive space-y-1.5">
          <div className="font-semibold flex items-center gap-1.5 text-destructive">
            <AlertTriangle size={14} /> Irreversible Database Purge
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            This operation will permanently delete this case and all its associated source deeds, OCR extractions, verification runs, verified land records, and audit logs from all database collections.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            testId="button-confirm-delete-case"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Purging Case...
              </>
            ) : (
              <>
                <Trash2 size={14} /> Delete Case Permanently
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) {
    return "Good morning.";
  } else if (hour >= 12 && hour < 17) {
    return "Good afternoon.";
  } else {
    return "Good evening.";
  }
}

export function DashboardPage() {
  const { cases, summary, activity, loading, setCases } = useSystemCache();
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);
  const { t } = useLanguage();

  return (
    <WorkspaceShell>
      <PageTitle
        eyebrow="Officer overview"
        title={getTimeGreeting()}
        detail="Your land record intelligence intake desk. Ingest original deeds, verify attributes, and track institutional determinations."
        action={
          <div className="flex items-center gap-2.5">
            <LanguageToggle />
            <Link
              href="/cases"
              data-testid="link-dashboard-cases"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110"
            >
              <Plus size={16} /> {t("New case")}
            </Link>
          </div>
        }
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open cases" value={summary.totalCases} detail="Active intake records" icon={ClipboardList} />
        <Kpi label="Source documents" value={summary.documentsUploaded} detail="Uploaded to cases" icon={FileText} />
        <Kpi label="Documents processed" value={summary.documentsProcessed} detail="Analyzed & extracted" icon={Clock3} />
        <Kpi
          label="Requires review"
          value={summary.recordsRequiringReview}
          detail="Pending officer audit"
          icon={CircleAlert}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-xl border border-card-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{t("Recent cases")}</div>
              <h2 className="mt-1 text-lg font-semibold">{t("Intake Queue")}</h2>
            </div>
            <Link href="/cases" data-testid="link-dashboard-all-cases" className="text-xs font-semibold text-[hsl(var(--primary))]">
              {t("View all")} <ArrowRight className="ml-1 inline" size={13} />
            </Link>
          </div>
          {loading ? (
            <LoadingRows rows={3} />
          ) : cases.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t("No cases in the queue")}
              detail={t("Start with a draft case to give your first source documents a home.")}
              action={
                <Link href="/cases" data-testid="link-dashboard-empty-cases" className="font-semibold text-[hsl(var(--primary))]">
                  {t("Open cases")} <ArrowRight className="ml-1 inline" size={14} />
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {cases.slice(0, 5).map((item) => (
                <CaseRow
                  key={item.id}
                  item={item}
                  onDelete={(c) => setCaseToDelete(c)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-card-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <ActivityIcon size={16} className="text-[hsl(var(--primary))]" />
            <div>
              <div className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{t("Recent activity")}</div>
              <h2 className="mt-1 text-lg font-semibold">{t("Operational feed")}</h2>
            </div>
          </div>
          {!activity?.length ? (
            <EmptyState icon={ActivityIcon} title={t("No recent operations")} detail={t("Audit actions and pipeline runs will appear as your intake advances.")} />
          ) : (
            <div className="space-y-5">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-3" data-testid={`activity-${a.id}`}>
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--accent))]" />
                  <div>
                    <p className="text-sm font-semibold">{t(a.description)}</p>
                    <p className="mono mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                      {t(a.action)} · {relativeTime(a.timestamp?.toDate ? a.timestamp.toDate() : a.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-7 border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            {t("Verified Single Source of Truth")}
            <span className="float-right mono text-[9px] uppercase">{t("Vision Vault")}</span>
          </div>
        </section>
      </div>

      {caseToDelete && (
        <DeleteCaseModal
          targetCase={caseToDelete}
          onClose={() => setCaseToDelete(null)}
          onDeleted={(id) => setCases((prev) => prev.filter((c) => c.id !== id))}
        />
      )}
    </WorkspaceShell>
  );
}

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof ClipboardList;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="mono text-[10px] uppercase tracking-[.13em] text-muted-foreground">{t(label)}</div>
        <Icon size={17} className="text-[hsl(var(--primary))]" />
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{t(detail)}</div>
    </div>
  );
}

function CaseRow({ item, onDelete }: { item: Case; onDelete?: (item: Case) => void }) {
  const { t } = useLanguage();
  return (
    <div className="group flex items-center justify-between gap-3 py-3 px-2 rounded-lg hover:bg-muted/40 transition">
      <Link
        href={`/cases/${item.id}`}
        data-testid={`link-case-${item.id}`}
        className="min-w-0 flex-1 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold flex items-center gap-2 group-hover:text-[hsl(var(--primary))] transition-colors">
            {t(item.projectName)}
          </div>
          <div className="mono mt-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {item.caseNumber} · {t(item.district)} / {t(item.village)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusPill status={item.status} />
          <ChevronRight size={15} className="text-muted-foreground" />
        </div>
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(item);
          }}
          data-testid={`button-delete-case-dash-${item.id}`}
          title="Permanently Delete Case"
          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors shrink-0"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function relativeTime(date: any): string {
  if (!date) return "just now";
  try {
    let d: Date;
    if (typeof date?.toDate === "function") {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === "object" && date !== null && typeof date.seconds === "number") {
      d = new Date(date.seconds * 1000);
    } else {
      d = new Date(date);
    }
    if (isNaN(d.getTime())) return "just now";
    const diff = Date.now() - d.getTime();
    if (diff < 0) return "just now";
    const mins = Math.max(1, Math.round(diff / 60000));
    return mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hr ago` : `${Math.round(mins / 1440)} days ago`;
  } catch {
    return "just now";
  }
}

function formatDate(date: any, fallback = "Active intake"): string {
  if (!date) return fallback;
  try {
    let d: Date;
    if (typeof date?.toDate === "function") {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === "object" && date !== null && typeof date.seconds === "number") {
      d = new Date(date.seconds * 1000);
    } else {
      d = new Date(date);
    }
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
  } catch {
    return fallback;
  }
}

function formatDateTime(date: any, fallback = "Just now"): string {
  if (!date) return fallback;
  try {
    let d: Date;
    if (typeof date?.toDate === "function") {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === "object" && date !== null && typeof date.seconds === "number") {
      d = new Date(date.seconds * 1000);
    } else {
      d = new Date(date);
    }
    return isNaN(d.getTime()) ? fallback : d.toLocaleString();
  } catch {
    return fallback;
  }
}

export function CasesPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);
  const { cases, loading, setCases } = useSystemCache();
  const { t } = useLanguage();

  const filtered = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(
      (c) =>
        String(c.projectName || "").toLowerCase().includes(q) ||
        String(c.caseNumber || "").toLowerCase().includes(q) ||
        String(c.district || "").toLowerCase().includes(q) ||
        String(c.village || "").toLowerCase().includes(q) ||
        String(c.acquisitionReference || "").toLowerCase().includes(q)
    );
  }, [cases, search]);

  return (
    <WorkspaceShell>
      <PageTitle
        eyebrow="Case register"
        title="Cases"
        detail="Search the intake register, open a case workspace, or establish a new acquisition."
        action={
          <div className="flex items-center gap-2.5">
            <LanguageToggle />
            <Button onClick={() => setShowForm(true)} testId="button-new-case">
              <Plus size={16} /> {t("New case")}
            </Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="relative block w-full max-w-md">
          <Search className="absolute left-3 top-3 text-muted-foreground" size={17} />
          <input
            data-testid="input-case-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="focus-ring h-11 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm outline-none"
            placeholder={t("Search by case number, village, project...")}
          />
        </label>
        <div className="flex items-center gap-4">
          <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {filtered.length} {t("records")}
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingRows />
      ) : filtered.length ? (
        <div className="overflow-hidden rounded-xl border border-card-border bg-card">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_140px_48px_40px] gap-4 border-b border-border bg-secondary/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>{t("Case")}</span>
            <span>{t("Location")}</span>
            <span>{t("Reference")}</span>
            <span>{t("Status")}</span>
            <span className="text-right pr-2">{t("Delete")}</span>
            <span />
          </div>
          {filtered.map((item) => (
            <div
              key={item.id}
              data-testid={`row-case-${item.id}`}
              className="data-row grid gap-2 border-b border-border px-5 py-4 last:border-0 md:grid-cols-[1.4fr_1fr_1fr_140px_48px_40px] md:items-center md:gap-4 group hover:bg-secondary/30 transition"
            >
              <Link
                href={`/cases/${item.id}`}
                data-testid={`link-case-${item.id}`}
                className="min-w-0"
              >
                <div className="text-sm font-semibold flex items-center gap-2 group-hover:text-[hsl(var(--primary))] transition-colors">
                  {t(item.projectName)}
                </div>
                <div className="mono mt-1 text-[10px] text-muted-foreground">{item.caseNumber}</div>
              </Link>
              <Link href={`/cases/${item.id}`} className="text-sm text-muted-foreground">
                {t(item.district)} <span className="text-border">/</span> {t(item.village)}
              </Link>
              <Link href={`/cases/${item.id}`} className="text-sm text-muted-foreground">
                {t(item.acquisitionReference) || "—"}
              </Link>
              <Link href={`/cases/${item.id}`}>
                <StatusPill status={item.status} />
              </Link>
              <div className="flex justify-end">
                <button
                  type="button"
                  data-testid={`button-delete-case-${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCaseToDelete(item);
                  }}
                  title="Permanently delete case"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <Link href={`/cases/${item.id}`} className="hidden md:flex justify-end text-muted-foreground hover:text-foreground">
                <ChevronRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={search ? "No matching cases" : "Your register is clear"}
          detail={search ? "Try another project name or district." : "Create a draft case to begin organizing source documents."}
          action={
            !search && (
              <Button onClick={() => setShowForm(true)}>
                <Plus size={16} /> Establish first case
              </Button>
            )
          }
        />
      )}
      {showForm && <CaseForm onClose={() => setShowForm(false)} />}
      {caseToDelete && (
        <DeleteCaseModal
          targetCase={caseToDelete}
          onClose={() => setCaseToDelete(null)}
          onDeleted={(id) => {
            setCases((prev) => prev.filter((c) => c.id !== id));
          }}
        />
      )}
    </WorkspaceShell>
  );
}

function SingleUploadZone({ caseId, onUploaded }: { caseId: string; onUploaded?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [docType, setDocType] = useState<DocumentType>("SALE_DEED");
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  // Auto-detect document type from filename
  function detectDocType(fileName: string): DocumentType {
    const name = fileName.toLowerCase();
    if (name.includes("khasra") || name.includes("khatauni") || name.includes("7-12") || name.includes("b1")) {
      return "KHASRA_RECORD";
    }
    if (name.includes("mutation") || name.includes("namantaran") || name.includes("ferfar")) {
      return "MUTATION_RECORD";
    }
    if (name.includes("reg") || name.includes("index") || name.includes("sub-registrar")) {
      return "REGISTRATION_RECORD";
    }
    if (name.includes("cert") || name.includes("certificate") || name.includes("ownership")) {
      return "OWNERSHIP_CERTIFICATE";
    }
    return "SALE_DEED";
  }

  async function handleFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    setUploadSuccess(null);
    setProgress(10);

    try {
      const fileList = Array.from(files);
      const total = fileList.length;

      for (let i = 0; i < total; i++) {
        const file = fileList[i];
        const inferredType = docType !== "SALE_DEED" ? docType : detectDocType(file.name);
        const docId = `doc-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;

        const basePct = Math.round((i / total) * 90);
        setProgress(basePct + 10);

        const { storagePath, fileUrl } = await uploadDocumentFile({
          caseId,
          documentId: docId,
          file,
          onProgress: (p) => setProgress(basePct + Math.round((p / 100) * (80 / total))),
        });

        console.log("[DOCUMENT RETRIEVAL TRACE] Creating CaseDocument record in Firestore:", {
          caseId,
          docId,
          fileName: file.name,
          storagePath,
          fileUrl: fileUrl ? (fileUrl.length > 80 ? `${fileUrl.substring(0, 80)}...` : fileUrl) : "NONE",
          fileSize: file.size,
          mimeType: file.type || "application/pdf",
          isDemo: false,
        });

        await createCaseDocument({
          id: docId,
          caseId,
          documentType: inferredType,
          fileName: file.name,
          storagePath,
          fileUrl,
          fileSize: file.size,
          mimeType: file.type || "application/pdf",
          isDemo: false,
        });
      }

      setProgress(100);
      setUploadSuccess(
        fileList.length === 1
          ? `Uploaded "${fileList[0].name}" successfully. Click "Process with Gemini" below.`
          : `Uploaded ${fileList.length} documents successfully. Click "Process with Gemini" on each document or use "Process All".`
      );

      if (inputRef.current) inputRef.current.value = "";
      if (onUploaded) onUploaded();
    } catch (err: any) {
      console.error("Direct upload error:", err);
      setError("Document upload encountered an issue. Please try selecting the file(s) again.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 2500);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-dashed border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.03)] p-6 transition hover:border-[hsl(var(--primary)/.6)]">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center text-center"
      >
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))] shadow-sm">
          <CloudUpload size={24} />
        </div>
        
        <h3 className="text-base font-semibold text-foreground">
          {t("Upload Land Record Source Documents")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-md">
          {t("Drag & drop your Sale Deed, Khasra, Mutation, or Registry (PDF, JPG, PNG) — multiple files supported.")}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <span>{t("Type:")}</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              disabled={busy}
              className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-normal outline-none focus-ring"
            >
              <option value="SALE_DEED">{t("Sale Deed / Registry Deed")}</option>
              <option value="KHASRA_RECORD">{t("Khasra / Khatauni Record")}</option>
              <option value="MUTATION_RECORD">{t("Mutation / Namantaran Order")}</option>
              <option value="OWNERSHIP_CERTIFICATE">{t("Ownership Certificate")}</option>
              <option value="REGISTRATION_RECORD">{t("Sub-Registrar Record")}</option>
              <option value="UNKNOWN">{t("Auto-detect from file")}</option>
            </select>
          </label>

          <input
            ref={inputRef}
            id="single-file-upload-input"
            data-testid="input-direct-document-file"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />

          <Button
            type="button"
            disabled={busy}
            testId="button-select-file-direct"
            onClick={() => inputRef.current?.click()}
            className="px-5 shadow-sm"
          >
            {busy ? (
              <>
                <RefreshCw size={15} className="animate-spin" /> {t("Uploading Documents…")}
              </>
            ) : (
              <>
                <Upload size={15} /> {t("Select Document(s) to Upload")}
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            testId="button-open-live-camera-scan"
            onClick={() => setShowCameraScanner(true)}
            className="px-4 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2 shadow-xs transition active:scale-95"
          >
            <Camera size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>{t("Live Document Scan")}</span>
          </Button>
        </div>

        {/* Live Camera Scanner Modal */}
        <LiveCameraScannerModal
          caseId={caseId}
          isOpen={showCameraScanner}
          onClose={() => setShowCameraScanner(false)}
          onUploaded={onUploaded}
          defaultDocType={docType}
        />

        {busy && progress > 0 && (
          <div className="mt-4 w-full max-w-xs">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>{t("Saving documents…")}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--primary))] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))]">
            <Check size={14} />
            {t(uploadSuccess)}
          </div>
        )}

        {error && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--destructive)/.1)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--destructive))]">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentRow({
  item,
  onDelete,
  onProcess,
  onView,
  isSelected,
  isProcessing,
}: {
  item: CaseDocument;
  onDelete: () => void;
  onProcess: () => void;
  onView: () => void;
  isSelected: boolean;
  isProcessing: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const isQuota = item.errorMessage?.includes("Quota") || item.errorMessage?.includes("429");
  const { t } = useLanguage();

  return (
    <div
      className={`grid grid-cols-[44px_minmax(180px,1.6fr)_minmax(150px,1.2fr)_115px_minmax(210px,1.2fr)_60px] items-center gap-4 border-b border-border px-5 py-3.5 last:border-0 transition-colors ${
        isSelected ? "bg-[hsl(var(--secondary)/.4)]" : "hover:bg-secondary/20"
      }`}
    >
      <div className="mono text-xs font-semibold text-muted-foreground text-center">
        {String(item.serialNumber).padStart(2, "0")}
      </div>
      
      {/* Filename with dedicated truncation and icon */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground border border-border/50">
          <FileText size={16} className="text-primary/70" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-foreground" title={item.fileName}>
            {t(item.fileName)}
          </div>
          <div className="mono mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
            {formatSize(item.fileSize)} · {item.mimeType?.split("/")[1] || "doc"}
          </div>
        </div>
      </div>

      {/* Document Type with clear badge */}
      <div className="min-w-0">
        {item.documentType === "IRRELEVANT_NON_LAND_RECORD" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
            <AlertTriangle size={11} /> {t("Irrelevant Non-Land")}
          </span>
        ) : (
          <span className="inline-block rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground whitespace-nowrap border border-border/40">
            {t((item.documentType || "SALE_DEED").replace(/_/g, " "))}
          </span>
        )}
      </div>

      {/* Status Pill */}
      <div className="whitespace-nowrap">
        {item.status === "COMPLETED" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <Check size={12} />
            {t("Extracted")}
          </span>
        ) : item.status === "PROCESSING" || isProcessing ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 border border-blue-500/20">
            <RefreshCw size={11} className="animate-spin" />
            {t("Extracting")}
          </span>
        ) : item.status === "FAILED" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300 border border-red-500/20">
            <AlertTriangle size={11} />
            {isQuota ? t("Quota Hit") : t("Failed")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary)/.1)] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--primary))] border border-[hsl(var(--primary)/.2)]">
            <Check size={12} />
            {t("Uploaded")}
          </span>
        )}
      </div>

      {/* Gemini Action */}
      <div className="whitespace-nowrap">
        {item.status === "COMPLETED" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid={`button-view-extracted-${item.id}`}
              onClick={onView}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.08)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.15)] transition"
            >
              <Eye size={13} /> {t("View Attributes")}
            </button>
            <button
              type="button"
              data-testid={`button-reprocess-gemini-${item.id}`}
              onClick={onProcess}
              title="Re-extract attributes with Gemini"
              className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            >
              <RefreshCw size={11} /> {t("Re-extract")}
            </button>
          </div>
        ) : item.status === "PROCESSING" || isProcessing ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--accent)/.15)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--accent))]">
            <RefreshCw size={13} className="animate-spin" /> {t("Extracting…")}
          </span>
        ) : item.status === "FAILED" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid={`button-retry-gemini-${item.id}`}
              onClick={onProcess}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 transition"
            >
              <RefreshCw size={12} /> {t("Retry")}
            </button>
            {item.errorMessage && (
              <span className="truncate text-[10px] text-muted-foreground max-w-[120px]" title={item.errorMessage}>
                {t(item.errorMessage)}
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            data-testid={`button-process-gemini-${item.id}`}
            onClick={onProcess}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-xs transition hover:opacity-90 active:scale-95"
          >
            <Sparkles size={13} /> {t("Process with Gemini")}
          </button>
        )}
      </div>

      {/* Row Delete Action */}
      <div className="flex items-center justify-end">
        {confirm ? (
          <div className="flex items-center gap-1">
            <button
              data-testid={`button-confirm-delete-${item.id}`}
              onClick={onDelete}
              className="rounded p-1 text-[hsl(var(--destructive))] hover:bg-destructive/15"
              title="Confirm Delete"
            >
              <Check size={15} />
            </button>
            <button
              data-testid={`button-cancel-delete-${item.id}`}
              onClick={() => setConfirm(false)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary"
              title="Cancel"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            data-testid={`button-delete-document-${item.id}`}
            onClick={() => setConfirm(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
            title="Delete document"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number) {
  if (!bytes) return "0 KB";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CaseWorkspacePage({ caseId }: { caseId: string }) {
  const [, setLocation] = useLocation();
  const [item, setItem] = useState<Case | null>(null);
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const { t } = useLanguage();
  const [legacyRecords, setLegacyRecords] = useState<LegacyLandRecord[]>([]);
  const [verificationRuns, setVerificationRuns] = useState<VerificationRun[]>([]);
  const [fieldResults, setFieldResults] = useState<VerificationFieldResult[]>([]);
  const [caseAudit, setCaseAudit] = useState<AuditLog[]>([]);
  const [caseLoading, setCaseLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Selected document for extraction viewing & processing step tracking
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedExtraction, setSelectedExtraction] = useState<DocumentExtraction | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [processingDocIds, setProcessingDocIds] = useState<Set<string>>(new Set());
  const [quotaAlertMessage, setQuotaAlertMessage] = useState<string | null>(null);
  const [peakLoadStatus, setPeakLoadStatus] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<"aadhaar" | "documents" | "extraction" | "verification" | "audit">("aadhaar");
  const [aadhaarVerification, setAadhaarVerification] = useState<AadhaarVerificationResult | null>(null);
  const [extractionViewMode, setExtractionViewMode] = useState<"full" | "attributes_only">("full");
  const [showManualReview, setShowManualReview] = useState(false);

  // Officer verification disposition state
  const [verificationDisposition, setVerificationDisposition] = useState<VerificationStatus>("Record Consistent");
  const [officerNote, setOfficerNote] = useState("");
  const [verifyingDone, setVerifyingDone] = useState(false);

  // Subscribe to Aadhaar verification
  useEffect(() => {
    const targetCaseId = item?.id || caseId;
    const unsub = subscribeAadhaarVerification(targetCaseId, setAadhaarVerification);
    return () => unsub();
  }, [item?.id, caseId]);

  // Subscribe to Case
  useEffect(() => {
    const unsub = subscribeCase(caseId, (c) => {
      setItem(c);
      setCaseLoading(false);
    });
    return () => unsub();
  }, [caseId]);

  // Subscribe to Documents
  useEffect(() => {
    const targetCaseId = item?.id || caseId;
    const unsub = subscribeCaseDocuments(targetCaseId, (list) => {
      setDocs(list);
    });
    return () => unsub();
  }, [item?.id, caseId]);

  // Set default selected document ID when documents are loaded
  useEffect(() => {
    if (!selectedDocId && docs.length > 0) {
      setSelectedDocId(docs[0].id);
    }
  }, [docs, selectedDocId]);

  // Subscribe to Legacy records
  useEffect(() => {
    const targetCaseId = item?.id || caseId;
    const unsub = subscribeLegacyLandRecords(targetCaseId, setLegacyRecords);
    return () => unsub();
  }, [item?.id, caseId]);

  // Subscribe to Verification runs
  useEffect(() => {
    const targetCaseId = item?.id || caseId;
    const unsub = subscribeVerificationRuns(targetCaseId, (runs) => {
      setVerificationRuns(runs);
    });
    return () => unsub();
  }, [item?.id, caseId]);

  // Subscribe to field results of latest run
  useEffect(() => {
    const latestRunId = verificationRuns[0]?.id;
    if (latestRunId) {
      const unsub = subscribeVerificationFieldResults(latestRunId, setFieldResults);
      return () => unsub();
    }
  }, [verificationRuns[0]?.id]);

  // Subscribe to Case Audit Logs
  useEffect(() => {
    const targetCaseId = item?.id || caseId;
    const unsub = subscribeCaseAuditLogs(targetCaseId, setCaseAudit);
    return () => unsub();
  }, [item?.id, caseId]);

  // Subscribe to Selected Document Extraction & Steps
  useEffect(() => {
    if (selectedDocId) {
      const unsubExt = subscribeDocumentExtraction(selectedDocId, setSelectedExtraction);
      const unsubSteps = subscribeProcessingSteps(selectedDocId, setProcessingSteps);
      return () => {
        unsubExt();
        unsubSteps();
      };
    }
  }, [selectedDocId]);

  // Automatically sync processingDocIds with Firestore document status
  useEffect(() => {
    setProcessingDocIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      docs.forEach((d) => {
        if ((d.status === "COMPLETED" || d.status === "FAILED") && next.has(d.id)) {
          next.delete(d.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [docs]);

  async function handleProcessSingle(documentId: string) {
    setSelectedDocId(documentId);
    setExtractionViewMode("full");
    setActiveTab("extraction");
    setQuotaAlertMessage(null);
    setPeakLoadStatus(null);
    setProcessingDocIds((prev) => new Set(prev).add(documentId));

    // Clear any previous error banner on the document in Firestore
    try {
      await updateDocument(documentId, { errorMessage: null, status: "PROCESSING" });
    } catch {}

    // Play audible Hindi scan notification sound
    playScanSpeechNotification();

    const MAX_RETRIES = 3;
    let attempt = 0;
    let completedSuccessfully = false;

    while (attempt < MAX_RETRIES && !completedSuccessfully) {
      attempt++;
      const controller = new AbortController();
      const clientTimeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        if (attempt > 1) {
          setPeakLoadStatus(`Peak traffic detected. Auto-recovering extraction (Attempt ${attempt} of ${MAX_RETRIES})...`);
        }

        const resp = await fetch("/api/process-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, caseId: item?.id || caseId }),
          signal: controller.signal,
        });
        clearTimeout(clientTimeoutId);

        // Handle 504 / 503 / 502 gateway busy status with auto-retry
        if (resp.status === 504 || resp.status === 503 || resp.status === 502) {
          if (attempt < MAX_RETRIES) {
            const backoffMs = Math.min(6000, Math.pow(2, attempt) * 1000 + Math.random() * 500);
            setPeakLoadStatus(`Gateway busy (HTTP ${resp.status}). Absorbing peak traffic, auto-retrying in ${(backoffMs / 1000).toFixed(1)}s...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
        }

        const data = await resp.json().catch(() => ({}));

        // HTTP 202: Processing accepted and smoothly running in background to prevent timeout
        if (resp.status === 202 || data?.pending) {
          setPeakLoadStatus("Processing running smoothly in background. Live updates streaming via Firestore...");
          completedSuccessfully = true;
          break;
        }

        if (resp.ok) {
          completedSuccessfully = true;
          setPeakLoadStatus(null);
        }
      } catch (e: any) {
        clearTimeout(clientTimeoutId);
        console.warn(`[Extraction Request] Attempt ${attempt} encounter:`, e?.name || e);
        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.min(6000, Math.pow(2, attempt) * 1000 + Math.random() * 500);
          setPeakLoadStatus(`Connection interrupted (${e?.name === "AbortError" ? "Timeout" : "Network"}). Auto-recovering in ${(backoffMs / 1000).toFixed(1)}s...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        } else {
          setPeakLoadStatus("High peak load exceeded retry limits. Click 'Retry Extraction Now' to try again.");
        }
      }
    }

    // Clear document from active local processing set if completed synchronously
    setProcessingDocIds((prev) => {
      const next = new Set(prev);
      next.delete(documentId);
      return next;
    });

    // Auto-clear transient peak load badge after a brief delay
    setTimeout(() => {
      setPeakLoadStatus((prev) => (prev?.includes("Auto-recovering") ? null : prev));
    }, 4000);
  }

  async function handleProcessAllDocuments() {
    if (!docs.length) return;
    setIsProcessingAll(true);
    setPeakLoadStatus("Batch extraction initiated. Processing documents in non-blocking background queue...");
    playScanSpeechNotification();

    try {
      const resp = await fetch("/api/process-all-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: item?.id || caseId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok || resp.status === 202) {
        setPeakLoadStatus("Batch processing active. Results will stream in real time.");
        setTimeout(() => setPeakLoadStatus(null), 5000);
      } else {
        if (data?.quotaExceeded) {
          setQuotaAlertMessage(data?.message || "Gemini API Quota Exceeded (429). Please update GEMINI_API_KEY in Secrets.");
        }
      }
    } catch (e) {
      console.error("Batch processing error:", e);
    } finally {
      setIsProcessingAll(false);
    }
  }

  async function handleRunVerification() {
    setIsVerifying(true);
    setActiveTab("verification");
    try {
      await fetch("/api/run-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: item?.id || caseId }),
      });
    } catch (e) {
      console.error("Verification run call error:", e);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSaveOfficerVerification() {
    if (!item) return;
    const latestRun = verificationRuns[0];
    const score = latestRun ? latestRun.integrityScore : 50;
    const legacy = legacyRecords[0];

    const findFieldValue = (name: string) => {
      const res = fieldResults.find((f) => f.fieldName === name);
      if (res && res.expectedValue) {
        const str = String(res.expectedValue).trim();
        if (
          str !== "" &&
          str !== "nil" &&
          !str.includes("nil") &&
          !str.includes("Consistent value required")
        ) {
          return str;
        }
      }
      return "nil";
    };

    const ownerName = findFieldValue("owner_name") !== "nil" ? findFieldValue("owner_name") : "nil";
    const surveyNumber = findFieldValue("survey_number");
    const khasraNumber = findFieldValue("khasra_number");
    const area = findFieldValue("area");
    const registrationNumber = findFieldValue("registration_number");
    const mutationNumber = findFieldValue("mutation_number");

    await saveVerifiedLandRecord({
      caseId: item.id,
      landRecordId: item.caseNumber,
      ownerName,
      surveyNumber,
      khasraNumber,
      village: item.village,
      district: item.district,
      area,
      areaUnit: "hectare",
      registrationNumber,
      mutationNumber,
      verificationStatus: verificationDisposition,
      integrityScore: score,
      isDemo: Boolean(item.isDemo),
    });
    setVerifyingDone(true);
  }

  if (caseLoading) {
    return (
      <WorkspaceShell>
        <LoadingRows rows={5} />
      </WorkspaceShell>
    );
  }

  if (!item) {
    return (
      <WorkspaceShell>
        <ErrorState message="This case may no longer be available." />
      </WorkspaceShell>
    );
  }

  const latestRun = verificationRuns[0];
  const selectedDoc = docs.find((d) => d.id === selectedDocId);

  const currentDocIndex = docs.findIndex((d) => d.id === selectedDocId);
  const hasNextDoc = currentDocIndex >= 0 && currentDocIndex < docs.length - 1;
  const hasPrevDoc = currentDocIndex > 0;

  const handleNextDocument = () => {
    if (hasNextDoc) setSelectedDocId(docs[currentDocIndex + 1].id);
  };

  const handlePrevDocument = () => {
    if (hasPrevDoc) setSelectedDocId(docs[currentDocIndex - 1].id);
  };

  const activeQuotaAlert =
    quotaAlertMessage ||
    docs.find(
      (d) =>
        d.status === "FAILED" &&
        (d.errorMessage?.includes("429") ||
          d.errorMessage?.includes("RESOURCE_EXHAUSTED") ||
          d.errorMessage?.toLowerCase().includes("quota"))
    )?.errorMessage ||
    null;

  return (
    <WorkspaceShell>
      <div className="mb-7 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/cases" data-testid="link-case-breadcrumb" className="hover:text-foreground">
          {t("Cases")}
        </Link>
        <ChevronRight size={13} />
        <span className="text-foreground flex items-center gap-2">
          {item.caseNumber}
        </span>
      </div>

      <PageTitle
        eyebrow={t("Case workspace")}
        title={t(item.projectName)}
        detail={`${t(item.district)} / ${t(item.village)} · ${t(item.acquisitionReference || "No acquisition reference recorded")}`}
        action={
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <StatusPill status={item.status} />
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              data-testid="button-delete-case-workspace"
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition shadow-xs"
              title="Permanently Delete Case and all associated documents"
            >
              <Trash2 size={13} /> {t("Delete Case")}
            </button>
          </div>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{t("Case ID")}</div>
          <div className="mono mt-3 text-sm font-medium">{item.caseNumber}</div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{t("Source documents")}</div>
          <div className="mt-3 text-2xl font-semibold">{docs.length}</div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{t("Integrity Score")}</div>
          <div className="mt-3 text-2xl font-semibold flex items-center gap-2">
            {latestRun ? `${latestRun.integrityScore}%` : t("Pending")}
            {latestRun && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  latestRun.integrityScore >= 90
                    ? "bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--destructive)/.15)] text-[hsl(var(--destructive))]"
                }`}
              >
                {latestRun.integrityScore >= 90 ? t("Consistent") : t("Variance")}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">{t("Created")}</div>
          <div className="mt-3 text-sm font-medium">
            {formatDate(item.createdAt)}
          </div>
        </div>
      </div>

      {item.description && (
        <div className="mb-8 rounded-xl border border-card-border bg-card p-5">
          <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">{t("Intake context")}</div>
          <p className="mt-3 max-w-3xl text-sm leading-6">{t(item.description)}</p>
        </div>
      )}

      {/* Explicit Global Quota Alert Banner */}
      {activeQuotaAlert && (
        <div className="mb-6 rounded-xl border-2 border-red-500/40 bg-red-500/10 p-4 text-xs text-red-950 dark:text-red-100 flex items-start justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-red-900 dark:text-red-200 text-sm">{t("Gemini API Quota Limit Exceeded (429 / RESOURCE_EXHAUSTED)")}</h4>
              <p className="text-red-800 dark:text-red-300 leading-relaxed font-medium">
                {t(activeQuotaAlert)}
              </p>
              <p className="text-muted-foreground text-[11px] pt-1">
                The current API key has reached its rate or token limits. You can configure your own Gemini API Key in <strong>Settings &gt; Secrets</strong> to immediately resume unlimited AI extractions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuotaAlertMessage(null)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
            title="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Active Peak Load & Gateway Auto-Recovery Banner */}
      {peakLoadStatus && (
        <div className="mb-6 rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 text-xs text-blue-950 dark:text-blue-100 flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
            <div>
              <span className="font-semibold text-blue-900 dark:text-blue-200">{t("High Peak Traffic Management:")}</span>{" "}
              <span className="text-blue-800 dark:text-blue-300 font-medium">{t(peakLoadStatus)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPeakLoadStatus(null)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10"
            title="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Prominent Call-to-Action Card for Aadhaar */}
      {!aadhaarVerification && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500 mt-0.5">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">{t("Aadhaar Identity Verification Required")}</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                {t("Deterministic cryptographic validation of the applicant's citizen identity is pending. Please verify the identity archive using official paperless e-KYC before continuing.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("aadhaar")}
            data-testid="button-verify-aadhaar-cta"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-xs hover:brightness-110 transition active:scale-95"
          >
            <ShieldCheck size={14} />
            <span>{t("Verify Aadhaar Identity")}</span>
          </button>
        </div>
      )}

      {aadhaarVerification && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 mt-0.5">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                {t("Aadhaar Identity Verified")}: <span className="text-emerald-600">{aadhaarVerification.identity.name}</span>
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                {t("Demographic identity matches applicant name. UIDAI digital signature status: ")}
                <span className="font-semibold text-emerald-600">{aadhaarVerification.signatureVerificationStatus}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("aadhaar")}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-secondary transition"
          >
            <span>{t("View Identity Details")}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Workspace Tabs & Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              id: "aadhaar",
              label: t("01 Aadhaar Identity (e-KYC)"),
              icon: ShieldCheck,
              isVerified: aadhaarVerification?.signatureVerificationStatus === "VALID",
            },
            { id: "documents", label: `${t("02 Source Documents")} (${docs.length})`, icon: FileText },
            { id: "extraction", label: t("03 OCR Extraction & Steps"), icon: Cpu },
            { id: "verification", label: t("04 Cross-Verification & Title"), icon: Scale },
            { id: "database", label: t("05 Verify in Database"), icon: Database, href: `/cases/${item.id}/verification` },
            { id: "audit", label: `${t("06 Audit Trail")} (${caseAudit.length})`, icon: Archive },
          ].map((tab) => {
            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground transition hover:bg-muted"
                >
                  <tab.icon size={14} />
                  {tab.label}
                </Link>
              );
            }
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === "extraction") {
                    setExtractionViewMode("full");
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 0: Aadhaar Identity Verification */}
      {activeTab === "aadhaar" && (
        <AadhaarVerificationDashboard
          currentCase={item}
          landDocuments={docs}
          legacyRecords={legacyRecords}
          existingVerification={aadhaarVerification}
          onContinueToUpload={() => setActiveTab("documents")}
        />
      )}

      {/* Tab 1: Source Documents */}
      {activeTab === "documents" && (
        <>
          {/* Single Unified Direct Document Upload */}
          <SingleUploadZone
            caseId={item.id}
            onUploaded={() => {
              // Documents list will automatically update via Firestore onSnapshot listener
            }}
          />

          <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-3.5">
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <FileText size={14} className="text-[hsl(var(--primary))]" />
                  {t("Registered Documents")} ({docs.length})
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {t("Uploaded deeds, scans, and cadastral records for this case")}
                </span>
              </div>
              {docs.length > 0 && (
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    data-testid="button-process-all-gemini"
                    onClick={handleProcessAllDocuments}
                    disabled={isProcessingAll || docs.every((d) => d.status === "COMPLETED")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-xs transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Sparkles size={13} className={isProcessingAll ? "animate-spin" : ""} />
                    {isProcessingAll ? t("Processing Queue...") : t("Process All with Gemini")}
                  </button>
                </div>
              )}
            </div>

            {docs.length ? (
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  <div className="grid grid-cols-[44px_minmax(180px,1.6fr)_minmax(150px,1.2fr)_115px_minmax(210px,1.2fr)_60px] gap-4 border-b border-border bg-secondary/20 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground items-center">
                    <span className="text-center">#</span>
                    <span>{t("Filename")}</span>
                    <span>{t("Document Type")}</span>
                    <span>{t("Status")}</span>
                    <span>{t("Gemini Action")}</span>
                    <span className="text-right">{t("Actions")}</span>
                  </div>
                  {docs.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      item={doc}
                      isSelected={doc.id === selectedDocId}
                      isProcessing={processingDocIds.has(doc.id) || doc.status === "PROCESSING"}
                      onProcess={() => handleProcessSingle(doc.id)}
                      onView={() => {
                        setSelectedDocId(doc.id);
                        setExtractionViewMode("attributes_only");
                        setShowManualReview(false);
                        setActiveTab("extraction");
                      }}
                      onDelete={() => deleteCaseDocument(doc.id, item.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-xs text-muted-foreground">
                  {t("No documents added yet. Select a file above to immediately upload and process with Gemini.")}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab 2: Gemini Optical Scanner & Extraction Workspace */}
      {activeTab === "extraction" && (
        <div className="space-y-6">
          {/* Document Switcher Queue Bar & View Mode Toggle */}
          {docs.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 overflow-x-auto pb-1">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap mr-1">
                  {t("Document Queue:")}
                </span>
                {docs.map((d) => {
                  const isSelected = d.id === selectedDocId;
                  const isExtracted = d.status === "COMPLETED";
                  const isProc = d.status === "PROCESSING" || processingDocIds.has(d.id);
                  const isFail = d.status === "FAILED";

                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDocId(d.id)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                        isSelected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span>#{d.serialNumber}</span>
                      <span className="truncate max-w-[140px]">{t(d.fileName)}</span>
                      {isExtracted ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-500" title={t("Extracted")} />
                      ) : isProc ? (
                        <RefreshCw size={11} className="animate-spin text-blue-500" />
                      ) : isFail ? (
                        <span className="h-2 w-2 rounded-full bg-red-500" title={t("Failed")} />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" title={t("Pending")} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Context Banner when viewing Extracted Fields Only */}
          {extractionViewMode === "attributes_only" && selectedDoc && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.05)] px-4 py-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))] shrink-0">
                  <Eye size={16} />
                </div>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{t("Extracted Fields for:")} {t(selectedDoc.fileName)}</span>
                    <span className="rounded bg-[hsl(var(--primary)/.15)] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--primary))]">
                      #{selectedDoc.serialNumber}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    {t("Displaying extracted parameters directly.")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="button-manual-review-toggle"
                  onClick={() => setShowManualReview(!showManualReview)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
                    showManualReview
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      : "border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.08)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.15)]"
                  }`}
                >
                  <FileText size={13} />
                  {showManualReview ? t("Hide Manual Review") : t("Manual Review (Scanned Document & Extraction Table)")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("documents")}
                  className="inline-flex items-center gap-1 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
                >
                  ← {t("Back to Source Documents")}
                </button>
              </div>
            </div>
          )}

          {/* Manual Review Side-by-Side View (Scanned Document + Extraction Table) - ONLY Visible when View Attributes is Active */}
          {extractionViewMode === "attributes_only" && showManualReview && selectedDoc && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-amber-600 dark:text-amber-400" size={18} />
                  <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                    {t("Manual Review Workspace: Scanned Document & Extraction Table")}
                  </h4>
                </div>
                <span className="mono text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded">
                  {t("Dual Manual Inspection")}
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Scanned Document Image / PDF Preview */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>{t("Original Scanned Document")} ({t(selectedDoc.fileName)})</span>
                    <span className="text-[10px] uppercase font-mono">{selectedDoc.mimeType || "PDF"}</span>
                  </div>
                  <div className="relative rounded-lg border border-border bg-neutral-900 overflow-hidden h-[480px] flex items-center justify-center p-2 shadow-inner">
                    {selectedDoc.fileUrl ? (
                      selectedDoc.mimeType?.includes("pdf") ? (
                        <iframe src={selectedDoc.fileUrl} className="w-full h-full rounded border-0" title="Scanned Document" />
                      ) : (
                        <img src={selectedDoc.fileUrl} alt={selectedDoc.fileName} className="max-h-full max-w-full object-contain rounded" />
                      )
                    ) : (
                      <div className="text-center text-xs text-neutral-400 p-6">
                        <FileText size={36} className="mx-auto mb-2 opacity-40 text-amber-400" />
                        <p className="font-semibold text-neutral-200">{t("Scanned Document Registered")}</p>
                        <p className="text-[11px] text-neutral-400 mt-1">{t(selectedDoc.fileName)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Extracted Attributes Table for Manual Review */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>{t("Extraction Table Parameters")}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{t("Manual Review Ready")}</span>
                  </div>
                  <div className="h-[480px] overflow-y-auto rounded-lg border border-border bg-card p-4 space-y-3 shadow-inner">
                    {selectedExtraction ? (
                      Object.entries(selectedExtraction.rawExtraction || {})
                        .filter(([k]) => k !== "is_land_record" && k !== "document_relevance" && k !== "irrelevant_reason" && k !== "raw_ocr_summary" && k !== "confidence_score" && k !== "fields" && k !== "document_type")
                        .map(([k, v]) => {
                          const isObjectVal = typeof v === "object" && v !== null;
                          const displayVal = isObjectVal && "value" in (v as any) ? (v as any).value : v;
                          const isPresent = displayVal !== null && displayVal !== undefined && String(displayVal).trim() !== "" && String(displayVal).toLowerCase() !== "null" && String(displayVal).toLowerCase() !== "nil";

                          return (
                            <div key={k} className="flex flex-col gap-1 rounded-md border border-border bg-secondary/30 p-2.5 text-xs">
                              <span className="mono text-[10px] uppercase font-semibold text-muted-foreground">
                                {t(k.replace(/_/g, " "))}
                              </span>
                              <div className="font-medium text-foreground">
                                {isPresent ? t(String(displayVal)) : <span className="italic text-muted-foreground">{t("nil")}</span>}
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div className="text-center text-xs text-muted-foreground py-10">
                        {t("No extraction payload available for this document yet.")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENT SCANNER & TIMELINE WORKSPACE: Only visible in "full" mode */}
          {extractionViewMode === "full" && (
            selectedDoc ? (
              <DocumentScanner
                document={selectedDoc}
                extraction={selectedExtraction}
                processingSteps={processingSteps}
                isProcessing={processingDocIds.has(selectedDoc.id) || selectedDoc.status === "PROCESSING"}
                onProcess={(id) => handleProcessSingle(id)}
                onNextDocument={handleNextDocument}
                onPrevDocument={handlePrevDocument}
                hasNextDocument={hasNextDoc}
                hasPrevDocument={hasPrevDoc}
                quotaAlertMessage={activeQuotaAlert}
                onViewExtractions={() => {
                  const el = document.getElementById("extracted-attributes-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              />
            ) : (
              <EmptyState
                icon={Cpu}
                title={t("No document selected")}
                detail={t("Select a document from the queue or upload a file to begin processing.")}
              />
            )
          )}

          {/* If in attributes-only mode and extraction is not loaded yet */}
          {extractionViewMode === "attributes_only" && !selectedExtraction && (
            <div className="rounded-xl border border-card-border bg-card p-10 text-center shadow-sm">
              <RefreshCw className="animate-spin text-[hsl(var(--primary))] mx-auto mb-3" size={24} />
              <h4 className="text-sm font-semibold text-foreground">{t("Loading Extracted Attributes")}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {t("Retrieving extracted parameters for")} {t(selectedDoc?.fileName || "selected document")}...
              </p>
            </div>
          )}

          {/* STRUCTURED EXTRACTED ATTRIBUTES GRID */}
          {selectedExtraction && (
            <section
              id="extracted-attributes-section"
              className="rounded-xl border border-card-border bg-card p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <div className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                    {t("Verified Extraction Payload")}
                  </div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-0.5">
                    <Sparkles size={16} className="text-[hsl(var(--primary))]" />
                    {t("Extracted Structured Land Attributes")}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {selectedExtraction.model === "gemini-quota-exceeded" || selectedExtraction.documentType === "QUOTA_EXCEEDED" ? (
                    <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> {t("Extraction Halted (Quota Exceeded)")}
                    </span>
                  ) : selectedExtraction.documentType === "EXTRACTION_UNAVAILABLE" || selectedExtraction.documentType === "SERVICE_BUSY" ? (
                    <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> {t("Extraction Unavailable")}
                    </span>
                  ) : (selectedExtraction.rawExtraction as any)?.is_land_record === false ? (
                    <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> {t("Non-Land File (Nil Fields)")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <BadgeCheck size={14} /> {t("Extraction Complete")}
                    </span>
                  )}
                </div>
              </div>

              {/* API Quota Alert Banner */}
              {(selectedExtraction.model === "gemini-quota-exceeded" ||
                selectedExtraction.documentType === "QUOTA_EXCEEDED" ||
                quotaAlertMessage ||
                (selectedExtraction.rawExtraction as any)?.irrelevant_reason?.includes("Quota Limit Exceeded")) && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-200">{t("Gemini API Quota Limit Exceeded")}</h4>
                    <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                      {t((selectedExtraction.rawExtraction as any)?.irrelevant_reason ||
                        quotaAlertMessage ||
                        "⚠️ Gemini API Quota Limit Exceeded (429 / RESOURCE_EXHAUSTED). The current API key quota has been exhausted. Please configure a new Gemini API Key in Settings > Secrets to continue AI extraction.")}
                    </p>
                  </div>
                </div>
              )}

              {/* Service Unavailable Alert Banner */}
              {(selectedExtraction.documentType === "EXTRACTION_UNAVAILABLE" ||
                selectedExtraction.documentType === "SERVICE_BUSY" ||
                selectedExtraction.documentType === "API_KEY_MISSING") &&
                selectedExtraction.documentType !== "QUOTA_EXCEEDED" &&
                selectedExtraction.model !== "gemini-quota-exceeded" &&
                !(selectedExtraction.rawExtraction as any)?.irrelevant_reason?.includes("Quota") && (
                <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 text-xs text-blue-950 dark:text-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-200">{t("Vision Extraction Service Status")}</h4>
                        <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                          {t("Resilience Protected")}
                        </span>
                      </div>
                      <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                        {t((selectedExtraction.rawExtraction as any)?.irrelevant_reason ||
                          "Optical vision extraction encountered peak demand. Safe fallback was applied with automatic retry protection.")}
                      </p>
                    </div>
                  </div>
                  {selectedDoc && (
                    <button
                      type="button"
                      data-testid="button-banner-retry-gemini"
                      onClick={() => handleProcessSingle(selectedDoc.id)}
                      disabled={processingDocIds.has(selectedDoc.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition"
                    >
                      <RefreshCw size={13} className={processingDocIds.has(selectedDoc.id) ? "animate-spin" : ""} />
                      {processingDocIds.has(selectedDoc.id) ? t("Extracting...") : t("Retry Extraction Now")}
                    </button>
                  )}
                </div>
              )}

              {/* Irrelevant / Non-Land Document Alert */}
              {(selectedExtraction.documentType === "IRRELEVANT_NON_LAND_RECORD" ||
                selectedExtraction.documentType === "ACADEMIC_ASSIGNMENT" ||
                selectedExtraction.documentType === "INCOME_CERTIFICATE" ||
                selectedExtraction.documentType === "RESIDENCE_CERTIFICATE" ||
                selectedExtraction.documentType === "CASTE_CERTIFICATE" ||
                ((selectedExtraction.rawExtraction as any)?.is_land_record === false &&
                  selectedExtraction.documentType !== "QUOTA_EXCEEDED" &&
                  selectedExtraction.documentType !== "EXTRACTION_UNAVAILABLE" &&
                  selectedExtraction.documentType !== "SERVICE_BUSY" &&
                  selectedExtraction.documentType !== "API_KEY_MISSING" &&
                  selectedExtraction.model !== "gemini-quota-exceeded")) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={16} />
                    {t("Non-Land Record / Irrelevant Document Detected")}
                  </div>
                  <p className="mt-1 leading-relaxed">
                    {t((selectedExtraction.rawExtraction as any)?.irrelevant_reason ||
                      "This uploaded file is not an official land record (e.g. academic assignment, curriculum, or certificate). All land parameters are strictly set to nil to prevent false data propagation.")}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">{t("Model Engine:")}</span>{" "}
                  <span className="font-semibold">{t(selectedExtraction.model)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("Classification:")}</span>{" "}
                  <span className="font-semibold uppercase">{t((selectedExtraction.documentType || "DOCUMENT").replace(/_/g, " "))}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("Optical Confidence:")}</span>{" "}
                  <span className="font-semibold">
                    {((selectedExtraction.overallConfidence || 0.95) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(selectedExtraction.rawExtraction || {})
                  .filter(
                    ([k]) =>
                      k !== "is_land_record" &&
                      k !== "document_relevance" &&
                      k !== "irrelevant_reason" &&
                      k !== "raw_ocr_summary" &&
                      k !== "confidence_score" &&
                      k !== "fields" &&
                      k !== "document_type"
                  )
                  .map(([k, v]) => {
                    const isObjectVal = typeof v === "object" && v !== null;
                    const displayVal = isObjectVal && "value" in (v as any) ? (v as any).value : v;
                    const isPresent =
                      displayVal !== null &&
                      displayVal !== undefined &&
                      typeof displayVal !== "object" &&
                      String(displayVal).trim() !== "" &&
                      String(displayVal).toLowerCase() !== "null" &&
                      String(displayVal).toLowerCase() !== "nil";

                    const fieldDetail = (selectedExtraction.rawExtraction as any)?.fields?.[k];
                    const status = fieldDetail?.status || (isPresent ? "FOUND" : "NOT_FOUND");
                    const evidence = typeof fieldDetail?.evidence_text === "string" ? fieldDetail.evidence_text : null;

                    return (
                      <div key={k} className={`rounded-lg border p-3 transition-colors ${isPresent ? 'border-border bg-card/60' : 'border-dashed border-border/60 bg-secondary/20'}`}>
                        <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span>{t(k.replace(/_/g, " "))}</span>
                          {status === "FOUND" ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <BadgeCheck size={11} /> {t("FOUND")}
                            </span>
                          ) : status === "NOT_APPLICABLE" ? (
                            <span className="text-[9px] text-muted-foreground font-medium">{t("N/A")}</span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground font-semibold tracking-wider">{t("NOT PRESENT")}</span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {isPresent ? (
                            typeof displayVal === "object" ? JSON.stringify(displayVal) : t(String(displayVal))
                          ) : (
                            <span className="inline-flex items-center rounded bg-muted/60 border border-border px-2 py-0.5 text-xs font-normal italic text-muted-foreground">
                              {t("nil (Not found in document)")}
                            </span>
                          )}
                        </div>
                        {evidence && (
                          <div className="mt-1.5 text-[10px] text-muted-foreground truncate" title={evidence}>
                            {t("Evidence:")} {t(evidence)}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Raw OCR Text Summary */}
              {(selectedExtraction.rawExtraction as any)?.raw_ocr_summary && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs mt-3">
                  <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t("Vision Optical OCR Stream")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {t((selectedExtraction.rawExtraction as any)?.raw_ocr_summary)}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Tab 3: Cross-Verification & Official Determination */}
      {activeTab === "verification" && (
        <div className="space-y-6">
          {/* Header Summary / Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-card-border bg-card p-6">
            <div>
              <div className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{t("Reconciliation Engine")}</div>
              <h3 className="text-xl font-semibold flex items-center gap-2 mt-1">
                <Scale size={20} className="text-[hsl(var(--primary))]" />
                {t("Multi-Document Cross-Verification & Reconciliation")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
                {t("Rigorous character-by-character cross-verification across all uploaded deeds, revenue records, and official government baseline registers. Zero-hallucination comparison.")}
              </p>
            </div>
            <Button
              data-testid="button-run-verification"
              onClick={handleRunVerification}
              disabled={isVerifying}
              className="text-xs shrink-0 self-start sm:self-auto"
            >
              <RefreshCw size={14} className={isVerifying ? "animate-spin" : ""} /> {isVerifying ? t("Analyzing Documents…") : t("Run Reconciliation")}
            </Button>
          </div>

          {/* Continuous Glowing Green Laser Line during Verification */}
          {isVerifying && (
            <div className="relative w-full h-2 bg-emerald-950 overflow-hidden rounded-full border border-emerald-500/40 my-2 shadow-xs">
              <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_#22c55e] animate-scan-horizontal" />
            </div>
          )}

          {latestRun ? (
            <>
              {/* Metric Breakdown Cards */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">{t("Integrity Score")}</div>
                  <div className="mt-1 text-2xl font-bold flex items-baseline gap-1">
                    <span
                      className={
                        latestRun.integrityScore >= 80
                          ? "text-[hsl(var(--primary))]"
                          : latestRun.integrityScore >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-[hsl(var(--destructive))]"
                      }
                    >
                      {latestRun.integrityScore}%
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {latestRun.integrityScore >= 80
                      ? t("High Concordance")
                      : latestRun.integrityScore >= 50
                      ? t("Review Required")
                      : t("Discrepancy Flagged")}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">{t("Verified Matches")}</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {fieldResults.filter((f) => f.status === "MATCH").length}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{t("Identical cross-records")}</div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">{t("Conflicts / Mismatches")}</div>
                  <div className="mt-1 text-2xl font-bold text-[hsl(var(--destructive))]">
                    {fieldResults.filter((f) => f.status === "MISMATCH").length}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {fieldResults.filter((f) => f.status === "MISMATCH").length > 0 ? `⚠️ ${t("Conflicting values")}` : t("No conflicts detected")}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">{t("Single Source")}</div>
                  <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {fieldResults.filter((f) => f.status === "SINGLE_SOURCE").length}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{t("Uncorroborated")}</div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">{t("Nil / Unstated")}</div>
                  <div className="mt-1 text-2xl font-bold text-muted-foreground">
                    {fieldResults.filter((f) => f.status === "NIL" || f.status === "MISSING").length}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{t("Absent across files")}</div>
                </div>
              </div>

              {/* Aadhaar Identity Cross-Check Banner */}
              {aadhaarVerification ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {t("Aadhaar e-KYC")}: {aadhaarVerification.identity.name}
                        </span>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          {aadhaarVerification.signatureVerificationStatus === "VALID" ? t("UIDAI Signature Valid") : aadhaarVerification.signatureVerificationStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t("Applicant identity verified offline. Decision:")} <strong>{t(aadhaarVerification.officerDecision || "PENDING")}</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("aadhaar")}
                    className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                  >
                    {t("View Identity Profile")} →
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Info size={15} className="text-amber-500" />
                    <span>{t("Aadhaar Identity Verification not yet performed for this case.")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("aadhaar")}
                    className="font-semibold text-[hsl(var(--primary))] hover:underline"
                  >
                    {t("Launch Stage 01 e-KYC")} →
                  </button>
                </div>
              )}

              {/* Status banner */}
              <div
                className={`rounded-xl border p-4 text-xs ${
                  fieldResults.some((f) => f.status === "MISMATCH")
                    ? "border-red-500/30 bg-red-500/5 text-red-900 dark:text-red-200"
                    : "border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] text-foreground"
                }`}
              >
                <div className="font-semibold flex items-center gap-2 text-sm">
                  {fieldResults.some((f) => f.status === "MISMATCH") ? (
                    <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  ) : (
                    <Check size={16} className="text-[hsl(var(--primary))] shrink-0" />
                  )}
                  {t(latestRun.summary)}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
                {/* Field Comparison Detailed Cards */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mono">
                      {t("Cross-Document Attribute Matrix")} ({fieldResults.length} {t("parameters evaluated")})
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {fieldResults.map((f, idx) => {
                      const extValue = f.documentValues?.[0]?.value || f.expectedValue || "nil";
                      const existValue = f.legacyValue || "nil";
                      const sim = calculateFieldSimilarity(extValue, existValue, f.fieldName);

                      return (
                        <div
                          key={f.id || idx}
                          data-testid={`field-result-${f.fieldName || idx}`}
                          className={`rounded-xl border p-4 transition-colors ${
                            f.status === "MISMATCH"
                              ? sim.matchScore >= 80
                                ? "border-amber-500/40 bg-card shadow-xs"
                                : "border-red-500/40 bg-card shadow-xs shadow-red-500/5"
                              : f.status === "MATCH"
                              ? "border-emerald-500/30 bg-card"
                              : f.status === "SINGLE_SOURCE"
                              ? "border-blue-500/30 bg-card"
                              : "border-border bg-card/60"
                          }`}
                        >
                          {/* Header of parameter */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {f.fieldLabel ? t(f.fieldLabel) : (f.fieldName ? t(f.fieldName.replace(/_/g, " ").toUpperCase()) : t("PARAMETER"))}
                              </span>
                              <span className="mono text-[10px] text-muted-foreground">({f.fieldName ? t(f.fieldName) : "field"})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* SIMILARITY PERCENTAGE BADGE */}
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${sim.badgeColor}`}
                              >
                                {sim.matchScore}% {t("Match")} ({sim.mismatchScore}% {t("Mismatch")})
                              </span>

                              {f.status === "MATCH" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                  <Check size={12} /> {t("VERIFIED MATCH")}
                                </span>
                              ) : f.status === "MISMATCH" ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sim.matchScore >= 80 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-red-500/15 text-red-700 dark:text-red-300'}`}>
                                  <AlertTriangle size={12} /> {sim.matchScore >= 80 ? t("MINOR VARIANCE") : t("CONFLICT / MISMATCH")}
                                </span>
                              ) : f.status === "SINGLE_SOURCE" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                  <FileText size={12} /> {t("SINGLE SOURCE")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {t("NIL / UNSET")}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress bar and breakdown */}
                          <div className="my-2.5 rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                              <span className="text-foreground">{t("Similarity Calculation")}:</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{sim.breakdownText}</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex border border-border/50">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  sim.matchScore >= 80
                                    ? "bg-emerald-500"
                                    : sim.matchScore >= 50
                                    ? "bg-amber-500"
                                    : "bg-destructive"
                                }`}
                                style={{ width: `${sim.matchScore}%` }}
                              />
                              <div
                                className="h-full bg-destructive/40 transition-all duration-500"
                                style={{ width: `${sim.mismatchScore}%` }}
                              />
                            </div>
                          </div>

                          {/* Values across documents & registry */}
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {/* Extracted Document Values */}
                            <div className="rounded-lg bg-secondary/30 p-3">
                              <div className="mono text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                                <FileText size={12} /> {t("Uploaded Source Documents")}
                              </div>
                              {f.documentValues && f.documentValues.length > 0 ? (
                                <div className="space-y-1.5">
                                  {f.documentValues.map((dv, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-xs rounded bg-background/80 px-2 py-1 border border-border/50"
                                    >
                                      <span className="truncate max-w-[140px] text-[11px] text-muted-foreground" title={dv.documentName}>
                                        {t(dv.documentName)}
                                      </span>
                                      <span className={dv.isNil ? "italic text-muted-foreground font-mono text-[11px]" : "font-semibold"}>
                                        {t(dv.value || "nil")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs">
                                  <span className={String(f.expectedValue || "").includes("nil") ? "italic text-muted-foreground" : "font-semibold"}>
                                    {t(f.expectedValue || "nil")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Government Baseline */}
                            <div className="rounded-lg bg-secondary/30 p-3">
                              <div className="mono text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                                <Scale size={12} /> {t("Official Government Registry Baseline")}
                              </div>
                              <div className="flex items-center justify-between text-xs rounded bg-background/80 px-2.5 py-2 border border-border/50">
                                <span className="text-[11px] text-muted-foreground">{t("Registry Record")}</span>
                                <span
                                  className={
                                    f.legacyValue === null || f.legacyValue === undefined || f.legacyValue === "nil"
                                      ? "italic text-muted-foreground font-mono text-[11px]"
                                      : "font-semibold"
                                  }
                                >
                                  {f.legacyValue ? t(f.legacyValue) : t("nil (No registry baseline)")}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Conflict or Explanation Callout */}
                          {f.explanation && (
                            <div
                              className={`mt-3 rounded-lg p-2.5 text-xs ${
                                f.status === "MISMATCH"
                                  ? sim.matchScore >= 80
                                    ? "bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20"
                                    : "bg-red-500/10 text-red-900 dark:text-red-200 border border-red-500/20"
                                  : f.status === "SINGLE_SOURCE"
                                  ? "bg-blue-500/10 text-blue-900 dark:text-blue-200 border border-blue-500/20"
                                  : "bg-secondary/40 text-muted-foreground"
                              }`}
                            >
                              <span className="font-semibold">
                                {f.status === "MISMATCH" ? `⚠️ ${t("Variance Note")}: ` : `${t("Determination")}: `}
                              </span>
                              {t(f.explanation)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Link to Stage 3 Final Database Verification & Officer Keynotes */}
                <section className="rounded-xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.06)] p-6 self-start space-y-4">
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))] font-semibold">
                      {t("Final Verification Stage")}
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-foreground flex items-center gap-2">
                      <FileCheck2 size={20} className="text-[hsl(var(--primary))]" />
                      {t("Stage 3 Database Matching & Officer Keynotes")}
                    </h3>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("Officer determination keynotes (minimum 12 words required) and final record disposition are recorded on the Stage 3 Database Matching page for official record maintenance.")}
                  </p>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                    <strong>{t("Standard Revenue Mandate")}:</strong> {t("Enter mandatory officer keynotes on the final Stage 3 page before saving official judgment.")}
                  </div>

                  <Link
                    href={`/cases/${item.id}/verification`}
                    className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-sm hover:brightness-110 transition"
                  >
                    <span>{t("Proceed to Stage 3 Final Verification")}</span>
                    <ArrowRight size={15} />
                  </Link>
                </section>
              </div>
            </>
          ) : (
            <EmptyState
              icon={Scale}
              title={t("No verification run recorded")}
              detail={t("Run automated verification analysis to correlate extracted title documents with governmental registry baseline.")}
              action={
                <Button onClick={handleRunVerification}>
                  <Scale size={14} /> {t("Run Analysis Now")}
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* Tab 4: Audit Trail */}
      {activeTab === "audit" && (
        <section className="rounded-xl border border-card-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Archive size={17} className="text-[hsl(var(--primary))]" />
              {t("Immutable Case Audit Log")}
            </h3>
            <span className="mono text-xs text-muted-foreground">{caseAudit.length} {t("events")}</span>
          </div>
          {caseAudit.length ? (
            <div className="divide-y divide-border">
              {caseAudit.map((log) => (
                <div key={log.id} className="py-3 text-xs flex justify-between gap-4">
                  <div>
                    <div className="font-semibold">{t(log.description)}</div>
                    <div className="mono text-[10px] text-muted-foreground mt-0.5">
                      {t(log.action)} · {t("Authorized Officer")}: {log.userId}
                    </div>
                  </div>
                  <div className="mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {relativeTime(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Archive} title={t("No case audit entries")} detail={t("Actions taken on this case will record here automatically.")} />
          )}
        </section>
      )}

      {showDeleteModal && item && (
        <DeleteCaseModal
          targetCase={item}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setLocation("/cases");
          }}
        />
      )}
    </WorkspaceShell>
  );
}

export function RecordsPage() {
  const [records, setRecords] = useState<VerifiedLandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();

  useEffect(() => {
    const unsub = subscribeVerifiedLandRecords((list) => {
      setRecords(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        (r.landRecordId && r.landRecordId.toLowerCase().includes(q)) ||
        (r.ownerName && r.ownerName.toLowerCase().includes(q)) ||
        (r.village && r.village.toLowerCase().includes(q)) ||
        (r.district && r.district.toLowerCase().includes(q)) ||
        (r.surveyNumber && r.surveyNumber.toLowerCase().includes(q)) ||
        (r.khasraNumber && r.khasraNumber.toLowerCase().includes(q)) ||
        (r.verificationStatus && r.verificationStatus.toLowerCase().includes(q))
    );
  }, [records, searchQuery]);

  return (
    <WorkspaceShell>
      <PageTitle
        eyebrow="Record intelligence"
        title="Verified Land Records"
        detail="Synthesized and verified land records recorded by authorized revenue officers in Firestore."
        action={<LanguageToggle />}
      />

      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search by owner, ID, village, or plot...")}
            className="w-full rounded-xl border border-input bg-card pl-9 pr-4 py-2.5 text-xs outline-hidden focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {t("Total Records:")} <strong className="text-foreground">{filteredRecords.length}</strong>
        </div>
      </div>

      {loading ? (
        <LoadingRows />
      ) : filteredRecords.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-xs">
          <div className="grid grid-cols-[1.1fr_1.1fr_1fr_0.9fr_1fr_1.2fr_70px_100px] gap-3 border-b border-border bg-secondary/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{t("Land Record ID")} / {t("Location")}</span>
            <span>{t("Owner Name")}</span>
            <span>{t("Survey No.")} / {t("Khasra No.")}</span>
            <span>{t("Area")}</span>
            <span>{t("Registration Number")} / {t("Mutation Number")}</span>
            <span>{t("Status")}</span>
            <span>{t("Integrity")}</span>
            <span className="text-right">{t("Secure Vault")}</span>
          </div>
          {filteredRecords.map((r) => {
            const isConsistent = r.verificationStatus === "Record Consistent" || r.verificationStatus === ("VERIFIED" as any);
            const isReview = r.verificationStatus === "Review Required" || r.verificationStatus === ("REVIEW REQUIRED" as any);
            const isConflict = r.verificationStatus === "Potential Conflict" || r.verificationStatus === ("NOT VERIFIED" as any);

            return (
              <div
                key={r.id}
                className="data-row grid grid-cols-[1.1fr_1.1fr_1fr_0.9fr_1fr_1.2fr_70px_100px] items-center gap-3 border-b border-border px-5 py-4 last:border-0 text-xs hover:bg-muted/30 transition"
              >
                <div>
                  <div className="font-bold text-foreground font-mono">{r.landRecordId || "NIL"}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {t(r.village || "NIL")} / {t(r.district || "NIL")}
                  </div>
                </div>

                <div className="font-semibold text-foreground">{t(r.ownerName || "NIL")}</div>

                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <div>{t("Survey No.")}: <strong className="text-foreground">{r.surveyNumber || "NIL"}</strong></div>
                  <div>{t("Khasra No.")}: <strong className="text-foreground">{r.khasraNumber || "NIL"}</strong></div>
                </div>

                <div className="text-muted-foreground">
                  {r.area && r.area !== "NIL" ? `${r.area} ${t(r.areaUnit || "Hectares")}` : "NIL"}
                </div>

                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <div>{t("Registration Number")}: <span className="font-mono">{r.registrationNumber || "NIL"}</span></div>
                  <div>{t("Mutation Number")}: <span className="font-mono">{r.mutationNumber || "NIL"}</span></div>
                </div>

                <div className="space-y-1">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      isConsistent
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : isReview
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : isConflict
                        ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                        : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                    }`}
                  >
                    {t(r.verificationStatus || "NIL")}
                  </span>
                  {r.officerNote && (
                    <div className="text-[10px] text-muted-foreground line-clamp-2 italic" title={r.officerNote}>
                      "{r.officerNote}"
                    </div>
                  )}
                  {r.officerName && (
                    <div className="text-[9px] text-muted-foreground font-semibold">
                      By: {r.officerName}
                    </div>
                  )}
                </div>

                <div className="font-bold text-foreground font-mono">{Math.min(100, Math.max(0, r.integrityScore ?? 0))}%</div>

                <div className="flex justify-end">
                  {r.hasSecureVault ? (
                    <Link
                      href={`/records/${r.id}/vault`}
                      data-testid={`button-open-vault-${r.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60 shadow-xs active:scale-95 transition"
                    >
                      <ShieldCheck size={13} className="text-amber-500 shrink-0" />
                      <span>Open Vault</span>
                    </Link>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 italic font-mono">
                      No Vault
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Database}
          title="No verified records recorded yet"
          detail="Process source documents in a case workspace and execute institutional verification to record verified entries."
          action={
            <Link href="/cases" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]">
              Open Cases <ArrowRight size={14} />
            </Link>
          }
        />
      )}
    </WorkspaceShell>
  );
}

export function ExistingRecordsPage() {
  const [records, setRecords] = useState<LegacyLandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();

  useEffect(() => {
    const unsub = subscribeAllLegacyLandRecords((list) => {
      setRecords(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        (r.landRecordId && String(r.landRecordId).toLowerCase().includes(q)) ||
        (r.propertyUid && String(r.propertyUid).toLowerCase().includes(q)) ||
        (r.ownerName && String(r.ownerName).toLowerCase().includes(q)) ||
        (r.surveyNumber && String(r.surveyNumber).toLowerCase().includes(q)) ||
        (r.khasraNumber && String(r.khasraNumber).toLowerCase().includes(q)) ||
        (r.village && String(r.village).toLowerCase().includes(q)) ||
        (r.district && String(r.district).toLowerCase().includes(q))
    );
  }, [records, searchQuery]);

  return (
    <WorkspaceShell>
      <PageTitle
        eyebrow="Reference archive"
        title="Existing Land Records (Baseline)"
        detail="Pre-existing institutional and legacy land records maintained as reference sources for document reconciliation and conflict detection."
        action={<LanguageToggle />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search by UID, Land Record ID, Owner, Survey, Khasra, Village, or District...")}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          {t("Showing")} {filteredRecords.length} {t("of")} {records.length} {t("reference records")}
        </div>
      </div>

      {loading ? (
        <LoadingRows />
      ) : filteredRecords.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-card-border bg-card">
          <div className="grid grid-cols-[1.1fr_1.2fr_1fr_1fr_120px_100px] gap-4 border-b border-border bg-secondary/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{t("Land Record ID")}</span>
            <span>{t("Owner Name")}</span>
            <span>{t("Survey No.")} / {t("Khasra No.")}</span>
            <span>{t("Village")} / {t("District")}</span>
            <span>{t("Area")}</span>
            <span>{t("Status")}</span>
          </div>
          {filteredRecords.map((r) => (
            <div
              key={r.id || r.landRecordId}
              className="data-row grid grid-cols-[1.1fr_1.2fr_1fr_1fr_120px_100px] items-center gap-4 border-b border-border px-5 py-4 last:border-0 text-sm"
            >
              <div>
                <div className="font-semibold mono">{r.landRecordId || "LR-00000"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{r.source || "Registry Archive"}</div>
                {r.propertyUid && <div className="text-[10px] font-mono font-semibold text-primary/80 mt-1">UID: {r.propertyUid}</div>}
              </div>
              <div className="font-medium text-foreground">{t(r.ownerName)}</div>
              <div className="text-muted-foreground text-xs">
                {t("Survey No.")}: <span className="font-medium text-foreground">{r.surveyNumber}</span><br />
                {t("Khasra No.")}: <span className="font-medium text-foreground">{r.khasraNumber}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t(r.village)}</span><br />
                {t(r.district)}
              </div>
              <div className="text-xs font-semibold">
                {r.area} {t(r.areaUnit || "Hectares")}
              </div>
              <div>
                <span className="rounded-full bg-[hsl(var(--primary)/.15)] px-2.5 py-1 text-[10px] font-semibold text-[hsl(var(--primary))]">
                  {t(r.status || "Active")}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Database}
          title={t("No legacy land records found")}
          detail={t("No reference records matched your search criteria.")}
        />
      )}
    </WorkspaceShell>
  );
}

export function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const unsub = subscribeRecentAuditLogs((list) => {
      setLogs(list);
      setLoading(false);
    }, 100);
    return () => unsub();
  }, []);

  return (
    <WorkspaceShell>
      <PageTitle
        eyebrow="Accountability layer"
        title="Audit Trail"
        detail="Immutable stream of officer actions, document uploads, classifications, extractions, and verification determinations."
        action={<LanguageToggle />}
      />

      {loading ? (
        <LoadingRows />
      ) : logs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-card-border bg-card">
          <div className="grid grid-cols-[180px_1.5fr_1fr_130px] gap-4 border-b border-border bg-secondary/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{t("Timestamp")}</span>
            <span>{t("Event Description")}</span>
            <span>{t("Action Category")}</span>
            <span>{t("Officer ID")}</span>
          </div>
          {logs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-[180px_1.5fr_1fr_130px] items-center gap-4 border-b border-border px-5 py-3.5 last:border-0 text-xs"
            >
              <span className="mono text-[10px] text-muted-foreground">
                {formatDateTime(log.timestamp)}
              </span>
              <span className="font-semibold text-foreground">{t(log.description)}</span>
              <span className="mono text-[10px] text-muted-foreground">{t(log.action)}</span>
              <span className="mono text-[10px] text-muted-foreground">{t(log.userId)}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Archive} title={t("No audit entries found")} detail={t("Actions performed across the application will stream here in realtime.")} />
      )}
    </WorkspaceShell>
  );
}

export function SettingsPage() {
  const { officer, updateProfile } = useAppAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "system">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile editable form state
  const [fullName, setFullName] = useState(officer?.fullName || "Senior Revenue Officer");
  const [email, setEmail] = useState(officer?.email || "officer@revenue.local");
  const [role, setRole] = useState(officer?.role || "Land Records Officer");
  const [department, setDepartment] = useState(officer?.department || "Revenue & Survey Department");
  const [jurisdiction, setJurisdiction] = useState(
    (officer as any)?.jurisdiction || "Zone IV · Regional Land Records & Survey Authority"
  );

  useEffect(() => {
    if (officer) {
      setFullName(officer.fullName || "Senior Revenue Officer");
      setEmail(officer.email || "officer@revenue.local");
      setRole(officer.role || "Land Records Officer");
      setDepartment(officer.department || "Revenue & Survey Department");
      if ((officer as any)?.jurisdiction) {
        setJurisdiction((officer as any).jurisdiction);
      }
    }
  }, [officer]);

  useEffect(() => {
    // If arriving with #profile or similar hash, ensure profile tab is selected
    if (typeof window !== "undefined" && window.location.hash.includes("profile")) {
      setActiveTab("profile");
      const el = document.getElementById("profile");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (updateProfile) {
        await updateProfile({
          fullName,
          email,
          role,
          department,
          jurisdiction,
        } as any);
      }
      setIsEditing(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkspaceShell>
      <PageTitle
        eyebrow="System settings"
        title="Settings"
        detail="Your authorized officer profile, credentials, and system architecture context."
      />

      {/* Navigation tabs between Profile and System Settings */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          data-testid="tab-settings-profile"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "profile"
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-xs"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <User size={14} />
          <span>Officer Profile View</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("system")}
          data-testid="tab-settings-system"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "system"
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-xs"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Database size={14} />
          <span>System Infrastructure</span>
        </button>
      </div>

      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_.8fr]">
        {/* OFFICER PROFILE VIEW SECTION */}
        <section
          id="profile"
          data-testid="section-officer-profile"
          className={`rounded-xl border border-card-border bg-card p-6 sm:p-8 transition-all duration-300 ${
            activeTab === "profile" ? "ring-2 ring-primary/25 shadow-sm" : ""
          }`}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
            <div className="flex items-center gap-4">
              {/* ANIMATED CARTOON OFFICER AVATAR */}
              <div className="relative flex-shrink-0">
                <CartoonOfficerAvatar size={76} animated />
                <span
                  title="Active Authorized Session"
                  className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-emerald-500 shadow-xs"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary mb-1">
                  <ShieldCheck size={11} />
                  Authorized Revenue Officer
                </div>
                <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              data-testid="button-edit-profile"
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition active:scale-95"
            >
              <Edit3 size={13} />
              <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
            </button>
          </div>

          {savedSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/15 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <Check size={14} /> Profile attributes updated successfully.
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                    Official Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  Jurisdiction & Survey Circle
                </label>
                <input
                  type="text"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:brightness-110 transition disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={13} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Officer Name</div>
                <div className="mt-1.5 text-sm font-semibold text-foreground">{fullName}</div>
              </div>
              <div>
                <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Official Email</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{email}</div>
              </div>
              <div>
                <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Designation & Role</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{role}</div>
              </div>
              <div>
                <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Department</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{department}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground">Jurisdiction Circle</div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{jurisdiction}</div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[hsl(var(--primary))]" />
              <span>Authorized Officer Identity · Institutional Session</span>
            </div>
            <span className="mono text-[10px] text-muted-foreground/80">ID: {officer?.id || "REV-OFFICER-01"}</span>
          </div>
        </section>

        {/* SYSTEM INFRASTRUCTURE SECTION */}
        <section className="rounded-xl border border-card-border bg-card p-6">
          <div className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Backend Status</div>
          <h2 className="mt-2 text-lg font-semibold">System Infrastructure</h2>
          <div className="mt-6 space-y-4">
            {[
              ["Database", "Secure Enterprise Ledger", Database],
              ["Object Storage", "Private Encrypted Deed Storage", CloudUpload],
              ["Intelligence Engine", "Vision Optical Intelligence (Server-side)", Sparkles],
              ["Security Rules", "Defensible Role & Access Rules Enforced", ShieldCheck],
            ].map(([t, d, I]) => (
              <div key={t as string} className="flex items-center gap-3 border-b border-border pb-4 last:border-0">
                <div className="text-[hsl(var(--primary))]">
                  <I size={17} />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t as string}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{d as string}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

export function UsageMonitorPage() {
  const [stats, setStats] = useState<QuotaStats>(() => getQuotaStats());
  const [history, setHistory] = useState<Array<{ id: string; time: string; action: string; count: number; type: "read" | "write" | "delete" }>>([
    { id: "init-01", time: new Date().toTimeString().split(" ")[0], action: "Monitor Initialized & Listening", count: 0, type: "read" },
  ]);

  useEffect(() => {
    let lastReads = stats.reads;
    let lastWrites = stats.writes;
    let lastDeletes = stats.deletes;

    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as QuotaStats;
      if (detail) {
        setStats(detail);
        
        const now = new Date();
        const timeStr = now.toTimeString().split(" ")[0];

        const readDiff = detail.reads - lastReads;
        const writeDiff = detail.writes - lastWrites;
        const deleteDiff = detail.deletes - lastDeletes;

        const newEntries: typeof history = [];
        if (readDiff > 0) {
          newEntries.push({
            id: `read-${Date.now()}-${Math.random()}`,
            time: timeStr,
            action: "SDK Intercept: Firestore Read Operation",
            count: readDiff,
            type: "read",
          });
        }
        if (writeDiff > 0) {
          newEntries.push({
            id: `write-${Date.now()}-${Math.random()}`,
            time: timeStr,
            action: "SDK Intercept: Firestore Write Operation",
            count: writeDiff,
            type: "write",
          });
        }
        if (deleteDiff > 0) {
          newEntries.push({
            id: `delete-${Date.now()}-${Math.random()}`,
            time: timeStr,
            action: "SDK Intercept: Firestore Delete Operation",
            count: deleteDiff,
            type: "delete",
          });
        }

        lastReads = detail.reads;
        lastWrites = detail.writes;
        lastDeletes = detail.deletes;

        if (newEntries.length > 0) {
          setHistory((prev) => [...newEntries, ...prev].slice(0, 15));
        }
      }
    };

    window.addEventListener("quota_stats_updated", handleUpdate);
    return () => {
      window.removeEventListener("quota_stats_updated", handleUpdate);
    };
  }, [stats]);

  const readPercent = Math.min(100, (stats.reads / QUOTA_LIMITS.reads) * 100);
  const writePercent = Math.min(100, (stats.writes / QUOTA_LIMITS.writes) * 100);
  const deletePercent = Math.min(100, (stats.deletes / QUOTA_LIMITS.deletes) * 100);

  // Billing estimation ($0.06 per 100k reads outside free, $0.18 per 100k writes outside free)
  const readsExceeded = Math.max(0, stats.reads - QUOTA_LIMITS.reads);
  const writesExceeded = Math.max(0, stats.writes - QUOTA_LIMITS.writes);
  const estimatedCost = (readsExceeded / 100000) * 0.06 + (writesExceeded / 100000) * 0.18;

  return (
    <WorkspaceShell>
      <PageTitle
        eyebrow="System administration"
        title="Firebase Usage Monitor"
        detail="Detailed, live breakdown of database operations, billing estimations, and automated threshold alerts tracking against Firebase free quotas."
      />

      {/* OVERVIEW CARDS */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {/* Reads Card */}
        <div className="rounded-xl border border-card-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Read Operations</span>
            </div>
            <span className="mono text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
              Limit: {QUOTA_LIMITS.reads.toLocaleString()}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-foreground">{stats.reads.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">Reads made during active sessions today</p>
          </div>
          <div className="mt-5 space-y-1.5">
            <div className="h-2 w-full rounded-full bg-secondary/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  readPercent >= 90 ? "bg-red-500" : readPercent >= 70 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${readPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>{readPercent.toFixed(2)}% used</span>
              <span>{(QUOTA_LIMITS.reads - stats.reads).toLocaleString()} left</span>
            </div>
          </div>
        </div>

        {/* Writes Card */}
        <div className="rounded-xl border border-card-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Write Operations</span>
            </div>
            <span className="mono text-[10px] font-medium text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
              Limit: {QUOTA_LIMITS.writes.toLocaleString()}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-foreground">{stats.writes.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">Writes, creations, and profile modifications</p>
          </div>
          <div className="mt-5 space-y-1.5">
            <div className="h-2 w-full rounded-full bg-secondary/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${writePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>{writePercent.toFixed(2)}% used</span>
              <span>{(QUOTA_LIMITS.writes - stats.writes).toLocaleString()} left</span>
            </div>
          </div>
        </div>

        {/* Deletes Card */}
        <div className="rounded-xl border border-card-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Delete Operations</span>
            </div>
            <span className="mono text-[10px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
              Limit: {QUOTA_LIMITS.deletes.toLocaleString()}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-foreground">{stats.deletes.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">Document deletions and ledger cleanups</p>
          </div>
          <div className="mt-5 space-y-1.5">
            <div className="h-2 w-full rounded-full bg-secondary/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-300"
                style={{ width: `${deletePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>{deletePercent.toFixed(2)}% used</span>
              <span>{(QUOTA_LIMITS.deletes - stats.deletes).toLocaleString()} left</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: Intercept Stream History */}
        <div className="rounded-xl border border-card-border bg-card p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Live SDK Intercept Log</h2>
              <p className="text-xs text-muted-foreground">Real-time operation stream caught by the Firestore SDK proxy wrapper</p>
            </div>
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>

          <div className="space-y-3">
            {history.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <span className={`mono text-[11px] font-bold px-2 py-1 rounded shrink-0 ${
                    log.type === "read"
                      ? "text-emerald-700 bg-emerald-50"
                      : log.type === "write"
                      ? "text-blue-700 bg-blue-50"
                      : "text-amber-700 bg-amber-50"
                  }`}>
                    {log.type.toUpperCase()}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{log.action}</div>
                    <div className="mono mt-0.5 text-[10px] text-muted-foreground">Intercepted at {log.time}</div>
                  </div>
                </div>
                {log.count > 0 && (
                  <div className="mono text-xs font-bold text-foreground">+{log.count} doc{log.count > 1 ? "s" : ""}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Info & Estimates */}
        <div className="space-y-6">
          {/* Estimated Billing Card */}
          <div className="rounded-xl border border-card-border bg-card p-6 shadow-xs">
            <h2 className="text-base font-semibold">Estimated Cost (Spark Free Tier)</h2>
            <p className="text-xs text-muted-foreground">Estimated daily cost based on standard Google Cloud Firestore tiering</p>
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                ${estimatedCost.toFixed(4)} <span className="text-xs font-medium text-muted-foreground">USD / today</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg font-medium">
                ✔ Your current usage is completely free. Google Firestore charges $0.00 up to 50,000 daily reads on the free Spark plan.
              </p>
            </div>
          </div>

          {/* Actionable recommendations */}
          <div className="rounded-xl border border-card-border bg-card p-6 shadow-xs">
            <h2 className="text-base font-semibold">Capacity Best Practices</h2>
            <div className="mt-4 space-y-3.5">
              {[
                ["Close Idle Sessions", "Always close the workspace tab when finished. Active live queries execute real-time document listener snapshots.", Clock3],
                ["Index Optimization", "Our newly optimized query structures fallback gracefully to indexless single-collection queries during transitions.", ShieldCheck],
                ["Local Cache Shielding", "The application leverages local state syncing so that navigating sub-menus doesn't re-fetch cases repeatedly from Cloud databases.", Database],
              ].map(([t, d, I]) => (
                <div key={t as string} className="flex gap-3">
                  <div className="text-muted-foreground shrink-0 mt-0.5">
                    <I size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">{t as string}</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{d as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

