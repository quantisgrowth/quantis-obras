import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

  async function fetchRoles(userId: string) {
    try {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      setRoles((data ?? []).map((r) => r.role as AppRole));
    } catch (err) {
      console.error("Erro ao carregar roles:", err);
    }
  }

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const currentSession = data.session;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchRoles(currentSession.user.id);
        } else {
          setRoles([]);
        }
      } catch (err) {
        console.error("Erro ao inicializar sessão:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    initializeAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!active) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        setLoading(true);
        await fetchRoles(s.user.id);
        if (active) setLoading(false);
      } else {
        setRoles([]);
        if (active) setLoading(false);
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