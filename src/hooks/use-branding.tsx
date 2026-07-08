import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "empresa_plataforma")
        .maybeSingle();

      if (error) throw error;

      if (data && data.value) {
        const company = data.value as any;
        setBranding({
          logo_url: company.logo_url || null,
          favicon_url: company.favicon_url || null,
          primary_color: company.primary_color || "#0284c7",
          secondary_color: company.secondary_color || "#0f172a",
          font_primary: company.font_primary || "Inter",
          custom_domain: company.custom_domain || null,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar configurações de branding:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  // Dynamically apply styles when branding state changes
  useEffect(() => {
    if (!branding) {
      // Reset to defaults if not loaded
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
    try {
      // 1. Get current values first to preserve registration details
      const { data: current, error: fetchErr } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "empresa_plataforma")
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      
      const currentVal = (current?.value as any) || {};
      const updatedValue = {
        ...currentVal,
        ...newBranding
      };

      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "empresa_plataforma",
          value: updatedValue,
          descricao: "Dados da Empresa e Identidade Visual da Instância"
        });

      if (error) throw error;

      setBranding((prev) => {
        if (!prev) return {
          logo_url: updatedValue.logo_url || null,
          favicon_url: updatedValue.favicon_url || null,
          primary_color: updatedValue.primary_color || "#0284c7",
          secondary_color: updatedValue.secondary_color || "#0f172a",
          font_primary: updatedValue.font_primary || "Inter",
          custom_domain: updatedValue.custom_domain || null,
        } as any;
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
