import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocomplete, lookupCEP, PlaceResult } from "@/components/address-autocomplete";
import { sendWhatsappMessage } from "@/lib/evolution";
import { toast } from "sonner";
import {
  Building,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Calendar,
  Check,
  CreditCard,
  Sparkles,
  HardHat,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/novo-agendamento")({
  head: () => ({ meta: [{ title: "Novo Agendamento — Geraltest Brasil" }] }),
  component: NovoAgendamento,
});

// ── Constants ──────────────────────────────────────────────────────────────
const FALLBACK_SERVICES = [
  { id: "s1", sku: "GTB-CP-25", nome_servico: "Moldagem e Ensaio de Compressão (fck 25 MPa)", valor_venda_editavel: 120.0, categoria: "Concreto" },
  { id: "s2", sku: "GTB-CP-30", nome_servico: "Moldagem e Ensaio de Compressão (fck 30 MPa)", valor_venda_editavel: 130.0, categoria: "Concreto" },
  { id: "s3", sku: "GTB-CP-40", nome_servico: "Moldagem e Ensaio de Compressão (fck 40 MPa)", valor_venda_editavel: 150.0, categoria: "Concreto" },
  { id: "s4", sku: "GTB-SLUMP", nome_servico: "Ensaio de Abatimento (Slump Test)", valor_venda_editavel: 80.0, categoria: "Concreto" },
];

const FALLBACK_CIDADES = [
  { id: "c1", nome_cidade: "Sorocaba", mobilizacao_base: 0.0, pedagio_estimado: 0.0 },
  { id: "c2", nome_cidade: "Votorantim", mobilizacao_base: 150.0, pedagio_estimado: 0.0 },
  { id: "c3", nome_cidade: "Itu", mobilizacao_base: 350.0, pedagio_estimado: 24.5 },
  { id: "c4", nome_cidade: "Salto", mobilizacao_base: 400.0, pedagio_estimado: 24.5 },
  { id: "c5", nome_cidade: "Boituva", mobilizacao_base: 500.0, pedagio_estimado: 38.0 },
];

const BR_STATES = [
  { value: "AC", label: "Acre" }, { value: "AL", label: "Alagoas" }, { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" }, { value: "BA", label: "Bahia" }, { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" }, { value: "ES", label: "Espírito Santo" }, { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" }, { value: "MT", label: "Mato Grosso" }, { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" }, { value: "PA", label: "Pará" }, { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" }, { value: "PE", label: "Pernambuco" }, { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" }, { value: "RN", label: "Rio Grande do Norte" }, { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" }, { value: "RR", label: "Roraima" }, { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" }, { value: "SE", label: "Sergipe" }, { value: "TO", label: "Tocantins" },
];

// Idades de cura disponíveis (NBR 5738)
const IDADES_CURA = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 28, label: "28 dias" },
  { value: 63, label: "63 dias" },
];

// ── Types ──────────────────────────────────────────────────────────────────
interface IdadeCPConfig {
  idade: number;
  qtd: number; // mínimo 2, múltiplo de 2
}

