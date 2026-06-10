import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "cliente" | "tecnico" | "admin";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let hasInitialized = false;
    setLoading(true);

    async function initialize() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!active) return;

        if (s?.user) {
          setSession(s);
          setUser(s.user);
          currentUserRef.current = s.user.id;
          const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
          if (active) {
            setRoles((data ?? []).map((r) => r.role as AppRole));
          }
        } else {
          setSession(null);
          setUser(null);
          currentUserRef.current = null;
          setRoles([]);
        }
      } catch (err) {
        console.error("Erro ao inicializar sessão:", err);
      } finally {
        hasInitialized = true;
        if (active) setLoading(false);
      }
    }

    initialize();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!active) return;
      
      // Ignore initial trigger event to avoid race conditions with initialize()
      if (!hasInitialized) return;

      if (!s?.user) {
        setSession(null);
        setUser(null);
        currentUserRef.current = null;
        setRoles([]);
        setLoading(false);
        return;
      }

      // Only show full page loader on explicit new sign-in transitions to prevent flickering on background actions (e.g. TOKEN_REFRESHED) or tab focus
      const isNewSignIn = event === "SIGNED_IN" && currentUserRef.current !== s.user.id;
      if (isNewSignIn) {
        setLoading(true);
      }

      setSession(s);
      setUser(s.user);
      currentUserRef.current = s.user.id;

      try {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
        if (active) {
          setRoles((data ?? []).map((r) => r.role as AppRole));
        }
      } catch (err) {
        console.error("Erro ao carregar roles:", err);
      } finally {
        if (active && isNewSignIn) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      roles,
      loading,
      signOut: async () => {
        currentUserRef.current = null;
        await supabase.auth.signOut();
      },
    }),
    [user, session, roles, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function primaryRole(roles: AppRole[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("tecnico")) return "tecnico";
  return "cliente";
}