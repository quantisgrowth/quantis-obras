import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocomplete, PlaceResult } from "@/components/address-autocomplete";
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
  MessageSquare,
  AlertTriangle 
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/novo-agendamento")({
  head: () => ({ meta: [{ title: "Novo Agendamento — Geraltest Brasil" }] }),
  component: NovoAgendamento,
});

// Fallback catalog services (in case DB is empty)
const FALLBACK_SERVICES = [
  { id: "s1", sku: "GTB-CP-25", nome_servico: "Moldagem e Ensaio de Compressão (fck 25 MPa)", valor_venda_editavel: 120.00, categoria: "Concreto" },
  { id: "s2", sku: "GTB-CP-30", nome_servico: "Moldagem e Ensaio de Compressão (fck 30 MPa)", valor_venda_editavel: 130.00, categoria: "Concreto" },
  { id: "s3", sku: "GTB-CP-40", nome_servico: "Moldagem e Ensaio de Compressão (fck 40 MPa)", valor_venda_editavel: 150.00, categoria: "Concreto" },
  { id: "s4", sku: "GTB-SLUMP", nome_servico: "Ensaio de Abatimento (Slump Test)", valor_venda_editavel: 80.00, categoria: "Concreto" },
];

// Fallback cities (in case DB is empty)
const FALLBACK_CIDADES = [
  { id: "c1", nome_cidade: "Sorocaba", mobilizacao_base: 0.00, pedagio_estimado: 0.00 },
  { id: "c2", nome_cidade: "Votorantim", mobilizacao_base: 150.00, pedagio_estimado: 0.00 },
  { id: "c3", nome_cidade: "Itu", mobilizacao_base: 350.00, pedagio_estimado: 24.50 },
  { id: "c4", nome_cidade: "Salto", mobilizacao_base: 400.00, pedagio_estimado: 24.50 },
  { id: "c5", nome_cidade: "Boituva", mobilizacao_base: 500.00, pedagio_estimado: 38.00 },
];

