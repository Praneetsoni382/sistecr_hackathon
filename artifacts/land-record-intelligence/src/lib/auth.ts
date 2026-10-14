import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "./firestore-tracked";

// DETERMINISTIC DEVELOPMENT OFFICER IDENTITY
// Marked clearly as DEVELOPMENT ONLY per system specification
export const DEV_OFFICER = {
  id: "dev-officer-land-records",
  email: "dev.officer@landrecords.local",
  fullName: "Development Officer",
  role: "OFFICER",
  department: "Land Records Intake & Verification",
  isDevelopmentUser: true,
} as const;

export interface OfficerProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  createdAt?: any;
  updatedAt?: any;
  isDevelopmentUser?: boolean;
}

// Development mode flag - defaults to true so preview opens directly to dashboard
// Can be toggled when full Firebase Auth login flow is enabled
export const IS_DEVELOPMENT_MODE = true;

export interface AppAuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string;
  officer: OfficerProfile;
  firebaseUser: User | null;
}

const LOCAL_STORAGE_KEY = "vision_vault_officer_profile";

export function getLocalOfficerProfile(): OfficerProfile {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return { ...DEV_OFFICER, ...JSON.parse(saved) };
      }
    }
  } catch (err) {
    console.warn("Error reading local officer profile:", err);
  }
  return DEV_OFFICER;
}

export async function ensureDevelopmentOfficerProfile(): Promise<OfficerProfile> {
  const local = getLocalOfficerProfile();
  try {
    const profileRef = doc(db, "profiles", DEV_OFFICER.id);
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const firestoreData = snap.data() as OfficerProfile;
      const merged = { ...DEV_OFFICER, ...local, ...firestoreData };
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    } else {
      const initialProfile = {
        ...local,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(profileRef, initialProfile, { merge: true });
      return initialProfile;
    }
  } catch (err) {
    console.warn("[Auth] Using local/in-memory fallback for dev officer profile:", err);
    return local;
  }
}

export async function saveOfficerProfile(updates: Partial<OfficerProfile>): Promise<OfficerProfile> {
  const current = getLocalOfficerProfile();
  const updated: OfficerProfile = {
    ...current,
    ...updates,
    id: current.id || DEV_OFFICER.id,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn("Failed saving to localStorage:", e);
  }

  try {
    const profileRef = doc(db, "profiles", DEV_OFFICER.id);
    await setDoc(
      profileRef,
      {
        ...updated,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[Auth] Firestore profile update warning:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("officer_profile_updated", { detail: updated }));
  }

  return updated;
}

export function useAppAuth(): AppAuthState {
  const [authState, setAuthState] = useState<AppAuthState>({
    isLoaded: true,
    isSignedIn: true,
    userId: DEV_OFFICER.id,
    officer: DEV_OFFICER,
    firebaseUser: null,
  });

  useEffect(() => {
    if (IS_DEVELOPMENT_MODE) {
      ensureDevelopmentOfficerProfile()
        .then((officer) => {
          setAuthState({
            isLoaded: true,
            isSignedIn: true,
            userId: DEV_OFFICER.id,
            officer,
            firebaseUser: null,
          });
        })
        .catch(() => {
          // Keep default fallback
        });
      return;
    }

    // Live Firebase Auth listener for production restoration
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profileSnap = await getDoc(doc(db, "profiles", user.uid));
          const profileData = profileSnap.exists()
            ? (profileSnap.data() as OfficerProfile)
            : {
                id: user.uid,
                email: user.email || "",
                fullName: user.displayName || "Officer",
                role: "OFFICER",
                department: "Land Records",
              };
          setAuthState({
            isLoaded: true,
            isSignedIn: true,
            userId: user.uid,
            officer: profileData,
            firebaseUser: user,
          });
        } catch {
          setAuthState({
            isLoaded: true,
            isSignedIn: true,
            userId: user.uid,
            officer: {
              id: user.uid,
              email: user.email || "",
              fullName: user.displayName || "Officer",
              role: "OFFICER",
              department: "Land Records",
            },
            firebaseUser: user,
          });
        }
      } else {
        setAuthState({
          isLoaded: true,
          isSignedIn: false,
          userId: "",
          officer: DEV_OFFICER,
          firebaseUser: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return authState;
}
