import { useState, useEffect } from "react";
import { useBranding, type BrandingConfig, getContrastColor } from "@/hooks/use-branding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Paintbrush, 
  Upload, 
  Check, 
  Type, 
  Image as ImageIcon, 
  Eye, 
  RotateCcw,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

// Presets Definition
interface Preset {
  name: string;
  primary: string;
  secondary: string;
}

const PRESETS: Preset[] = [
  { name: "Azul Corporativo", primary: "#0284c7", secondary: "#0f172a" },
  { name: "Laranja Industrial", primary: "#ea580c", secondary: "#18181b" },
  { name: "Verde Construtora", primary: "#059669", secondary: "#1f2937" },
  { name: "Monocromático Sleek", primary: "#18181b", secondary: "#27272a" },
  { name: "Violeta Tecnológico", primary: "#7c3aed", secondary: "#09090b" },
];

const FONTS = ["Inter", "Outfit", "Roboto", "Montserrat", "Poppins"];

export function BrandingSettings() {
  const { branding, updateBranding, refreshBranding } = useBranding();

  // Settings states initialized with current branding or defaults
  const [primaryColor, setPrimaryColor] = useState("#0284c7");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [fontPrimary, setFontPrimary] = useState("Inter");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [faviconUrl, setFaviconUrl] = useState<string>("");
  const [customDomain, setCustomDomain] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Load current branding values once fetched
  useEffect(() => {
    if (branding) {
      setPrimaryColor(branding.primary_color);
      setSecondaryColor(branding.secondary_color);
      setFontPrimary(branding.font_primary);
      setLogoUrl(branding.logo_url || "");
      setFaviconUrl(branding.favicon_url || "");
      setCustomDomain(branding.custom_domain || "");
    }
  }, [branding]);

  // Handle Logo Upload and Convert to Base64 (fully robust)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "favicon") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      if (type === "logo") {
        setLogoUrl(base64String);
        toast.success("Logotipo carregado com sucesso!");
      } else {
        setFaviconUrl(base64String);
        toast.success("Favicon carregado com sucesso!");
      }
    };
    reader.onerror = (error) => {
      console.error("Erro ao ler arquivo:", error);
      toast.error("Erro ao carregar o arquivo.");
    };
  };

  const handleApplyPreset = (preset: Preset) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    toast.success(`Preset "${preset.name}" aplicado na visualização!`);
  };

  const handleReset = () => {
    if (branding) {
      setPrimaryColor(branding.primary_color);
      setSecondaryColor(branding.secondary_color);
      setFontPrimary(branding.font_primary);
      setLogoUrl(branding.logo_url || "");
      setFaviconUrl(branding.favicon_url || "");
      setCustomDomain(branding.custom_domain || "");
    } else {
      setPrimaryColor("#0284c7");
      setSecondaryColor("#0f172a");
      setFontPrimary("Inter");
      setLogoUrl("");
      setFaviconUrl("");
      setCustomDomain("");
    }
    toast.info("Configurações revertidas para o último estado salvo.");
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateBranding({
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      font_primary: fontPrimary,
      logo_url: logoUrl || null,
      favicon_url: faviconUrl || null,
      custom_domain: customDomain || null,
    });
    setIsSaving(false);
    if (success) {
      refreshBranding();
    }
  };

  // Contrast calculations for preview
  const primaryContrastText = getContrastColor(primaryColor);
  const secondaryContrastText = getContrastColor(secondaryColor);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Coluna de Configuração */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Paintbrush className="h-5 w-5 text-primary" />
              Identidade Visual da Empresa
            </CardTitle>
            <CardDescription>
              Configure o logotipo, as cores e as fontes que seus clientes e equipe verão na plataforma.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 1. Logotipo e Favicon */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground border-b pb-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Logotipos & Ícones
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="logo-upload" className="text-xs font-semibold">Logotipo Principal</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-28 border rounded bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden p-2">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground text-center">Sem Logo (Usa texto)</span>
                      )}
                    </div>
                    <label className="h-9 px-3 rounded-md border border-input bg-background hover:bg-accent text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all">
                      <Upload className="h-3.5 w-3.5" />
                      Escolher Logo
                      <input 
                        type="file" 
                        id="logo-upload" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleLogoUpload(e, "logo")} 
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="favicon-upload" className="text-xs font-semibold">Favicon da Aba (.ico/.png)</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 border rounded bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden p-2">
                      {faviconUrl ? (
                        <img src={faviconUrl} alt="Favicon" className="h-6 w-6 object-contain" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <label className="h-9 px-3 rounded-md border border-input bg-background hover:bg-accent text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all">
                      <Upload className="h-3.5 w-3.5" />
                      Escolher Ícone
                      <input 
                        type="file" 
                        id="favicon-upload" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleLogoUpload(e, "favicon")} 
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Cores */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground border-b pb-2">
                <Paintbrush className="h-4 w-4 text-muted-foreground" /> Paleta de Cores
              </h3>

              {/* Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Presets Combinados
                </Label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-accent flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <span className="flex h-3 w-6 rounded overflow-hidden border">
                        <span className="w-1/2 h-full" style={{ backgroundColor: preset.primary }} />
                        <span className="w-1/2 h-full" style={{ backgroundColor: preset.secondary }} />
                      </span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom color picker */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="primary-color" className="text-xs font-semibold">Cor Primária (Botões, Títulos)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="color" 
                      id="primary-color" 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)} 
                      className="w-10 h-10 p-0 border border-input rounded-md cursor-pointer overflow-hidden" 
                    />
                    <Input 
                      type="text" 
                      value={primaryColor} 
                      maxLength={7}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="text-xs font-mono font-semibold uppercase" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondary-color" className="text-xs font-semibold">Cor Secundária (Fundo, Headers)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="color" 
                      id="secondary-color" 
                      value={secondaryColor} 
                      onChange={(e) => setSecondaryColor(e.target.value)} 
                      className="w-10 h-10 p-0 border border-input rounded-md cursor-pointer overflow-hidden" 
                    />
                    <Input 
                      type="text" 
                      value={secondaryColor} 
                      maxLength={7}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="text-xs font-mono font-semibold uppercase" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Fontes */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground border-b pb-2">
                <Type className="h-4 w-4 text-muted-foreground" /> Tipografia
              </h3>

              <div className="space-y-2">
                <Label htmlFor="font-primary" className="text-xs font-semibold">Fonte Principal do Sistema</Label>
                <select
                  id="font-primary"
                  value={fontPrimary}
                  onChange={(e) => setFontPrimary(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {FONTS.map((font) => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  A tipografia selecionada será carregada via Google Fonts e aplicada a toda a plataforma.
                </p>
              </div>
            </div>

            {/* 4. Domínio Customizado */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground border-b pb-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Domínio Customizado (Avançado)
              </h3>
              <div className="space-y-2">
                <Label htmlFor="custom-domain" className="text-xs font-semibold">Endereço de Acesso White-Label</Label>
                <Input 
                  id="custom-domain"
                  type="text" 
                  value={customDomain} 
                  placeholder="Ex: obras.construtorax.com.br"
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="text-xs" 
                />
                <p className="text-[10px] text-muted-foreground">
                  Se você configurar um subdomínio próprio apontado para a nossa plataforma, a página de login inteira também assumirá suas cores.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={handleReset} 
            className="text-xs gap-1.5"
            type="button"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reverter Alterações
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="text-xs gap-1.5"
          >
            {isSaving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {/* Coluna de Preview */}
      <div className="lg:col-span-5">
        <div className="sticky top-6 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-4 w-4" /> Pré-visualização ao Vivo
          </h3>

          <Card className="border border-border overflow-hidden bg-background shadow-md">
            {/* Mock Header */}
            <div 
              className="px-4 py-3 border-b flex items-center justify-between transition-all"
              style={{ backgroundColor: secondaryColor, color: secondaryContrastText }}
            >
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-6 max-w-[100px] object-contain" />
                ) : (
                  <span className="text-xs font-extrabold uppercase tracking-wide">Minha Empresa</span>
                )}
              </div>
              <div className="flex gap-2">
                <span className="h-2 w-8 rounded bg-current opacity-30" />
                <span className="h-2 w-8 rounded bg-current opacity-30" />
              </div>
            </div>

            {/* Mock Page Content */}
            <div className="p-6 space-y-6 bg-zinc-50 dark:bg-zinc-950 text-foreground" style={{ fontFamily: `"${fontPrimary}", sans-serif` }}>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Controle Tecnológico Obras</h4>
                <p className="text-[11px] text-muted-foreground">Visualização instantânea de cores, fonte e logotipo.</p>
              </div>

              {/* Mock Status Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm space-y-1">
                  <span className="text-[10px] text-muted-foreground">Agendamentos</span>
                  <div className="text-base font-bold transition-all" style={{ color: primaryColor }}>12 Ativos</div>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm space-y-1">
                  <span className="text-[10px] text-muted-foreground">Localidades</span>
                  <div className="text-base font-bold">4 Obras</div>
                </div>
              </div>

              {/* Elements & Buttons Preview */}
              <div className="space-y-3 p-4 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Exemplo de Botões</span>
                  <span 
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold transition-all"
                    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                  >
                    Ativo
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <button 
                    className="w-full py-2 px-3 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: primaryColor, color: primaryContrastText }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Botão Primário
                  </button>

                  <button 
                    className="w-full py-2 px-3 rounded-md text-xs font-semibold border transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    style={{ color: primaryColor, borderColor: primaryColor }}
                  >
                    Botão Secundário
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
