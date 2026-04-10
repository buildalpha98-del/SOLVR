import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { trpc } from "./trpc";
import { clearStoredCookie, storeSessionCookie } from "./cookieStore";

type Feature = string;

interface User {
  id: string;
  email: string;
  name: string;
  businessName?: string;
  onboardingCompleted: boolean;
  plan?: string;
  features: Feature[];
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
    const result = await (trpc as any).portal.passwordLogin.mutate({
      email,
      password,
    });
    if (result?.setCookie) {
      await storeSessionCookie(result.setCookie);
    }
    const me = await (trpc as any).portal.me.query();
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