// ── Component ──────────────────────────────────────────────────────────────
function NovoAgendamento() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // DB data
  const [obras, setObras] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [cidades, setCidades] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Step 1 — Obra
  const [selectedObraId, setSelectedObraId] = useState<string>("nova");
  const [obraRascunhoId, setObraRascunhoId] = useState<string | null>(null); // ID da obra salva ao avançar Step 1
  const [novaObraNome, setNovaObraNome] = useState("");
  const [novaObraEndereco, setNovaObraEndereco] = useState("");
  const [novaObraCidade, setNovaObraCidade] = useState("");
  const [novaObraLat, setNovaObraLat] = useState(0);
  const [novaObraLng, setNovaObraLng] = useState(0);
  const [novaObraCEP, setNovaObraCEP] = useState("");
  const [novaObraNumero, setNovaObraNumero] = useState("");
  const [novaObraBairro, setNovaObraBairro] = useState("");
  const [novaObraEstado, setNovaObraEstado] = useState("");
  const [cnoObra, setCnoObra] = useState("");
  const [responsavelObra, setResponsavelObra] = useState("");
  const [cargoResponsavel, setCargoResponsavel] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  // Step 2 — Serviço
  const [selectedServicoId, setSelectedServicoId] = useState("");
  const [volumeM3, setVolumeM3] = useState(10);
  const [qtdCaminhoes, setQtdCaminhoes] = useState(1);
  // Idades configuradas com qtd de CPs por idade (NBR 5738)
  const [idadesCP, setIdadesCP] = useState<IdadeCPConfig[]>([
    { idade: 7, qtd: 2 },
    { idade: 28, qtd: 2 },
  ]);

  // Step 3 — Agenda
  const [dataServico, setDataServico] = useState("");
  const [horarioNaObra, setHorarioNaObra] = useState("08:00");
  const [observacoes, setObservacoes] = useState("");

  // Step 4 — Pagamento
  const [formaPagamento, setFormaPagamento] = useState("Pix");

  // ── Derived values ────────────────────────────────────────────────────
  // Total de CPs = soma de (qtd por idade) × nº de caminhões
  const cpsContratados = idadesCP.reduce((acc, i) => acc + i.qtd, 0) * qtdCaminhoes;

  // ── Load data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function loadData() {
      let { data: profile } = await supabase
        .from("profiles")
        .select("*, empresa:empresas_clientes(*)")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (!profile.empresa_id) {
          toast.info("Configurando empresa de testes no seu perfil...");
          let { data: empresa } = await supabase.from("empresas_clientes").select("id").eq("cnpj", "12.345.678/0001-99").single();
          let newEmpresaId = empresa?.id;
          if (!newEmpresaId) {
            const { data: newEmpresa } = await supabase.from("empresas_clientes").insert({ razao_social: "Geraltest Cliente Padrão Ltda", cnpj: "12.345.678/0001-99" }).select("id").single();
            newEmpresaId = newEmpresa?.id;
          }
          if (newEmpresaId) {
            await supabase.from("profiles").update({ empresa_id: newEmpresaId }).eq("id", user.id);
            profile.empresa_id = newEmpresaId;
          }
        }
        setUserProfile(profile);
      }

      if (profile?.empresa_id) {
        const { data: listObras } = await supabase.from("obras").select("*").eq("empresa_id", profile.empresa_id);
        if (listObras && listObras.length > 0) { setObras(listObras); setSelectedObraId(listObras[0].id); }
      }

      const { data: listServicos } = await supabase.from("servicos_catalogo").select("*").eq("ativo", true);
      if (listServicos && listServicos.length > 0) { setServicos(listServicos); setSelectedServicoId(listServicos[0].id); }
      else { setServicos(FALLBACK_SERVICES); setSelectedServicoId(FALLBACK_SERVICES[0].id); }

      const { data: listCidades } = await supabase.from("cidades_atendidas").select("*");
      setCidades(listCidades && listCidades.length > 0 ? listCidades : FALLBACK_CIDADES);
    }
    loadData();
  }, [user]);

  // ── CEP lookup ────────────────────────────────────────────────────────
  const handleCEPBlur = async () => {
    const clean = novaObraCEP.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    const result = await lookupCEP(clean);
    setCepLoading(false);
    if (!result) { toast.error("CEP não encontrado."); return; }
    if (result.formattedAddress) setNovaObraEndereco(result.formattedAddress);
    if (result.cidade) setNovaObraCidade(result.cidade);
    if (result.bairro) setNovaObraBairro(result.bairro);
    if (result.estado) setNovaObraEstado(result.estado);
    toast.success("Endereço preenchido pelo CEP!");
  };

  // ── Google Maps place handler ─────────────────────────────────────────
  const handlePlaceSelected = (place: PlaceResult) => {
    setNovaObraEndereco(place.formattedAddress);
    if (place.cidade) setNovaObraCidade(place.cidade);
    if (place.latitude) setNovaObraLat(place.latitude);
    if (place.longitude) setNovaObraLng(place.longitude);
    if (place.cep) setNovaObraCEP(place.cep);
    if (place.bairro) setNovaObraBairro(place.bairro);
    if (place.estado) setNovaObraEstado(place.estado);
    if (place.numero) setNovaObraNumero(place.numero);
  };

  // ── Idade CP helpers ──────────────────────────────────────────────────
  const toggleIdade = (idade: number) => {
    setIdadesCP((prev) => {
      const exists = prev.find((i) => i.idade === idade);
      if (exists) {
        if (prev.length === 1) { toast.error("Selecione ao menos uma idade de cura."); return prev; }
        return prev.filter((i) => i.idade !== idade);
      }
      return [...prev, { idade, qtd: 2 }].sort((a, b) => a.idade - b.idade);
    });
  };

  const setQtdIdade = (idade: number, qtd: number) => {
    // Must be >= 2 and even
    const valid = Math.max(2, Math.round(qtd / 2) * 2);
    setIdadesCP((prev) => prev.map((i) => (i.idade === idade ? { ...i, qtd: valid } : i)));
  };

  // ── Financials ────────────────────────────────────────────────────────
  const getSelectedService = () => servicos.find((s) => s.id === selectedServicoId) || FALLBACK_SERVICES[0];

  const getSelectedObraCity = () => {
    if (selectedObraId === "nova") return novaObraCidade;
    return obras.find((o) => o.id === selectedObraId)?.cidade || "Sorocaba";
  };

  const getMobilizationCosts = () => {
    const city = cidades.find((c) => c.nome_cidade.toLowerCase() === getSelectedObraCity().toLowerCase());
    const mobBase = city ? parseFloat(city.mobilizacao_base) : 0;
    const toll = city ? parseFloat(city.pedagio_estimado) : 0;
    return { mobilizacao: isNaN(mobBase) ? 0 : mobBase, pedagios: isNaN(toll) ? 0 : toll };
  };

  const servicePrice = getSelectedService()?.valor_venda_editavel || 0;
  const rawServiceCost = cpsContratados * servicePrice;
  const { mobilizacao, pedagios } = getMobilizationCosts();
  const subtotal = rawServiceCost + mobilizacao + pedagios;
  const impostoPct = 0.12;
  const descontoPct = formaPagamento === "Pix" || formaPagamento === "Cartao" ? 0.05 : 0;
  const imposto = subtotal * impostoPct;
  const desconto = subtotal * descontoPct;
  const total = subtotal + imposto - desconto;

  // ── Validation ────────────────────────────────────────────────────────
  const step1Valid =
    selectedObraId !== "nova" ||
    (!!novaObraNome.trim() && !!novaObraEndereco.trim() && !!novaObraCEP.trim() &&
      !!novaObraNumero.trim() && !!novaObraBairro.trim() && !!novaObraEstado &&
      !!cnoObra.trim() && !!responsavelObra.trim() && !!cargoResponsavel.trim());

  // ── Submit ────────────────────────────────────────────────────────────
  const handleConfirmBooking = async () => {
    if (!user || !userProfile) return;
    setLoading(true);
    try {
      let finalObraId = selectedObraId;

      if (selectedObraId === "nova") {
        const { data: newObra, error: obraErr } = await supabase
          .from("obras")
          .insert({
            empresa_id: userProfile.empresa_id,
            nome_obra: novaObraNome, cno: cnoObra, responsavel: responsavelObra,
            cargo_responsavel: cargoResponsavel, endereco: novaObraEndereco,
            numero: novaObraNumero, bairro: novaObraBairro, estado: novaObraEstado,
            cidade: novaObraCidade, cep: novaObraCEP || null,
            latitude: novaObraLat, longitude: novaObraLng,
          })
          .select("id").single();
        if (obraErr) throw obraErr;
        finalObraId = newObra.id;
      }

      const { data: agendamento, error: bookingErr } = await supabase
        .from("agendamentos_medicoes")
        .insert({
          obra_id: finalObraId, empresa_id: userProfile.empresa_id,
          servico_id: selectedServicoId, criado_por: user.id,
          data_servico: dataServico, horario_na_obra: horarioNaObra + ":00",
          volume_m3: volumeM3, qtd_caminhoes: qtdCaminhoes,
          cps_contratados: cpsContratados,
          idades_cp: JSON.stringify(idadesCP),
          status_pagamento: formaPagamento === "Pix" || formaPagamento === "Cartao" ? "Pago" : "Pendente",
          forma_pagamento: formaPagamento, status_agendamento: "Pendente_Tecnico",
          valor_subtotal: subtotal, valor_desconto: desconto,
          valor_imposto_12: imposto, valor_total: total,
          observacoes: observacoes || null,
        })
        .select("*").single();
      if (bookingErr) throw bookingErr;

      toast.success("Agendamento criado com sucesso!");

      const phoneToNotify = userProfile.telefone || "5515999999999";
      await sendWhatsappMessage({
        number: phoneToNotify,
        text:
          `🛠️ *Geraltest Brasil - Confirmação de Agendamento*\n\n` +
          `Olá, *${userProfile.nome_completo || user.email}*!\n` +
          `Seu pedido de controle tecnológico foi criado com sucesso.\n\n` +
          `📝 *Código do Pedido:* ${agendamento.codigo_pedido}\n` +
          `📅 *Data:* ${new Date(dataServico).toLocaleDateString("pt-BR")}\n` +
          `⏰ *Horário na Obra:* ${horarioNaObra}\n` +
          `📋 *Serviço:* ${getSelectedService().nome_servico}\n` +
          `🏗️ *CPs Contratados:* ${cpsContratados} unidades\n` +
          `🧪 *Idades:* ${idadesCP.map((i) => `${i.idade}d(${i.qtd}CPs)`).join(", ")}\n` +
          `💰 *Valor Total:* R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
          `💳 *Forma de Pagamento:* ${formaPagamento}\n\n` +
          `Um técnico certificado será alocado em breve. Obrigado pela preferência!`,
      });

      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error("Erro ao criar agendamento", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dashboard" })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Novo Agendamento</h1>
          <p className="text-sm text-muted-foreground">Preencha os passos para solicitar o controle tecnológico.</p>
        </div>
      </div>

      {/* Progress */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold sm:text-sm">
        {[
          { num: 1, label: "Obra", icon: Building },
          { num: 2, label: "Serviço", icon: HardHat },
          { num: 3, label: "Agenda", icon: Calendar },
          { num: 4, label: "Resumo", icon: Calculator },
        ].map(({ num, label, icon: Icon }) => (
          <div key={num} className={`flex flex-col items-center gap-2 border-b-2 py-3 transition-colors ${step >= num ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            <div className={`grid h-8 w-8 place-items-center rounded-full text-xs transition-colors ${step === num ? "bg-primary text-primary-foreground" : step > num ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {step > num ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      <Card className="shadow-[var(--shadow-elegant)]">
        <CardContent className="pt-6">

          {/* ── STEP 1: OBRA ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-base font-bold">Onde será realizada a medição?</Label>
                <Select value={selectedObraId} onValueChange={setSelectedObraId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma obra cadastrada" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nome_obra} ({o.cidade})</SelectItem>
                    ))}
                    <SelectItem value="nova">+ Adicionar Nova Obra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedObraId === "nova" && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 space-y-4 animate-in fade-in-50 duration-200">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <Building className="h-5 w-5" />
                    <span>Cadastrar Nova Obra</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Nome */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="obra-nome">Identificação / Nome da Obra</Label>
                      <Input id="obra-nome" placeholder="Ex: Edifício Bella Vista - Torre A" value={novaObraNome} onChange={(e) => setNovaObraNome(e.target.value)} />
                    </div>

                    {/* CEP com lookup automático */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-cep">CEP</Label>
                      <div className="relative">
                        <Input
                          id="obra-cep"
                          placeholder="Ex: 18275-690"
                          value={novaObraCEP}
                          onChange={(e) => setNovaObraCEP(e.target.value)}
                          onBlur={handleCEPBlur}
                          maxLength={9}
                        />
                        {cepLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Digite o CEP e saia do campo — o endereço será preenchido automaticamente.</p>
                    </div>

                    {/* Endereço autocomplete */}
                    <div className="space-y-2 md:col-span-2">
                      <Label>Buscar Endereço (Google Maps)</Label>
                      <AddressAutocomplete
                        value={novaObraEndereco}
                        onChange={setNovaObraEndereco}
                        onPlaceSelected={handlePlaceSelected}
                      />
                    </div>

                    {/* Número */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-numero">Número</Label>
                      <Input id="obra-numero" placeholder="Ex: 260" value={novaObraNumero} onChange={(e) => setNovaObraNumero(e.target.value)} />
                    </div>

                    {/* Bairro */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-bairro">Bairro</Label>
                      <Input id="obra-bairro" placeholder="Ex: Centro" value={novaObraBairro} onChange={(e) => setNovaObraBairro(e.target.value)} />
                    </div>

                    {/* Estado */}
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select value={novaObraEstado} onValueChange={setNovaObraEstado}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {BR_STATES.map((st) => (
                            <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cidade */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-cidade">Cidade</Label>
                      <Input id="obra-cidade" disabled value={novaObraCidade} className="bg-muted text-muted-foreground" placeholder="Preenchido automaticamente" />
                    </div>

                    {/* CNO */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-cno">CNO</Label>
                      <Input id="obra-cno" placeholder="Ex: 12345678" value={cnoObra} onChange={(e) => setCnoObra(e.target.value)} />
                    </div>

                    {/* Responsável */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-responsavel">Responsável Pela Obra</Label>
                      <Input id="obra-responsavel" placeholder="Nome completo" value={responsavelObra} onChange={(e) => setResponsavelObra(e.target.value)} />
                    </div>

                    {/* Cargo */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="obra-cargo">Cargo do Responsável</Label>
                      <Input id="obra-cargo" placeholder="Ex: Engenheiro Civil" value={cargoResponsavel} onChange={(e) => setCargoResponsavel(e.target.value)} />
                    </div>
                  </div>

                  {(novaObraLat !== 0 || novaObraLng !== 0) && (
                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md flex gap-2 items-center">
                      <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Lat: {novaObraLat.toFixed(6)} | Lng: {novaObraLng.toFixed(6)} detectado pelo satélite.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    // Salvar obra imediatamente ao avançar (se for nova)
                    if (selectedObraId === "nova" && userProfile?.empresa_id) {
                      try {
                        // Verifica se já salvou antes nesta sessão
                        if (!obraRascunhoId) {
                          const { data: newObra, error } = await supabase
                            .from("obras")
                            .insert({
                              empresa_id: userProfile.empresa_id,
                              nome_obra: novaObraNome,
                              cno: cnoObra,
                              responsavel: responsavelObra,
                              cargo_responsavel: cargoResponsavel,
                              endereco: novaObraEndereco,
                              numero: novaObraNumero,
                              bairro: novaObraBairro,
                              estado: novaObraEstado,
                              cidade: novaObraCidade,
                              cep: novaObraCEP || null,
                              latitude: novaObraLat,
                              longitude: novaObraLng,
                            })
                            .select("id")
                            .single();
                          if (!error && newObra) {
                            setObraRascunhoId(newObra.id);
                            setObras((prev) => [...prev, { ...newObra, nome_obra: novaObraNome, cidade: novaObraCidade }]);
                            toast.success("Obra salva! Você pode acessá-la em novos agendamentos.");
                          }
                        }
                      } catch (_) {}
                    }
                    setStep(2);
                  }}
                  disabled={!step1Valid}
                >
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: SERVIÇO ──────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Serviço */}
              <div className="space-y-2">
                <Label className="text-base font-bold">Selecione o Serviço de Controle</Label>
                <Select value={selectedServicoId} onValueChange={setSelectedServicoId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o ensaio tecnológico" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome_servico} — R$ {Number(s.valor_venda_editavel).toFixed(2)} / CP
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Volume e caminhões */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vol-m3">Volume de Concreto (m³)</Label>
                  <Input id="vol-m3" type="number" min={1} value={volumeM3} onChange={(e) => setVolumeM3(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qtd-caminhoes">Quantidade de Betoneiras</Label>
                  <Input id="qtd-caminhoes" type="number" min={1} value={qtdCaminhoes} onChange={(e) => setQtdCaminhoes(Number(e.target.value))} />
                </div>
              </div>

              {/* Idades de cura — NBR 5738 */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-bold">Idades de Cura dos CPs (NBR 5738)</Label>
                  <p className="text-xs text-muted-foreground mt-1">Selecione as idades e defina a quantidade por idade. Mínimo: 2 CPs por idade, sempre em número par.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {IDADES_CURA.map(({ value: idade, label }) => {
                    const config = idadesCP.find((i) => i.idade === idade);
                    const selected = !!config;
                    return (
                      <div key={idade} className={`rounded-xl border p-4 transition-all ${selected ? "border-primary bg-primary/5" : "border-border bg-muted/20 opacity-60"}`}>
                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleIdade(idade)}
                          className={`w-full flex items-center justify-between mb-3 font-semibold text-sm ${selected ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <span>{label}</span>
                          <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                            {selected && <Check className="h-3 w-3 text-white" />}
                          </span>
                        </button>

                        {/* Qtd input */}
                        {selected && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">CPs por betoneira</Label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setQtdIdade(idade, (config?.qtd ?? 2) - 2)}
                                className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                                disabled={(config?.qtd ?? 2) <= 2}
                              >−</button>
                              <span className="text-sm font-bold text-foreground w-6 text-center">{config?.qtd ?? 2}</span>
                              <button
                                type="button"
                                onClick={() => setQtdIdade(idade, (config?.qtd ?? 2) + 2)}
                                className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                              >+</button>
                            </div>
                          </div>
                        )}

                        {!selected && (
                          <p className="text-xs text-muted-foreground">Clique para incluir</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Resumo de CPs */}
                <div className="rounded-lg bg-muted/40 border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Resumo de Corpos de Prova</p>
                  <div className="flex flex-wrap gap-3">
                    {idadesCP.map((i) => (
                      <span key={i.idade} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {i.idade} dias × {i.qtd} CPs/betoneira
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground">Total de CPs ({qtdCaminhoes} betoneira{qtdCaminhoes > 1 ? "s" : ""})</span>
                    <span className="text-lg font-extrabold text-primary">{cpsContratados} CPs</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                <Button onClick={() => setStep(3)} disabled={!selectedServicoId || idadesCP.length === 0}>
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: AGENDA ───────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Data — input nativo maior */}
                <div className="space-y-2">
                  <Label htmlFor="data-servico" className="text-base font-bold">Data do Serviço</Label>
                  <input
                    id="data-servico"
                    type="date"
                    required
                    value={dataServico}
                    onChange={(e) => setDataServico(e.target.value)}
                    style={{ fontSize: "1.1rem", padding: "0.6rem 0.75rem", minHeight: "3rem" }}
                    className="flex w-full rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">Selecione a data em que o técnico deve estar na obra.</p>
                </div>

                {/* Horário */}
                <div className="space-y-2">
                  <Label htmlFor="hora-servico" className="text-base font-bold">Horário de Chegada na Obra</Label>
                  <input
                    id="hora-servico"
                    type="time"
                    required
                    value={horarioNaObra}
                    onChange={(e) => setHorarioNaObra(e.target.value)}
                    style={{ fontSize: "1.1rem", padding: "0.6rem 0.75rem", minHeight: "3rem" }}
                    className="flex w-full rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs" className="text-base font-bold">Observações / Recomendações Especiais</Label>
                <textarea
                  id="obs"
                  rows={3}
                  placeholder="Ex: Falar com encarregado Roberto ao chegar. CPs de 7, 14, 28 + Teste Slump na primeira carga."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                <Button onClick={() => setStep(4)} disabled={!dataServico || !horarioNaObra}>
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: RESUMO ───────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Resumo do Pedido e Memória de Cálculo
              </h2>

              {/* CPs por idade */}
              <div className="rounded-xl border border-border bg-muted/10 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">CPs por Idade de Cura</p>
                <div className="flex flex-wrap gap-2">
                  {idadesCP.map((i) => (
                    <span key={i.idade} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {i.idade} dias — {i.qtd} CPs/betoneira × {qtdCaminhoes} betoneira{qtdCaminhoes > 1 ? "s" : ""} = {i.qtd * qtdCaminhoes} CPs
                    </span>
                  ))}
                </div>
              </div>

              {/* Memória de cálculo */}
              <div className="rounded-xl border border-border p-5 space-y-4 bg-muted/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{getSelectedService()?.nome_servico} ({cpsContratados} CPs × R$ {servicePrice.toFixed(2)})</span>
                  <span className="font-semibold">R$ {rawServiceCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deslocamento e Mobilização ({getSelectedObraCity() || "Sorocaba"})</span>
                  <span className="font-semibold">R$ {mobilizacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                {pedagios > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo Estimado de Pedágios</span>
                    <span className="font-semibold">R$ {pedagios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t border-border pt-3 flex justify-between text-sm font-semibold">
                  <span>Subtotal Bruto</span>
                  <span>R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Imposto de Serviço Retido (12%)</span>
                  <span>+ R$ {imposto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                {desconto > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Desconto Pagamento Rápido (5%)</span>
                    <span>− R$ {desconto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t-2 border-border pt-4 flex justify-between text-lg font-extrabold">
                  <span>Valor Total Final</span>
                  <span className="text-primary text-xl">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Forma de pagamento */}
              <div className="space-y-3">
                <Label className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Escolha a Forma de Pagamento
                </Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { val: "Pix", label: "Pix (5% desc)", desc: "Imediato" },
                    { val: "Cartao", label: "Cartão (5% desc)", desc: "1x sem juros" },
                    { val: "Boleto_14", label: "Boleto 14 dias", desc: "Sujeito a crédito" },
                    { val: "Boleto_28", label: "Boleto 28 dias", desc: "Sujeito a crédito" },
                  ].map((p) => (
                    <button key={p.val} type="button" onClick={() => setFormaPagamento(p.val)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${formaPagamento === p.val ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
                      <span className="text-sm font-bold block">{p.label}</span>
                      <span className="text-[10px] block opacity-80 mt-1">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 p-4 border border-amber-500/20 text-xs text-amber-600 flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  <span className="font-bold block">Modo Validação Rápida</span>
                  O pagamento real foi postergado. Clicar em "Confirmar" registra o agendamento no Supabase e envia notificação no WhatsApp.
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}><ChevronLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                <Button onClick={handleConfirmBooking} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando...</> : "Confirmar Agendamento"}
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

