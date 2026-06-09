import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;
  signOut: () => Promise<void>;
  enterAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isGuest: false,
  signOut: async () => {},
  enterAsGuest: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem("mugla-guest") === "true";
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        setIsGuest(false);
        localStorage.removeItem("mugla-guest");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
    localStorage.removeItem("mugla-guest");
  };

  const enterAsGuest = () => {
    setIsGuest(true);
    localStorage.setItem("mugla-guest", "true");
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isGuest, signOut, enterAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};
