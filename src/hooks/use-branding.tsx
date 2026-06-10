import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { toast } from "sonner";

export interface BrandingConfig {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_primary: string;
  custom_domain: string | null;
}

interface BrandingContextValue {
  branding: BrandingConfig | null;
  isAdminEmpresa: boolean;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  updateBranding: (newBranding: Partial<BrandingConfig>) => Promise<boolean>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

// Helper to calculate contrast color (YIQ formula)
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#09090b" : "#ffffff";
}

// Helper to darken a color slightly for gradients
export function darkenColor(hexColor: string, percent = 15): string {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return hexColor;
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent / 100))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent / 100))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent / 100))));

  const rHex = r.toString(16).padStart(2, "0");
  const gHex = g.toString(16).padStart(2, "0");
  const bHex = b.toString(16).padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isAdminEmpresa, setIsAdminEmpresa] = useState(false);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const fetchBranding = async () => {
    if (!user) {
      setBranding(null);
      setIsAdminEmpresa(false);
      setLoading(false);
      return;
    }

    try {
      // 1. Get user profile to find empresa_id and is_admin_empresa
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("empresa_id, is_admin_empresa")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.empresa_id) {
        setEmpresaId(profile.empresa_id);
        setIsAdminEmpresa(profile.is_admin_empresa || false);

        // 2. Get company branding
        const { data: company, error: companyError } = await supabase
          .from("empresas_clientes")
          .select("logo_url, favicon_url, primary_color, secondary_color, font_primary, custom_domain")
          .eq("id", profile.empresa_id)
          .single();

        if (companyError) throw companyError;

        if (company) {
          setBranding({
            logo_url: company.logo_url,
            favicon_url: company.favicon_url,
            primary_color: company.primary_color || "#0284c7",
            secondary_color: company.secondary_color || "#0f172a",
            font_primary: company.font_primary || "Inter",
            custom_domain: company.custom_domain,
          });
        }
      }
    } catch (err) {
      console.error("Erro ao carregar configurações de branding:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, [user]);

  // Dynamically apply styles when branding state changes
  useEffect(() => {
    if (!branding) {
      // Reset to defaults if not logged in or no branding
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--primary-foreground");
      document.documentElement.style.removeProperty("--secondary");
      document.documentElement.style.removeProperty("--secondary-foreground");
      document.documentElement.style.removeProperty("--ring");
      document.documentElement.style.removeProperty("--gradient-primary");
      document.body.style.fontFamily = "";
      
      const defaultFavicon = document.getElementById("favicon") as HTMLLinkElement;
      if (defaultFavicon) defaultFavicon.href = "/favicon.ico";
      return;
    }

    const { primary_color, secondary_color, font_primary, favicon_url } = branding;

    // Apply primary color & contrast foreground color
    const contrastPrimary = getContrastColor(primary_color);
    document.documentElement.style.setProperty("--primary", primary_color);
    document.documentElement.style.setProperty("--primary-foreground", contrastPrimary);
    document.documentElement.style.setProperty("--ring", primary_color);
    
    // Gradient primary
    const darkPrimary = darkenColor(primary_color, 15);
    document.documentElement.style.setProperty(
      "--gradient-primary",
      `linear-gradient(135deg, ${primary_color}, ${darkPrimary})`
    );

    // Apply secondary color & contrast
    const contrastSecondary = getContrastColor(secondary_color);
    document.documentElement.style.setProperty("--secondary", secondary_color);
    document.documentElement.style.setProperty("--secondary-foreground", contrastSecondary);

    // Load and apply custom font
    if (font_primary) {
      const linkId = "dynamic-google-font";
      let link = document.getElementById(linkId) as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${font_primary.replace(/\s+/g, "+")}:wght@300;400;500;600;700&display=swap`;
      document.body.style.fontFamily = `"${font_primary}", sans-serif`;
    }

    // Apply favicon
    if (favicon_url) {
      let favicon = document.getElementById("favicon") as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.id = "favicon";
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = favicon_url;
    }
  }, [branding]);

  const updateBranding = async (newBranding: Partial<BrandingConfig>): Promise<boolean> => {
    if (!empresaId || !isAdminEmpresa) {
      toast.error("Você não tem permissão para alterar as configurações desta empresa.");
      return false;
    }

    try {
      const { error } = await supabase
        .from("empresas_clientes")
        .update({
          logo_url: newBranding.logo_url,
          favicon_url: newBranding.favicon_url,
          primary_color: newBranding.primary_color,
          secondary_color: newBranding.secondary_color,
          font_primary: newBranding.font_primary,
          custom_domain: newBranding.custom_domain,
        })
        .eq("id", empresaId);

      if (error) throw error;

      setBranding((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          ...newBranding,
        };
      });

      toast.success("Identidade visual atualizada com sucesso!");
      return true;
    } catch (err: any) {
      console.error("Erro ao atualizar branding:", err);
      toast.error(err?.message || "Erro ao salvar as configurações de identidade visual.");
      return false;
    }
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        isAdminEmpresa,
        loading,
        refreshBranding: fetchBranding,
        updateBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
