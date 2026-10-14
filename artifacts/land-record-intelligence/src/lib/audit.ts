import { db, handleFirestoreError, OperationType } from "./firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, where, getDocs, onSnapshot } from "./firestore-tracked";
import type { AuditLog, AuditAction } from "./types";
import { DEV_OFFICER } from "./auth";
import { multiplexSubscription } from "./firestore-cache";

export async function logAuditEvent(params: {
  action: AuditAction;
  description: string;
  caseId?: string | null;
  documentId?: string | null;
  userId?: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  try {
    const colRef = collection(db, "audit_logs");
    const docRef = await addDoc(colRef, {
      caseId: params.caseId || null,
      documentId: params.documentId || null,
      userId: params.userId || DEV_OFFICER.id,
      action: params.action,
      description: params.description,
      metadata: params.metadata || {},
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Audit log error:", error);
    // Don't crash the user action if audit log write fails, but report
    return "";
  }
}

export function subscribeToRecentAuditLogs(
  onUpdate: (logs: AuditLog[]) => void,
  maxItems: number = 20
) {
  return multiplexSubscription<AuditLog[]>(
    `recent_audit_logs_${maxItems}`,
    (publish) => {
      try {
        const q = query(
          collection(db, "audit_logs"),
          orderBy("timestamp", "desc"),
          limit(maxItems)
        );
        return onSnapshot(
          q,
          (snapshot) => {
            const items = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })) as AuditLog[];
            publish(items);
          },
          (error) => {
            console.warn("Audit logs subscription notice:", error?.message || error);
            publish([]);
          }
        );
      } catch (error) {
        console.warn("Audit logs listener init notice:", error);
        return () => {};
      }
    },
    onUpdate
  );
}

export function subscribeToCaseAuditLogs(
  caseId: string,
  onUpdate: (logs: AuditLog[]) => void
) {
  if (!caseId) {
    onUpdate([]);
    return () => {};
  }
  return multiplexSubscription<AuditLog[]>(
    `case_audit_logs_${caseId}`,
    (publish) => {
      try {
        const q = query(
          collection(db, "audit_logs"),
          where("caseId", "==", caseId),
          orderBy("timestamp", "desc"),
          limit(50)
        );
        return onSnapshot(
          q,
          (snapshot) => {
            const items = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })) as AuditLog[];
            publish(items);
          },
          (error) => {
            console.warn(`Case ${caseId} audit logs notice:`, error?.message || error);
            publish([]);
          }
        );
      } catch (error) {
        console.warn("Case audit logs listener init notice:", error);
        return () => {};
      }
    },
    onUpdate
  );
}

export const subscribeRecentAuditLogs = subscribeToRecentAuditLogs;
export const subscribeCaseAuditLogs = subscribeToCaseAuditLogs;

