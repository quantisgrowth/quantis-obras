import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocomplete, lookupCEP, PlaceResult } from "@/components/address-autocomplete";
import { toast } from "sonner";
import { createBooking } from "@/lib/booking.functions";
import { sendWhatsappMessage } from "@/lib/whatsapp.functions";
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
  MessageCircle,
  Clock3,
  UserCheck,
  XCircle,
  ClipboardList,
  CalendarPlus,
} from "lucide-react";

type NovoAgendamentoSearch = {
  obraId?: string;
};

export const Route = createFileRoute("/_authenticated/novo-agendamento")({
  head: () => ({ meta: [{ title: "Novo Agendamento — Quantis Obras" }] }),
  validateSearch: (search: Record<string, unknown>): NovoAgendamentoSearch => {
    return {
      obraId: search.obraId as string | undefined,
    };
  },
  component: NovoAgendamento,
});

// ── Constants ──────────────────────────────────────────────────────────────
// Serviços carregados exclusivamente do banco de dados (sem fallback com IDs falsos)

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
const CARGOS_OBRA = [
  "Almoxarife",
  "Analista de Planejamento e Controle de Produção (PCP)",
  "Arquiteto Residente / Visitante",
  "Encarregado (de carpintaria, armação, instalações, etc.)",
  "Engenheiro Ambiental",
  "Engenheiro Chefe",
  "Engenheiro Civil Residente / Visitante",
  "Engenheiro de Campo / Setor",
  "Engenheiro de Controle de Qualidade (CQ)",
  "Engenheiro de Planejamento / Orçamento",
  "Engenheiro de Produção",
  "Engenheiro de Segurança do Trabalho",
  "Gerente de Contrato",
  "Gerente de Operações",
  "Gerente de Produção",
  "Gestor de Suprimentos / Compras de Campo",
  "Mestre de Obras",
  "Mestre Geral",
  "Técnico de Controle de Qualidade (CQ)",
  "Técnico de Planejamento",
  "Técnico de Segurança do Trabalho (TST)",
  "Técnico em Edificações",
];

const IDADES_CURA = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 28, label: "28 dias" },
  { value: 63, label: "63 dias" },
];

interface IdadeCPConfig {
  idade: number;
  qtd: number;
}

interface ConfiguredService {
  client_id: string;
  servico_id: string;
  nome_servico: string;
  sku: string;
  categoria: string;
  valor_venda_editavel: number;
  volume_m3?: number;
  tamanho_betoneira?: number;
  qtd_caminhoes?: number;
  idades_cp?: IdadeCPConfig[];
  qtd_ensaios?: number;
  pontos_por_ensaio?: number;
  quantidade?: number;
  is_orcamento_manual?: boolean;
  reason_manual_quote?: string;
}

