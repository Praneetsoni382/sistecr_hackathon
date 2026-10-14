import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Case, DashboardSummary } from "./types";
import { subscribeCases, subscribeDashboardSummary } from "./firestore";
import { subscribeRecentAuditLogs } from "./audit";
import { AuditLog } from "./types";
import { ensureDemoDataSeeded } from "./seed-data";

interface SystemCacheContextType {
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  summary: DashboardSummary;
  activity: AuditLog[];
  loading: boolean;
}

const SystemCacheContext = createContext<SystemCacheContextType | null>(null);

export function SystemCacheProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<Case[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    totalCases: 0,
    documentsUploaded: 0,
    documentsProcessed: 0,
    recordsVerified: 0,
    recordsRequiringReview: 0,
    conflictsDetected: 0,
  });
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed essential baseline records if missing
    ensureDemoDataSeeded().catch((err) => {
      console.warn("Seeding initial data notice:", err);
    });

    // Multiplexed global subscriptions: 1 shared stream for the whole app
    const unsubCases = subscribeCases((list) => {
      setCases(list);
      setLoading(false);
    }, true);

    const unsubSummary = subscribeDashboardSummary((data) => {
      setSummary(data);
    }, true);

    const unsubActivity = subscribeRecentAuditLogs((logs) => {
      setActivity(logs);
    }, 15);

    return () => {
      unsubCases();
      unsubSummary();
      unsubActivity();
    };
  }, []);

  return (
    <SystemCacheContext.Provider value={{ cases, setCases, summary, activity, loading }}>
      {children}
    </SystemCacheContext.Provider>
  );
}

export function useSystemCache() {
  const context = useContext(SystemCacheContext);
  if (!context) {
    throw new Error("useSystemCache must be used within a SystemCacheProvider");
  }
  return context;
}