function NovoAgendamento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Step navigation
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Lists from DB or fallbacks
  const [obras, setObras] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [cidades, setCidades] = useState<any[]>([]);
  
  // Form State
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedObraId, setSelectedObraId] = useState<string>("nova");
  
  // New fields for manual address entry

  const [novaObraNumero, setNovaObraNumero] = useState("");
  const [novaObraBairro, setNovaObraBairro] = useState("");
  const [novaObraEstado, setNovaObraEstado] = useState("");
  // Additional obra details
  const [cnoObra, setCnoObra] = useState("");
  const [responsavelObra, setResponsavelObra] = useState("");
  const [cargoResponsavel, setCargoResponsavel] = useState("");

  // Brazilian states list (value,label)
  const BR_STATES = [
    { value: "AC", label: "Acre" },
    { value: "AL", label: "Alagoas" },
    { value: "AP", label: "Amapá" },
    { value: "AM", label: "Amazonas" },
    { value: "BA", label: "Bahia" },
    { value: "CE", label: "Ceará" },
    { value: "DF", label: "Distrito Federal" },
    { value: "ES", label: "Espírito Santo" },
    { value: "GO", label: "Goiás" },
    { value: "MA", label: "Maranhão" },
    { value: "MT", label: "Mato Grosso" },
    { value: "MS", label: "Mato Grosso do Sul" },
    { value: "MG", label: "Minas Gerais" },
    { value: "PA", label: "Pará" },
    { value: "PB", label: "Paraíba" },
    { value: "PR", label: "Paraná" },
    { value: "PE", label: "Pernambuco" },
    { value: "PI", label: "Piauí" },
    { value: "RJ", label: "Rio de Janeiro" },
    { value: "RN", label: "Rio Grande do Norte" },
    { value: "RS", label: "Rio Grande do Sul" },
    { value: "RO", label: "Rondônia" },
    { value: "RR", label: "Roraima" },
    { value: "SC", label: "Santa Catarina" },
    { value: "SP", label: "São Paulo" },
    { value: "SE", label: "Sergipe" },
    { value: "TO", label: "Tocantins" },
  ];



  // Service details
  const [selectedServicoId, setSelectedServicoId] = useState("");
  const [volumeM3, setVolumeM3] = useState(10);
  const [qtdCaminhoes, setQtdCaminhoes] = useState(1);
  const [cpsContratados, setCpsContratados] = useState(4);

  // Date and Time
  const [dataServico, setDataServico] = useState("");
  const [horarioNaObra, setHorarioNaObra] = useState("08:00");
  const [observacoes, setObservacoes] = useState("");

  // Payment method
  const [formaPagamento, setFormaPagamento] = useState("Pix");

  // Load Initial Data
  useEffect(() => {
    if (!user) return;
    
    async function loadData() {
      // 1. Get user profile and ensure company exists
      let { data: profile } = await supabase
        .from("profiles")
        .select("*, empresa:empresas_clientes(*)")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        // If company is missing, create a default one to make sure foreign key checks pass
        if (!profile.empresa_id) {
          toast.info("Configurando empresa de testes no seu perfil...");
          
          // Check if default mock company exists or create it
          let { data: empresa } = await supabase
            .from("empresas_clientes")
            .select("id")
            .eq("cnpj", "12.345.678/0001-99")
            .single();
            
          let newEmpresaId = empresa?.id;
          
          if (!newEmpresaId) {
            const { data: newEmpresa } = await supabase
              .from("empresas_clientes")
              .insert({
                razao_social: "Geraltest Cliente Padrão Ltda",
                cnpj: "12.345.678/0001-99",
              })
              .select("id")
              .single();
            newEmpresaId = newEmpresa?.id;
          }

          if (newEmpresaId) {
            await supabase
              .from("profiles")
              .update({ empresa_id: newEmpresaId })
              .eq("id", user.id);
              
            profile.empresa_id = newEmpresaId;
          }
        }
        setUserProfile(profile);
      }

      // 2. Fetch Obras
      if (profile?.empresa_id) {
        const { data: listObras } = await supabase
          .from("obras")
          .select("*")
          .eq("empresa_id", profile.empresa_id);
        
        if (listObras && listObras.length > 0) {
          setObras(listObras);
          setSelectedObraId(listObras[0].id);
        }
      }

      // 3. Fetch Servicos
      const { data: listServicos } = await supabase
        .from("servicos_catalogo")
        .select("*")
        .eq("ativo", true);
      
      if (listServicos && listServicos.length > 0) {
        setServicos(listServicos);
        setSelectedServicoId(listServicos[0].id);
      } else {
        setServicos(FALLBACK_SERVICES);
        setSelectedServicoId(FALLBACK_SERVICES[0].id);
      }

      // 4. Fetch Cidades
      const { data: listCidades } = await supabase
        .from("cidades_atendidas")
        .select("*");
      
      if (listCidades && listCidades.length > 0) {
        setCidades(listCidades);
      } else {
        setCidades(FALLBACK_CIDADES);
      }
    }

    loadData();
  }, [user]);

  // Handle Autocomplete selection
  const handlePlaceSelected = (place: PlaceResult) => {
    setNovaObraEndereco(place.formattedAddress);
    setNovaObraCidade(place.cidade);
    setNovaObraLat(place.latitude);
    setNovaObraLng(place.longitude);
    if (place.cep) setNovaObraCEP(place.cep);
    // If the place includes state component, you could set it here (placeholder for now)
    // Example: setNovaObraEstado(place.estado);
  };

  // Auto calculate CPs based on trucks
  useEffect(() => {
    // Standard rule: 4 CPs per truck (for testing ages e.g. 7, 14, 28 + backup)
    setCpsContratados(qtdCaminhoes * 4);
  }, [qtdCaminhoes]);

  // Calculations
  const getSelectedService = () => {
    return servicos.find((s) => s.id === selectedServicoId) || FALLBACK_SERVICES[0];
  };

  const getSelectedObraCity = () => {
    if (selectedObraId === "nova") {
      return novaObraCidade;
    }
    const obra = obras.find((o) => o.id === selectedObraId);
    return obra ? obra.cidade : "Sorocaba";
  };

  const getMobilizationCosts = () => {
    const cityName = getSelectedObraCity();
    const city = cidades.find((c) => c.nome_cidade.toLowerCase() === cityName.toLowerCase());
    
    // Convert base values if exists
    const mobBase = city ? parseFloat(city.mobilizacao_base) : 0;
    const toll = city ? parseFloat(city.pedagio_estimado) : 0;
    
    return {
      mobilizacao: isNaN(mobBase) ? 0 : mobBase,
      pedagios: isNaN(toll) ? 0 : toll,
    };
  };

  // Financial summary
  const servicePrice = getSelectedService()?.valor_venda_editavel || 0;
  const rawServiceCost = cpsContratados * servicePrice;
  const { mobilizacao, pedagios } = getMobilizationCosts();
  
  const subtotal = rawServiceCost + mobilizacao + pedagios;
  
  // App settings parameters (default fallbacks matching public.app_settings migrations)
  const impostoPct = 0.12; // 12%
  const descontoPct = formaPagamento === "Pix" || formaPagamento === "Cartao" ? 0.05 : 0; // 5%
  
  const imposto = subtotal * impostoPct;
  const desconto = subtotal * descontoPct;
  const total = subtotal + imposto - desconto;

  // Submit Booking to Supabase
  const handleConfirmBooking = async () => {
    if (!user || !userProfile) return;
    setLoading(true);

    try {
      let finalObraId = selectedObraId;

      // 1. If "nova" obra, create it in DB first
      if (selectedObraId === "nova") {
        if (!novaObraNome.trim() || !novaObraEndereco.trim()) {
          toast.error("Preencha todos os campos da obra.");
          setLoading(false);
          return;
        }

        const { data: newObra, error: obraErr } = await supabase
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

        if (obraErr) throw obraErr;
        finalObraId = newObra.id;
      }

      // 2. Insert Agendamento
      const { data: agendamento, error: bookingErr } = await supabase
        .from("agendamentos_medicoes")
        .insert({
          obra_id: finalObraId,
          empresa_id: userProfile.empresa_id,
          servico_id: selectedServicoId,
          criado_por: user.id,
          data_servico: dataServico,
          horario_na_obra: horarioNaObra + ":00", // Format HH:MM:SS
          volume_m3: volumeM3,
          qtd_caminhoes: qtdCaminhoes,
          cps_contratados: cpsContratados,
          status_pagamento: formaPagamento === "Pix" || formaPagamento === "Cartao" ? "Pago" : "Pendente",
          forma_pagamento: formaPagamento,
          status_agendamento: "Pendente_Tecnico",
          valor_subtotal: subtotal,
          valor_desconto: desconto,
          valor_imposto_12: imposto,
          valor_total: total,
          observacoes: observacoes || null,
        })
        .select("*")
        .single();

      if (bookingErr) throw bookingErr;

      toast.success("Agendamento criado com sucesso!");

      // 3. Trigger Evolution API WhatsApp Alert
      const phoneToNotify = userProfile.telefone || "5515999999999";
      const userText = 
        `🛠️ *Geraltest Brasil - Confirmação de Agendamento*\n\n` +
        `Olá, *${userProfile.nome_completo || user.email}*!\n` +
        `Seu pedido de controle tecnológico foi criado com sucesso.\n\n` +
        `📝 *Código do Pedido:* ${agendamento.codigo_pedido}\n` +
        `📅 *Data:* ${new Date(dataServico).toLocaleDateString("pt-BR")}\n` +
        `⏰ *Horário na Obra:* ${horarioNaObra}\n` +
        `📋 *Serviço:* ${getSelectedService().nome_servico}\n` +
        `🏗️ *CPs Contratados:* ${cpsContratados} unidades\n` +
        `💰 *Valor Total:* R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
        `💳 *Forma de Pagamento:* ${formaPagamento}\n\n` +
        `Um técnico certificado será alocado em breve. Obrigado pela preferência!`;

      await sendWhatsappMessage({
        number: phoneToNotify,
        text: userText,
      });

      // Redirect back to dashboard
      navigate({ to: "/dashboard" });

    } catch (err: any) {
      console.error("Booking error:", err);
      toast.error("Erro ao criar agendamento", { description: err.message || "Erro no banco de dados" });
    } finally {
      setLoading(false);
    }
  };

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

      {/* Progress Indicators */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold sm:text-sm">
        {[
          { num: 1, label: "Obra", icon: Building },
          { num: 2, label: "Serviço", icon: HardHat },
          { num: 3, label: "Agenda", icon: Calendar },
          { num: 4, label: "Resumo", icon: Calculator },
        ].map(({ num, label, icon: Icon }) => (
          <div
            key={num}
            className={`flex flex-col items-center gap-2 border-b-2 py-3 transition-colors ${
              step >= num ? "border-primary text-primary" : "border-border text-muted-foreground"
            }`}
          >
            <div className={`grid h-8 w-8 place-items-center rounded-full text-xs transition-colors ${
              step === num ? "bg-primary text-primary-foreground" : step > num ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {step > num ? <Check className="h-4 w-4" /> : num}
            </div>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* WIZARD CARD PANEL */}
      <Card className="shadow-[var(--shadow-elegant)]">
        <CardContent className="pt-6">
          {/* STEP 1: OBRA DETAILS */}
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
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome_obra} ({o.cidade})
                      </SelectItem>
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
                    <div className="space-y-2">
                      <Label htmlFor="obra-nome">Identificação / Nome da Obra</Label>
                      <Input
                        id="obra-nome"
                        placeholder="Ex: Edifício Bella Vista - Torre A"
                        value={novaObraNome}
                        onChange={(e) => setNovaObraNome(e.target.value)}
                      />
                    </div>

          {/* CEP */}
          <div className="space-y-2">
            <Label htmlFor="obra-cep">CEP</Label>
            <Input
              id="obra-cep"
              placeholder="Ex: 18000-000"
              value={novaObraCEP}
              onChange={(e) => setNovaObraCEP(e.target.value)}
            />
          </div>
          {/* Endereço Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="obra-autocomplete">Buscar Endereço (Google Maps)</Label>
            <AddressAutocomplete
              value={novaObraEndereco}
              onChange={setNovaObraEndereco}
              onPlaceSelected={handlePlaceSelected}
            />
          </div>
          {/* Número */}
          <div className="space-y-2">
            <Label htmlFor="obra-numero">Número</Label>
            <Input
              id="obra-numero"
              placeholder="Ex: 123"
              value={novaObraNumero}
              onChange={(e) => setNovaObraNumero(e.target.value)}
            />
          </div>
          {/* Bairro */}
          <div className="space-y-2">
            <Label htmlFor="obra-bairro">Bairro</Label>
            <Input
              id="obra-bairro"
              placeholder="Ex: Centro"
              value={novaObraBairro}
              onChange={(e) => setNovaObraBairro(e.target.value)}
            />
          </div>
          {/* Estado */}
          <div className="space-y-2">
            <Label htmlFor="obra-estado">Estado</Label>
            <Select value={novaObraEstado} onValueChange={setNovaObraEstado}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o estado" />
              </SelectTrigger>
              <SelectContent>
                {BR_STATES.map((st) => (
                  <SelectItem key={st.value} value={st.value}>
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Cidade (auto preenchido) */}
          <div className="space-y-2">
            <Label htmlFor="obra-cidade">Cidade</Label>
            <Input
              id="obra-cidade"
              disabled
              value={novaObraCidade}
              className="bg-muted text-muted-foreground"
            />
          </div>
          {/* Novo campos de obra */}
          <div className="space-y-2">
            <Label htmlFor="obra-cno">CNO</Label>
            <Input
              id="obra-cno"
              placeholder="Ex: 12345678"
              value={cnoObra}
              onChange={(e) => setCnoObra(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obra-responsavel">Responsável Pela Obra</Label>
            <Input
              id="obra-responsavel"
              placeholder="Nome completo"
              value={responsavelObra}
              onChange={(e) => setResponsavelObra(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obra-cargo">Cargo do Responsável</Label>
            <Input
              id="obra-cargo"
              placeholder="Ex: Engenheiro" 
              value={cargoResponsavel}
              onChange={(e) => setCargoResponsavel(e.target.value)}
            />
          </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md flex gap-2 items-center">
                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>Lat: {novaObraLat.toFixed(6)} | Lng: {novaObraLng.toFixed(6)} detectado pelo satélite da obra.</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button 
                  onClick={() => setStep(2)}
                  disabled={
                    selectedObraId === "nova" && (
                      !novaObraCEP ||
                      !novaObraEndereco ||
                      !novaObraNumero ||
                      !novaObraBairro ||
                      !novaObraEstado ||
                      !cnoObra ||
                      !responsavelObra ||
                      !cargoResponsavel
                    )
                  }
                >
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: SERVICE DETAILS */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-bold">Selecione o Serviço de Controle</Label>
                  <Select value={selectedServicoId} onValueChange={setSelectedServicoId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o ensaio tecnológico" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome_servico} - R$ {s.valor_venda_editavel.toFixed(2)} / CP
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="vol-m3">Volume de Concreto (m³)</Label>
                    <Input
                      id="vol-m3"
                      type="number"
                      min={1}
                      value={volumeM3}
                      onChange={(e) => setVolumeM3(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qtd-caminhoes">Qtd de Caminhões (Ciclos)</Label>
                    <Input
                      id="qtd-caminhoes"
                      type="number"
                      min={1}
                      value={qtdCaminhoes}
                      onChange={(e) => setQtdCaminhoes(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cps-contratados">Corpos de Prova (CPs)</Label>
                    <Input
                      id="cps-contratados"
                      type="number"
                      min={1}
                      value={cpsContratados}
                      onChange={(e) => setCpsContratados(Number(e.target.value))}
                    />
                    <p className="text-[10px] text-muted-foreground">Sugestão: 4 CPs por caminhão</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button onClick={() => setStep(3)}>
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: DATE AND TIME */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="data-servico">Data do Serviço</Label>
                  <Input
                    id="data-servico"
                    type="date"
                    required
                    value={dataServico}
                    onChange={(e) => setDataServico(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora-servico">Horário de Chegada na Obra</Label>
                  <Input
                    id="hora-servico"
                    type="time"
                    required
                    value={horarioNaObra}
                    onChange={(e) => setHorarioNaObra(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Observações / Recomendações Especiais</Label>
                <Input
                  id="obs"
                  placeholder="Ex: Falar com encarregado Roberto ao chegar. CPs de 7, 14, 28 + Teste Slump na primeira carga."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button onClick={() => setStep(4)} disabled={!dataServico || !horarioNaObra}>
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: FINANCIAL SUMMARY & CONFIRMATION */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Resumo do Pedido e Memória de Cálculo
              </h2>

              <div className="rounded-xl border border-border p-5 space-y-4 bg-muted/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{getSelectedService()?.nome_servico} ({cpsContratados} CPs x R$ {servicePrice.toFixed(2)})</span>
                  <span className="font-semibold text-foreground">R$ {rawServiceCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deslocamento e Mobilização ({getSelectedObraCity()})</span>
                  <span className="font-semibold text-foreground">R$ {mobilizacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>

                {pedagios > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo Estimado de Pedágios</span>
                    <span className="font-semibold text-foreground">R$ {pedagios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="border-t border-border pt-3 flex justify-between text-sm font-semibold">
                  <span className="text-foreground">Subtotal Bruto</span>
                  <span className="text-foreground">R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-sm text-green-600">
                  <span>Imposto de Serviço Retido (12%)</span>
                  <span>+ R$ {imposto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>

                {desconto > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Desconto Pagamento Rápido (5%)</span>
                    <span>- R$ {desconto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="border-t-2 border-border pt-4 flex justify-between text-lg font-extrabold text-foreground">
                  <span>Valor Total Final</span>
                  <span className="text-primary text-xl">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Payment selection */}
              <div className="space-y-3">
                <Label className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Escolha a Forma de Pagamento (Validação Rápida)
                </Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { val: "Pix", label: "Pix (5% desc)", desc: "Imediato" },
                    { val: "Cartao", label: "Cartão (5% desc)", desc: "1x sem juros" },
                    { val: "Boleto_14", label: "Boleto 14 dias", desc: "Sujeito a crédito" },
                    { val: "Boleto_28", label: "Boleto 28 dias", desc: "Sujeito a crédito" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setFormaPagamento(p.val)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                        formaPagamento === p.val
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
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
                  O pagamento real foi postergado conforme solicitado. Clicar em "Confirmar" fará o registro imediato do agendamento no Supabase e enviará a notificação do WhatsApp.
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                
                <Button 
                  onClick={handleConfirmBooking} 
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  {loading ? "Confirmando agendamento..." : "Confirmar Agendamento"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
