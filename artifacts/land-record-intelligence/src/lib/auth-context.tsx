import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useAuth as useClerkAuth } from "@clerk/react";
import {
  DEV_OFFICER,
  OfficerProfile,
  ensureDevelopmentOfficerProfile,
  getLocalOfficerProfile,
  saveOfficerProfile,
} from "./auth";
import { db } from "./firebase";
import { doc, onSnapshot } from "./firestore-tracked";

const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const isClerkConfigured = Boolean(
  rawKey &&
  typeof rawKey === "string" &&
  rawKey.trim() !== "" &&
  (rawKey.startsWith("pk_test_") || rawKey.startsWith("pk_live_")) &&
  !rawKey.includes("placeholder") &&
  rawKey.length > 20
);

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId?: string | null;
  officer: OfficerProfile;
  updateProfile: (updates: Partial<OfficerProfile>) => Promise<OfficerProfile>;
}

const defaultAuthState: AuthState = {
  isLoaded: true,
  isSignedIn: true,
  userId: DEV_OFFICER.id,
  officer: DEV_OFFICER,
  updateProfile: async (updates) => saveOfficerProfile(updates),
};

const AuthContext = createContext<AuthState>(defaultAuthState);

function ClerkAuthBridge({
  children,
  officer,
  updateProfile,
}: {
  children: ReactNode;
  officer: OfficerProfile;
  updateProfile: (updates: Partial<OfficerProfile>) => Promise<OfficerProfile>;
}) {
  let isLoaded = true;
  let isSignedIn = true;
  let userId: string | null = DEV_OFFICER.id;

  try {
    const clerkAuth = useClerkAuth();
    if (clerkAuth) {
      isLoaded = clerkAuth.isLoaded;
      isSignedIn = Boolean(clerkAuth.isSignedIn);
      userId = clerkAuth.userId || DEV_OFFICER.id;
    }
  } catch {
    isLoaded = true;
    isSignedIn = true;
    userId = DEV_OFFICER.id;
  }

  const value: AuthState = {
    isLoaded,
    isSignedIn,
    userId,
    officer,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({
  children,
  hasClerkProvider = false,
}: {
  children: ReactNode;
  hasClerkProvider?: boolean;
}) {
  const [officer, setOfficer] = useState<OfficerProfile>(() => getLocalOfficerProfile());

  useEffect(() => {
    ensureDevelopmentOfficerProfile()
      .then((prof) => {
        if (prof) setOfficer(prof);
      })
      .catch(() => {});

    const handleProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setOfficer(detail);
      }
    };
    window.addEventListener("officer_profile_updated", handleProfileUpdated);

    try {
      const unsub = onSnapshot(doc(db, "profiles", DEV_OFFICER.id), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as OfficerProfile;
          setOfficer((prev) => ({ ...prev, ...data }));
        }
      });
      return () => {
        window.removeEventListener("officer_profile_updated", handleProfileUpdated);
        unsub();
      };
    } catch {
      return () => {
        window.removeEventListener("officer_profile_updated", handleProfileUpdated);
      };
    }
  }, []);

  const handleUpdate = async (updates: Partial<OfficerProfile>) => {
    const updated = await saveOfficerProfile(updates);
    setOfficer(updated);
    return updated;
  };

  if (hasClerkProvider && isClerkConfigured) {
    return (
      <ClerkAuthBridge officer={officer} updateProfile={handleUpdate}>
        {children}
      </ClerkAuthBridge>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        isLoaded: true,
        isSignedIn: true,
        userId: officer.id || DEV_OFFICER.id,
        officer,
        updateProfile: handleUpdate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAppAuth(): AuthState {
  const context = useContext(AuthContext);
  return context || defaultAuthState;
}

