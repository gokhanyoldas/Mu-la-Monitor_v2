import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type UserRole = "admin" | "analyst" | "user" | "guest";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;
  isAuthenticated: boolean;
  hasDashboardAccess: boolean;
  role: UserRole;
  isAdmin: boolean;
  canManageData: boolean;
  canGenerateAI: boolean;
  canGenerateExecutiveReport: boolean;
  canRunAdminActions: boolean;
  signOut: () => Promise<void>;
  enterAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isGuest: false,
  isAuthenticated: false,
  hasDashboardAccess: false,
  role: "guest",
  isAdmin: false,
  canManageData: false,
  canGenerateAI: false,
  canGenerateExecutiveReport: false,
  canRunAdminActions: false,
  signOut: async () => {},
  enterAsGuest: () => {},
});

import { safeStorage } from "@/lib/safe-storage";

export const useAuth = () => useContext(AuthContext);

function resolveUserRole(session: Session | null, user: User | null): UserRole {
  if (!session || !user) return "guest";
  const rawRole = (session.user?.app_metadata?.role ?? user.app_metadata?.role ?? "user")
    .toString()
    .toLowerCase();
  if (rawRole === "admin") return "admin";
  if (rawRole === "analyst") return "analyst";
  return "user";
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => {
    return safeStorage.getItem("mugla-guest") === "true";
  });

  useEffect(() => {
    // Get initial session safely
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsGuest(false);
        safeStorage.removeItem("mugla-guest");
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        setIsGuest(false);
        safeStorage.removeItem("mugla-guest");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore sign-out network errors and always clear local session state
    }
    setUser(null);
    setSession(null);
    setIsGuest(false);
    setIsLoading(false);
    safeStorage.removeItem("mugla-guest");
  };

  const enterAsGuest = () => {
    setIsGuest(true);
    safeStorage.setItem("mugla-guest", "true");
  };

  // Misafir modu (mugla-guest) ASLA isAuthenticated = true vermez; yalnızca salt-okunur erişim sağlar.
  const isAuthenticated = Boolean(user && session);
  const hasDashboardAccess = isAuthenticated || isGuest;
  const role = resolveUserRole(session, user);
  const isAdmin = isAuthenticated && role === "admin";
  const canManageData = isAuthenticated && (role === "admin" || role === "analyst");
  const canGenerateAI = isAuthenticated;
  const canGenerateExecutiveReport = canManageData;
  const canRunAdminActions = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isGuest: !isAuthenticated && isGuest,
        isAuthenticated,
        hasDashboardAccess,
        role,
        isAdmin,
        canManageData,
        canGenerateAI,
        canGenerateExecutiveReport,
        canRunAdminActions,
        signOut,
        enterAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
