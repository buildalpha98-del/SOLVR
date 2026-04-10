import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Alert } from "react-native";
import { trpc } from "./trpc";
import { clearStoredCookie, getStoredCookie, storeSessionCookie } from "./cookieStore";

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
    // DEBUG: show each stage so we can see where login fails on real device.
    // Remove these Alert.alert calls once login is confirmed working.
    const showStage = (title: string, body: string) =>
      new Promise<void>((resolve) => {
        Alert.alert(title, body, [{ text: "OK", onPress: () => resolve() }]);
      });

    try {
      await showStage("[1/5] Login start", `Calling passwordLogin for ${email}`);

      const result = await (trpc as any).portal.passwordLogin.mutate({
        email,
        password,
      });

      await showStage(
        "[2/5] passwordLogin OK",
        `Response: ${JSON.stringify(result).slice(0, 300)}`
      );

      if (result?.setCookie) {
        await storeSessionCookie(result.setCookie);
      }

      const storedCookie = await getStoredCookie();
      await showStage(
        "[3/5] Cookie check",
        `Stored cookie: ${storedCookie ? storedCookie.slice(0, 60) + "..." : "NONE (iOS likely stripped Set-Cookie)"}`
      );

      await showStage("[4/5] Calling me.query", "Fetching /portal.me");

      const me = await (trpc as any).portal.me.query();

      await showStage(
        "[5/5] me.query OK",
        `User: ${me?.email ?? "no email"} id=${me?.id ?? "no id"}`
      );

      setUser(me);
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.data?.message ||
        err?.shape?.message ||
        JSON.stringify(err).slice(0, 300) ||
        "unknown";
      const code = err?.data?.code || err?.shape?.data?.code || "no-code";
      Alert.alert("[X] Login failed", `code: ${code}\nmessage: ${msg}`);
      throw err;
    }
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