// ── Component ──────────────────────────────────────────────────────────────
function NovoAgendamento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { obraId } = Route.useSearch();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [agendamentoCriado, setAgendamentoCriado] = useState<{
    codigo_pedido: string;
    valor_total: number;
    data_servico: string;
    horario: string;
  } | null>(null);

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

  // Step 2 — Serviços Selecionados
  const [selectedServices, setSelectedServices] = useState<ConfiguredService[]>([]);

  // Step 2 Form States (para configurar o serviço que está sendo adicionado)
  const [currentServiceId, setCurrentServiceId] = useState("");
  const [currentVolume, setCurrentVolume] = useState(10);
  const [currentBetoneiraSize, setCurrentBetoneiraSize] = useState(8); // 6, 8, 10, 12
  const [currentIdadesCP, setCurrentIdadesCP] = useState<IdadeCPConfig[]>([
    { idade: 7, qtd: 2 },
    { idade: 28, qtd: 2 },
  ]);
  const [currentQtdEnsaios, setCurrentQtdEnsaios] = useState(1);
  const [currentPontosPorEnsaio, setCurrentPontosPorEnsaio] = useState(16);
  const [currentQuantidade, setCurrentQuantidade] = useState(1);

  // Dynamic Pricing States
  const [priceCalculation, setPriceCalculation] = useState<{
    valorTotal: number;
    requireManualQuote: boolean;
    reason?: string;
    requireUpfrontPayment?: boolean;
    formasPagamento?: string[];
    regraMinimo?: number;
  } | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  useEffect(() => {
    if (!currentServiceId) return;

    const selectedCityName = getSelectedObraCity();
    const cityObj = cidades.find(c => c.nome_cidade.toLowerCase() === selectedCityName.toLowerCase());
    const cityId = cityObj?.id;

    const currentService = servicos.find((s) => s.id === currentServiceId);
    if (!currentService) return;

    const isConcrete = 
      currentService.nome_servico.toLowerCase().includes("concreto") ||
      currentService.nome_servico.toLowerCase().includes("graute") ||
      currentService.nome_servico.toLowerCase().includes("argamassa") ||
      currentService.nome_servico.toLowerCase().includes("cp") ||
      currentService.categoria.toLowerCase().includes("concreto");

    const isArrancamento = 
      currentService.nome_servico.toLowerCase().includes("arrancamento") ||
      currentService.categoria.toLowerCase().includes("arrancamento");

    let qty = 1;
    if (isConcrete) {
      const currentQtdCaminhoes = Math.ceil(currentVolume / currentBetoneiraSize);
      qty = currentIdadesCP.reduce((acc, i) => acc + i.qtd, 0) * currentQtdCaminhoes;
    } else if (isArrancamento) {
      qty = currentQtdEnsaios * currentPontosPorEnsaio;
    } else {
      qty = currentQuantidade;
    }

    let active = true;
    const updatePrice = async () => {
      setCalculatingPrice(true);
      try {
        const { calculateBookingPrice } = await import("@/lib/booking.functions");
        const res = await calculateBookingPrice({
          data: {
            servicoId: currentServiceId,
            cidadeId: cityId || null,
            quantidade: qty
          }
        });
        if (active) {
          setPriceCalculation(res as any);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setCalculatingPrice(false);
      }
    };

    updatePrice();

    return () => {
      active = false;
    };
  }, [
    currentServiceId,
    selectedObraId,
    novaObraCidade,
    currentVolume,
    currentBetoneiraSize,
    currentIdadesCP,
    currentQtdEnsaios,
    currentPontosPorEnsaio,
    currentQuantidade,
    cidades,
    servicos
  ]);

  // Step 3 — Agenda
  const [dataServico, setDataServico] = useState("");
  const [horarioNaObra, setHorarioNaObra] = useState("08:00");
  const [observacoes, setObservacoes] = useState("");

  // Disponibilidade de técnicos
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [loadingDatas, setLoadingDatas] = useState(false);
  const [tecnicosDisponiveis, setTecnicosDisponiveis] = useState<any[]>([]);
  const [calMes, setCalMes] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Jornada calculada
  const JORNADA_PADRAO_H = 8;
  const ALMOCO_H = 1;
  const JORNADA_TOTAL_H = JORNADA_PADRAO_H + ALMOCO_H; // 9h

  const calcularHorarioFim = (inicio: string): string => {
    if (!inicio) return "";
    const [h, m] = inicio.split(":").map(Number);
    const fimMin = h * 60 + m + JORNADA_TOTAL_H * 60;
    const fimH = Math.floor(fimMin / 60) % 24;
    const fimM = fimMin % 60;
    return `${String(fimH).padStart(2, "0")}:${String(fimM).padStart(2, "0")}`;
  };

  const horarioFim = calcularHorarioFim(horarioNaObra);

  // Horas extras — depende se é sábado (após 12h) ou dia de semana (após 17h)
  const calcularHorasExtras = (inicio: string, data: string): number => {
    if (!inicio || !data) return 0;
    const dateObj = new Date(data + "T00:00:00");
    const dow = dateObj.getDay();
    const [h] = inicio.split(":").map(Number);
    const fimH = h + JORNADA_TOTAL_H;

    if (dow === 6) { // Saturday
      return Math.max(0, fimH - 12);
    }
    // Weekdays
    return Math.max(0, fimH - 17);
  };

  const getValorHoraExtra = (data: string): number => {
    if (!data) return 150;
    const dateObj = new Date(data + "T00:00:00");
    const dow = dateObj.getDay();
    return dow === 6 ? 200 : 150;
  };

  const horasExtras = calcularHorasExtras(horarioNaObra, dataServico);
  const valorHoraExtra = getValorHoraExtra(dataServico);
  const custoExtra = horasExtras * valorHoraExtra;

  const isHorarioValido = (data: string, hora: string): boolean => {
    if (!data || !hora) return true;
    const dateObj = new Date(data + "T00:00:00");
    const dow = dateObj.getDay();
    const [h, m] = hora.split(":").map(Number);
    const totalMinutes = h * 60 + m;

    if (dow === 0) return false; // Sunday
    // Permitido das 07:00 às 12:00 (tanto para dias de semana quanto sábado)
    return totalMinutes >= 7 * 60 && totalMinutes <= 12 * 60;
  };

  // Step 4 — Pagamento
  type FormaPagamento = "Pix" | "Cartao" | "Boleto_14" | "Boleto_28" | "Faturar_Depois";
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("Pix");

  // ── Derived values ────────────────────────────────────────────────────
  // Encontra serviço atualmente selecionado no seletor
  const getCurrentService = () => servicos.find((s) => s.id === currentServiceId) || servicos[0];

  const checkIsConcrete = (service: any) => {
    if (!service) return false;
    const name = (service.nome_servico || "").toLowerCase();
    const cat = (service.categoria || "").toLowerCase();
    return name.includes("concreto") || name.includes("graute") || name.includes("argamassa") || name.includes("cp") || cat.includes("concreto");
  };

  const checkIsArrancamento = (service: any) => {
    if (!service) return false;
    const name = (service.nome_servico || "").toLowerCase();
    const cat = (service.categoria || "").toLowerCase();
    return name.includes("arrancamento") || cat.includes("arrancamento");
  };

  // ── Load data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    async function loadData() {
      let { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .single();

      if (profileErr) {
        console.error("[Supabase Error - profiles]:", profileErr);
        toast.error(`Erro ao carregar perfil: ${profileErr.message}`);
      }

      if (profile) {
        if (!profile.empresa_id) {
          toast.info("Configurando empresa de testes no seu perfil...");
          let { data: empresa } = await supabase.from("empresas_clientes").select("id").eq("cnpj", "12.345.678/0001-99").single();
          let newEmpresaId = empresa?.id;
          if (!newEmpresaId) {
            const { data: newEmpresa } = await supabase.from("empresas_clientes").insert({ razao_social: "Quantis Cliente Padrão Ltda", cnpj: "12.345.678/0001-99" }).select("id").single();
            newEmpresaId = newEmpresa?.id;
          }
          if (newEmpresaId) {
            await supabase.from("profiles").update({ empresa_id: newEmpresaId }).eq("id", currentUserId);
            profile.empresa_id = newEmpresaId;
          }
        }
        setUserProfile(profile);
      }

      if (profile?.empresa_id) {
        const { data: listObras, error: obrasErr } = await supabase.from("obras").select("*").eq("empresa_id", profile.empresa_id);
        if (obrasErr) {
          console.error("[Supabase Error - obras]:", obrasErr);
          toast.error(`Erro ao carregar obras: ${obrasErr.message}`);
        }
        if (listObras && listObras.length > 0) {
          setObras(listObras);
          const initialObra = obraId && listObras.some((o: any) => o.id === obraId)
            ? obraId
            : listObras[0].id;
          setSelectedObraId(initialObra);
        }
      }

      const { data: listServicos, error: servicosErr } = await supabase
        .from("servicos_catalogo_pub")
        .select("*")
        .eq("ativo", true);

      if (servicosErr) {
        console.error("[Supabase Error - servicos_catalogo]:", servicosErr);
        toast.error(`Erro ao carregar serviços: ${servicosErr.message}`);
      }

      const hasArrancamento = listServicos?.some(s => s.sku === "GTB-ARRANCAMENTO");
      const completeList = listServicos ? [...listServicos] : [];
      if (!hasArrancamento) {
        completeList.push({
          id: "e2b4f9b8-67a1-432d-94c0-0f04df5156a0",
          sku: "GTB-ARRANCAMENTO",
          nome_servico: "Ensaio de Arrancamento",
          unidade: "Ponto",
          valor_venda_editavel: 250,
          categoria: "Arrancamento",
          ativo: true,
          created_at: null,
        });
      }

      setServicos(completeList);
      if (completeList.length > 0) {
        setCurrentServiceId(completeList[0].id || "");
      }

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

  // ── CNO lookup ────────────────────────────────────────────────────────
  const handleCNOLookup = async (cnoValue: string) => {
    setCnoObra(cnoValue);
    const cleanCno = cnoValue.replace(/\D/g, "");
    if (cleanCno.length >= 3) {
      try {
        const { data: existingObra, error } = await supabase
          .from("obras")
          .select("*")
          .eq("cno", cleanCno)
          .limit(1)
          .maybeSingle();

        if (existingObra && !error) {
          toast.success("Obra encontrada pelo CNO! Dados preenchidos automaticamente.");
          setNovaObraNome(existingObra.nome_obra || "");
          setNovaObraEndereco(existingObra.endereco || "");
          setNovaObraNumero(existingObra.numero || "");
          setNovaObraBairro(existingObra.bairro || "");
          setNovaObraCidade(existingObra.cidade || "");
          setNovaObraEstado(existingObra.estado || "");
          setNovaObraCEP(existingObra.cep || "");
          setResponsavelObra(existingObra.responsavel || "");
          setCargoResponsavel(existingObra.cargo_responsavel || "");
          if (existingObra.latitude) setNovaObraLat(Number(existingObra.latitude));
          if (existingObra.longitude) setNovaObraLng(Number(existingObra.longitude));
        }
      } catch (err) {
        console.error("Erro ao buscar CNO:", err);
      }
    }
  };

  // ── Idade CP helpers ──────────────────────────────────────────────────
  const toggleIdade = (idade: number) => {
    setCurrentIdadesCP((prev) => {
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
    setCurrentIdadesCP((prev) => prev.map((i) => (i.idade === idade ? { ...i, qtd: valid } : i)));
  };

  // ── Buscar técnicos disponíveis ao selecionar serviço(s) ───────────────
  useEffect(() => {
    if (selectedServices.length === 0) return;
    async function fetchTecnicosDisponiveis() {
      setLoadingDatas(true);
      try {
        const categories = selectedServices.map(s => s.categoria.toLowerCase());

        // Buscar técnicos
        const { data: tecnicos } = await supabase
          .from("tecnicos")
          .select("id, nome, status, certificacoes, ranking_score")
          .eq("status", "Disponivel");

        const compativeis = (tecnicos || []).filter((t) => {
          if (!t.certificacoes) return true;
          return categories.every(cat => {
            if (!cat) return true;
            const catLower = cat.toLowerCase();
            return (t.certificacoes || "").toLowerCase().includes(catLower) || catLower.includes("concreto") || catLower.includes("geral");
          });
        });

        setTecnicosDisponiveis(compativeis);

        // Buscar datas já ocupadas nos próximos 60 dias
        const hoje = new Date();
        const limite = new Date();
        limite.setDate(limite.getDate() + 60);

        const { data: agendados } = await supabase
          .from("agendamentos_medicoes")
          .select("data_servico, tecnico_id")
          .gte("data_servico", hoje.toISOString().split("T")[0])
          .lte("data_servico", limite.toISOString().split("T")[0])
          .in("status_agendamento", ["Confirmado", "Em_Execucao", "Pendente_Tecnico"])
          .in("tecnico_id", compativeis.map((t) => t.id));

        // Datas onde TODOS os técnicos estão ocupados
        const datasOcupadas = new Set<string>();
        const contagem: Record<string, number> = {};
        (agendados || []).forEach((a) => {
          contagem[a.data_servico] = (contagem[a.data_servico] || 0) + 1;
        });
        Object.entries(contagem).forEach(([data, count]) => {
          if (count >= compativeis.length) datasOcupadas.add(data);
        });

        // Gerar array de datas disponíveis (próximos 60 dias, sem domingos e datas lotadas, respeitando 48h)
        const datasOk: string[] = [];
        const cursor = new Date(hoje);
        cursor.setDate(cursor.getDate() + 2); // respeita antecedência mínima de 48h
        while (cursor <= limite) {
          const dow = cursor.getDay();
          const iso = cursor.toISOString().split("T")[0];
          if (dow !== 0 && !datasOcupadas.has(iso)) {
            datasOk.push(iso);
          }
          cursor.setDate(cursor.getDate() + 1);
        }
        setDatasDisponiveis(datasOk);
      } catch (err) {
        console.error("Erro ao buscar disponibilidade:", err);
      } finally {
        setLoadingDatas(false);
      }
    }
    fetchTecnicosDisponiveis();
  }, [selectedServices, servicos]);

  // ── Financials ────────────────────────────────────────────────────────
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

  const getServiceCost = (svc: ConfiguredService) => {
    const isConcrete = checkIsConcrete(svc);
    const isArrancamento = checkIsArrancamento(svc);

    if (isConcrete && svc.idades_cp && svc.qtd_caminhoes) {
      const cps = svc.idades_cp.reduce((acc, i) => acc + i.qtd, 0) * svc.qtd_caminhoes;
      return cps * svc.valor_venda_editavel;
    } else if (isArrancamento && svc.qtd_ensaios && svc.pontos_por_ensaio) {
      return svc.qtd_ensaios * svc.pontos_por_ensaio * svc.valor_venda_editavel;
    } else {
      return (svc.quantidade || 1) * svc.valor_venda_editavel;
    }
  };

  const getServiceQuantityText = (svc: ConfiguredService) => {
    const isConcrete = checkIsConcrete(svc);
    const isArrancamento = checkIsArrancamento(svc);

    if (isConcrete && svc.idades_cp && svc.qtd_caminhoes) {
      const cps = svc.idades_cp.reduce((acc, i) => acc + i.qtd, 0) * svc.qtd_caminhoes;
      return `${cps} CPs (${svc.qtd_caminhoes} betoneira(s) de ${svc.tamanho_betoneira} m³, idades: ${svc.idades_cp.map(i => `${i.idade}d`).join(", ")})`;
    } else if (isArrancamento && svc.qtd_ensaios && svc.pontos_por_ensaio) {
      const totalPoints = svc.qtd_ensaios * svc.pontos_por_ensaio;
      return `${totalPoints} pontos (${svc.qtd_ensaios} ensaio(s) de arrancamento × ${svc.pontos_por_ensaio} pontos/ensaio)`;
    } else {
      return `${svc.quantidade || 1} ${svc.sku === "GTB-DIARIA" ? "diária(s)" : "unidade(s)"}`;
    }
  };

  const rawServiceCost = selectedServices.reduce((sum, svc) => sum + getServiceCost(svc), 0);
  const { mobilizacao, pedagios } = getMobilizationCosts();
  const subtotal = rawServiceCost + mobilizacao + pedagios;
  const impostoPct = 0.12;
  const descontoPct = formaPagamento === "Pix" || formaPagamento === "Cartao" ? 0.05 : 0;
  const imposto = subtotal * impostoPct;
  const desconto = subtotal * descontoPct;
  const total = subtotal + imposto - desconto + custoExtra;
  const isBookingManualQuote = selectedServices.some(s => s.is_orcamento_manual);

  const currentService = getCurrentService();
  const isConcrete = checkIsConcrete(currentService);
  const isArrancamento = checkIsArrancamento(currentService);

  const currentQtdCaminhoes = isConcrete ? Math.ceil(currentVolume / currentBetoneiraSize) : 1;
  const currentCpsCount = isConcrete ? currentIdadesCP.reduce((acc, i) => acc + i.qtd, 0) * currentQtdCaminhoes : 0;

  const handleAddService = () => {
    if (!currentService) return;
    
    // Check if service already added
    if (selectedServices.some(s => s.servico_id === currentService.id)) {
      toast.error("Este serviço já foi adicionado ao agendamento.");
      return;
    }

    const isConcreteService = checkIsConcrete(currentService);
    const isArrancamentoService = checkIsArrancamento(currentService);
    let qty = 1;
    if (isConcreteService) {
      qty = currentCpsCount;
    } else if (isArrancamentoService) {
      qty = currentQtdEnsaios * currentPontosPorEnsaio;
    } else {
      qty = currentQuantidade;
    }

    const newSvc: ConfiguredService = {
      client_id: Math.random().toString(36).substring(2, 9),
      servico_id: currentService.id,
      nome_servico: currentService.nome_servico,
      sku: currentService.sku,
      categoria: currentService.categoria,
      valor_venda_editavel: priceCalculation && !priceCalculation.requireManualQuote 
        ? (currentService.tipo_cobranca === "Por Execucao" ? priceCalculation.valorTotal : priceCalculation.valorTotal / qty) 
        : currentService.valor_venda_editavel,
      is_orcamento_manual: priceCalculation?.requireManualQuote || false,
      reason_manual_quote: priceCalculation?.reason || "",
    };

    if (isConcrete) {
      if (currentIdadesCP.length === 0) {
        toast.error("Selecione ao menos uma idade de cura.");
        return;
      }
      newSvc.volume_m3 = currentVolume;
      newSvc.tamanho_betoneira = currentBetoneiraSize;
      newSvc.qtd_caminhoes = currentQtdCaminhoes;
      newSvc.idades_cp = [...currentIdadesCP];
    } else if (isArrancamento) {
      if (currentQtdEnsaios < 1 || currentPontosPorEnsaio < 1) {
        toast.error("Valores de ensaios e pontos inválidos.");
        return;
      }
      if (currentPontosPorEnsaio > 16) {
        toast.error("O número máximo de pontos por ensaio é 16.");
        return;
      }
      newSvc.qtd_ensaios = currentQtdEnsaios;
      newSvc.pontos_por_ensaio = currentPontosPorEnsaio;
    } else {
      if (currentQuantidade < 1) {
        toast.error("Quantidade inválida.");
        return;
      }
      newSvc.quantidade = currentQuantidade;
    }

    setSelectedServices((prev) => [...prev, newSvc]);
    toast.success("Serviço adicionado ao agendamento!");
  };

  const handleRemoveService = (client_id: string) => {
    setSelectedServices((prev) => prev.filter(s => s.client_id !== client_id));
    toast.info("Serviço removido.");
  };

  // ── Validation ────────────────────────────────────────────────────────
  const step1Valid =
    selectedObraId !== "nova" ||
    (!!novaObraNome.trim() && !!novaObraEndereco.trim() && !!novaObraCEP.trim() &&
      !!novaObraNumero.trim() && !!novaObraBairro.trim() && !!novaObraEstado &&
      !!novaObraCidade.trim() &&
      !!cnoObra.trim() && !!responsavelObra.trim() && !!cargoResponsavel.trim());

  const handleConfirmBooking = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para continuar.");
      return;
    }
    if (selectedServices.length === 0) {
      toast.error("Adicione ao menos um serviço para agendar.");
      return;
    }
    setLoading(true);
    try {
      const agendamento = await createBooking({
        data: {
          obra_id: selectedObraId === "nova" ? (obraRascunhoId ?? null) : selectedObraId,
          nova_obra:
            selectedObraId === "nova" && !obraRascunhoId
              ? {
                  nome_obra: novaObraNome,
                  endereco: novaObraEndereco,
                  numero: novaObraNumero,
                  bairro: novaObraBairro,
                  cidade: novaObraCidade,
                  estado: novaObraEstado,
                  cep: novaObraCEP || null,
                  cno: cnoObra,
                  responsavel: responsavelObra,
                  cargo_responsavel: cargoResponsavel,
                  latitude: novaObraLat ?? null,
                  longitude: novaObraLng ?? null,
                }
              : null,
          data_servico: dataServico,
          horario_na_obra: horarioNaObra,
          forma_pagamento: formaPagamento,
          observacoes: observacoes || null,
          servicos: selectedServices.map(s => ({
            servico_id: s.servico_id,
            volume_m3: s.volume_m3 || null,
            tamanho_betoneira: s.tamanho_betoneira || null,
            qtd_caminhoes: s.qtd_caminhoes || null,
            idades_cp: s.idades_cp || null,
            qtd_ensaios: s.qtd_ensaios || null,
            pontos_por_ensaio: s.pontos_por_ensaio || null,
            quantidade: s.quantidade || null,
          })),
        },
      });

      toast.success("Agendamentos criados com sucesso!");

      // Envia notificação por WhatsApp em segundo plano
      try {
        const phoneToNotify = userProfile?.telefone || "5515999999999";
        const servicesSummary = selectedServices.map(s => {
          return `- *${s.nome_servico}*: ${getServiceQuantityText(s)}`;
        }).join("\n");

        sendWhatsappMessage({
          data: {
            number: phoneToNotify,
            text:
            `🛠️ *Quantis Obras - Confirmação de Agendamento*\n\n` +
            `Olá, *${userProfile?.nome_completo || user?.email}*!\n` +
            `Seu pedido de controle tecnológico foi criado com sucesso.\n\n` +
            `📝 *Código do Pedido:* ${agendamento.codigo_pedido}\n` +
            `📅 *Data:* ${new Date(dataServico + "T00:00:00").toLocaleDateString("pt-BR")}\n` +
            `⏰ *Horário na Obra:* ${horarioNaObra}\n` +
            `📋 *Serviços Contratados:*\n${servicesSummary}\n\n` +
            `💰 *Valor Total:* R$ ${agendamento.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
            `💳 *Forma de Pagamento:* ${formaPagamento}\n\n` +
            `Um técnico certificado será alocado em breve. Obrigado pela preferência!`,
          },
        }).catch(err => console.error("Error sending WhatsApp message:", err));
      } catch (waErr) {
        console.error("Failed to prepare WhatsApp payload:", waErr);
      }

      // Redireciona imediatamente para o painel do cliente
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      console.error("Booking error:", err);
      toast.error("Erro ao criar agendamento", { 
        description: err?.message || err?.toString() || "Erro desconhecido. Tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };
  // ── Render ────────────────────────────────────────────────────────────
  // ── Tela de Sucesso ──────────────────────────────────────────────────
  if (agendamentoCriado) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center space-y-6 animate-in fade-in-50 duration-300">
        {/* Ícone de sucesso */}
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
          <Check className="h-10 w-10 text-emerald-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-foreground">Agendamento Confirmado!</h1>
          <p className="text-muted-foreground">Seu pedido foi registrado com sucesso. Um técnico será alocado em breve.</p>
        </div>

        {/* Card resumo */}
        <div className="rounded-xl border border-border bg-card p-6 text-left space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <span className="text-sm text-muted-foreground">Código do Pedido</span>
            <span className="font-bold text-primary text-lg">{agendamentoCriado.codigo_pedido}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Data do Serviço</span>
            <span className="font-semibold text-foreground">
              {new Date(agendamentoCriado.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {agendamentoCriado.horario}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Valor Total</span>
            <span className="font-extrabold text-foreground text-xl">
              R$ {agendamentoCriado.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 border border-amber-500/20">
              ⏳ Aguardando alocação de técnico
            </span>
          </div>
        </div>

        {/* Próximos passos */}
        <div className="rounded-xl border border-border bg-muted/20 p-5 text-left space-y-3">
          <p className="text-sm font-bold text-foreground">O que acontece agora?</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2"><span className="text-primary font-bold">1.</span> Um técnico especializado receberá o convite de serviço</div>
            <div className="flex gap-2"><span className="text-primary font-bold">2.</span> Após aceite, você receberá uma confirmação por WhatsApp</div>
            <div className="flex gap-2"><span className="text-primary font-bold">3.</span> Nossa equipe de expedição preparará os equipamentos</div>
            <div className="flex gap-2"><span className="text-primary font-bold">4.</span> No dia, o técnico fará check-in ao chegar na obra</div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={() => navigate({ to: "/dashboard" })}
            className="bg-primary hover:bg-primary/90 font-bold gap-2"
            size="lg"
          >
            <ClipboardList className="h-5 w-5" />
            Ver Meus Agendamentos
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setAgendamentoCriado(null);
              setStep(1);
              setSelectedObraId("nova");
              setNovaObraNome("");
              setNovaObraEndereco("");
              setNovaObraCidade("");
              setNovaObraCEP("");
              setNovaObraNumero("");
              setNovaObraBairro("");
              setNovaObraEstado("");
              setCnoObra("");
              setResponsavelObra("");
              setCargoResponsavel("");
              setObraRascunhoId(null);
              setDataServico("");
              setHorarioNaObra("08:00");
              setObservacoes("");
              setSelectedServices([]);
              setCurrentVolume(10);
              setCurrentBetoneiraSize(8);
              setCurrentIdadesCP([{ idade: 7, qtd: 2 }, { idade: 28, qtd: 2 }]);
              setCurrentQtdEnsaios(1);
              setCurrentPontosPorEnsaio(16);
              setCurrentQuantidade(1);
            }}
            className="gap-2"
          >
            <CalendarPlus className="h-5 w-5" />
            Novo Agendamento
          </Button>
        </div>
      </div>
    );
  }

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
      {/* Mobile-only Step Indicator */}
      <div className="sm:hidden space-y-2 py-2 mb-4 animate-in fade-in duration-200">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-muted-foreground">Passo {step} de 4</span>
          <span className="text-primary font-bold">
            {step === 1 ? "Identificação da Obra" : step === 2 ? "Seleção de Serviços" : step === 3 ? "Agendamento da Data" : "Resumo e Pagamento"}
          </span>
        </div>
        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }} />
        </div>
      </div>

      {/* Desktop Step Indicator */}
      <div className="hidden sm:grid grid-cols-4 gap-2 text-center text-xs font-semibold sm:text-sm">
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
                    {/* CNO */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-cno">CNO</Label>
                      <Input id="obra-cno" placeholder="Ex: 12345678" value={cnoObra} onChange={(e) => handleCNOLookup(e.target.value)} />
                    </div>

                    {/* Responsável */}
                    <div className="space-y-2">
                      <Label htmlFor="obra-responsavel">Responsável Pela Obra</Label>
                      <Input id="obra-responsavel" placeholder="Nome completo" value={responsavelObra} onChange={(e) => setResponsavelObra(e.target.value)} />
                    </div>

                    {/* Cargo */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="obra-cargo">Cargo do Responsável</Label>
                      <Select value={cargoResponsavel} onValueChange={setCargoResponsavel}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o cargo do responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {CARGOS_OBRA.map((cargo) => (
                            <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Divisor Visual para Endereço */}
                    <div className="md:col-span-2 border-t border-border pt-4 my-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço e Localização da Obra</span>
                    </div>

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
                      <Input
                        id="obra-cidade"
                        value={novaObraCidade}
                        onChange={(e) => setNovaObraCidade(e.target.value)}
                        placeholder="Digite a cidade ou preencha automaticamente"
                      />
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

                          if (error) {
                            console.error("Erro ao salvar obra:", error);
                            toast.error(`Erro ao salvar obra: ${error.message}`);
                            return; // Impede o avanço para o Step 2 se der erro
                          }

                          if (newObra) {
                            setObraRascunhoId(newObra.id);
                            setObras((prev) => [...prev, { id: newObra.id, nome_obra: novaObraNome, cidade: novaObraCidade }]);
                            setSelectedObraId(newObra.id);
                            toast.success("Obra salva! Você pode acessá-la em novos agendamentos.");
                          } else {
                            toast.error("Erro ao salvar obra: Retorno vazio do servidor.");
                            return;
                          }
                        }
                      } catch (err: any) {
                        console.error("Erro ao salvar obra:", err);
                        toast.error(`Erro ao salvar obra: ${err?.message || err}`);
                        return; // Impede o avanço para o Step 2 se der erro
                      }
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
              {/* Form de Adicionar Serviço */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-2 text-primary font-bold text-lg border-b border-border pb-3">
                  <HardHat className="h-5 w-5" />
                  <span>Configurar Serviço</span>
                </div>

                {/* Seleção do Serviço */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Escolha o Serviço de Controle</Label>
                  <Select value={currentServiceId} onValueChange={setCurrentServiceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o ensaio tecnológico" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome_servico} — R$ {Number(s.valor_venda_editavel).toFixed(2)} / {s.unidade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Inputs Dinâmicos com base na categoria/tipo de serviço */}
                {currentService && checkIsConcrete(currentService) && (
                  <div className="space-y-6 animate-in fade-in-50 duration-200">
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Volume de Concreto */}
                      <div className="space-y-2">
                        <Label htmlFor="current-volume">Volume de Concreto (m³)</Label>
                        <Input
                          id="current-volume"
                          type="number"
                          min={1}
                          value={currentVolume}
                          onChange={(e) => setCurrentVolume(Math.max(1, Number(e.target.value)))}
                        />
                      </div>

                      {/* Tamanho da Betoneira */}
                      <div className="space-y-2">
                        <Label htmlFor="betoneira-size">Capacidade da Betoneira (m³)</Label>
                        <Select
                          value={String(currentBetoneiraSize)}
                          onValueChange={(val) => setCurrentBetoneiraSize(Number(val))}
                        >
                          <SelectTrigger id="betoneira-size">
                            <SelectValue placeholder="Selecione o tamanho" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="6">6 m³</SelectItem>
                            <SelectItem value="8">8 m³</SelectItem>
                            <SelectItem value="10">10 m³</SelectItem>
                            <SelectItem value="12">12 m³</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantidade de Betoneiras Calculada */}
                      <div className="space-y-2">
                        <Label>Quantidade de Betoneiras</Label>
                        <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 text-foreground font-bold flex items-center">
                          <span>{currentQtdCaminhoes} betoneira(s)</span>
                        </div>
                      </div>
                    </div>

                    {/* Idades de cura — NBR 5738 */}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold">Idades de Cura dos CPs (NBR 5738)</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Selecione as idades e a quantidade por idade. Mínimo: 2 CPs por idade, sempre par.</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {IDADES_CURA.map(({ value: idade, label }) => {
                          const config = currentIdadesCP.find((i) => i.idade === idade);
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
                      <div className="rounded-lg bg-muted/40 border border-border p-4 flex items-center justify-between">
                        <div className="text-xs space-y-1">
                          <span className="font-semibold text-muted-foreground block">Resumo de Corpos de Prova</span>
                          <span className="text-muted-foreground">
                            {currentIdadesCP.map(i => `${i.idade}d (${i.qtd} CPs)`).join(" + ")}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground block">Total de CPs</span>
                          <span className="text-lg font-extrabold text-primary">{currentCpsCount} CPs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentService && checkIsArrancamento(currentService) && (
                  <div className="space-y-4 animate-in fade-in-50 duration-200">
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Qtd Ensaios */}
                      <div className="space-y-2">
                        <Label htmlFor="arrancamento-ensaios">Quantidade de Ensaios (Pontos)</Label>
                        <Input
                          id="arrancamento-ensaios"
                          type="number"
                          min={1}
                          value={currentQtdEnsaios}
                          onChange={(e) => setCurrentQtdEnsaios(Math.max(1, Number(e.target.value)))}
                        />
                      </div>

                      {/* Pontos por Ensaio */}
                      <div className="space-y-2">
                        <Label htmlFor="arrancamento-pontos">Pontos por Ensaio (máx 16)</Label>
                        <Input
                          id="arrancamento-pontos"
                          type="number"
                          min={1}
                          max={16}
                          value={currentPontosPorEnsaio}
                          onChange={(e) => setCurrentPontosPorEnsaio(Math.min(16, Math.max(1, Number(e.target.value))))}
                        />
                      </div>
                    </div>

                    {/* Alerta informativo */}
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 flex gap-2 items-start text-xs text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Importante sobre Ensaios de Arrancamento</p>
                        <p className="mt-0.5">A cada ensaio de arrancamento (cada ponto), podem ser coletados/tracionados até 16 pontos de ensaio adicionais.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentService && !checkIsConcrete(currentService) && !checkIsArrancamento(currentService) && (
                  <div className="space-y-2 animate-in fade-in-50 duration-200">
                    <Label htmlFor="general-quantity">Quantidade</Label>
                    <Input
                      id="general-quantity"
                      type="number"
                      min={1}
                      value={currentQuantidade}
                      onChange={(e) => setCurrentQuantidade(Math.max(1, Number(e.target.value)))}
                      className="w-full md:w-1/3"
                    />
                  </div>
                )}

                {/* Visualização de Preço Dinâmico e Regras */}
                {calculatingPrice ? (
                  <div className="text-xs text-muted-foreground animate-pulse py-2">Calculando preço estimado...</div>
                ) : priceCalculation && (
                  <div className="space-y-2 py-2">
                    {priceCalculation.requireManualQuote ? (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 flex gap-2 items-start text-xs text-amber-700">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-amber-800">Orçamento sob consulta por vendedor</p>
                          <p className="mt-0.5">{priceCalculation.reason || "Este serviço na cidade selecionada exige cotação comercial manual."}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3.5 space-y-2 text-xs text-emerald-800 dark:text-emerald-400">
                        <div className="flex justify-between items-center font-bold">
                          <span>Preço Estimado do Ensaio:</span>
                          <span className="text-base text-emerald-600">R$ {priceCalculation.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {priceCalculation.requireUpfrontPayment && (
                          <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-2 text-[10px] text-emerald-800 dark:text-emerald-400">
                            <strong>💡 Pagamento à Vista Requerido</strong>: Pedidos com valor menor que R$ {Number(priceCalculation.regraMinimo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} exigem faturamento à vista para liberação.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Botão de Adicionar ao Agendamento */}
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleAddService}
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2 text-white"
                  >
                    + Adicionar Serviço ao Agendamento
                  </Button>
                </div>
              </div>

              {/* Lista de Serviços Adicionados */}
              {selectedServices.length > 0 && (
                <div className="space-y-4">
                  <div className="text-sm font-bold text-foreground">Serviços Adicionados ({selectedServices.length})</div>
                  <div className="grid gap-3">
                    {selectedServices.map((svc) => (
                      <div key={svc.client_id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between shadow-sm animate-in slide-in-from-bottom-2 duration-200">
                        <div className="space-y-1">
                          <span className="font-bold text-foreground text-sm block">{svc.nome_servico}</span>
                          <span className="text-xs text-muted-foreground block">{getServiceQuantityText(svc)}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Valor do Ensaio</span>
                            <span className="font-bold text-foreground text-sm">
                              R$ {getServiceCost(svc).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveService(svc.client_id)}
                            className="p-1 rounded-md text-red-500 hover:bg-red-50/10 transition-colors"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumo Financeiro do Grupo */}
                  <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
                    <div className="text-xs font-bold text-foreground uppercase tracking-wide pb-1 border-b border-border">Resumo de Custos Previstos</div>
                    {isBookingManualQuote ? (
                      <div className="space-y-2 text-xs">
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 flex gap-2 items-start text-amber-700">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-800">Orçamento sob consulta comercial</p>
                            <p className="mt-0.5">Alguns serviços ou cidades deste agendamento ultrapassam o limite de precificação automática ou estão fora da área de preço fixo. O orçamento final será enviado após avaliação do vendedor.</p>
                          </div>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2.5 text-base font-extrabold text-foreground">
                          <span>Valor Total Final</span>
                          <span className="text-primary text-sm">Sob Consulta</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Subtotal dos Serviços</span>
                          <span>R$ {rawServiceCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {(mobilizacao > 0 || pedagios > 0) && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Deslocamento & Mobilização ({getSelectedObraCity()})</span>
                            <span>R$ {(mobilizacao + pedagios).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {custoExtra > 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground text-amber-600 font-medium">
                            <span>Custo Adicional (Horas Extras / Fora de Expediente)</span>
                            <span>+ R$ {custoExtra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Imposto Retido (12%)</span>
                          <span>+ R$ {imposto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {desconto > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                            <span>Desconto Forma de Pagamento (5%)</span>
                            <span>- R$ {desconto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-border pt-2.5 text-base font-extrabold text-foreground">
                          <span>Valor Total Prévio</span>
                          <span className="text-primary text-lg">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-border">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={selectedServices.length === 0}
                  className="bg-primary text-primary-foreground font-bold"
                >
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: AGENDA ───────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">

              {/* Status de técnicos disponíveis */}
              {loadingDatas ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin animate-spin-slow" />
                  Verificando disponibilidade de técnicos especializados...
                </div>
              ) : tecnicosDisponiveis.length === 0 ? (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-600">Nenhum técnico disponível para este serviço</p>
                    <p className="text-xs text-red-500 mt-0.5">Entre em contato com nossa equipe para verificar alternativas.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      Para esta data temos {tecnicosDisponiveis.length} técnico{tecnicosDisponiveis.length > 1 ? "s" : ""} especializado{tecnicosDisponiveis.length > 1 ? "s" : ""} disponível{tecnicosDisponiveis.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      O técnico será confirmado após aceitar a solicitação.
                    </p>
                  </div>
                </div>
              )}

              {/* ── CALENDÁRIO E HORÁRIOS SIDE-BY-SIDE (Estilo OnceHub) ── */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-bold text-foreground">Agenda do Serviço</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Selecione uma data disponível e o horário de chegada do técnico.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-card border border-border rounded-2xl p-5 shadow-sm">
                  {/* Calendário (Esquerda) */}
                  <div className="md:col-span-7 space-y-4">
                    {/* Cabeçalho do mês */}
                    <div className="flex items-center justify-between px-2 py-1 bg-transparent border-b border-border/60 pb-3">
                      <button
                        type="button"
                        disabled={new Date(calMes.getFullYear(), calMes.getMonth(), 1) <= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
                        onClick={() => setCalMes(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-sm"
                      >
                        ‹
                      </button>
                      <div className="text-center">
                        <p className="text-sm font-bold text-foreground">
                          {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][calMes.getMonth()]}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{calMes.getFullYear()}</p>
                      </div>
                      <button
                        type="button"
                        disabled={(() => { const lim = new Date(); lim.setDate(lim.getDate() + 62); return new Date(calMes.getFullYear(), calMes.getMonth() + 1, 1) > new Date(lim.getFullYear(), lim.getMonth(), 1); })()}
                        onClick={() => setCalMes(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-sm"
                      >
                        ›
                      </button>
                    </div>

                    {/* Cabeçalho dias da semana */}
                    <div className="grid grid-cols-7 text-center">
                      {[
                        { label: "D", color: "text-rose-400 font-bold" },
                        { label: "S", color: "text-foreground/60 font-semibold" },
                        { label: "T", color: "text-foreground/60 font-semibold" },
                        { label: "Q", color: "text-foreground/60 font-semibold" },
                        { label: "Q", color: "text-foreground/60 font-semibold" },
                        { label: "S", color: "text-foreground/60 font-semibold" },
                        { label: "S", color: "text-blue-400 font-bold" },
                      ].map((d, i) => (
                        <div key={i} className={`py-1 text-[11px] ${d.color}`}>
                          {d.label}
                        </div>
                      ))}
                    </div>

                    {/* Grade de dias */}
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const hoje = new Date(); hoje.setHours(0,0,0,0);
                        const limiteMax = new Date(hoje); limiteMax.setDate(limiteMax.getDate() + 62);
                        const primeiroDia = new Date(calMes.getFullYear(), calMes.getMonth(), 1);
                        const ultimoDia  = new Date(calMes.getFullYear(), calMes.getMonth() + 1, 0);
                        const cells: (null | Date)[] = [
                          ...Array(primeiroDia.getDay()).fill(null),
                          ...Array.from({ length: ultimoDia.getDate() }, (_, i) => new Date(calMes.getFullYear(), calMes.getMonth(), i + 1))
                        ];
                        while (cells.length % 7 !== 0) cells.push(null);
                        const isoDate = (d: Date) => d.toISOString().split("T")[0];

                        return cells.map((day, idx) => {
                          if (!day) return <div key={`e-${idx}`} className="h-9 w-9 sm:h-10 sm:w-10" />;

                          const iso        = isoDate(day);
                          const isSelected = dataServico === iso;
                          const isToday    = isoDate(hoje) === iso;
                          const isMin48h   = day < new Date(hoje.getTime() + 2 * 86400000);
                          const isSun      = day.getDay() === 0;
                          const isSat      = day.getDay() === 6;
                          const isFuture   = day > limiteMax;
                          const hasVaga    = datasDisponiveis.includes(iso);
                          const isDisabled = isMin48h || isSun || isFuture || (datasDisponiveis.length > 0 && !hasVaga);

                          let wrapClass = "h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center mx-auto transition-all duration-200 rounded-full ";
                          let btnClass  = "w-8 h-8 flex flex-col items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 relative ";

                          if (isSelected) {
                            wrapClass += "bg-primary/10";
                            btnClass  += "bg-primary text-primary-foreground font-bold shadow-sm scale-105";
                          } else if (isDisabled) {
                            wrapClass += "cursor-not-allowed";
                            btnClass  += "opacity-25 " + (isSun ? "text-rose-400 " : "text-muted-foreground ");
                          } else if (hasVaga) {
                            wrapClass += "cursor-pointer hover:scale-105 active:scale-95";
                            btnClass  += "text-foreground hover:bg-emerald-500 hover:text-white " + (isSat ? "text-blue-500 " : "");
                          } else {
                            wrapClass += "cursor-pointer";
                            btnClass  += "text-muted-foreground hover:bg-muted";
                          }

                          return (
                            <div key={iso} className={wrapClass} onClick={() => { if (!isDisabled) setDataServico(iso); }}>
                              <button
                                type="button"
                                disabled={isDisabled}
                                className={btnClass}
                              >
                                {isToday && !isSelected && (
                                  <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 ring-offset-0" />
                                )}
                                <span>{day.getDate()}</span>
                                {hasVaga && !isDisabled && !isSelected && (
                                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-500" />
                                )}
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Legenda */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 border-t border-border/60 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Disponível
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Selecionada
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-foreground/15" />
                        Indisponível
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full ring-1 ring-primary/40" />
                        Hoje
                      </span>
                    </div>
                  </div>

                  {/* Linha divisória no Desktop */}
                  <div className="hidden md:block w-px bg-border/80 self-stretch" />

                  {/* Horários (Direita) */}
                  <div className="md:col-span-4 flex flex-col justify-between space-y-4">
                    <div>
                      <Label className="text-xs font-bold block text-foreground uppercase tracking-wider">
                        {dataServico ? (
                          <>{new Date(dataServico + "T00:00:00").toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'short' })}</>
                        ) : (
                          <>Selecione uma data</>
                        )}
                      </Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Selecione o horário de chegada na obra</p>
                    </div>

                    {dataServico ? (
                      <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5 max-h-[200px] md:max-h-[240px] overflow-y-auto pr-1">
                        {["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"].map((time) => {
                          const isSelected = horarioNaObra === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setHorarioNaObra(time)}
                              className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all ${
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                                  : "border-border bg-card text-foreground hover:bg-accent hover:border-primary/30 active:scale-[0.98]"
                              }`}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl p-4">
                        <Clock3 className="h-6 w-6 text-muted-foreground/30 mb-1.5 animate-pulse" />
                        <span>Escolha um dia no calendário ao lado.</span>
                      </div>
                    )}

                    {dataServico && horarioNaObra && (
                      <div className="rounded-xl bg-muted/30 border border-border/80 p-3 space-y-1.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <Clock3 className="h-3.5 w-3.5 text-primary" />
                          <span>Jornada: {horarioNaObra} às {horarioFim}</span>
                        </div>
                        <p className="text-[10px] leading-relaxed">
                          Jornada mínima de 8h + 1h de almoço. Saída às {horarioFim}.
                        </p>
                        {horasExtras > 0 && (
                          <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-amber-700 font-medium text-[10px]">
                            ⚠️ {horasExtras}h extra{horasExtras > 1 ? "s" : ""} inclusa{horasExtras > 1 ? "s" : ""} (+ R$ {custoExtra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Observações */}
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
                <Button onClick={() => setStep(4)} disabled={!dataServico || !horarioNaObra || !isHorarioValido(dataServico, horarioNaObra)}>
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

              {/* Lista de Serviços Contratados */}
              <div className="rounded-xl border border-border bg-muted/10 p-5 space-y-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border pb-2">Serviços Contratados</p>
                <div className="space-y-3">
                  {selectedServices.map((svc) => (
                    <div key={svc.client_id} className="flex justify-between items-start text-sm">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">{svc.nome_servico}</span>
                        <span className="text-xs text-muted-foreground block">{getServiceQuantityText(svc)}</span>
                      </div>
                      <span className="font-bold text-foreground">
                        R$ {getServiceCost(svc).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Memória de cálculo */}
              <div className="rounded-xl border border-border p-5 space-y-4 bg-card shadow-sm">
                {isBookingManualQuote ? (
                  <div className="space-y-2 text-xs">
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 flex gap-2 items-start text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-800">Orçamento sob consulta comercial</p>
                        <p className="mt-0.5">Alguns serviços ou cidades deste agendamento ultrapassam o limite de precificação automática ou estão fora da área de preço fixo. O orçamento final será enviado após avaliação do vendedor.</p>
                      </div>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2.5 text-base font-extrabold text-foreground">
                      <span>Valor Total Final</span>
                      <span className="text-primary text-sm">Sob Consulta</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal dos Serviços</span>
                      <span className="font-semibold">R$ {rawServiceCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {(mobilizacao > 0 || pedagios > 0) && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deslocamento e Mobilização ({getSelectedObraCity() || "Sorocaba"})</span>
                        <span className="font-semibold">R$ {(mobilizacao + pedagios).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {custoExtra > 0 && (
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>Horas Extras ({horasExtras}h após {dataServico && new Date(dataServico + "T00:00:00").getDay() === 6 ? "12:00" : "17:00"} × R$ {valorHoraExtra}/h)</span>
                        <span className="font-semibold">+ R$ {custoExtra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
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
                  </>
                )}
              </div>

              {/* Forma de pagamento */}
              <div className="space-y-3">
                <Label className="text-base font-bold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Escolha a Forma de Pagamento
                </Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    { val: "Pix", label: "Pix (5% desc)", desc: "Imediato" },
                    { val: "Cartao", label: "Cartão (5% desc)", desc: "1x sem juros" },
                    { val: "Boleto_14", label: "Boleto 14 dias", desc: "Sujeito a crédito" },
                    { val: "Boleto_28", label: "Boleto 28 dias", desc: "Sujeito a crédito" },
                    { val: "Faturar_Depois", label: "Faturar Depois", desc: "Financeiro entrará em contato" },
                  ].map((p) => (
                    <button key={p.val} type="button" onClick={() => setFormaPagamento(p.val as typeof formaPagamento)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${formaPagamento === p.val ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
                      <span className="text-sm font-bold block">{p.label}</span>
                      <span className="text-[10px] block opacity-80 mt-1">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formaPagamento === "Faturar_Depois" ? (
                <div className="rounded-lg bg-blue-500/10 p-4 border border-blue-500/20 text-xs text-blue-700 flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-blue-500" />
                  <div>
                    <span className="font-bold block">Faturamento Posterior</span>
                    O agendamento será registrado e nosso time financeiro entrará em contato para emitir o boleto. O valor total permanece o mesmo.
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-500/10 p-4 border border-amber-500/20 text-xs text-amber-600 flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="font-bold block">Modo Validação Rápida</span>
                    O pagamento real foi postergado. Clicar em "Confirmar" registra o agendamento no Supabase e envia notificação no WhatsApp.
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(3)}><ChevronLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Botão Falar com Vendedor */}
                  <a
                    href="https://wa.me/5515981103345?text=Olá%2C%20preciso%20de%20ajuda%20com%20um%20agendamento%20na%20Quantis%20Obras!"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 font-semibold px-4 py-2 text-sm transition-all"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Falar com Vendedor
                  </a>
                  {/* Botão Confirmar */}
                  <Button onClick={handleConfirmBooking} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando...</> : "Confirmar Agendamento"}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

