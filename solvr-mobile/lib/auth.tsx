import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { trpc } from "./trpc";
import { clearStoredCookie } from "./cookieStore";

type Feature = string;

/**
 * Mirrors the shape returned by the backend `portal.me` tRPC procedure.
 * The backend does NOT return `id`/`email`/`name` — it returns `clientId`,
 * `contactName`, `businessName`, plus quote branding fields. Keep this
 * interface in sync with server/routers/portal.ts → `me` procedure.
 */
interface User {
  clientId: string;
  businessName: string;
  contactName: string;
  tradeType?: string | null;
  plan?: string;
  features: Feature[];
  featureMatrix?: Record<string, Feature[]>;
  logoUrl?: string | null;
  brandColour?: string;
  abn?: string | null;
  paymentTerms?: string | null;
  defaultNotes?: string | null;
  gstRate?: string;
  replyToEmail?: string | null;
  validityDays?: number;
  onboardingCompleted: boolean;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasFeature: (feature: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const me = await (trpc as any).portal.me.query();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    await (trpc as any).portal.passwordLogin.mutate({ email, password });
    // Cookie is captured automatically by customFetch in lib/trpc.ts
    // (reads Set-Cookie from response headers and stores via SecureStore).
    const me = await (trpc as any).portal.me.query();
    if (!me) {
      throw new Error("Authentication succeeded but /portal.me returned null. Check the session cookie.");
    }
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await (trpc as any).portal.logout.mutate();
    } catch {
      // ignore
    }
    await clearStoredCookie();
    setUser(null);
  }, []);

  const hasFeature = useCallback(
    (feature: string) => {
      return user?.features?.includes(feature) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hasFeature,
        login,
        logout,
        refetchUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
