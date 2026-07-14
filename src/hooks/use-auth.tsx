import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "cliente" | "tecnico" | "admin";

export interface Profile {
  id: string;
  nome_completo: string;
  telefone: string | null;
  empresa_id: string | null;
  sub_role: string | null;
  permissoes: string[] | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
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
          
          const [rolesRes, profileRes] = await Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", s.user.id),
            supabase.from("profiles").select("*").eq("id", s.user.id).single()
          ]);

          if (active) {
            setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
            setProfile(profileRes.data as any);
          }
        } else {
          setSession(null);
          setUser(null);
          currentUserRef.current = null;
          setRoles([]);
          setProfile(null);
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
        setProfile(null);
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
        const [rolesRes, profileRes] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", s.user.id),
          supabase.from("profiles").select("*").eq("id", s.user.id).single()
        ]);

        if (active) {
          setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
          setProfile(profileRes.data as any);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
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
      profile,
      loading,
      signOut: async () => {
        currentUserRef.current = null;
        await supabase.auth.signOut();
      },
    }),
    [user, session, roles, profile, loading],
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