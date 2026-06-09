import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus, ClipboardList, Users, Settings, MapPin, Camera, Building2,
  Bell, BarChart3, Clock, FlaskConical, ChevronRight, X, Check, AlertTriangle,
  Upload, Eye, EyeOff, UserPlus, Plus, CheckCircle2, FileText, Calendar, LucideIcon, ShieldCheck, Edit,
  Star, Settings2, LogOut, HardHat, Filter, FileDown, Printer
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  validateBooking,
  acceptInvite,
  rejectInvite,
  startExecution,
  recordCheckin,
  addMoldingCycle,
  finalizeExecution,
  registerTechnician,
  registerAdmin,
  updateTechnician,
  addTechnicianDocument,
  deleteTechnicianDocument,
  syncUserRoles,
  processTimeouts,
  resolveAlert,
  requestBlocker,
  updateBlockerStatus,
  resolveMapsUrl,
  abandonBooking,
  getAgendamentoSettings,
  saveAgendamentoSettings,
  submitTechnicianRating,
  getTechnicianRatings,
  deleteObra,
  allocateTechnicianManually
} from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Quantis Obras" }] }),
  component: Dashboard,
});

// ── Helpers ────────────────────────────────────────────────────────────────
function Dashboard() {
  const { roles, user } = useAuth();
  const role = primaryRole(roles);

  useEffect(() => {
    // If logged in but does not have technician/admin role, check if they are in 'tecnicos' table to repair
    if (user && !roles.includes("tecnico") && !roles.includes("admin")) {
      syncUserRoles()
        .then((res) => {
          if (res && res.roleSynced === "tecnico") {
            window.location.reload();
          }
        })
        .catch((err) => console.error("Error syncing user roles:", err));
    }
  }, [user, roles]);

  useEffect(() => {
    if (user) {
      processTimeouts().catch((err) => console.error("Error processing timeouts/allocations:", err));
    }
  }, [user]);

  if (role === "admin") return <AdminDash />;
  if (role === "tecnico") return <TecnicoDash email={user?.email ?? ""} userId={user?.id ?? ""} />;
  return <ClienteDash email={user?.email ?? ""} userId={user?.id ?? ""} />;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function PlaceholderCard({ icon: Icon, title, desc, badge }: { icon: LucideIcon; title: string; desc: string; badge?: string }) {
  return (
    <Card className="transition-all hover:shadow-[var(--shadow-elegant)] border border-border bg-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <CardTitle className="mt-3 text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Em breve nesta fase do app.</p>
      </CardContent>
    </Card>
  );
}

// Robust upload function with Base64 fallback if storage bucket fails
async function uploadPhotoOrBase64(file: File): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `historico/${fileName}`;

    let uploadResult = await supabase.storage.from("fotos").upload(filePath, file);
    
    if (uploadResult.error) {
      console.warn("Upload to bucket 'fotos' failed, trying 'historico_fotos'...", uploadResult.error);
      uploadResult = await supabase.storage.from("historico_fotos").upload(filePath, file);
    }

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const bucketUsed = uploadResult.data.path.startsWith("fotos/") ? "fotos" : "historico_fotos";
    const { data } = supabase.storage.from(bucketUsed).getPublicUrl(uploadResult.data.path);
    return data.publicUrl;
  } catch (err) {
    console.warn("Storage bucket upload failed or unconfigured, converting to Base64:", err);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }
}

// Status helpers
const STATUS_COLORS: Record<string, string> = {
  Pendente_Tecnico: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Pendente_Aprovacao_Gestor: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Confirmado: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Em_Execucao: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  Aguardando_Medicao: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Validado: "bg-green-500/10 text-green-600 border-green-500/20",
  Laboratorio: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  Cancelado: "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  Pendente_Tecnico: "⏳ Aguardando Técnico",
  Pendente_Aprovacao_Gestor: "🚨 Pendente sua Aprovação",
  Confirmado: "✅ Confirmado",
  Em_Execucao: "🔧 Em Execução",
  Aguardando_Medicao: "📋 Aguardando Medição",
  Validado: "✅ Concluído e Validado",
  Laboratorio: "🔬 No Laboratório",
  Cancelado: "❌ Cancelado",
};

// ── CLIENTE DASHBOARD ──────────────────────────────────────────────────────
function ClienteDash({ email, userId }: { email: string; userId: string }) {
  const navigate = useNavigate();

  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pendentes");
  const [clientCompany, setClientCompany] = useState<any>(null);
  const [approvingTec, setApprovingTec] = useState<string | null>(null);
  const [reallocatingTec, setReallocatingTec] = useState<string | null>(null);
  const [overtimeActionLoading, setOvertimeActionLoading] = useState(false);

  // Advanced filters state for client panel
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("all");
  const [filterPiece, setFilterPiece] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [availableServices, setAvailableServices] = useState<any[]>([]);

  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("servicos_catalogo_pub")
        .select("id, nome_servico, sku")
        .eq("ativo", true)
        .order("nome_servico", { ascending: true });
      if (!error && data) {
        setAvailableServices(data);
      }
    }
    fetchServices();
  }, []);

  // Booking detail modal state
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [bookingPhotos, setBookingPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Client view technician profile state
  const [clientViewTecnico, setClientViewTecnico] = useState<any | null>(null);
  const [clientTecDocs, setClientTecDocs] = useState<any[]>([]);
  const [clientTecSkills, setClientTecSkills] = useState<any[]>([]);
  const [loadingClientTec, setLoadingClientTec] = useState(false);
  const [clientPreviewUrl, setClientPreviewUrl] = useState<string | null>(null);
  const [clientPreviewType, setClientPreviewType] = useState<string | null>(null);

  // Rejection states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectBookingId, setRejectBookingId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  // Rescheduling and Cancellation states
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [rescheduleDatasDisponiveis, setRescheduleDatasDisponiveis] = useState<string[]>([]);
  const [loadingRescheduleDatas, setLoadingRescheduleDatas] = useState(false);
  const [calMesReschedule, setCalMesReschedule] = useState<Date>(new Date());

  // Technician Rating Modal states
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingTecnicoId, setRatingTecnicoId] = useState<string | null>(null);
  const [ratingTecnicoNome, setRatingTecnicoNome] = useState<string>("");
  const [ratingComunicacao, setRatingComunicacao] = useState(5);
  const [ratingConhecimento, setRatingConhecimento] = useState(5);
  const [ratingPontualidade, setRatingPontualidade] = useState(5);
  const [ratingLimpeza, setRatingLimpeza] = useState(5);
  const [ratingOrganizacao, setRatingOrganizacao] = useState(5);
  const [ratingComentario, setRatingComentario] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratedBookingIds, setRatedBookingIds] = useState<Set<string>>(new Set());

  const handleOpenRatingDialog = (ag: any) => {
    setRatingBookingId(ag.id);
    setRatingTecnicoId(ag.tecnico?.id || ag.tecnico_id || null);
    setRatingTecnicoNome(ag.tecnico?.nome || "Técnico");
    setRatingComunicacao(5);
    setRatingConhecimento(5);
    setRatingPontualidade(5);
    setRatingLimpeza(5);
    setRatingOrganizacao(5);
    setRatingComentario("");
    setRatingDialogOpen(true);
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBookingId || !ratingTecnicoId) return;
    setRatingSubmitting(true);
    try {
      await submitTechnicianRating({
        data: {
          bookingId: ratingBookingId,
          tecnicoId: ratingTecnicoId,
          notaComunicacao: ratingComunicacao,
          notaConhecimentoTecnico: ratingConhecimento,
          notaPontualidade: ratingPontualidade,
          notaLimpezaMateriais: ratingLimpeza,
          notaOrganizacaoTrabalho: ratingOrganizacao,
          comentario: ratingComentario || null,
          tipoAvaliador: "cliente",
        },
      });
      toast.success("Avaliação enviada! Obrigado pelo feedback.");
      setRatedBookingIds(prev => new Set(prev).add(ratingBookingId));
      setRatingDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar avaliação.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const fetchRescheduleAvailability = async (categoria: string) => {
    setLoadingRescheduleDatas(true);
    try {
      const catLower = (categoria || "Concreto").toLowerCase();

      // Fetch compatible technicians
      const { data: tecnicos } = await supabase
        .from("tecnicos")
        .select("id, nome, status, certificacoes")
        .eq("status", "Disponivel");

      const compativeis = (tecnicos || []).filter((t) => {
        if (!t.certificacoes) return true;
        const cert = t.certificacoes.toLowerCase();
        return cert.includes(catLower) || catLower.includes("concreto") || catLower.includes("geral");
      });

      // Fetch bookings in next 60 days
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const limite = new Date();
      limite.setDate(limite.getDate() + 62);

      const { data: agendados } = await supabase
        .from("agendamentos_medicoes")
        .select("data_servico, tecnico_id")
        .gte("data_servico", hoje.toISOString().split("T")[0])
        .lte("data_servico", limite.toISOString().split("T")[0])
        .in("status_agendamento", ["Confirmado", "Em_Execucao", "Pendente_Tecnico"])
        .in("tecnico_id", compativeis.map((t) => t.id));

      const datasOcupadas = new Set<string>();
      const contagem: Record<string, number> = {};
      (agendados || []).forEach((a) => {
        contagem[a.data_servico] = (contagem[a.data_servico] || 0) + 1;
      });
      Object.entries(contagem).forEach(([data, count]) => {
        if (count >= compativeis.length) datasOcupadas.add(data);
      });

      const datasOk: string[] = [];
      const cursor = new Date(hoje);
      cursor.setDate(cursor.getDate() + 2); // 48h limit
      while (cursor <= limite) {
        const dow = cursor.getDay();
        const iso = cursor.toISOString().split("T")[0];
        if (dow !== 0 && !datasOcupadas.has(iso)) {
          datasOk.push(iso);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      setRescheduleDatasDisponiveis(datasOk);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRescheduleDatas(false);
    }
  };

  const handleOpenReschedule = (booking: any) => {
    setRescheduleBooking(booking);
    setNewDate(booking.data_servico);
    setNewTime(booking.horario_na_obra?.substring(0, 5) || "08:00");
    setCalMesReschedule(new Date(booking.data_servico + "T00:00:00"));
    fetchRescheduleAvailability(booking.servico?.categoria || "Concreto");
    setRescheduleDialogOpen(true);
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTime) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }
    setSavingReschedule(true);
    try {
      const { error } = await supabase
        .from("agendamentos_medicoes")
        .update({
          data_servico: newDate,
          horario_na_obra: newTime + ":00", // Ensure valid time format
          tecnico_id: null,
          status_agendamento: "Pendente_Tecnico"
        })
        .eq("id", rescheduleBooking.id);

      if (error) throw error;
      toast.success("Agendamento reagendado com sucesso!");
      setRescheduleDialogOpen(false);
      setSelectedBooking(null);
      fetchBookings();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao reagendar.");
    } finally {
      setSavingReschedule(false);
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
    try {
      const { error } = await supabase
        .from("agendamentos_medicoes")
        .update({ status_agendamento: "Cancelado", tecnico_id: null })
        .eq("id", id);
      if (error) throw error;
      toast.success("Agendamento cancelado com sucesso!");
      setSelectedBooking(null);
      fetchBookings();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao cancelar agendamento.");
    }
  };


  const handleApproveTechnician = async (bookingId: string) => {
    setApprovingTec(bookingId);
    try {
      const { approveTechnician: dynamicApprove } = await import("@/lib/booking.functions");
      await dynamicApprove({ data: { bookingId } });
      toast.success("Alocação de técnico aprovada com sucesso!");
      fetchBookings();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao aprovar técnico.");
    } finally {
      setApprovingTec(null);
    }
  };

  const handleReallocateTechnician = async (bookingId: string) => {
    if (!confirm("Tem certeza que deseja remanejar este agendamento? O técnico atual será desvinculado e outro será convidado.")) return;
    setReallocatingTec(bookingId);
    try {
      const { reallocateTechnician: dynamicReallocate } = await import("@/lib/booking.functions");
      await dynamicReallocate({ data: { bookingId } });
      toast.success("Técnico desvinculado. Nova busca iniciada!");
      fetchBookings();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao remanejar técnico.");
    } finally {
      setReallocatingTec(null);
    }
  };

  const handleApproveOvertime = async (bookingId: string, approved: boolean) => {
    setOvertimeActionLoading(true);
    try {
      const { approveOvertime: dynamicApproveOT } = await import("@/lib/booking.functions");
      await dynamicApproveOT({ data: { bookingId, approved } });
      toast.success(approved ? "Horas extras aprovadas!" : "Horas extras reprovadas!");
      
      // Update selectedBooking details to refresh the modal view
      if (selectedBooking && selectedBooking.id === bookingId) {
        const { data: updated } = await supabase
          .from("agendamentos_medicoes")
          .select("*, obra:obras(*), servico:servicos_catalogo_pub(*), tecnico:tecnicos!agendamentos_medicoes_tecnico_id_fkey(*)")
          .eq("id", bookingId)
          .single();
        if (updated) setSelectedBooking(updated);
      }
      
      fetchBookings();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao processar horas extras.");
    } finally {
      setOvertimeActionLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      let { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .single();

      // Self-healing: if profile has no company linked, associate them with the default test company
      if (profile && !profile.empresa_id) {
        const { data: empresa } = await supabase
          .from("empresas_clientes")
          .select("id")
          .eq("cnpj", "12.345.678/0001-99")
          .maybeSingle();

        let newEmpresaId = empresa?.id;
        if (!newEmpresaId) {
          const { data: newEmpresa } = await supabase
            .from("empresas_clientes")
            .insert({ razao_social: "Quantis Cliente Padrão Ltda", cnpj: "12.345.678/0001-99" })
            .select("id")
            .single();
          newEmpresaId = newEmpresa?.id;
        }

        if (newEmpresaId) {
          await supabase
            .from("profiles")
            .update({ empresa_id: newEmpresaId })
            .eq("id", userId);
          profile.empresa_id = newEmpresaId;
        }
      }

      let query = supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*), tecnico:tecnicos!agendamentos_medicoes_tecnico_id_fkey(*), fotos:historico_fotos(tipo_foto, metadata)");

      if (profile?.empresa_id) {
        query = query.or(`criado_por.eq.${userId},empresa_id.eq.${profile.empresa_id}`);
      } else {
        query = query.eq("criado_por", userId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setAgendamentos(data);

      if (profile?.empresa_id) {
        const { data: comp } = await supabase
          .from("empresas_clientes")
          .select("id, requer_aprovacao_tecnico, razao_social, cnpj")
          .eq("id", profile.empresa_id)
          .single();
        if (comp) setClientCompany(comp);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientViewTecnico) {
      setClientTecDocs([]);
      setClientTecSkills([]);
      setClientPreviewUrl(null);
      setClientPreviewType(null);
      return;
    }
    async function fetchDocsAndSkills() {
      setLoadingClientTec(true);
      try {
        const [docsRes, skillsRes] = await Promise.all([
          supabase.from("documentos_tecnicos").select("*").eq("tecnico_id", clientViewTecnico.id),
          supabase.from("habilidades_tecnicos").select("*, servico:servicos_catalogo_pub(*)").eq("tecnico_id", clientViewTecnico.id)
        ]);
        if (!docsRes.error && docsRes.data) setClientTecDocs(docsRes.data);
        if (!skillsRes.error && skillsRes.data) setClientTecSkills(skillsRes.data);
      } catch (err) {
        console.error("Error loading technician docs/skills for client:", err);
      } finally {
        setLoadingClientTec(false);
      }
    }
    fetchDocsAndSkills();
  }, [clientViewTecnico]);

  const handleSelectClientPreview = (url: string, name: string) => {
    setClientPreviewUrl(url);
    const lowerUrl = url.toLowerCase();
    const lowerName = name.toLowerCase();
    if (lowerUrl.includes(".pdf") || lowerName.includes(".pdf") || url.startsWith("data:application/pdf")) {
      setClientPreviewType("pdf");
    } else if (
      lowerUrl.includes(".png") || lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg") || lowerUrl.includes(".webp") ||
      lowerUrl.startsWith("data:image/") || lowerName.includes(".png") || lowerName.includes(".jpg") || lowerName.includes(".jpeg") || lowerName.includes(".webp")
    ) {
      setClientPreviewType("image");
    } else {
      setClientPreviewType("other");
    }
  };

  useEffect(() => {
    if (userId) {
      fetchBookings();
    }
  }, [userId]);

  // Load photos of selected booking
  useEffect(() => {
    if (!selectedBooking) {
      setBookingPhotos([]);
      return;
    }
    async function fetchPhotos() {
      setLoadingPhotos(true);
      try {
        const { data, error } = await supabase
          .from("historico_fotos")
          .select("*")
          .eq("agendamento_id", selectedBooking.id)
          .order("created_at", { ascending: true });
        if (!error && data) {
          setBookingPhotos(data);
        }
      } catch (err) {
        console.error("Error fetching photos:", err);
      } finally {
        setLoadingPhotos(false);
      }
    }
    fetchPhotos();
  }, [selectedBooking]);

  const handleValidate = async (bookingId: string) => {
    if (!confirm("Deseja confirmar a conclusão e validar as medições deste serviço?")) return;
    try {
      const res = await validateBooking({ data: { bookingId } });
      if (res.success) {
        toast.success("Medições validadas e serviço concluído com sucesso!");
        setSelectedBooking(null); // Fecha modal de detalhes se estiver aberto
        fetchBookings();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao validar agendamento.");
    }
  };

  const handleOpenRejectDialog = (bookingId: string) => {
    setRejectBookingId(bookingId);
    setJustificativa("");
    setRejectDialogOpen(true);
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectBookingId || !justificativa.trim()) {
      toast.error("A justificativa é obrigatória.");
      return;
    }
    setRejectLoading(true);
    try {
      const { rejectBookingMedicao } = await import("@/lib/booking.functions");
      const res = await rejectBookingMedicao({
        data: {
          bookingId: rejectBookingId,
          justificativa: justificativa.trim()
        }
      });
      if (res.success) {
        toast.success("Medição reprovada com sucesso. O atendimento retornou para execução.");
        setRejectDialogOpen(false);
        setSelectedBooking(null); // Fecha modal de detalhes se estiver aberto
        fetchBookings();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao reprovar agendamento.");
    } finally {
      setRejectLoading(false);
    }
  };

  const filteredAgendamentos = agendamentos.filter((a) => {
    // 1. Period Start Filter
    if (filterStartDate && a.data_servico < filterStartDate) {
      return false;
    }
    // 2. Period End Filter
    if (filterEndDate && a.data_servico > filterEndDate) {
      return false;
    }
    // 3. Service ID Filter
    if (filterServiceId !== "all" && a.servico_id !== filterServiceId) {
      return false;
    }
    // 4. Piece Filter
    if (filterPiece) {
      const searchStr = filterPiece.toLowerCase().trim();
      const inObs = a.observacoes?.toLowerCase().includes(searchStr);
      const inCycles = a.fotos?.some((f: any) => 
        f.tipo_foto === "Ciclo_CP" && 
        f.metadata?.peca_concretada?.toLowerCase().includes(searchStr)
      );
      if (!inObs && !inCycles) {
        return false;
      }
    }
    // 5. Status Filter
    if (filterStatus !== "all" && a.status_agendamento !== filterStatus) {
      return false;
    }
    return true;
  });

  const pendentes = filteredAgendamentos.filter((a) => ["Pendente_Tecnico", "Pendente_Aprovacao_Gestor"].includes(a.status_agendamento));
  const confirmados = filteredAgendamentos.filter((a) =>
    ["Confirmado", "Em_Execucao", "Aguardando_Medicao"].includes(a.status_agendamento)
  );
  const concluidos = filteredAgendamentos.filter((a) =>
    ["Validado", "Laboratorio", "Cancelado"].includes(a.status_agendamento)
  );

  const handleExportCSV = () => {
    if (filteredAgendamentos.length === 0) {
      toast.error("Nenhum dado filtrado para exportar.");
      return;
    }

    const headers = [
      "Código do Pedido",
      "Data do Serviço",
      "Horário",
      "Obra",
      "Cidade",
      "Serviço",
      "CPs Contratados",
      "CPs Realizados",
      "Status do Agendamento",
      "Forma de Pagamento",
      "Valor Total (R$)",
      "Horas Extras (min)",
      "Caminhões Realizados",
    ];

    const rows = filteredAgendamentos.map((a) => [
      a.codigo_pedido,
      a.data_servico,
      a.horario_na_obra,
      a.obra?.nome_obra || "",
      a.obra?.cidade || "",
      a.servico?.nome_servico || "",
      a.cps_contratados,
      a.cps_moldados_real || 0,
      STATUS_LABELS[a.status_agendamento] || a.status_agendamento,
      a.forma_pagamento || "",
      a.valor_total,
      a.horas_extras_minutos || 0,
      a.qtd_caminhoes_real || 0,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_obras_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    if (filteredAgendamentos.length === 0) {
      toast.error("Nenhum dado filtrado para gerar relatório.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão. Por favor, desative o bloqueador de pop-ups.");
      return;
    }

    const totalCps = filteredAgendamentos.reduce((sum, a) => sum + (a.cps_moldados_real || a.cps_contratados || 0), 0);
    const totalValue = filteredAgendamentos.reduce((sum, a) => sum + Number(a.valor_total || 0), 0);

    const filterDetails = [];
    if (filterStartDate) filterDetails.push(`Início: ${filterStartDate}`);
    if (filterEndDate) filterDetails.push(`Fim: ${filterEndDate}`);
    if (filterServiceId !== "all") {
      const svc = availableServices.find(s => s.id === filterServiceId);
      if (svc) filterDetails.push(`Serviço: ${svc.nome_servico}`);
    }
    if (filterPiece) filterDetails.push(`Peça: ${filterPiece}`);
    if (filterStatus !== "all") filterDetails.push(`Status: ${STATUS_LABELS[filterStatus] || filterStatus}`);

    const filterText = filterDetails.length > 0 ? filterDetails.join(" | ") : "Todos os registros";

    const rowsHtml = filteredAgendamentos.map((a) => `
      <tr>
        <td style="font-family: monospace; font-size: 11px;">${a.codigo_pedido}</td>
        <td>${new Date(a.data_servico + "T00:00:00").toLocaleDateString("pt-BR")}</td>
        <td>${a.obra?.nome_obra || ""}</td>
        <td>${a.obra?.cidade || ""}</td>
        <td>${a.servico?.nome_servico || ""}</td>
        <td style="text-align: center;">${a.cps_moldados_real || a.cps_contratados || 0}</td>
        <td>${STATUS_LABELS[a.status_agendamento] || a.status_agendamento}</td>
        <td style="text-align: right; font-weight: bold;">R$ ${Number(a.valor_total).toFixed(2)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório Executivo - Quantis Obras</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #333;
            margin: 40px;
            font-size: 13px;
            line-height: 1.4;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a8a;
          }
          .title {
            text-align: right;
          }
          .title h1 {
            margin: 0;
            font-size: 20px;
            color: #1e3a8a;
          }
          .title p {
            margin: 5px 0 0 0;
            font-size: 11px;
            color: #666;
          }
          .filters {
            background-color: #f3f4f6;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 11px;
            color: #4b5563;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
          }
          .summary-card {
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 6px;
            background-color: #fafafa;
          }
          .summary-card p {
            margin: 0;
            font-size: 10px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 600;
          }
          .summary-card h2 {
            margin: 5px 0 0 0;
            font-size: 18px;
            color: #111827;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #1e3a8a;
            color: white;
            font-weight: 600;
            text-align: left;
            padding: 10px;
            font-size: 11px;
          }
          td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
          }
          tr:nth-child(even) td {
            background-color: #f9fafb;
          }
          footer {
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
            margin-top: 50px;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="logo">Quantis Obras</div>
          <div class="title">
            <h1>Relatório de Agendamentos</h1>
            <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
          </div>
        </header>

        <div class="filters">
          <strong>Filtros Aplicados:</strong> ${filterText}
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <p>Total Chamados</p>
            <h2>${filteredAgendamentos.length}</h2>
          </div>
          <div class="summary-card">
            <p>Total CPs Moldados</p>
            <h2>${totalCps}</h2>
          </div>
          <div class="summary-card">
            <p>Valor Consolidado</p>
            <h2>R$ ${totalValue.toFixed(2)}</h2>
          </div>
          <div class="summary-card">
            <p>Empresa</p>
            <h2 style="font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${clientCompany?.razao_social || "Carregando..."}</h2>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Data</th>
              <th>Obra</th>
              <th>Cidade</th>
              <th>Serviço</th>
              <th style="text-align: center;">CPs</th>
              <th>Status</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <footer>
          Relatório Executivo Quantis Obras - Rastreabilidade, Controle Tecnológico e Transparência.
        </footer>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };



  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <SectionTitle
        title="Painel do Cliente"
        subtitle={`Bem-vindo, ${email}. Gerencie seus agendamentos de controle tecnológico.`}
      />

      {/* ── Cards de Resumo ── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Pedidos</p>
            <p className="text-3xl font-extrabold text-foreground mt-1">{agendamentos.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Aguardando Técnico</p>
            <p className="text-3xl font-extrabold text-amber-600 mt-1">{pendentes.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-5">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Confirmados</p>
            <p className="text-3xl font-extrabold text-blue-600 mt-1">{confirmados.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-green-500/30 bg-green-500/5">
          <CardContent className="pt-5">
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Concluídos / Realizados</p>
            <p className="text-3xl font-extrabold text-green-600 mt-1">{concluidos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Barra de Filtros Avançados & Exportação ── */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filtros Avançados
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="text-xs font-bold gap-1.5 h-8 bg-card border-border hover:bg-accent"
              >
                <FileDown className="h-3.5 w-3.5" /> Exportar Excel (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintPDF}
                className="text-xs font-bold gap-1.5 h-8 bg-card border-border hover:bg-accent"
              >
                <Printer className="h-3.5 w-3.5" /> Gerar PDF
              </Button>
              {(filterStartDate || filterEndDate || filterServiceId !== "all" || filterPiece || filterStatus !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setFilterStartDate("");
                    setFilterEndDate("");
                    setFilterServiceId("all");
                    setFilterPiece("");
                    setFilterStatus("all");
                  }}
                  className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/25 h-8 px-2"
                >
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="filter-start" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data Inicial</Label>
              <Input
                id="filter-start"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-end" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data Final</Label>
              <Input
                id="filter-end"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-service" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Serviço</Label>
              <select
                id="filter-service"
                value={filterServiceId}
                onChange={(e) => setFilterServiceId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
              >
                <option value="all">Todos os Serviços</option>
                {availableServices.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.nome_servico}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-piece" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Peça / Estrutura</Label>
              <Input
                id="filter-piece"
                placeholder="Ex: Laje, Pilar..."
                value={filterPiece}
                onChange={(e) => setFilterPiece(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-status" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
              >
                <option value="all">Todos os Status</option>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Abas do Painel ── */}
      <Tabs defaultValue="pendentes" onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap gap-2 md:gap-3 bg-transparent p-0 h-auto justify-start mb-6">
          <TabsTrigger 
            value="solicitar" 
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <CalendarPlus className="h-4 w-4" /> Solicitação
          </TabsTrigger>
          <TabsTrigger 
            value="pendentes" 
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <Clock className="h-4 w-4" /> Aguardando Técnico ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger 
            value="confirmados" 
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <Calendar className="h-4 w-4" /> Confirmados ({confirmados.length})
          </TabsTrigger>
          <TabsTrigger 
            value="realizados" 
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <CheckCircle2 className="h-4 w-4" /> Realizados ({concluidos.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: SOLICITAÇÃO ── */}
        <TabsContent value="solicitar">
          <Card className="border border-border bg-card max-w-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-primary" />
                Solicitar Novo Agendamento
              </CardTitle>
              <CardDescription>
                Agende ensaios de concreto e controle tecnológico para a sua obra com antecedência de no mínimo 48 horas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nossos laboratórios e técnicos móveis atendem Sorocaba e região de Segunda a Sábado. Ao registrar a sua solicitação, calculamos a melhor rota e escalamos os profissionais mais bem avaliados para prestar o atendimento no canteiro.
              </p>
              <Button
                onClick={() => navigate({ to: "/novo-agendamento" })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
                size="lg"
              >
                <Plus className="h-5 w-5" />
                Iniciar Nova Solicitação
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: AGUARDANDO TÉCNICO ── */}
        <TabsContent value="pendentes" className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando agendamentos pendentes…</div>
          ) : pendentes.length === 0 ? (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-3">
                <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento aguardando aceitação de técnico.</p>
                <Button onClick={() => setActiveTab("solicitar")} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  Agendar agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {pendentes.map((ag) => (
                <Card
                  key={ag.id}
                  className="border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer"
                  onClick={() => setSelectedBooking(ag)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">{ag.obra?.nome_obra || "Obra sem nome"}</span>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[ag.status_agendamento] || "bg-muted text-muted-foreground"}
                        >
                          {STATUS_LABELS[ag.status_agendamento] || ag.status_agendamento}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {ag.servico?.nome_servico || "Controle Tecnológico"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pedido: <span className="text-foreground font-medium">{ag.codigo_pedido}</span>
                        {ag.obra?.cidade && ` · ${ag.obra.cidade}`}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-3 min-w-[200px]">
                      <div className="text-right sm:text-left md:text-right">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {ag.cps_contratados} CPs · {ag.forma_pagamento}
                        </div>
                      </div>
                      {ag.status_agendamento === "Pendente_Aprovacao_Gestor" ? (
                        <div className="text-[10px] text-orange-600 font-semibold italic flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
                          <Clock className="h-3 w-3 text-orange-500" /> Aguardando aprovação da Geraltest
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground italic flex items-center gap-1 bg-muted px-2 py-1 rounded">
                          <Clock className="h-3 w-3" /> Aguardando aceite do técnico
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: CONFIRMADOS ── */}
        <TabsContent value="confirmados" className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando agendamentos confirmados…</div>
          ) : confirmados.length === 0 ? (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-3">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento confirmado por técnico.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {confirmados.map((ag) => (
                <Card
                  key={ag.id}
                  className="border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer"
                  onClick={() => setSelectedBooking(ag)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">{ag.obra?.nome_obra || "Obra sem nome"}</span>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[ag.status_agendamento] || "bg-muted text-muted-foreground"}
                        >
                          {STATUS_LABELS[ag.status_agendamento] || ag.status_agendamento}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {ag.servico?.nome_servico || "Controle Tecnológico"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pedido: <span className="text-foreground font-medium">{ag.codigo_pedido}</span>
                        {ag.obra?.cidade && ` · ${ag.obra.cidade}`}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-3 min-w-[200px]">
                      <div className="text-right sm:text-left md:text-right">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {ag.cps_contratados} CPs · {ag.forma_pagamento}
                        </div>
                      </div>

                      {ag.status_agendamento === "Aguardando_Medicao" ? (
                        <div className="flex gap-2 self-stretch sm:self-auto">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 flex-1 sm:flex-initial"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleValidate(ag.id);
                            }}
                          >
                            <Check className="h-4 w-4" />
                            Aceitar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="font-bold gap-1 flex-1 sm:flex-initial"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRejectDialog(ag.id);
                            }}
                          >
                            <X className="h-4 w-4" />
                            Reprovar
                          </Button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground italic flex items-center gap-1 bg-muted px-2 py-1 rounded">
                          <Eye className="h-3 w-3" /> Clique para ver técnico e acompanhar
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: REALIZADOS ── */}
        <TabsContent value="realizados" className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando histórico…</div>
          ) : concluidos.length === 0 ? (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-2">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento concluído ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {concluidos.map((ag) => (
                <Card
                  key={ag.id}
                  className="border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer"
                  onClick={() => setSelectedBooking(ag)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">{ag.obra?.nome_obra || "Obra sem nome"}</span>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[ag.status_agendamento] || "bg-muted text-muted-foreground"}
                        >
                          {STATUS_LABELS[ag.status_agendamento] || ag.status_agendamento}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {ag.servico?.nome_servico || "Controle Tecnológico"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pedido: <span className="text-foreground font-medium">{ag.codigo_pedido}</span> · CPs Moldados: <strong className="text-primary">{ag.cps_moldados_real ?? ag.cps_contratados}</strong>
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-border min-w-[150px]">
                      <div className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                      <div className="text-sm font-extrabold text-primary mt-1">
                        R$ {Number(ag.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <button
                        className="mt-2 text-xs text-primary hover:underline font-bold flex items-center gap-1"
                      >
                        Ver Ensaios & Fotos <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>


      </Tabs>

      {/* ── DETALHES MODAL (LINHA DO TEMPO DOS ENSAIOS E FOTOS CRONOLÓGICA) ── */}
      {selectedBooking && (
        <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">
                Linha do Tempo de Campo — {selectedBooking.obra?.nome_obra}
              </DialogTitle>
              <DialogDescription>
                Pedido: <span className="font-semibold text-foreground">{selectedBooking.codigo_pedido}</span> · Serviço: {selectedBooking.servico?.nome_servico || "Controle Tecnológico"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Resumo rápido */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/40 p-4 rounded-lg border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block font-medium">Data do Serviço</span>
                  <span className="font-bold text-foreground">{new Date(selectedBooking.data_servico + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">Chegada Estimada</span>
                  <span className="font-bold text-foreground">{selectedBooking.horario_na_obra?.substring(0, 5)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">CPs Contratados</span>
                  <span className="font-bold text-foreground">{selectedBooking.cps_contratados} unidades</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">CPs Moldados Reais</span>
                  <span className="font-bold text-primary">{selectedBooking.cps_moldados_real !== null ? `${selectedBooking.cps_moldados_real} CPs` : "Aguardando"}</span>
                </div>
              </div>

              {selectedBooking.tecnico && (
                <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-200">
                  <div>
                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">Técnico Alocado</span>
                    <h5 className="font-bold text-foreground text-sm">{selectedBooking.tecnico.nome}</h5>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Avaliação: <span className="font-bold text-amber-500">{selectedBooking.tecnico.ranking_score ? Number(selectedBooking.tecnico.ranking_score).toFixed(1) : "5.0"} ⭐</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    className="border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 font-bold gap-1.5"
                    onClick={() => setClientViewTecnico(selectedBooking.tecnico)}
                  >
                    <Eye className="h-4 w-4" /> Perfil e Documentos
                  </Button>
                </div>
              )}

              {/* Histórico/Timeline */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2 border-b pb-2 border-border">
                  <ClipboardList className="h-4.5 w-4.5 text-primary" />
                  Evidências Técnicas em Canteiro (Ordem de Realização)
                </h4>

                {loadingPhotos ? (
                  <div className="text-center text-xs text-muted-foreground py-8">Buscando registros técnicos...</div>
                ) : bookingPhotos.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-10 bg-muted/10 border border-dashed rounded-lg">
                    Nenhum registro ou foto enviado pelo técnico para este agendamento até o momento.
                  </div>
                ) : (
                  <div className="relative border-l-2 border-primary/20 ml-3 pl-6 space-y-6 py-2">
                    {bookingPhotos.map((photo) => {
                      const meta = photo.metadata || {};
                      let title = "Registro Técnico";
                      let detailsHtml = null;

                      if (photo.tipo_foto === "Checkin_QR") {
                        title = "Check-in do Técnico na Obra (GPS)";
                        detailsHtml = (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <p>📍 GPS Coordenadas: {meta.latitude ? `${Number(meta.latitude).toFixed(6)}, ${Number(meta.longitude).toFixed(6)}` : "Não compartilhadas"}</p>
                            <p>🕒 Registro de Chegada: {meta.horario_checkin ? new Date(meta.horario_checkin).toLocaleTimeString("pt-BR") : new Date(photo.created_at).toLocaleTimeString("pt-BR")}</p>
                          </div>
                        );
                      } else if (photo.tipo_foto === "Ciclo_CP") {
                        title = `Moldagem & Ensaio (Caminhão ${meta.numero_caminhao || "N/A"})`;
                        detailsHtml = (
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1 bg-muted/20 p-2.5 rounded border border-border">
                            <p>🧪 <strong className="text-foreground">Caminhão:</strong> {meta.numero_caminhao}</p>
                            <p>📄 <strong className="text-foreground">Nota Fiscal:</strong> {meta.nota_fiscal}</p>
                            <p>🏗️ <strong className="text-foreground">Peça Concretada:</strong> {meta.peca_concretada}</p>
                            <p>📉 <strong className="text-foreground">Slump Test:</strong> {meta.slump} mm</p>
                            <p>🧱 <strong className="text-foreground">CPs Moldados:</strong> {meta.cps_moldados} unidades</p>
                            <p>🕒 Hora Registro: {meta.horario_registro ? new Date(meta.horario_registro).toLocaleTimeString("pt-BR") : new Date(photo.created_at).toLocaleTimeString("pt-BR")}</p>
                          </div>
                        );
                      } else if (photo.tipo_foto === "Final_Panoramica") {
                        title = "Foto Panorâmica Final (Organização dos CPs)";
                        detailsHtml = (
                          <div className="text-xs text-muted-foreground mt-1">
                            <p>🕒 Horário: {meta.horario_registro ? new Date(meta.horario_registro).toLocaleTimeString("pt-BR") : new Date(photo.created_at).toLocaleTimeString("pt-BR")}</p>
                          </div>
                        );
                      } else if (photo.tipo_foto === "Retorno_Carga") {
                        title = "Foto de Retorno de Carga / Resto na Betoneira";
                        detailsHtml = (
                          <div className="text-xs text-muted-foreground mt-1">
                            <p>🕒 Horário: {meta.horario_registro ? new Date(meta.horario_registro).toLocaleTimeString("pt-BR") : new Date(photo.created_at).toLocaleTimeString("pt-BR")}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={photo.id} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-[31px] mt-1 bg-background border-2 border-primary rounded-full h-4 w-4 grid place-items-center">
                            <div className="h-1.5 w-1.5 bg-primary rounded-full animate-ping" />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground block">{title}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(photo.created_at).toLocaleTimeString("pt-BR")}
                              </span>
                            </div>
                            {detailsHtml}
                            {photo.url_foto && (
                              <div className="relative group max-w-sm rounded-lg overflow-hidden border border-border mt-2 bg-muted/30">
                                <img
                                  src={photo.url_foto}
                                  alt={title}
                                  className="w-full max-h-48 object-cover cursor-zoom-in hover:opacity-90 transition-all"
                                  onClick={() => window.open(photo.url_foto, "_blank")}
                                />
                                <div className="absolute bottom-2 right-2 bg-black/60 text-[9px] text-white px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                                  Clique para abrir original
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bloco de Medição & Validação (CPs Excedentes e Horas Extras) */}
              {(selectedBooking.status_agendamento === "Aguardando_Medicao" || selectedBooking.status_agendamento === "Validado") && (
                <div className="border-t border-border pt-4 mt-6 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Resumo Financeiro & Medição Final
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] bg-muted/40 p-3 rounded border border-border">
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-semibold">Controle de CPs</p>
                      <p>Contratados: <strong className="text-foreground">{selectedBooking.cps_contratados} CPs</strong></p>
                      <p>Moldados Real: <strong className="text-foreground">{selectedBooking.cps_moldados_real || 0} CPs</strong></p>
                      {selectedBooking.cps_moldados_real > selectedBooking.cps_contratados && (
                        <p className="text-emerald-600 font-semibold mt-1">
                          Excedente: +{selectedBooking.cps_moldados_real - selectedBooking.cps_contratados} CPs 
                          {selectedBooking.servico?.valor_cp_excedente > 0 && (
                            <span> (Adicional: R$ {((selectedBooking.cps_moldados_real - selectedBooking.cps_contratados) * selectedBooking.servico.valor_cp_excedente).toFixed(2)})</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-semibold">Horas Extras em Campo</p>
                      <p>Saída Planejada: <strong className="text-foreground">{selectedBooking.horario_saida_lab?.substring(0, 5) || "16:00"}</strong></p>
                      <p>Saída Real: <strong className="text-foreground">{selectedBooking.horario_saida_real?.substring(0, 5) || "Não registrado"}</strong></p>
                      {selectedBooking.horas_extras_minutos > 0 ? (
                        <div className="space-y-1.5 mt-2 bg-card p-2 rounded border border-border">
                          <p className="font-semibold text-amber-600">
                            Solicitadas: {Math.floor(selectedBooking.horas_extras_minutos / 60)}h {selectedBooking.horas_extras_minutos % 60}min
                          </p>
                          <p className="text-[10px] text-muted-foreground">Status: <strong className="text-foreground">{
                            selectedBooking.status_horas_extras === "Pendente_Aprovacao" ? "⏳ Pendente Aprovação" :
                            selectedBooking.status_horas_extras === "Aprovado" ? "✅ Aprovado" : "❌ Reprovado"
                          }</strong></p>
                          {selectedBooking.status_horas_extras === "Pendente_Aprovacao" && (
                            <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-6 px-2 font-bold"
                                onClick={() => handleApproveOvertime(selectedBooking.id, true)}
                                disabled={overtimeActionLoading}
                              >
                                Aprovar HE
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                className="text-[10px] h-6 px-2 font-bold"
                                onClick={() => handleApproveOvertime(selectedBooking.id, false)}
                                disabled={overtimeActionLoading}
                              >
                                Recusar
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic mt-1 text-[10px]">Sem horas extras registradas.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-end gap-2 border-t pt-4 mt-6">
              <Button
                variant="outline"
                onClick={() => setSelectedBooking(null)}
              >
                Fechar
              </Button>
              {selectedBooking.status_agendamento === "Aguardando_Medicao" && (
                <>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                    onClick={() => handleValidate(selectedBooking.id)}
                  >
                    <Check className="h-4 w-4" />
                    Aceitar Medição
                  </Button>
                  <Button
                    variant="destructive"
                    className="font-bold gap-1"
                    onClick={() => handleOpenRejectDialog(selectedBooking.id)}
                  >
                    <X className="h-4 w-4" />
                    Reprovar Medição
                  </Button>
                </>
              )}
              {(selectedBooking.status_agendamento === "Pendente_Tecnico" || selectedBooking.status_agendamento === "Confirmado") && (
                <>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
                    onClick={() => handleOpenReschedule(selectedBooking)}
                  >
                    <Calendar className="h-4 w-4" />
                    Reagendar
                  </Button>
                  <Button
                    variant="destructive"
                    className="font-bold gap-1.5"
                    onClick={() => handleCancelBooking(selectedBooking.id)}
                  >
                    <X className="h-4 w-4" />
                    Cancelar Agendamento
                  </Button>
                </>
              )}
              {selectedBooking.status_agendamento === "Validado" && selectedBooking.tecnico_id && !ratedBookingIds.has(selectedBooking.id) && (
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
                  onClick={() => { setSelectedBooking(null); handleOpenRatingDialog(selectedBooking); }}
                >
                  <Star className="h-4 w-4" />
                  Avaliar Técnico
                </Button>
              )}
              {selectedBooking.status_agendamento === "Validado" && ratedBookingIds.has(selectedBooking.id) && (
                <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20">
                  <Check className="h-3.5 w-3.5" /> Avaliação enviada
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── DIALOG: Avaliar Técnico ── */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="max-w-lg border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Star className="h-5 w-5 text-yellow-500" />
              Avaliar Técnico
            </DialogTitle>
            <DialogDescription>
              Avalie o desempenho de <strong>{ratingTecnicoNome}</strong> neste atendimento. Seu feedback é muito importante para melhorarmos a qualidade dos nossos serviços.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRating} className="space-y-5 mt-2">
            {/* Helper component for star rating */}
            {([
              { label: "Comunicação", value: ratingComunicacao, setter: setRatingComunicacao, id: "comunicacao" },
              { label: "Conhecimento Técnico", value: ratingConhecimento, setter: setRatingConhecimento, id: "conhecimento" },
              { label: "Pontualidade", value: ratingPontualidade, setter: setRatingPontualidade, id: "pontualidade" },
              { label: "Limpeza dos Materiais", value: ratingLimpeza, setter: setRatingLimpeza, id: "limpeza" },
              { label: "Organização do Espaço de Trabalho", value: ratingOrganizacao, setter: setRatingOrganizacao, id: "organizacao" },
            ] as const).map((param) => (
              <div key={param.id} className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">{param.label}</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => (param.setter as (v: number) => void)(star)}
                      className={`transition-all duration-100 hover:scale-110 focus:outline-none ${
                        star <= param.value
                          ? "text-yellow-400"
                          : "text-muted-foreground/30 hover:text-yellow-300"
                      }`}
                    >
                      <Star className="h-7 w-7" fill={star <= param.value ? "currentColor" : "none"} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-bold text-muted-foreground">{param.value}/5</span>
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <label htmlFor="rating-comentario" className="text-sm font-semibold text-foreground">
                Comentários Adicionais <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Textarea
                id="rating-comentario"
                placeholder="Descreva sua experiência com o técnico (pontualidade, organização, etc.)"
                value={ratingComentario}
                onChange={(e) => setRatingComentario(e.target.value)}
                className="min-h-[80px] bg-background border-border text-foreground"
              />
            </div>

            <div className="bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground border border-border">
              Nota Média Calculada: <strong className="text-foreground text-sm">{((ratingComunicacao + ratingConhecimento + ratingPontualidade + ratingLimpeza + ratingOrganizacao) / 5).toFixed(1)}</strong> / 5.0
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRatingDialogOpen(false)}
                disabled={ratingSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
                disabled={ratingSubmitting}
              >
                <Star className="h-4 w-4" />
                {ratingSubmitting ? "Enviando..." : "Enviar Avaliação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Reprovação de Medição */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reprovar Medição
            </DialogTitle>
            <DialogDescription>
              Insira a justificativa para a reprovação. O atendimento retornará para o status "Em Execução" e o técnico poderá visualizar este motivo para realizar os ajustes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReject} className="space-y-4 mt-2">
            <div className="space-y-2">
              <label htmlFor="justificativa" className="text-sm font-medium text-foreground">
                Justificativa (Obrigatória)
              </label>
              <Textarea
                id="justificativa"
                placeholder="Descreva o motivo da reprovação (ex: fotos ilegíveis, dados de slump divergentes...)"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                required
                className="min-h-[100px] bg-background border-border text-foreground"
              />
            </div>

            <DialogFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
                disabled={rejectLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={rejectLoading || !justificativa.trim()}
              >
                {rejectLoading ? "Reprovando..." : "Confirmar Reprovação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Reagendar Agendamento ── */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="max-w-md border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              Reagendar Agendamento
            </DialogTitle>
            <DialogDescription>
              Selecione uma nova data e horário para a realização do serviço.
            </DialogDescription>
          </DialogHeader>

          {rescheduleBooking && (
            <form onSubmit={handleSaveReschedule} className="space-y-4 pt-2">
              {/* Calendário Visual Redesenhado */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-bold">Nova Data do Serviço *</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Escolha um dia disponível (marcado com pontos verdes)</p>
                </div>

                {loadingRescheduleDatas ? (
                  <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
                    Buscando datas disponíveis...
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                    {/* Cabeçalho do mês */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                      <button
                        type="button"
                        disabled={new Date(calMesReschedule.getFullYear(), calMesReschedule.getMonth(), 1) <= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
                        onClick={() => setCalMesReschedule(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent transition-all disabled:opacity-20 text-sm font-medium"
                      >
                        ‹
                      </button>
                      <div className="text-center">
                        <p className="text-sm font-bold text-foreground">
                          {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][calMesReschedule.getMonth()]}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{calMesReschedule.getFullYear()}</p>
                      </div>
                      <button
                        type="button"
                        disabled={(() => { const lim = new Date(); lim.setDate(lim.getDate() + 62); return new Date(calMesReschedule.getFullYear(), calMesReschedule.getMonth() + 1, 1) > new Date(lim.getFullYear(), lim.getMonth(), 1); })()}
                        onClick={() => setCalMesReschedule(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent transition-all disabled:opacity-20 text-sm font-medium"
                      >
                        ›
                      </button>
                    </div>

                    {/* Dias da semana */}
                    <div className="grid grid-cols-7 bg-muted/20 border-b border-border text-center py-1.5 text-[10px] font-bold">
                      {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                        <span key={i} className={i === 0 ? "text-rose-400" : i === 6 ? "text-blue-400" : "text-foreground/60"}>{d}</span>
                      ))}
                    </div>

                    {/* Grade de dias */}
                    <div className="grid grid-cols-7 p-1 gap-0.5">
                      {(() => {
                        const hoje = new Date(); hoje.setHours(0,0,0,0);
                        const limiteMax = new Date(hoje); limiteMax.setDate(limiteMax.getDate() + 62);
                        const primeiroDia = new Date(calMesReschedule.getFullYear(), calMesReschedule.getMonth(), 1);
                        const ultimoDia  = new Date(calMesReschedule.getFullYear(), calMesReschedule.getMonth() + 1, 0);
                        const cells: (null | Date)[] = [
                          ...Array(primeiroDia.getDay()).fill(null),
                          ...Array.from({ length: ultimoDia.getDate() }, (_, i) => new Date(calMesReschedule.getFullYear(), calMesReschedule.getMonth(), i + 1))
                        ];
                        while (cells.length % 7 !== 0) cells.push(null);
                        const isoDate = (d: Date) => d.toISOString().split("T")[0];

                        return cells.map((day, idx) => {
                          if (!day) return <div key={`e-${idx}`} className="h-9" />;

                          const iso        = isoDate(day);
                          const isSelected = newDate === iso;
                          const isToday    = isoDate(hoje) === iso;
                          const isMin48h   = day < new Date(hoje.getTime() + 2 * 86400000);
                          const isSun      = day.getDay() === 0;
                          const isSat      = day.getDay() === 6;
                          const isFuture   = day > limiteMax;
                          const hasVaga    = rescheduleDatasDisponiveis.includes(iso);
                          const isDisabled = isMin48h || isSun || isFuture || (rescheduleDatasDisponiveis.length > 0 && !hasVaga);

                          let wrapClass = "h-9 flex items-center justify-center relative rounded-lg ";
                          let numClass  = "w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-all relative ";

                          if (isSelected) {
                            numClass  += "bg-primary text-primary-foreground font-bold shadow-sm ";
                          } else if (isDisabled) {
                            wrapClass += "cursor-not-allowed ";
                            numClass  += "opacity-20 " + (isSun ? "text-rose-400 " : "text-muted-foreground ");
                          } else if (hasVaga) {
                            wrapClass += "cursor-pointer hover:scale-105 active:scale-95 ";
                            numClass  += "text-foreground font-semibold hover:bg-emerald-500 hover:text-white " + (isSat ? "text-blue-500 " : "");
                          } else {
                            wrapClass += "cursor-pointer ";
                            numClass  += "text-muted-foreground hover:bg-muted ";
                          }

                          return (
                            <div key={iso} className={wrapClass}>
                              <button
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setNewDate(iso)}
                                className={numClass}
                              >
                                {isToday && !isSelected && (
                                  <span className="absolute inset-0 rounded-full ring-2 ring-primary/40" />
                                )}
                                <span>{day.getDate()}</span>
                                {hasVaga && !isDisabled && !isSelected && (
                                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-500" />
                                )}
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="reschedule-time" className="font-bold">Horário de Chegada Estimado *</Label>
                <Input
                  id="reschedule-time"
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>

              <DialogFooter className="mt-6 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setRescheduleDialogOpen(false)} disabled={savingReschedule}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingReschedule || !newDate} className="bg-primary hover:bg-primary/90 font-bold">
                  {savingReschedule ? "Salvando..." : "Confirmar Reagendamento"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Visualizador de Técnico para o Cliente */}
      {clientViewTecnico && (
        <Dialog open={!!clientViewTecnico} onOpenChange={(open) => { if (!open) setClientViewTecnico(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Perfil do Técnico: {clientViewTecnico.nome}
              </DialogTitle>
              <DialogDescription>
                Credenciais, habilidades catalogadas e certificados do profissional alocado.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {/* Informações e Habilidades */}
              <div className="space-y-4">
                <div className="bg-muted/30 border border-border p-4 rounded-lg space-y-2">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Dados Profissionais</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block font-medium">Avaliação Geral</span>
                      <span className="font-bold text-amber-500 flex items-center gap-1">
                        {clientViewTecnico.ranking_score ? Number(clientViewTecnico.ranking_score).toFixed(1) : "5.0"} ⭐
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">CPF</span>
                      <span className="font-mono font-semibold text-foreground">
                        {clientViewTecnico.cpf ? `${clientViewTecnico.cpf.substring(0, 3)}.***.***-**` : "Não informado"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-foreground border-b pb-2">Matriz de Habilidades</h4>
                  {loadingClientTec ? (
                    <p className="text-xs text-muted-foreground">Carregando qualificações...</p>
                  ) : clientTecSkills.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma habilidade cadastrada para este técnico.</p>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {clientTecSkills.map(sk => (
                        <div key={sk.id} className="space-y-1 bg-muted/10 p-2 rounded border border-border/50">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-foreground">{sk.servico?.nome_servico || "Serviço"}</span>
                            <span className="font-bold text-indigo-500">{sk.nivel_conhecimento}/10</span>
                          </div>
                          {/* Knowledge bar visual representation */}
                          <div className="w-full bg-muted-foreground/20 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-1.5 rounded-full" 
                              style={{ width: `${sk.nivel_conhecimento * 10}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Documentos e Visualizador */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground border-b pb-2">Documentos e Certificados (Visualização Apenas)</h4>
                {loadingClientTec ? (
                  <p className="text-xs text-muted-foreground">Carregando documentos...</p>
                ) : clientTecDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4">Nenhum certificado ou documento disponível.</p>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {clientTecDocs.map(doc => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleSelectClientPreview(doc.url_documento, doc.nome_documento)}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-muted/10 transition-colors text-left text-xs font-semibold text-foreground"
                      >
                        <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span className="truncate flex-1">{doc.nome_documento}</span>
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Secure Preview Container */}
                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Visualizador Seguro</span>
                  {clientPreviewUrl ? (
                    <div 
                      className="relative border border-border rounded-lg bg-zinc-950 overflow-hidden w-full h-[220px] flex items-center justify-center select-none"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    >
                      {clientPreviewType === "image" && (
                        <img
                          src={clientPreviewUrl}
                          alt="Documento"
                          className="max-w-full max-h-full object-contain pointer-events-none"
                        />
                      )}
                      {clientPreviewType === "pdf" && (
                        <iframe
                          src={`${clientPreviewUrl}#toolbar=0&navpanes=0&statusbar=0&view=FitH`}
                          className="w-full h-full border-none pointer-events-none"
                          title="PDF Preview"
                        />
                      )}
                      {clientPreviewType === "other" && (
                        <div className="text-center p-4">
                          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-foreground font-semibold">Visualização indisponível</p>
                        </div>
                      )}
                      {/* Interaction Blocker Overlay */}
                      <div className="absolute inset-0 bg-transparent z-10" />
                    </div>
                  ) : (
                    <div className="border border-dashed border-border rounded-lg h-[220px] flex flex-col items-center justify-center text-center p-4 bg-muted/5">
                      <Eye className="h-7 w-7 text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">Selecione um documento da lista para abrir a pré-visualização.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── TÉCNICO DASHBOARD ──────────────────────────────────────────────────────
function InvitationCountdown({ convidadoEm, onTimeout }: { convidadoEm: string | null; onTimeout: () => void }) {
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (!convidadoEm || hasTimedOut) return;

    const targetTime = new Date(convidadoEm).getTime() + 3 * 60 * 60 * 1000;

    const updateTimer = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeftStr("Expirado");
        setHasTimedOut(true);
        onTimeout();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeftStr(
        `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [convidadoEm, onTimeout, hasTimedOut]);

  if (!convidadoEm) {
    return (
      <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded border border-border">
        Sem convite ativo
      </span>
    );
  }

  return (
    <span className="font-mono text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded border border-red-200 dark:border-red-900/50 flex items-center gap-1.5 animate-pulse">
      <Clock className="h-3.5 w-3.5" />
      {timeLeftStr}
    </span>
  );
}

function TecnicoDash({ email, userId }: { email: string; userId: string }) {
  const [tecnico, setTecnico] = useState<any>(null);
  const [empresaVinculada, setEmpresaVinculada] = useState<string>("Quantis Obras");
  const [convites, setConvites] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [activeExec, setActiveExec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check-in locations and departure selection states
  const [locaisCheckin, setLocaisCheckin] = useState<any[]>([]);
  const [selectedStartBookingId, setSelectedStartBookingId] = useState<string | null>(null);
  const [semDefinicao, setSemDefinicao] = useState(false);
  const [pontoPartidaId, setPontoPartidaId] = useState("");
  const [customEndereco, setCustomEndereco] = useState("");
  const [customNumero, setCustomNumero] = useState("");
  const [customBairro, setCustomBairro] = useState("");
  const [customCidade, setCustomCidade] = useState("");
  const [customEstado, setCustomEstado] = useState("");

  // Active execution screen states
  const [activePhotos, setActivePhotos] = useState<any[]>([]);
  const [loadingExecPhotos, setLoadingExecPhotos] = useState(false);
  const [uploadingCheckin, setUploadingCheckin] = useState(false);
  const [uploadingMultiple, setUploadingMultiple] = useState(false);
  
  // Molding cycle form states
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [slump, setSlump] = useState(100);
  const [numCaminhao, setNumCaminhao] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [pecaConcretada, setPecaConcretada] = useState("");
  const [cpsMoldados, setCpsMoldados] = useState(2);
  const [cyclePhoto, setCyclePhoto] = useState<File | null>(null);
  const [savingCycle, setSavingCycle] = useState(false);
  const [horarioMoldagem, setHorarioMoldagem] = useState("");
  const [codigosBarras, setCodigosBarras] = useState<string[]>(["", ""]);
  const [horarioSaidaReal, setHorarioSaidaReal] = useState("");

  useEffect(() => {
    setCodigosBarras(prev => {
      const next = [...prev];
      if (next.length < cpsMoldados) {
        while (next.length < cpsMoldados) next.push("");
      } else if (next.length > cpsMoldados) {
        next.length = cpsMoldados;
      }
      return next;
    });
  }, [cpsMoldados]);

  // Conclude form states
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [photoFinal, setPhotoFinal] = useState<File | null>(null);
  const [photoRetorno, setPhotoRetorno] = useState<File | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // Blocker / Absence states
  const [tecnicoActiveTab, setTecnicoActiveTab] = useState("execucao");
  const [blockers, setBlockers] = useState<any[]>([]);
  const [loadingBlockers, setLoadingBlockers] = useState(false);
  const [blockerDialogOpen, setBlockerDialogOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoBlocker, setTipoBlocker] = useState("Folga");
  const [descricaoBlocker, setDescricaoBlocker] = useState("");
  const [savingBlocker, setSavingBlocker] = useState(false);

  // Abandono/Transferência states
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false);
  const [abandonBookingId, setAbandonBookingId] = useState<string | null>(null);
  const [abandonMotivo, setAbandonMotivo] = useState("Problema pessoal");
  const [abandonCustomMotivo, setAbandonCustomMotivo] = useState("");
  const [abandoningBooking, setAbandoningBooking] = useState(false);

  const fetchTecnicoData = async () => {
    try {
      const { processTimeouts: dynamicProcessTimeouts } = await import("@/lib/booking.functions");
      await dynamicProcessTimeouts();

      // Get technician profile
      const { data: tec, error: tecErr } = await supabase
        .from("tecnicos")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tecErr || !tec) {
        console.error("Technician profile not found:", tecErr);
        setLoading(false);
        return;
      }
      setTecnico(tec);

      // Get the profile (with client company details)
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, empresas_clientes(razao_social)")
        .eq("id", userId)
        .maybeSingle();

      // Get the platform settings
      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "empresa_plataforma")
        .maybeSingle();

      let companyName = "Quantis Obras";
      if (profile?.empresas_clientes?.razao_social) {
        companyName = profile.empresas_clientes.razao_social;
      } else if (settingsData?.value) {
        const val = settingsData.value as any;
        if (val.razao_social) {
          companyName = val.razao_social;
        }
      }
      setEmpresaVinculada(companyName);

      // Get invitations
      const { data: invList, error: invErr } = await supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*)")
        .eq("tecnico_id", tec.id)
        .eq("status_agendamento", "Pendente_Tecnico")
        .order("created_at", { ascending: false });

      if (!invErr && invList) {
        setConvites(invList);
      }

      // Get scale (confirmed, execution active, or awaiting validation)
      const { data: scheduleList, error: schErr } = await supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*)")
        .eq("tecnico_id", tec.id)
        .neq("status_agendamento", "Pendente_Tecnico")
        .neq("status_agendamento", "Cancelado")
        .order("data_servico", { ascending: true })
        .order("horario_na_obra", { ascending: true });

      if (!schErr && scheduleList) {
        setAgenda(scheduleList);

        // Check if there is an active execution
        const active = scheduleList.find(a => a.status_agendamento === "Em_Execucao");
        if (active) {
          setActiveExec(active);
          fetchExecPhotos(active.id);
        } else {
          setActiveExec(null);
        }
      }

      // Get check-in locations
      const { data: locs, error: locsErr } = await supabase
        .from("locais_checkin")
        .select("*")
        .order("nome", { ascending: true });
      if (!locsErr && locs) {
        setLocaisCheckin(locs);
      }

      // Get blockers (both technician-specific and global/company-wide blockers)
      setLoadingBlockers(true);
      const { data: blks, error: blkErr } = await supabase
        .from("bloqueios_tecnicos")
        .select("*")
        .or(`tecnico_id.eq.${tec.id},tecnico_id.is.null`)
        .order("data_inicio", { ascending: false });
      if (!blkErr && blks) {
        setBlockers(blks);
      }
      setLoadingBlockers(false);
    } catch (err) {
      console.error("Error fetching technician dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataInicio || !dataFim) {
      toast.error("Por favor, preencha as datas.");
      return;
    }
    setSavingBlocker(true);
    try {
      await requestBlocker({
        data: {
          dataInicio,
          dataFim,
          tipo: tipoBlocker as any,
          descricao: descricaoBlocker,
        }
      });
      toast.success("Solicitação de bloqueio registrada com sucesso!");
      setBlockerDialogOpen(false);
      setDataInicio("");
      setDataFim("");
      setTipoBlocker("Folga");
      setDescricaoBlocker("");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao solicitar bloqueio.");
    } finally {
      setSavingBlocker(false);
    }
  };

  const handleDeleteBlocker = async (blockerId: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta solicitação de bloqueio?")) return;
    try {
      const { error } = await supabase
        .from("bloqueios_tecnicos")
        .delete()
        .eq("id", blockerId);
      if (error) throw error;
      toast.success("Solicitação excluída com sucesso.");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir solicitação.");
    }
  };

  const fetchExecPhotos = async (bookingId: string) => {
    setLoadingExecPhotos(true);
    try {
      const { data, error } = await supabase
        .from("historico_fotos")
        .select("*")
        .eq("agendamento_id", bookingId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setActivePhotos(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExecPhotos(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTecnicoData();
    }
  }, [userId]);

  const handleAccept = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await acceptInvite({ data: { bookingId } });
      toast.success("Agendamento aceito com sucesso!");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aceitar o convite.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await rejectInvite({ data: { bookingId } });
      toast.info("Convite recusado.");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao recusar o convite.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAbandonBooking = async () => {
    if (!abandonBookingId) return;
    const motivoFinal = abandonMotivo === "Outro" ? abandonCustomMotivo.trim() : abandonMotivo;
    if (!motivoFinal) {
      toast.error("Por favor, descreva o motivo do abandono.");
      return;
    }
    setAbandoningBooking(true);
    try {
      const result = await abandonBooking({ data: { bookingId: abandonBookingId, motivo: motivoFinal } });
      if (result.penaltyApplied) {
        toast.warning(
          `Atendimento transferido. Penalidade aplicada: -${result.penaltyAmount} pts no score por cancelamento dentro da janela de 24h.`,
          { duration: 6000 }
        );
      } else {
        toast.success("Atendimento transferido com sucesso! Um novo técnico será alocado.");
      }
      setAbandonDialogOpen(false);
      setAbandonBookingId(null);
      setAbandonMotivo("Problema pessoal");
      setAbandonCustomMotivo("");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao transferir atendimento.");
    } finally {
      setAbandoningBooking(false);
    }
  };

  const handleConfirmStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStartBookingId) return;
    
    if (!semDefinicao && !pontoPartidaId) {
      toast.error("Por favor, selecione um ponto de partida ou ative a opção customizada.");
      return;
    }

    setActionLoading(selectedStartBookingId);
    try {
      // Capture geoloc
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (geoErr) {
        console.warn("Could not get departure GPS location:", geoErr);
      }

      let customAddress: string | null = null;
      if (semDefinicao) {
        customAddress = `${customEndereco}, ${customNumero || "S/N"} - ${customBairro || ""}, ${customCidade}/${customEstado}`;
      } else {
        const selectedLoc = locaisCheckin.find(l => l.id === pontoPartidaId);
        if (selectedLoc) {
          customAddress = `${selectedLoc.nome} - ${selectedLoc.endereco}, ${selectedLoc.numero || ""} (${selectedLoc.cidade}/${selectedLoc.estado})`;
        }
      }

      await startExecution({
        data: {
          bookingId: selectedStartBookingId,
          pontoPartidaId: semDefinicao ? null : pontoPartidaId,
          partidaCustomEndereco: customAddress,
          partidaLat: lat,
          partidaLng: lng
        }
      });

      toast.success("Atendimento iniciado! Siga a rota até a obra.");
      setSelectedStartBookingId(null);
      
      // Clear states
      setSemDefinicao(false);
      setPontoPartidaId("");
      setCustomEndereco("");
      setCustomNumero("");
      setCustomBairro("");
      setCustomCidade("");
      setCustomEstado("");
      
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao iniciar atendimento.");
    } finally {
      setActionLoading(null);
    }
  };

  // Step 1: Check-in upload
  const handleCheckin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeExec) return;
    const file = e.target.files[0];
    setUploadingCheckin(true);
    try {
      // Get location coordinates if browser supports it
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (geoErr) {
        console.warn("Could not get GPS location:", geoErr);
      }

      const url = await uploadPhotoOrBase64(file);
      await recordCheckin({
        data: {
          bookingId: activeExec.id,
          urlFoto: url,
          lat,
          lng,
        }
      });

      toast.success("Check-in registrado com sucesso!");
      fetchExecPhotos(activeExec.id);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao fazer check-in.");
    } finally {
      setUploadingCheckin(false);
    }
  };

  const handleUploadMultiplePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeExec) return;

    const additionalPhotosCount = activePhotos.filter(p => p.tipo_foto !== "Checkin_QR").length;
    const remainingSlots = 15 - additionalPhotosCount;

    if (files.length > remainingSlots) {
      toast.error(`Você só pode enviar mais ${remainingSlots} foto(s). Limite máximo é 15.`);
      return;
    }

    setUploadingMultiple(true);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadPhotoOrBase64(file);
        
        const { error } = await supabase
          .from("historico_fotos")
          .insert({
            agendamento_id: activeExec.id,
            tipo_foto: "Final_Panoramica",
            url_foto: url,
            metadata: { 
              horario_registro: new Date().toISOString(),
              nome_arquivo: file.name
            }
          });

        if (error) {
          console.error("Erro ao salvar foto de campo:", error);
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} foto(s) de campo enviada(s) com sucesso!`);
        fetchExecPhotos(activeExec.id);
      }
    } catch (err: any) {
      toast.error("Ocorreu um erro no upload das fotos.");
      console.error(err);
    } finally {
      setUploadingMultiple(false);
      e.target.value = "";
    }
  };

  // Step 2: Add Molding Cycle
  const handleAddCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cyclePhoto || !activeExec) {
      toast.error("A foto do ciclo é obrigatória.");
      return;
    }
    if (!horarioMoldagem) {
      toast.error("O horário de moldagem é obrigatório.");
      return;
    }
    const filteredBarcodes = codigosBarras.filter(b => b.trim() !== "");
    if (filteredBarcodes.length < cpsMoldados) {
      toast.error("Por favor, preencha o código de barras para todos os CPs.");
      return;
    }

    setSavingCycle(true);
    try {
      const url = await uploadPhotoOrBase64(cyclePhoto);
      await addMoldingCycle({
        data: {
          bookingId: activeExec.id,
          urlFoto: url,
          slump,
          numeroCaminhao: numCaminhao,
          notaFiscal,
          pecaConcretada,
          cpsMoldados,
          horarioMoldagem,
          codigosBarras: filteredBarcodes,
        }
      });

      toast.success("Ciclo de moldagem registrado!");
      setCycleDialogOpen(false);
      // Reset form
      setNumCaminhao("");
      setNotaFiscal("");
      setPecaConcretada("");
      setSlump(100);
      setCpsMoldados(2);
      setHorarioMoldagem("");
      setCodigosBarras(["", ""]);
      setCyclePhoto(null);
      // Refetch
      fetchExecPhotos(activeExec.id);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar ciclo de moldagem.");
    } finally {
      setSavingCycle(false);
    }
  };

  // Step 3: Conclude Execution
  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExec) return;
    setFinalizing(true);
    try {
      let finalUrl: string | null = null;
      let retornoUrl: string | null = null;

      if (photoFinal) {
        finalUrl = await uploadPhotoOrBase64(photoFinal);
      }
      if (photoRetorno) {
        retornoUrl = await uploadPhotoOrBase64(photoRetorno);
      }

      // Calculate total CPs molded from all saved cycles
      const totalCps = activePhotos
        .filter(p => p.tipo_foto === "Ciclo_CP")
        .reduce((sum, p) => sum + (Number(p.metadata?.cps_moldados) || 0), 0);

      await finalizeExecution({
        data: {
          bookingId: activeExec.id,
          cpsMoldadosReal: totalCps,
          urlFotoFinal: finalUrl,
          urlFotoRetorno: retornoUrl,
          horarioSaida: horarioSaidaReal || null,
        }
      });

      toast.success("Serviço concluído e enviado para validação!");
      setConcludeDialogOpen(false);
      setPhotoFinal(null);
      setPhotoRetorno(null);
      setHorarioSaidaReal("");
      // Refresh whole page scale
      fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao finalizar serviço.");
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Carregando painel do técnico…</div>;
  }

  if (!tecnico) {
    return (
      <Card className="border border-dashed border-red-500/30 p-8 text-center bg-red-500/5 max-w-xl mx-auto mt-12">
        <CardContent className="space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Perfil Técnico Não Localizado</h2>
          <p className="text-sm text-muted-foreground">
            Sua conta está associada ao cargo de técnico, mas não encontramos um cadastro correspondente na tabela de técnicos. Por favor, contate o administrador do sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check-in photo status
  const checkinRecord = activePhotos.find(p => p.tipo_foto === "Checkin_QR");
  const cycleRecords = activePhotos.filter(p => p.tipo_foto === "Ciclo_CP");
  const totalCpsMolded = cycleRecords.reduce((sum, p) => sum + (Number(p.metadata?.cps_moldados) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <SectionTitle
            title={`Painel do Técnico — ${tecnico.nome}`}
            subtitle={`Bem-vindo, ${email}. Gerencie seus convites de serviço e sua escala.`}
          />
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span>Empresa Vinculada: <strong className="text-foreground">{empresaVinculada}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-600/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-500 text-sm font-semibold self-start sm:self-center">
          ⭐ Score de Avaliação: {tecnico.ranking_score ? Number(tecnico.ranking_score).toFixed(1) : "0.0"}
        </div>
      </div>

      <Tabs value={tecnicoActiveTab} onValueChange={setTecnicoActiveTab} className="w-full animate-in fade-in-50 duration-200">
        <TabsList className="flex flex-wrap gap-2 md:gap-3 bg-transparent p-0 h-auto justify-start mb-6">
          <TabsTrigger
            value="execucao"
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <Camera className="h-4 w-4" /> Execução Ativa
          </TabsTrigger>
          <TabsTrigger
            value="convites"
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <Bell className="h-4 w-4" /> Convites Pendentes ({convites.length})
          </TabsTrigger>
          <TabsTrigger
            value="escala"
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <Calendar className="h-4 w-4" /> Minha Escala ({agenda.length})
          </TabsTrigger>
          <TabsTrigger
            value="calendario"
            className="flex items-center gap-2 px-4 py-2.5 h-auto text-sm font-semibold rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md"
          >
            <Clock className="h-4 w-4" /> Calendário / Ausências ({blockers.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: EXECUÇÃO ATIVA ── */}
        <TabsContent value="execucao" className="space-y-4">
          {activeExec ? (
            <Card className="border-2 border-indigo-500 bg-indigo-500/5 shadow-md">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white border-0 font-bold flex items-center gap-1">
                      <Camera className="h-3 w-3" /> Em Execução Ativo
                    </Badge>
                    <span className="text-xs text-indigo-700 dark:text-indigo-400 font-semibold font-mono">
                      {activeExec.codigo_pedido}
                    </span>
                  </div>
                  <CardTitle className="text-xl font-bold mt-1 text-foreground">
                    {activeExec.obra?.nome_obra}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                    📍 {activeExec.obra?.cidade}
                  </div>
                  {!checkinRecord && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 font-semibold text-xs gap-1.5"
                      onClick={() => {
                        setAbandonBookingId(activeExec.id);
                        setAbandonDialogOpen(true);
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Transferir Atendimento
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-6">
                {activeExec.justificativa_reprovacao && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 animate-in fade-in-50 duration-200">
                    <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Medição Reprovada pelo Cliente</h4>
                      <p className="text-xs mt-1 text-muted-foreground">
                        O cliente solicitou correções com a seguinte justificativa:
                      </p>
                      <p className="text-sm font-semibold mt-2 italic text-foreground bg-card/65 p-2 rounded border border-red-500/20">
                        "{activeExec.justificativa_reprovacao}"
                      </p>
                      <p className="text-[11px] mt-2 text-muted-foreground">
                        Por favor, adicione as fotos ou refaça as medições necessárias e finalize novamente.
                      </p>
                    </div>
                  </div>
                )}

                {/* Infos do pedido e Rota GPS */}
                <div className="grid gap-4 md:grid-cols-2 bg-muted/20 p-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>📍 <strong className="text-foreground">Endereço Obra:</strong> {activeExec.obra?.endereco}, {activeExec.obra?.numero} · {activeExec.obra?.bairro}, {activeExec.obra?.cidade}/{activeExec.obra?.estado}</p>
                    <p>🧪 <strong className="text-foreground">Serviço:</strong> {activeExec.servico?.nome_servico || "Controle Tecnológico"}</p>
                    <p>🧱 <strong className="text-foreground">CPs Contratados:</strong> {activeExec.cps_contratados} unidades ({activeExec.qtd_caminhoes} caminhões)</p>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5 border-t md:border-t-0 md:border-l border-border pt-2 md:pt-0 md:pl-4 flex flex-col justify-center">
                    <p className="font-semibold text-foreground">🚀 Ponto de Partida do Técnico</p>
                    <p className="truncate">
                      📍 {activeExec.partida_custom_endereco || "Laboratório / Base padrão"}
                    </p>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          `${activeExec.obra?.endereco || ""}, ${activeExec.obra?.numero || ""}, ${activeExec.obra?.cidade || ""}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[10px] shadow-sm transition-all cursor-pointer"
                      >
                        <MapPin className="h-3 w-3" /> Abrir no Google Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?q=${encodeURIComponent(
                          `${activeExec.obra?.endereco || ""}, ${activeExec.obra?.numero || ""}, ${activeExec.obra?.cidade || ""}`
                        )}&navigate=yes`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shadow-sm transition-all cursor-pointer"
                      >
                        <MapPin className="h-3 w-3" /> Abrir no Waze
                      </a>
                    </div>
                  </div>
                </div>

                {/* Passos de execução */}
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Passo 1: Check-in */}
                  <Card className="border border-border bg-card p-4 relative overflow-hidden">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5 mb-2">
                      <MapPin className="h-4.5 w-4.5 text-primary" />
                      1. Check-in na Obra
                    </h4>
                    {checkinRecord ? (
                      <div className="space-y-2">
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Check-in realizado!
                        </p>
                        <img src={checkinRecord.url_foto} alt="Checkin" className="h-16 w-full object-cover rounded border border-border" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Tire uma foto ao chegar no canteiro para iniciar.</p>
                        <Label htmlFor="checkin-file" className="w-full flex items-center justify-center gap-1 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted text-xs font-semibold">
                          <Camera className="h-4 w-4" /> Capturar Foto Chegada
                        </Label>
                        <Input id="checkin-file" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCheckin} disabled={uploadingCheckin} />
                        {uploadingCheckin && <p className="text-[10px] text-muted-foreground animate-pulse">Registrando check-in...</p>}
                      </div>
                    )}
                  </Card>

                  {/* Passo 2: Moldagem */}
                  <Card className="border border-border bg-card p-4">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5 mb-2">
                      <FlaskConical className="h-4.5 w-4.5 text-primary" />
                      2. Lançar Moldagens ({cycleRecords.length})
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Registre as leituras de slump e CPs moldados de cada caminhão.
                    </p>
                    
                    <div className="space-y-2">
                      <Dialog open={cycleDialogOpen} onOpenChange={(open) => {
                        setCycleDialogOpen(open);
                        if (open) {
                          setHorarioMoldagem(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
                        }
                      }}>
                        <DialogTrigger asChild disabled={!checkinRecord}>
                          <Button className="w-full text-xs font-bold gap-1 h-9" size="sm">
                            <Plus className="h-4 w-4" /> Lançar Novo Caminhão
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm border border-border bg-card">
                          <DialogHeader>
                            <DialogTitle>Lançar Ensaio / Moldagem</DialogTitle>
                            <DialogDescription>Preencha os dados do ensaio de concreto deste ciclo.</DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleAddCycle} className="space-y-4 pt-2 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="numCaminhao">Caminhão #</Label>
                                <Input id="numCaminhao" required value={numCaminhao} onChange={(e) => setNumCaminhao(e.target.value)} placeholder="Ex: 01" />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="notaFiscal">Nota Fiscal</Label>
                                <Input id="notaFiscal" required value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} placeholder="Ex: NF-1234" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="pecaConcretada">Estrutura Concretada</Label>
                              <Input id="pecaConcretada" required value={pecaConcretada} onChange={(e) => setPecaConcretada(e.target.value)} placeholder="Ex: Laje 2º andar - Bloco A" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label htmlFor="slump">Slump Test (mm)</Label>
                                <Input id="slump" type="number" required value={slump} onChange={(e) => setSlump(Number(e.target.value))} placeholder="Ex: 100" />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="cps">CPs Moldados</Label>
                                <Input id="cps" type="number" required value={cpsMoldados} onChange={(e) => setCpsMoldados(Number(e.target.value))} placeholder="Ex: 2" />
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <Label htmlFor="horarioMoldagem">Horário da Moldagem</Label>
                              <Input id="horarioMoldagem" type="time" required value={horarioMoldagem} onChange={(e) => setHorarioMoldagem(e.target.value)} />
                            </div>

                            <div className="space-y-2 border-t border-border pt-2">
                              <p className="font-semibold text-foreground">Códigos de Barras dos CPs</p>
                              {codigosBarras.map((barcode, idx) => (
                                <div key={idx} className="space-y-1">
                                  <Label htmlFor={`barcode-${idx}`}>CP {idx + 1}</Label>
                                  <Input
                                    id={`barcode-${idx}`}
                                    required
                                    value={barcode}
                                    onChange={(e) => {
                                      const newBarcodes = [...codigosBarras];
                                      newBarcodes[idx] = e.target.value;
                                      setCodigosBarras(newBarcodes);
                                    }}
                                    placeholder="Digite ou escaneie o código de barras"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="cycle-photo">Foto do Ensaio / Slump (Obrigatório)</Label>
                              <Input id="cycle-photo" type="file" accept="image/*" capture="environment" required onChange={(e) => setCyclePhoto(e.target.files ? e.target.files[0] : null)} />
                            </div>
                            <DialogFooter className="pt-2">
                              <Button type="button" variant="outline" onClick={() => setCycleDialogOpen(false)} disabled={savingCycle}>Cancelar</Button>
                              <Button type="submit" disabled={savingCycle}>{savingCycle ? "Lançando..." : "Registrar Ciclo"}</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {cycleRecords.length > 0 && (
                        <div className="text-[10px] text-muted-foreground max-h-24 overflow-y-auto divide-y divide-border border rounded p-1.5 bg-muted/10 font-medium">
                          {cycleRecords.map((c, i) => (
                            <div key={c.id} className="py-1 flex flex-col gap-0.5">
                              <div className="flex justify-between">
                                <span>Cam. {c.metadata?.numero_caminhao} ({c.metadata?.peca_concretada}) · {c.metadata?.horario_moldagem || "S/H"}</span>
                                <span className="font-bold">{c.metadata?.cps_moldados} CPs · Slump: {c.metadata?.slump}mm</span>
                              </div>
                              {c.metadata?.codigos_barras && (
                                <div className="text-[9px] text-primary/80 truncate">
                                  Barras: {c.metadata.codigos_barras.join(", ")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Passo 3: Concluir */}
                  <Card className="border border-border bg-card p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                        3. Concluir Serviço
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Total coletado até agora: <strong className="text-primary text-sm">{totalCpsMolded} de {activeExec.cps_contratados} CPs</strong> contratados.
                      </p>
                    </div>

                    <Dialog open={concludeDialogOpen} onOpenChange={(open) => {
                      setConcludeDialogOpen(open);
                      if (open) {
                        setHorarioSaidaReal(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
                      }
                    }}>
                      <DialogTrigger asChild disabled={cycleRecords.length === 0}>
                        <Button className="w-full text-xs font-bold gap-1 h-9 bg-emerald-600 hover:bg-emerald-700" size="sm">
                          <Check className="h-4 w-4" /> Finalizar e Enviar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm border border-border bg-card">
                        <DialogHeader>
                          <DialogTitle>Concluir Serviço</DialogTitle>
                          <DialogDescription>
                            Envie os ensaios finais. As medições serão validadas pelo cliente.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleFinalize} className="space-y-4 pt-2 text-xs">
                          <div className="bg-muted/40 p-3 rounded border border-border">
                            <p className="font-semibold text-foreground text-sm">Resumo Coleta</p>
                            <p className="mt-1">CPs Moldados Reais: <strong className="text-primary text-sm">{totalCpsMolded} unidades</strong></p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="horarioSaidaReal">Horário de Saída Real (Checkout)</Label>
                            <Input
                              id="horarioSaidaReal"
                              type="time"
                              required
                              value={horarioSaidaReal}
                              onChange={(e) => setHorarioSaidaReal(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">
                              Preencha com o horário que você está encerrando as moldagens.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="photo-final">Foto Panorâmica dos CPs Organizados (Opcional)</Label>
                            <Input id="photo-final" type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoFinal(e.target.files ? e.target.files[0] : null)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="photo-retorno">Foto de Retorno de Carga / Betoneira Limpa (Opcional)</Label>
                            <Input id="photo-retorno" type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoRetorno(e.target.files ? e.target.files[0] : null)} />
                          </div>
                          <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setConcludeDialogOpen(false)} disabled={finalizing}>Cancelar</Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" disabled={finalizing}>
                              {finalizing ? "Concluindo..." : "Confirmar Conclusão"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </Card>
                </div>

                {/* Seção de upload de fotos de campo */}
                {checkinRecord && (
                  <Card className="border border-border bg-card p-5 mt-6">
                    <CardHeader className="p-0 pb-3">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Camera className="h-5 w-5 text-indigo-500" />
                        Fotos de Campo (Slump, CPs Moldados, etc.)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Você pode enviar até 15 fotos por atendimento em andamento para comprovação do serviço.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-3 space-y-4">
                      {/* Input para upload de múltiplas fotos */}
                      <div className="space-y-2">
                        <Label htmlFor="multiple-photos-input" className={`flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 cursor-pointer hover:bg-muted/30 transition-all ${uploadingMultiple ? "opacity-60 pointer-events-none" : ""}`}>
                          <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <span className="text-xs font-semibold text-foreground">
                            {uploadingMultiple ? "Fazendo upload das fotos..." : "Selecionar Fotos de Campo"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/75 mt-1">
                            Envie fotos do ensaio de slump, CPs moldados, etc. (Máx. 15 fotos)
                          </span>
                        </Label>
                        <Input
                          id="multiple-photos-input"
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadMultiplePhotos}
                          disabled={uploadingMultiple || activePhotos.filter(p => p.tipo_foto !== "Checkin_QR").length >= 15}
                        />
                      </div>

                      {/* Progresso ou contador de fotos */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">
                          Fotos enviadas: <strong className="text-foreground">{activePhotos.filter(p => p.tipo_foto !== "Checkin_QR").length} de 15</strong>
                        </span>
                        {activePhotos.filter(p => p.tipo_foto !== "Checkin_QR").length >= 15 && (
                          <span className="text-red-500 font-bold text-[10px]">Limite máximo de 15 fotos atingido.</span>
                        )}
                      </div>

                      {/* Grid de miniaturas das fotos enviadas */}
                      {activePhotos.filter(p => p.tipo_foto !== "Checkin_QR").length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3 pt-2">
                          {activePhotos
                            .filter(p => p.tipo_foto !== "Checkin_QR")
                            .map((p, idx) => (
                              <div key={p.id} className="relative group aspect-square rounded-md overflow-hidden border border-border shadow-sm bg-muted/40">
                                <img src={p.url_foto} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-end p-1">
                                  <span className="text-[8px] text-white truncate font-medium">
                                    {p.metadata?.nome_arquivo || `Foto ${idx + 1}`}
                                  </span>
                                  <span className="text-[7px] text-white/70 font-mono">
                                    {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-3">
                <Camera className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground font-semibold">Nenhum agendamento em execução ativo no momento.</p>
                <p className="text-xs text-muted-foreground/70">Inicie um serviço confirmado na aba "Minha Escala".</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB: CONVITES PENDENTES ── */}
        <TabsContent value="convites" className="space-y-4">
          {convites.length === 0 ? (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Você não possui convites pendentes no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {convites.map((ag) => (
                <Card key={ag.id} className="border-2 border-amber-500/40 bg-amber-500/5 hover:shadow-md transition-all">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground">
                        {ag.obra?.nome_obra || "Obra sem nome"}
                      </CardTitle>
                      <CardDescription className="text-xs font-semibold text-amber-600 mt-1">
                        {ag.servico?.nome_servico || "Controle Tecnológico"}
                      </CardDescription>
                    </div>
                    <InvitationCountdown convidadoEm={ag.convidado_em} onTimeout={fetchTecnicoData} />
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        📍 <strong className="text-foreground">Endereço:</strong> {ag.obra?.endereco}, {ag.obra?.numero} - {ag.obra?.bairro}, {ag.obra?.cidade}/{ag.obra?.estado}
                      </p>
                      <p>
                        📅 <strong className="text-foreground">Data/Hora:</strong> {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                      </p>
                      <p>
                        🧪 <strong className="text-foreground">Quantidade CPs:</strong> {ag.cps_contratados} unidades ({ag.qtd_caminhoes} {ag.qtd_caminhoes === 1 ? "caminhão" : "caminhões"})
                      </p>
                      {ag.observacoes && (
                        <p className="italic bg-card p-2 rounded border border-border mt-2">
                          "{ag.observacoes}"
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        onClick={() => handleAccept(ag.id)}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === ag.id ? "Processando..." : "Aceitar Convite"}
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1 border-red-500/30 text-red-600 hover:bg-red-500/10"
                        onClick={() => handleReject(ag.id)}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === ag.id ? "Processando..." : "Recusar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: MINHA ESCALA ── */}
        <TabsContent value="escala" className="space-y-4">
          {agenda.length === 0 ? (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-2">
                <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum serviço confirmado na sua escala por enquanto.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {(() => {
                const renderCard = (ag: any) => (
                  <Card key={ag.id} className="border border-border bg-card p-4 hover:shadow-sm transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">{ag.obra?.nome_obra || "Obra sem nome"}</span>
                          <Badge variant="outline" className={STATUS_COLORS[ag.status_agendamento] || "bg-muted text-muted-foreground"}>
                            {STATUS_LABELS[ag.status_agendamento] || ag.status_agendamento}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">
                          {ag.servico?.nome_servico || "Controle Tecnológico"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          📍 {ag.obra?.endereco}, {ag.obra?.numero} - {ag.obra?.bairro}, {ag.obra?.cidade}/{ag.obra?.estado}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pedido: <span className="text-foreground font-medium">{ag.codigo_pedido}</span> · CPs: <span className="text-foreground font-medium">{ag.cps_contratados}</span>
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 justify-center min-w-[150px]">
                        <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-muted px-2.5 py-1 rounded">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                        </div>

                        {ag.status_agendamento === "Confirmado" && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 cursor-pointer"
                              onClick={() => setSelectedStartBookingId(ag.id)}
                              disabled={actionLoading !== null || activeExec !== null}
                            >
                              <Camera className="h-4 w-4" /> Iniciar Atendimento
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 font-semibold gap-1"
                              onClick={() => {
                                setAbandonBookingId(ag.id);
                                setAbandonDialogOpen(true);
                              }}
                              disabled={actionLoading !== null}
                            >
                              <LogOut className="h-3.5 w-3.5" /> Transferir
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );

                const agendaConfirmados = agenda.filter(a => a.status_agendamento === "Confirmado");
                const agendaEmAndamento = agenda.filter(a => a.status_agendamento === "Em_Execucao");
                const agendaConcluidos = agenda.filter(a => ["Aguardando_Medicao", "Validado", "Laboratorio"].includes(a.status_agendamento));

                return (
                  <div className="space-y-6">
                    {/* 1. Em Andamento */}
                    {agendaEmAndamento.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                          Em Andamento / Em Viagem ({agendaEmAndamento.length})
                        </h3>
                        <div className="grid gap-3">
                          {agendaEmAndamento.map(renderCard)}
                        </div>
                      </div>
                    )}

                    {/* 2. Próximos */}
                    {agendaConfirmados.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          Próximos Agendamentos / Aguardando Início ({agendaConfirmados.length})
                        </h3>
                        <div className="grid gap-3">
                          {agendaConfirmados.map(renderCard)}
                        </div>
                      </div>
                    )}

                    {/* 3. Concluídos */}
                    {agendaConcluidos.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Histórico / Realizados ({agendaConcluidos.length})
                        </h3>
                        <div className="grid gap-3">
                          {agendaConcluidos.map(renderCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: CALENDÁRIO / INDISPONIBILIDADE ── */}
        <TabsContent value="calendario" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">Solicitações de Indisponibilidade</h3>
              <p className="text-xs text-muted-foreground">Adicione consultas, folgas ou outros compromissos para travar novos agendamentos.</p>
            </div>
            <Dialog open={blockerDialogOpen} onOpenChange={setBlockerDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 font-bold cursor-pointer text-xs h-9">
                  <Plus className="h-4 w-4" /> Solicitar Bloqueio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm border border-border bg-card">
                <DialogHeader>
                  <DialogTitle>Solicitar Indisponibilidade</DialogTitle>
                  <DialogDescription>A agenda será travada para novos convites após a aprovação da gerência.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRequestBlocker} className="space-y-4 pt-2 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="dataInicio">Data Início</Label>
                      <Input id="dataInicio" type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dataFim">Data Fim</Label>
                      <Input id="dataFim" type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tipoBlocker">Tipo de Motivo</Label>
                    <select
                      id="tipoBlocker"
                      value={tipoBlocker}
                      onChange={(e: any) => setTipoBlocker(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
                    >
                      <option value="Folga">Folga / Descanso</option>
                      <option value="Medico">Médico / Consulta / Exame</option>
                      <option value="Problema_Veiculo">Problema com Veículo</option>
                      <option value="Outro">Outro Contratempo</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="descricaoBlocker">Justificativa / Descrição</Label>
                    <Input id="descricaoBlocker" value={descricaoBlocker} onChange={(e) => setDescricaoBlocker(e.target.value)} placeholder="Ex: Consulta oftalmológica às 14h" />
                  </div>
                  <DialogFooter className="pt-2">
                    <Button type="button" variant="outline" onClick={() => setBlockerDialogOpen(false)} disabled={savingBlocker}>Cancelar</Button>
                    <Button type="submit" disabled={savingBlocker}>{savingBlocker ? "Enviando..." : "Confirmar Solicitação"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingBlockers ? (
            <div className="text-center text-sm text-muted-foreground py-8">Carregando bloqueios...</div>
          ) : blockers.length === 0 ? (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma solicitação de bloqueio registrada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground">
                    <th className="p-3">Período</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blockers.map((blk) => (
                    <tr key={blk.id} className="hover:bg-muted/10 text-foreground transition-all">
                      <td className="p-3 font-semibold text-nowrap">
                        {new Date(blk.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")} até {new Date(blk.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={
                          blk.tipo === "Medico" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                          blk.tipo === "Folga" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                          blk.tipo === "Problema_Veiculo" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                          blk.tipo === "Feriado" ? "bg-sky-500/10 text-sky-600 border-sky-500/20" :
                          blk.tipo === "Bloqueio_Global" ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" :
                          "bg-purple-500/10 text-purple-600 border-purple-500/20"
                        }>
                          {blk.tipo === "Medico" ? "🔬 Médico" :
                           blk.tipo === "Folga" ? "🌴 Folga" :
                           blk.tipo === "Problema_Veiculo" ? "🚗 Veículo" :
                           blk.tipo === "Feriado" ? "🎉 Feriado" :
                           blk.tipo === "Bloqueio_Global" ? "🔒 Bloqueio Global" : "Outro"}
                        </Badge>
                      </td>
                      <td className="p-3 max-w-xs truncate">{blk.descricao || "Sem justificativa"}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={
                          blk.status === "Aprovado" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                          blk.status === "Rejeitado" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                          "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }>
                          {blk.status === "Aprovado" ? "✅ Aprovado" :
                           blk.status === "Rejeitado" ? "❌ Rejeitado" : "⏳ Pendente"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {blk.status === "Pendente" && blk.tecnico_id !== null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 cursor-pointer h-auto"
                            onClick={() => handleDeleteBlocker(blk.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Check-in de Partida */}
      <Dialog open={!!selectedStartBookingId} onOpenChange={(open) => { if (!open) setSelectedStartBookingId(null); }}>
        <DialogContent className="max-w-md border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-indigo-600" />
              Check-in de Partida
            </DialogTitle>
            <DialogDescription>
              Selecione ou informe de onde você está partindo para iniciar este atendimento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmStart} className="space-y-4 pt-2 text-xs">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sem-definicao"
                  checked={semDefinicao}
                  onChange={(e) => setSemDefinicao(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-background cursor-pointer"
                />
                <Label htmlFor="sem-definicao" className="text-xs font-semibold cursor-pointer">
                  Local ainda sem definição (Digitar endereço de partida)
                </Label>
              </div>

              {!semDefinicao ? (
                <div className="space-y-1.5">
                  <Label>Selecione a Base / Hotel de Partida</Label>
                  <select
                    required
                    value={pontoPartidaId}
                    onChange={(e) => setPontoPartidaId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Selecione um local cadastrado --</option>
                    {locaisCheckin
                      .filter(l => !l.agendamento_id || l.agendamento_id === selectedStartBookingId)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.nome} ({l.tipo} - {l.cidade}/{l.estado})
                        </option>
                      ))}
                  </select>
                  {locaisCheckin.filter(l => !l.agendamento_id || l.agendamento_id === selectedStartBookingId).length === 0 && (
                    <p className="text-[10px] text-amber-600 font-medium mt-1">
                      ⚠️ Nenhum local pré-cadastrado disponível. Use a opção de endereço customizado.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-3 border rounded bg-muted/20">
                  <p className="font-semibold text-foreground text-[11px]">Endereço de Partida Customizado</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-end">Endereço (Rua/Av.)</Label>
                    <Input id="cust-end" required value={customEndereco} onChange={(e) => setCustomEndereco(e.target.value)} placeholder="Ex: Av. Paulista" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-num">Número</Label>
                      <Input id="cust-num" value={customNumero} onChange={(e) => setCustomNumero(e.target.value)} placeholder="Ex: 1000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-bair">Bairro</Label>
                      <Input id="cust-bair" value={customBairro} onChange={(e) => setCustomBairro(e.target.value)} placeholder="Ex: Centro" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-cid">Cidade</Label>
                      <Input id="cust-cid" required value={customCidade} onChange={(e) => setCustomCidade(e.target.value)} placeholder="Ex: Sorocaba" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-est">Estado</Label>
                      <Input id="cust-est" required maxLength={2} value={customEstado} onChange={(e) => setCustomEstado(e.target.value)} placeholder="Ex: SP" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSelectedStartBookingId(null)} disabled={actionLoading !== null}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" disabled={actionLoading !== null}>
                {actionLoading !== null ? "Iniciando..." : "Confirmar Partida e Iniciar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Abandono / Transferência ── */}
      <Dialog open={abandonDialogOpen} onOpenChange={(open) => { if (!abandoningBooking) setAbandonDialogOpen(open); }}>
        <DialogContent className="max-w-md border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Transferir Atendimento
            </DialogTitle>
            <DialogDescription>
              Ao transferir, o atendimento será realocado automaticamente para outro técnico disponível.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Atenção</p>
              <p>Se você transferir com menos de <strong>24 horas</strong> de antecedência ao serviço, uma penalidade será aplicada ao seu score de avaliação.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="abandon-motivo-tec">Motivo da Transferência *</Label>
              <select
                id="abandon-motivo-tec"
                value={abandonMotivo}
                onChange={(e) => setAbandonMotivo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Problema pessoal">Problema pessoal</option>
                <option value="Problema no veículo">Problema no veículo</option>
                <option value="Emergência médica">Emergência médica</option>
                <option value="Conflito de horário">Conflito de horário</option>
                <option value="Outro">Outro (descrever)</option>
              </select>
            </div>

            {abandonMotivo === "Outro" && (
              <div className="space-y-2">
                <Label htmlFor="abandon-custom-tec">Descreva o motivo *</Label>
                <Input
                  id="abandon-custom-tec"
                  placeholder="Descreva brevemente o motivo..."
                  value={abandonCustomMotivo}
                  onChange={(e) => setAbandonCustomMotivo(e.target.value)}
                  maxLength={300}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setAbandonDialogOpen(false)}
              disabled={abandoningBooking}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
              onClick={handleAbandonBooking}
              disabled={abandoningBooking}
            >
              <LogOut className="h-4 w-4" />
              {abandoningBooking ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  
  // 1. Check for @lat,lng format
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      lat: parseFloat(atMatch[1]),
      lng: parseFloat(atMatch[2])
    };
  }
  
  // 2. Check for !3dLat!4dLng format (exact pin coordinate format)
  const bangMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    return {
      lat: parseFloat(bangMatch[1]),
      lng: parseFloat(bangMatch[2])
    };
  }

  // 3. Check for query parameters format q=lat,lng or ll=lat,lng
  const qMatch = url.match(/[?&](q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return {
      lat: parseFloat(qMatch[2]),
      lng: parseFloat(qMatch[3])
    };
  }
  
  // 4. Check for static maps URL format or center format
  const centerMatch = url.match(/[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (centerMatch) {
    return {
      lat: parseFloat(centerMatch[1]),
      lng: parseFloat(centerMatch[2])
    };
  }
  
  // 5. Try parsing naked lat,lng if they pasted just coordinates
  const nakedMatch = url.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (nakedMatch) {
    return {
      lat: parseFloat(nakedMatch[1]),
      lng: parseFloat(nakedMatch[2])
    };
  }
  return null;
}

// ── ADMIN DASHBOARD ────────────────────────────────────────────────────────
function AdminDash() {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Form states for technician creation
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [laboratorioPadraoId, setLaboratorioPadraoId] = useState("");
  const [raioAtuacaoKm, setRaioAtuacaoKm] = useState(50);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<{ servico_id: string; nivel: number }[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form states for "Meus Dados" (contracting company settings)
  const [empresaPlataforma, setEmpresaPlataforma] = useState({
    razao_social: "Quantis Tecnologia Ltda",
    cnpj: "12.345.678/0001-99",
    telefone: "(15) 98110-3345",
    email: "contato@quantis.com.br",
    endereco: "Av. Paulista, 1000 - São Paulo/SP"
  });
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  // Products/Services states
  const [servicos, setServicos] = useState<any[]>([]);
  const [cidades, setCidades] = useState<any[]>([]);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [servicoDialogOpen, setServicoDialogOpen] = useState(false);
  const [selectedServico, setSelectedServico] = useState<any | null>(null);

  // Form states for service creation/edition
  const [servicoSku, setServicoSku] = useState("");
  const [servicoNome, setServicoNome] = useState("");
  const [servicoUnidade, setServicoUnidade] = useState("");
  const [servicoCustoBase, setServicoCustoBase] = useState(0);
  const [servicoVendaEditavel, setServicoVendaEditavel] = useState(0);
  const [servicoCategoria, setServicoCategoria] = useState("");
  const [servicoAtivo, setServicoAtivo] = useState(true);
  const [servicoDescricao, setServicoDescricao] = useState("");
  const [servicoTipoCobranca, setServicoTipoCobranca] = useState("Por Execucao");
  const [servicoFormasPagamento, setServicoFormasPagamento] = useState<string[]>(["PIX", "Boleto", "Cartao"]);
  const [servicoRegraMinimo, setServicoRegraMinimo] = useState(1000.00);
  const [servicoCpExcedente, setServicoCpExcedente] = useState(0);
  const [servicoSaving, setServicoSaving] = useState(false);

  // City pricing states
  const [precosCidadeOpen, setPrecosCidadeOpen] = useState(false);
  const [pricingCityRates, setPricingCityRates] = useState<{ [cidadeId: string]: { valorFixo: number; limiteUnidades: number; id?: string } }>({});
  const [savingCityRates, setSavingCityRates] = useState<string | null>(null);

  // Sidebar navigation and modular features states
  const [activeTab, setActiveTab] = useState("tecnicos");

  // Global Configs states
  const [globalConfigs, setGlobalConfigs] = useState({ eficiencia_cp: 95, coeficiente_he: 1.5, prazo_faturamento_dias: 28 });
  const [savingGlobalConfigs, setSavingGlobalConfigs] = useState(false);

  // City form states
  const [cidadeId, setCidadeId] = useState("");
  const [cidadeNome, setCidadeNome] = useState("");
  const [cidadeMobilizacao, setCidadeMobilizacao] = useState(0);
  const [cidadePedagio, setCidadePedagio] = useState(0);
  const [cidadeMinutos, setCidadeMinutos] = useState(60);
  const [cidadeIsBase, setCidadeIsBase] = useState(false);
  const [cidadeDialogOpen, setCidadeDialogOpen] = useState(false);
  const [cidadeSaving, setCidadeSaving] = useState(false);

  // Finance states
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [adminFinStartDate, setAdminFinStartDate] = useState("");
  const [adminFinEndDate, setAdminFinEndDate] = useState("");
  const [adminFinClientId, setAdminFinClientId] = useState("all");
  const [adminFinServiceId, setAdminFinServiceId] = useState("all");

  // Obras Management states
  const [obrasGestor, setObrasGestor] = useState<any[]>([]);
  const [empresasClientes, setEmpresasClientes] = useState<any[]>([]);
  const [loadingObras, setLoadingObras] = useState(false);
  const [obrasSearch, setObrasSearch] = useState("");
  const [selectedEmpresaFiltro, setSelectedEmpresaFiltro] = useState("all");
  const [obraDialogOpen, setObraDialogOpen] = useState(false);
  const [obraSaving, setObraSaving] = useState(false);

  // Clientes/Empresas Management states
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clientesSearch, setClientesSearch] = useState("");
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [clienteSaving, setClienteSaving] = useState(false);

  // Form states for Cliente/Empresa
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteRazaoSocial, setClienteRazaoSocial] = useState("");
  const [clienteCnpj, setClienteCnpj] = useState("");
  const [clienteRequerAprovacaoTecnico, setClienteRequerAprovacaoTecnico] = useState(false);

  // Admin Agendamentos panel states
  const [adminAgendamentos, setAdminAgendamentos] = useState<any[]>([]);
  const [loadingAdminAgend, setLoadingAdminAgend] = useState(false);
  const [adminAgendStatusFilter, setAdminAgendStatusFilter] = useState("Pendente_Aprovacao_Gestor");
  // Manual allocation modal states
  const [allocModalOpen, setAllocModalOpen] = useState(false);
  const [allocBooking, setAllocBooking] = useState<any | null>(null);
  const [allocTecnicoId, setAllocTecnicoId] = useState("");
  const [allocating, setAllocating] = useState(false);

  const fetchAdminAgendamentos = async () => {
    setLoadingAdminAgend(true);
    try {
      const { data, error } = await supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*), tecnico:tecnicos!agendamentos_medicoes_tecnico_id_fkey(*)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setAdminAgendamentos(data || []);
    } catch (err) {
      console.error("Erro ao buscar agendamentos:", err);
      toast.error("Erro ao carregar agendamentos.");
    } finally {
      setLoadingAdminAgend(false);
    }
  };

  const handleOpenAllocModal = (ag: any) => {
    setAllocBooking(ag);
    setAllocTecnicoId("");
    setAllocModalOpen(true);
  };

  const handleAllocateTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocBooking || !allocTecnicoId) return;
    setAllocating(true);
    try {
      await allocateTechnicianManually({
        data: { bookingId: allocBooking.id, tecnicoId: allocTecnicoId },
      });
      toast.success("Técnico alocado com sucesso! Notificação enviada via WhatsApp.");
      setAllocModalOpen(false);
      fetchAdminAgendamentos();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alocar técnico.");
    } finally {
      setAllocating(false);
    }
  };


  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteRazaoSocial || !clienteCnpj) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    setClienteSaving(true);
    try {
      const payload = {
        razao_social: clienteRazaoSocial,
        cnpj: clienteCnpj,
        requer_aprovacao_tecnico: clienteRequerAprovacaoTecnico
      };

      if (clienteId) {
        const { error } = await supabase
          .from("empresas_clientes")
          .update(payload)
          .eq("id", clienteId);
        if (error) throw error;
        toast.success("Empresa cliente atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("empresas_clientes")
          .insert(payload);
        if (error) throw error;
        toast.success("Empresa cliente cadastrada com sucesso!");
      }
      setClienteDialogOpen(false);
      fetchEmpresasClientes();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar empresa cliente.");
    } finally {
      setClienteSaving(false);
    }
  };

  const handleDeleteCliente = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta empresa cliente? Isso pode afetar usuários vinculados.")) return;
    try {
      const { error } = await supabase
        .from("empresas_clientes")
        .delete()
        .eq("id", id);
      
      if (error) {
        if (error.code === "23503") {
          toast.error("Não é possível excluir esta empresa pois existem perfis de usuários, obras ou agendamentos vinculados a ela.");
        } else {
          throw error;
        }
      } else {
        toast.success("Empresa cliente excluída com sucesso!");
        fetchEmpresasClientes();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao excluir empresa cliente.");
    }
  };

  const handleOpenNewCliente = () => {
    setClienteId(null);
    setClienteRazaoSocial("");
    setClienteCnpj("");
    setClienteRequerAprovacaoTecnico(false);
    setClienteDialogOpen(true);
  };

  const handleOpenEditCliente = (emp: any) => {
    setClienteId(emp.id);
    setClienteRazaoSocial(emp.razao_social);
    setClienteCnpj(emp.cnpj);
    setClienteRequerAprovacaoTecnico(emp.requer_aprovacao_tecnico || false);
    setClienteDialogOpen(true);
  };

  // Form states for Obra
  const [obraId, setObraId] = useState<string | null>(null);
  const [obraEmpresaId, setObraEmpresaId] = useState("");
  const [obraNome, setObraNome] = useState("");
  const [obraCep, setObraCep] = useState("");
  const [obraEndereco, setObraEndereco] = useState("");
  const [obraNumero, setObraNumero] = useState("");
  const [obraBairro, setObraBairro] = useState("");
  const [obraCidade, setObraCidade] = useState("");
  const [obraEstado, setObraEstado] = useState("");
  const [obraCno, setObraCno] = useState("");
  const [obraResponsavel, setObraResponsavel] = useState("");
  const [obraCargoResponsavel, setObraCargoResponsavel] = useState("");
  const [obraLat, setObraLat] = useState("");
  const [obraLng, setObraLng] = useState("");
  const [fetchingObraCep, setFetchingObraCep] = useState(false);

  const fetchObrasGestor = async () => {
    setLoadingObras(true);
    try {
      const { data, error } = await supabase
        .from("obras")
        .select("*, empresa:empresas_clientes(razao_social)")
        .order("nome_obra", { ascending: true });
      if (!error && data) {
        setObrasGestor(data);
      }
    } catch (err) {
      console.error("Error fetching Obras:", err);
      toast.error("Erro ao carregar obras.");
    } finally {
      setLoadingObras(false);
    }
  };

  const fetchEmpresasClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("empresas_clientes")
        .select("id, razao_social, cnpj, requer_aprovacao_tecnico")
        .order("razao_social", { ascending: true });
      if (!error && data) {
        setEmpresasClientes(data);
      }
    } catch (err) {
      console.error("Error fetching empresas:", err);
    }
  };

  const handleObraCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const clean = rawVal.replace(/\D/g, "");
    setObraCep(rawVal);
    
    if (clean.length === 8) {
      setFetchingObraCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) {
          toast.error("CEP não encontrado.");
        } else {
          setObraEndereco(data.logradouro || "");
          setObraBairro(data.bairro || "");
          setObraCidade(data.localidade || "");
          setObraEstado(data.uf || "");
          toast.success("Endereço preenchido com sucesso pelo CEP!");
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
        toast.error("Erro ao buscar endereço pelo CEP.");
      } finally {
        setFetchingObraCep(false);
      }
    }
  };

  const handleSaveObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraEmpresaId || !obraNome || !obraEndereco || !obraCidade) {
      toast.error("Por favor, preencha os campos obrigatórios.");
      return;
    }
    setObraSaving(true);
    try {
      // Check for duplicate work (same nome_obra, endereco, cep for this company)
      const cleanCep = (obraCep || "").replace(/\D/g, "");
      const { data: existingObras } = await supabase
        .from("obras")
        .select("id, cep")
        .eq("empresa_id", obraEmpresaId)
        .ilike("nome_obra", obraNome.trim())
        .ilike("endereco", obraEndereco.trim());

      const duplicate = (existingObras || []).find(o => {
        if (obraId && o.id === obraId) return false; // Ignore current work being edited
        const oCepClean = o.cep?.replace(/\D/g, "") || "";
        return oCepClean === cleanCep;
      });

      if (duplicate) {
        toast.error("Já existe outra obra cadastrada com este mesmo nome, endereço e CEP para esta empresa.");
        setObraSaving(false);
        return;
      }

      const payload = {
        empresa_id: obraEmpresaId,
        nome_obra: obraNome.trim(),
        cep: obraCep || null,
        endereco: obraEndereco.trim(),
        numero: obraNumero || null,
        bairro: obraBairro || null,
        cidade: obraCidade,
        estado: obraEstado || null,
        cno: obraCno || null,
        responsavel: obraResponsavel || null,
        cargo_responsavel: obraCargoResponsavel || null,
        latitude: obraLat ? Number(obraLat) : null,
        longitude: obraLng ? Number(obraLng) : null
      };

      if (obraId) {
        const { error } = await supabase
          .from("obras")
          .update(payload)
          .eq("id", obraId);
        if (error) throw error;
        toast.success("Obra atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("obras")
          .insert(payload);
        if (error) throw error;
        toast.success("Obra cadastrada com sucesso!");
      }
      setObraDialogOpen(false);
      fetchObrasGestor();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar obra.");
    } finally {
      setObraSaving(false);
    }
  };

  const handleDeleteObra = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta obra?")) return;
    try {
      await deleteObra({ data: { obraId: id } });
      toast.success("Obra excluída com sucesso!");
      fetchObrasGestor();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao excluir obra.");
    }
  };

  const handleOpenNewObra = () => {
    setObraId(null);
    setObraEmpresaId(empresasClientes[0]?.id || "");
    setObraNome("");
    setObraCep("");
    setObraEndereco("");
    setObraNumero("");
    setObraBairro("");
    setObraCidade("");
    setObraEstado("");
    setObraCno("");
    setObraResponsavel("");
    setObraCargoResponsavel("");
    setObraLat("");
    setObraLng("");
    setObraDialogOpen(true);
  };

  const handleOpenEditObra = (obra: any) => {
    setObraId(obra.id);
    setObraEmpresaId(obra.empresa_id);
    setObraNome(obra.nome_obra);
    setObraCep(obra.cep || "");
    setObraEndereco(obra.endereco);
    setObraNumero(obra.numero || "");
    setObraBairro(obra.bairro || "");
    setObraCidade(obra.cidade);
    setObraEstado(obra.estado || "");
    setObraCno(obra.cno || "");
    setObraResponsavel(obra.responsavel || "");
    setObraCargoResponsavel(obra.cargo_responsavel || "");
    setObraLat(obra.latitude?.toString() || "");
    setObraLng(obra.longitude?.toString() || "");
    setObraDialogOpen(true);
  };

  // Scale alerts states
  const [scaleAlerts, setScaleAlerts] = useState<any[]>([]);
  const [loadingScaleAlerts, setLoadingScaleAlerts] = useState(false);

  const fetchScaleAlerts = async () => {
    setLoadingScaleAlerts(true);
    try {
      // Buscar todos os agendamentos confirmados/em execução ordenados por técnico e data
      const { data, error } = await supabase
        .from("agendamentos_medicoes")
        .select("id, codigo_pedido, data_servico, horario_na_obra, duracao_estimada_horas, tecnico_id, tecnico:tecnicos(nome)")
        .in("status_agendamento", ["Confirmado", "Em_Execucao", "Aguardando_Medicao"])
        .order("tecnico_id", { ascending: true })
        .order("data_servico", { ascending: true });

      if (error) throw error;

      const violations: any[] = [];
      const DESCANSO_MINIMO_H = 11;

      // Agrupar por técnico
      const byTecnico: Record<string, any[]> = {};
      (data || []).forEach((ag: any) => {
        const tid = ag.tecnico_id;
        if (!tid) return;
        if (!byTecnico[tid]) byTecnico[tid] = [];
        byTecnico[tid].push(ag);
      });

      Object.values(byTecnico).forEach((agendamentos) => {
        for (let i = 0; i < agendamentos.length - 1; i++) {
          const ag1 = agendamentos[i];
          const ag2 = agendamentos[i + 1];

          // Calcular horário de término do 1º serviço
          const duracao1 = Number(ag1.duracao_estimada_horas ?? 8);
          const inicio1Str = `${ag1.data_servico}T${ag1.horario_na_obra ?? "07:00:00"}`;
          const inicio1 = new Date(inicio1Str);
          if (isNaN(inicio1.getTime())) return;
          const fim1 = new Date(inicio1.getTime() + duracao1 * 3600 * 1000);

          // Calcular horário de início do 2º serviço
          const inicio2Str = `${ag2.data_servico}T${ag2.horario_na_obra ?? "07:00:00"}`;
          const inicio2 = new Date(inicio2Str);
          if (isNaN(inicio2.getTime())) return;

          const descansoMs = inicio2.getTime() - fim1.getTime();
          const descansoH = descansoMs / 3600 / 1000;

          if (descansoH < DESCANSO_MINIMO_H) {
            violations.push({
              tecnicoNome: ag1.tecnico?.nome ?? "Técnico",
              pedido1: ag1.codigo_pedido,
              data1: new Date(ag1.data_servico + "T00:00:00").toLocaleDateString("pt-BR"),
              horaFim1: fim1.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              pedido2: ag2.codigo_pedido,
              data2: new Date(ag2.data_servico + "T00:00:00").toLocaleDateString("pt-BR"),
              horaInicio2: inicio2.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              descansoHoras: descansoH.toFixed(1),
            });
          }
        }
      });

      setScaleAlerts(violations);
    } catch (err) {
      console.error("Erro ao calcular alertas de escala:", err);
    } finally {
      setLoadingScaleAlerts(false);
    }
  };

  const handleLoadGlobalConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "configuracoes_globais")
        .maybeSingle();
      if (data && data.value) {
        setGlobalConfigs(data.value as any);
      }
      await fetchAllCidades();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveGlobalConfigs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobalConfigs(true);
    try {
      const { saveGlobalSettings } = await import("@/lib/booking.functions");
      const res = await saveGlobalSettings({
        data: globalConfigs
      });
      if (res.success) {
        toast.success("Configurações globais atualizadas com sucesso!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar configurações globais.");
    } finally {
      setSavingGlobalConfigs(false);
    }
  };

  const handleOpenCidadeDialog = (cid: any | null = null) => {
    if (cid) {
      setCidadeId(cid.id);
      setCidadeNome(cid.nome_cidade);
      setCidadeMobilizacao(Number(cid.mobilizacao_base));
      setCidadePedagio(Number(cid.pedagio_estimado));
      setCidadeMinutos(Number(cid.minutos_deslocamento));
      setCidadeIsBase(cid.is_base);
    } else {
      setCidadeId("");
      setCidadeNome("");
      setCidadeMobilizacao(0);
      setCidadePedagio(0);
      setCidadeMinutos(60);
      setCidadeIsBase(false);
    }
    setCidadeDialogOpen(true);
  };

  const handleSaveCidade = async (e: React.FormEvent) => {
    e.preventDefault();
    setCidadeSaving(true);
    try {
      const { saveCidadeAtendida } = await import("@/lib/booking.functions");
      const res = await saveCidadeAtendida({
        data: {
          id: cidadeId || undefined,
          nomeCidade: cidadeNome,
          mobilizacaoBase: cidadeMobilizacao,
          pedagioEstimado: cidadePedagio,
          minutosDeslocamento: cidadeMinutos,
          isBase: cidadeIsBase
        }
      });
      if (res.success) {
        toast.success("Cidade salva com sucesso!");
        setCidadeDialogOpen(false);
        fetchAllCidades();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar cidade.");
    } finally {
      setCidadeSaving(false);
    }
  };

  const handleDeleteCidade = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta cidade?")) return;
    try {
      const { deleteCidadeAtendida } = await import("@/lib/booking.functions");
      const res = await deleteCidadeAtendida({
        data: { cidadeId: id }
      });
      if (res.success) {
        toast.success("Cidade excluída!");
        fetchAllCidades();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir cidade.");
    }
  };

  const fetchFinancialSummary = async () => {
    setLoadingFinance(true);
    try {
      const { getFinancialSummary } = await import("@/lib/booking.functions");
      const res = await getFinancialSummary();
      if (res.success) {
        setFinanceSummary(res);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados financeiros.");
    } finally {
      setLoadingFinance(false);
    }
  };

  const handleAdminExportCSV = () => {
    const adminFiltered = (financeSummary?.bookings || []).filter((b: any) => {
      if (adminFinStartDate && b.data_servico < adminFinStartDate) return false;
      if (adminFinEndDate && b.data_servico > adminFinEndDate) return false;
      if (adminFinClientId !== "all" && b.empresa_id !== adminFinClientId) return false;
      if (adminFinServiceId !== "all" && b.servico_id !== adminFinServiceId) return false;
      return true;
    });

    if (adminFiltered.length === 0) {
      toast.error("Nenhum dado financeiro para exportar.");
      return;
    }

    const headers = [
      "Código do Pedido",
      "Data do Serviço",
      "Cliente",
      "CNPJ",
      "Serviço",
      "Status Execução",
      "Status Faturamento",
      "Valor Total (R$)"
    ];

    const rows = adminFiltered.map((b: any) => [
      b.codigo_pedido,
      b.data_servico,
      b.empresa?.razao_social || "",
      b.empresa?.cnpj || "",
      b.servico?.nome_servico || "",
      STATUS_LABELS[b.status_agendamento] || b.status_agendamento,
      b.status_pagamento || "",
      b.valor_total
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `financeiro_consolidado_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdminPrintPDF = () => {
    const adminFiltered = (financeSummary?.bookings || []).filter((b: any) => {
      if (adminFinStartDate && b.data_servico < adminFinStartDate) return false;
      if (adminFinEndDate && b.data_servico > adminFinEndDate) return false;
      if (adminFinClientId !== "all" && b.empresa_id !== adminFinClientId) return false;
      if (adminFinServiceId !== "all" && b.servico_id !== adminFinServiceId) return false;
      return true;
    });

    if (adminFiltered.length === 0) {
      toast.error("Nenhum dado financeiro para gerar PDF.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão. Por favor, desative o bloqueador de pop-ups.");
      return;
    }

    const filterDetails = [];
    if (adminFinStartDate) filterDetails.push(`Início: ${adminFinStartDate}`);
    if (adminFinEndDate) filterDetails.push(`Fim: ${adminFinEndDate}`);
    if (adminFinClientId !== "all") {
      const emp = empresasClientes.find(e => e.id === adminFinClientId);
      if (emp) filterDetails.push(`Cliente: ${emp.razao_social}`);
    }
    if (adminFinServiceId !== "all") {
      const svc = servicos.find(s => s.id === adminFinServiceId);
      if (svc) filterDetails.push(`Serviço: ${svc.nome_servico}`);
    }

    const filterText = filterDetails.length > 0 ? filterDetails.join(" | ") : "Todo o histórico financeiro";

    // Recompute client list for report print
    const adminPorClienteMap: Record<string, { cliente: string; pago: number; pendente: number; total: number }> = {};
    adminFiltered.forEach((b: any) => {
      const val = Number(b.valor_total) || 0;
      const rSocial = b.empresa?.razao_social || "Empresa Desconhecida";
      const empId = b.empresa_id || "unknown";

      if (!adminPorClienteMap[empId]) {
        adminPorClienteMap[empId] = { cliente: rSocial, pago: 0, pendente: 0, total: 0 };
      }

      adminPorClienteMap[empId].total += val;
      if (b.status_pagamento === "Pago") {
        adminPorClienteMap[empId].pago += val;
      } else {
        adminPorClienteMap[empId].pendente += val;
      }
    });
    const adminPorClienteList = Object.values(adminPorClienteMap);

    let adminTotalAgendado = 0;
    let adminTotalRealizado = 0;
    let adminTotalACobrar = 0;
    let adminTotalAcumulado = 0;

    adminFiltered.forEach((b: any) => {
      const val = Number(b.valor_total) || 0;
      adminTotalAcumulado += val;

      if (["Confirmado", "Em_Execucao"].includes(b.status_agendamento)) {
        adminTotalAgendado += val;
      }
      if (["Aguardando_Medicao", "Laboratorio", "Validado"].includes(b.status_agendamento)) {
        adminTotalRealizado += val;
      }
      if (b.status_agendamento === "Validado" && b.status_pagamento !== "Pago") {
        adminTotalACobrar += val;
      }
    });

    const rowsHtml = adminFiltered.map((b: any) => `
      <tr>
        <td style="font-family: monospace; font-size: 11px;">${b.codigo_pedido}</td>
        <td>${new Date(b.data_servico + "T00:00:00").toLocaleDateString("pt-BR")}</td>
        <td>${b.empresa?.razao_social || ""}</td>
        <td>${b.servico?.nome_servico || ""}</td>
        <td>${STATUS_LABELS[b.status_agendamento] || b.status_agendamento}</td>
        <td>${b.status_pagamento}</td>
        <td style="text-align: right; font-weight: bold;">R$ ${Number(b.valor_total).toFixed(2)}</td>
      </tr>
    `).join("");

    const clientRowsHtml = adminPorClienteList.map((c: any) => `
      <tr>
        <td><strong>${c.cliente}</strong></td>
        <td style="text-align: right; color: #16a34a;">R$ ${Number(c.pago).toFixed(2)}</td>
        <td style="text-align: right; color: #d97706;">R$ ${Number(c.pendente).toFixed(2)}</td>
        <td style="text-align: right; font-weight: bold;">R$ ${Number(c.total).toFixed(2)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Módulo Financeiro - Quantis Obras</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #333;
            margin: 40px;
            font-size: 12px;
            line-height: 1.4;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #10b981;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #065f46;
          }
          .title {
            text-align: right;
          }
          .title h1 {
            margin: 0;
            font-size: 20px;
            color: #065f46;
          }
          .title p {
            margin: 5px 0 0 0;
            font-size: 11px;
            color: #666;
          }
          .filters {
            background-color: #f3f4f6;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 11px;
            color: #4b5563;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .summary-card {
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 6px;
            background-color: #fafafa;
          }
          .summary-card p {
            margin: 0;
            font-size: 10px;
            text-transform: uppercase;
            color: #6b7280;
            font-weight: 600;
          }
          .summary-card h2 {
            margin: 5px 0 0 0;
            font-size: 16px;
            color: #111827;
            font-weight: 700;
          }
          h3 {
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
            margin-top: 25px;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background-color: #065f46;
            color: white;
            font-weight: 600;
            text-align: left;
            padding: 8px;
            font-size: 11px;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
          }
          tr:nth-child(even) td {
            background-color: #f9fafb;
          }
          footer {
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
            margin-top: 50px;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="logo">Quantis Obras</div>
          <div class="title">
            <h1>Relatório Financeiro</h1>
            <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
          </div>
        </header>

        <div class="filters">
          <strong>Filtros Aplicados:</strong> ${filterText}
        </div>

        <div class="summary-grid">
          <div class="summary-card" style="border-left: 4px solid #3b82f6;">
            <p>Agendado</p>
            <h2>R$ ${adminTotalAgendado.toFixed(2)}</h2>
          </div>
          <div class="summary-card" style="border-left: 4px solid #10b981;">
            <p>Realizado</p>
            <h2>R$ ${adminTotalRealizado.toFixed(2)}</h2>
          </div>
          <div class="summary-card" style="border-left: 4px solid #f59e0b;">
            <p>A Cobrar (Validados)</p>
            <h2>R$ ${adminTotalACobrar.toFixed(2)}</h2>
          </div>
          <div class="summary-card" style="border-left: 4px solid #6b7280; background-color: #f3f4f6;">
            <p>Acumulado Geral</p>
            <h2>R$ ${adminTotalAcumulado.toFixed(2)}</h2>
          </div>
        </div>

        <h3>Faturamento Consolidado por Cliente</h3>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th style="text-align: right;">Pago</th>
              <th style="text-align: right;">Pendente</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${clientRowsHtml}
          </tbody>
        </table>

        <h3>Detalhamento dos Serviços</h3>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Execução</th>
              <th>Pagamento</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <footer>
          Módulo Financeiro Administrativo - Quantis Obras.
        </footer>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fetchAllServicos = async () => {
    setLoadingServicos(true);
    try {
      const { data, error } = await supabase
        .from("servicos_catalogo")
        .select("*")
        .order("nome_servico", { ascending: true });
      if (error) throw error;
      setServicos(data || []);
    } catch (err) {
      console.error("Error fetching servicos:", err);
      toast.error("Erro ao carregar serviços.");
    } finally {
      setLoadingServicos(false);
    }
  };

  const fetchAllCidades = async () => {
    try {
      const { data, error } = await supabase
        .from("cidades_atendidas")
        .select("*")
        .order("nome_cidade", { ascending: true });
      if (error) throw error;
      setCidades(data || []);
    } catch (err) {
      console.error("Error fetching cidades:", err);
    }
  };

  const handleOpenServicoDialog = (serv: any | null = null) => {
    setSelectedServico(serv);
    if (serv) {
      setServicoSku(serv.sku);
      setServicoNome(serv.nome_servico);
      setServicoUnidade(serv.unidade);
      setServicoCustoBase(Number(serv.valor_custo_base));
      setServicoVendaEditavel(Number(serv.valor_venda_editavel));
      setServicoCategoria(serv.categoria);
      setServicoAtivo(serv.ativo);
      setServicoDescricao(serv.descricao || "");
      setServicoTipoCobranca(serv.tipo_cobranca || "Por Execucao");
      setServicoFormasPagamento(serv.formas_pagamento_aceitas || ["PIX", "Boleto", "Cartao"]);
      setServicoRegraMinimo(Number(serv.regra_minimo_a_vista ?? 1000.00));
      setServicoCpExcedente(Number(serv.valor_cp_excedente ?? 0.00));
    } else {
      setServicoSku("");
      setServicoNome("");
      setServicoUnidade("unidade");
      setServicoCustoBase(0);
      setServicoVendaEditavel(0);
      setServicoCategoria("Controle Tecnológico");
      setServicoAtivo(true);
      setServicoDescricao("");
      setServicoTipoCobranca("Por Execucao");
      setServicoFormasPagamento(["PIX", "Boleto", "Cartao"]);
      setServicoRegraMinimo(1000.00);
      setServicoCpExcedente(0.00);
    }
    setServicoDialogOpen(true);
  };

  const handleSaveServicoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServicoSaving(true);
    try {
      const { saveServico } = await import("@/lib/booking.functions");
      const res = await saveServico({
        data: {
          id: selectedServico?.id,
          sku: servicoSku,
          nome_servico: servicoNome,
          unidade: servicoUnidade,
          valor_custo_base: servicoCustoBase,
          valor_venda_editavel: servicoVendaEditavel,
          categoria: servicoCategoria,
          ativo: servicoAtivo,
          descricao: servicoDescricao,
          tipo_cobranca: servicoTipoCobranca,
          formas_pagamento_aceitas: servicoFormasPagamento,
          regra_minimo_a_vista: servicoRegraMinimo,
          valor_cp_excedente: servicoCpExcedente
        }
      });
      if (res.success) {
        toast.success("Serviço salvo com sucesso!");
        setServicoDialogOpen(false);
        fetchAllServicos();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar serviço.");
    } finally {
      setServicoSaving(false);
    }
  };

  const handleOpenPrecosCidade = async (serv: any) => {
    setSelectedServico(serv);
    setPrecosCidadeOpen(true);
    setLoadingServicos(true);
    try {
      const { data: precos, error } = await supabase
        .from("servicos_precos_cidades")
        .select("*")
        .eq("servico_id", serv.id);
      if (error) throw error;

      await fetchAllCidades();

      const mapping: any = {};
      precos?.forEach((p: any) => {
        mapping[p.cidade_id] = {
          id: p.id,
          valorFixo: Number(p.valor_fixo),
          limiteUnidades: Number(p.limite_unidades)
        };
      });

      setPricingCityRates(mapping);
    } catch (err) {
      console.error("Error loading pricing rates:", err);
      toast.error("Erro ao carregar precificação regional.");
    } finally {
      setLoadingServicos(false);
    }
  };

  const handleSaveCityPriceRate = async (cidadeId: string) => {
    const rate = pricingCityRates[cidadeId];
    if (!rate || rate.valorFixo === undefined) {
      toast.error("Por favor, preencha o valor fixo.");
      return;
    }
    setSavingCityRates(cidadeId);
    try {
      const { saveServicoPrecoCidade } = await import("@/lib/booking.functions");
      const res = await saveServicoPrecoCidade({
        data: {
          id: rate.id,
          servicoId: selectedServico.id,
          cidadeId: cidadeId,
          valorFixo: Number(rate.valorFixo),
          limiteUnidades: Number(rate.limiteUnidades ?? 50)
        }
      });
      if (res.success) {
        toast.success("Preço regional atualizado!");
        const { data: precos } = await supabase
          .from("servicos_precos_cidades")
          .select("*")
          .eq("servico_id", selectedServico.id);

        const mapping: any = {};
        precos?.forEach((p: any) => {
          mapping[p.cidade_id] = {
            id: p.id,
            valorFixo: Number(p.valor_fixo),
            limiteUnidades: Number(p.limite_unidades)
          };
        });
        setPricingCityRates(mapping);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar preço regional.");
    } finally {
      setSavingCityRates(null);
    }
  };

  const fetchEmpresaPlataforma = async () => {
    setLoadingEmpresa(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "empresa_plataforma")
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
      } else if (data && data.value) {
        const val = data.value as any;
        setEmpresaPlataforma({
          razao_social: val.razao_social || "",
          cnpj: val.cnpj || "",
          telefone: val.telefone || "",
          email: val.email || "",
          endereco: val.endereco || ""
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmpresa(false);
    }
  };

  const handleSaveEmpresaPlataforma = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmpresa(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "empresa_plataforma",
          value: empresaPlataforma,
          descricao: "Dados da Empresa contratante da plataforma"
        });

      if (error) {
        toast.error(`Erro ao salvar dados: ${error.message}`);
      } else {
        toast.success("Dados da empresa salvos com sucesso!");
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSavingEmpresa(false);
    }
  };

  // Form states for admin creation
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminTelefone, setAdminTelefone] = useState("");
  const [adminSubmitLoading, setAdminSubmitLoading] = useState(false);

  // Selected technician details / edit states
  const [selectedTecnico, setSelectedTecnico] = useState<any | null>(null);
  const [tecnicoDocs, setTecnicoDocs] = useState<any[]>([]);
  const [tecnicoSkills, setTecnicoSkills] = useState<any[]>([]);
  const [loadingDocsAndSkills, setLoadingDocsAndSkills] = useState(false);

  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editRankingScore, setEditRankingScore] = useState(5);
  const [editCpf, setEditCpf] = useState("");
  const [editRg, setEditRg] = useState("");
  const [editLaboratorioPadraoId, setEditLaboratorioPadraoId] = useState("");
  const [editRaioAtuacaoKm, setEditRaioAtuacaoKm] = useState(50);
  const [editSkills, setEditSkills] = useState<{ servico_id: string; nivel: number }[]>([]);
  const [editSubmitLoading, setEditSubmitLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Document upload states
  const [documentName, setDocumentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Preview state
  const [adminPreviewUrl, setAdminPreviewUrl] = useState<string | null>(null);
  const [adminPreviewType, setAdminPreviewType] = useState<string | null>(null);

  // CRUD check-in locations states
  const [locais, setLocais] = useState<any[]>([]);
  const [loadingLocais, setLoadingLocais] = useState(false);
  const [localNome, setLocalNome] = useState("");
  const [localTipo, setLocalTipo] = useState("Laboratorio");
  const [localEndereco, setLocalEndereco] = useState("");
  const [localNumero, setLocalNumero] = useState("");
  const [localBairro, setLocalBairro] = useState("");
  const [localCidade, setLocalCidade] = useState("");
  const [localEstado, setLocalEstado] = useState("");
  const [localLat, setLocalLat] = useState("");
  const [localLng, setLocalLng] = useState("");
  const [submittingLocal, setSubmittingLocal] = useState(false);
  const [showLocalDialog, setShowLocalDialog] = useState(false);
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [localCep, setLocalCep] = useState("");
  const [fetchingCep, setFetchingCep] = useState(false);

  // Alerts states
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [alertSupportDialogOpen, setAlertSupportDialogOpen] = useState(false);
  const [selectedAlerta, setSelectedAlerta] = useState<any | null>(null);

  // Blocker requests states
  const [blockerRequests, setBlockerRequests] = useState<any[]>([]);
  const [loadingBlockers, setLoadingBlockers] = useState(false);

  // States for creating a blocker/holiday
  const [showBlockerDialog, setShowBlockerDialog] = useState(false);
  const [blockerTecnicoId, setBlockerTecnicoId] = useState("global");
  const [blockerDataInicio, setBlockerDataInicio] = useState("");
  const [blockerDataFim, setBlockerDataFim] = useState("");
  const [blockerTipo, setBlockerTipo] = useState("Feriado");
  const [blockerDescricao, setBlockerDescricao] = useState("");
  const [submittingBlocker, setSubmittingBlocker] = useState(false);

  const fetchBlockerRequests = async () => {
    setLoadingBlockers(true);
    try {
      const { data, error } = await supabase
        .from("bloqueios_tecnicos")
        .select("*, tecnico:tecnicos(nome)")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setBlockerRequests(data);
      }
    } catch (err) {
      console.error("Error fetching blocker requests:", err);
    } finally {
      setLoadingBlockers(false);
    }
  };

  const handleResolveBlocker = async (blockerId: string, status: 'Aprovado' | 'Rejeitado') => {
    try {
      await updateBlockerStatus({
        data: {
          blockerId,
          status
        }
      });
      toast.success(`Solicitação de bloqueio ${status === 'Aprovado' ? 'aprovada' : 'rejeitada'} com sucesso!`);
      await fetchBlockerRequests();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao resolver solicitação de bloqueio.");
    }
  };

  const handleCreateBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockerDataInicio || !blockerDataFim) {
      toast.error("Por favor, preencha as datas de início e fim.");
      return;
    }

    setSubmittingBlocker(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id || null;

      const newBlocker = {
        tecnico_id: blockerTecnicoId === "global" ? null : blockerTecnicoId,
        data_inicio: blockerDataInicio,
        data_fim: blockerDataFim,
        tipo: blockerTipo,
        descricao: blockerDescricao || null,
        status: "Aprovado",
        resolvido_em: new Date().toISOString(),
        resolvido_por: currentUserId
      };

      const { error } = await supabase
        .from("bloqueios_tecnicos")
        .insert(newBlocker);

      if (error) throw error;

      toast.success("Bloqueio/Feriado criado e aprovado com sucesso!");
      setShowBlockerDialog(false);
      
      // Reset form
      setBlockerTecnicoId("global");
      setBlockerDataInicio("");
      setBlockerDataFim("");
      setBlockerTipo("Feriado");
      setBlockerDescricao("");
      
      await fetchBlockerRequests();
    } catch (err: any) {
      console.error("Erro ao criar bloqueio:", err);
      toast.error(err?.message || "Erro ao criar bloqueio.");
    } finally {
      setSubmittingBlocker(false);
    }
  };

  const handleDeleteBlocker = async (blockerId: string) => {
    if (!confirm("Deseja realmente excluir este bloqueio/folga?")) return;
    try {
      const { error } = await supabase
        .from("bloqueios_tecnicos")
        .delete()
        .eq("id", blockerId);
      if (error) throw error;
      toast.success("Bloqueio/folga excluído com sucesso!");
      await fetchBlockerRequests();
    } catch (err: any) {
      console.error("Erro ao excluir bloqueio:", err);
      toast.error(err?.message || "Erro ao excluir bloqueio.");
    }
  };

  const fetchTecnicos = async () => {
    try {
      const { data, error } = await supabase
        .from("tecnicos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      if (data) setTecnicos(data);
    } catch (err) {
      console.error("Error fetching tecnicos:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("servicos_catalogo_pub")
        .select("*")
        .eq("ativo", true)
        .order("nome_servico", { ascending: true });
      if (error) throw error;
      if (data) setAvailableServices(data);
    } catch (err) {
      console.error("Error fetching services:", err);
    }
  };

  const fetchTecnicoDocsAndSkills = async (tecId: string) => {
    setLoadingDocsAndSkills(true);
    try {
      const [docsRes, skillsRes] = await Promise.all([
        supabase.from("documentos_tecnicos").select("*").eq("tecnico_id", tecId),
        supabase.from("habilidades_tecnicos").select("*, servico:servicos_catalogo_pub(*)").eq("tecnico_id", tecId)
      ]);
      if (docsRes.error) throw docsRes.error;
      if (skillsRes.error) throw skillsRes.error;
      setTecnicoDocs(docsRes.data || []);
      setTecnicoSkills(skillsRes.data || []);
      setEditSkills((skillsRes.data || []).map((s: any) => ({
        servico_id: s.servico_id,
        nivel: s.nivel_conhecimento
      })));
    } catch (err) {
      console.error("Error fetching docs/skills:", err);
      toast.error("Erro ao carregar documentos e habilidades.");
    } finally {
      setLoadingDocsAndSkills(false);
    }
  };

  const fetchLocais = async () => {
    setLoadingLocais(true);
    try {
      const { data, error } = await supabase
        .from("locais_checkin")
        .select("*")
        .order("nome", { ascending: true });
      if (!error && data) setLocais(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLocais(false);
    }
  };

  const fetchAlertas = async () => {
    setLoadingAlertas(true);
    try {
      const { data, error } = await supabase
        .from("alertas_gestao")
        .select("*, agendamento:agendamentos_medicoes(*, obra:obras(*)), tecnico:tecnicos(*)")
        .eq("resolvido", false)
        .order("created_at", { ascending: false });
      if (!error && data) setAlertas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAlertas(false);
    }
  };

  useEffect(() => {
    fetchTecnicos();
    fetchServices();
    fetchLocais();
    fetchAlertas();
    fetchBlockerRequests();
    fetchEmpresaPlataforma();
  }, []);

  useEffect(() => {
    if (selectedTecnico) {
      fetchTecnicoDocsAndSkills(selectedTecnico.id);
      setEditNome(selectedTecnico.nome);
      setEditEmail(selectedTecnico.email || "");
      setEditStatus(selectedTecnico.status);
      setEditRankingScore(selectedTecnico.ranking_score || 5);
      setEditCpf(selectedTecnico.cpf || "");
      setEditRg(selectedTecnico.rg || "");
      setEditLaboratorioPadraoId(selectedTecnico.laboratorio_padrao_id || "");
      setEditRaioAtuacaoKm(Number(selectedTecnico.raio_atuacao_km) || 50);
      setAdminPreviewUrl(null);
      setAdminPreviewType(null);
      setSelectedFile(null);
      setIsEditing(false);
    } else {
      setTecnicoDocs([]);
      setTecnicoSkills([]);
      setEditSkills([]);
      setEditEmail("");
      setEditLaboratorioPadraoId("");
      setEditRaioAtuacaoKm(50);
      setAdminPreviewUrl(null);
      setAdminPreviewType(null);
      setSelectedFile(null);
      setIsEditing(false);
    }
  }, [selectedTecnico]);

  const toggleSkill = (serviceId: string) => {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.servico_id === serviceId);
      if (exists) return prev.filter(s => s.servico_id !== serviceId);
      return [...prev, { servico_id: serviceId, nivel: 5 }];
    });
  };

  const updateSkillLevel = (serviceId: string, level: number) => {
    setSelectedSkills(prev =>
      prev.map(s => s.servico_id === serviceId ? { ...s, nivel: level } : s)
    );
  };

  const toggleEditSkill = (serviceId: string) => {
    setEditSkills(prev => {
      const exists = prev.find(s => s.servico_id === serviceId);
      if (exists) return prev.filter(s => s.servico_id !== serviceId);
      return [...prev, { servico_id: serviceId, nivel: 5 }];
    });
  };

  const updateEditSkillLevel = (serviceId: string, level: number) => {
    setEditSkills(prev =>
      prev.map(s => s.servico_id === serviceId ? { ...s, nivel: level } : s)
    );
  };

  const handleSelectAdminPreview = (url: string, name: string) => {
    setAdminPreviewUrl(url);
    const lowerUrl = url.toLowerCase();
    const lowerName = name.toLowerCase();
    if (lowerUrl.includes(".pdf") || lowerName.includes(".pdf") || url.startsWith("data:application/pdf")) {
      setAdminPreviewType("pdf");
    } else if (
      lowerUrl.includes(".png") || lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg") || lowerUrl.includes(".webp") ||
      lowerUrl.startsWith("data:image/") || lowerName.includes(".png") || lowerName.includes(".jpg") || lowerName.includes(".jpeg") || lowerName.includes(".webp")
    ) {
      setAdminPreviewType("image");
    } else {
      setAdminPreviewType("other");
    }
  };

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const res = await registerTechnician({
        data: {
          nome,
          email,
          password,
          telefone,
          cpf,
          rg,
          laboratorioPadraoId: laboratorioPadraoId || null,
          raioAtuacaoKm: Number(raioAtuacaoKm) || 50,
          habilidades: selectedSkills,
        }
      });
      if (res.success) {
        toast.success("Técnico cadastrado com sucesso!");
        setDialogOpen(false);
        // Reset form
        setNome("");
        setEmail("");
        setPassword("");
        setTelefone("");
        setCpf("");
        setRg("");
        setLaboratorioPadraoId("");
        setRaioAtuacaoKm(50);
        setSelectedSkills([]);
        // Refetch list
        fetchTecnicos();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar técnico.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateTechnician = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTecnico) return;
    setEditSubmitLoading(true);
    try {
      const res = await updateTechnician({
        data: {
          id: selectedTecnico.id,
          nome: editNome,
          email: editEmail,
          status: editStatus,
          ranking_score: Number(editRankingScore),
          cpf: editCpf || null,
          rg: editRg || null,
          laboratorioPadraoId: editLaboratorioPadraoId || null,
          raioAtuacaoKm: Number(editRaioAtuacaoKm) || 50,
          habilidades: editSkills
        }
      });
      if (res.success) {
        toast.success("Técnico atualizado com sucesso!");
        fetchTecnicos();
        const updated = {
          ...selectedTecnico,
          nome: editNome,
          email: editEmail,
          status: editStatus,
          ranking_score: Number(editRankingScore),
          cpf: editCpf || null,
          rg: editRg || null,
          laboratorio_padrao_id: editLaboratorioPadraoId || null,
          raio_atuacao_km: Number(editRaioAtuacaoKm) || 50
        };
        setSelectedTecnico(updated);
        fetchTecnicoDocsAndSkills(selectedTecnico.id);
        setIsEditing(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar técnico.");
    } finally {
      setEditSubmitLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !selectedTecnico) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      toast.error("O arquivo excede o limite máximo de 5MB.");
      return;
    }

    const docName = documentName.trim() || selectedFile.name.split(".")[0];
    setUploadingDoc(true);
    try {
      const fileUrl = await uploadPhotoOrBase64(selectedFile);
      const res = await addTechnicianDocument({
        data: {
          tecnicoId: selectedTecnico.id,
          nomeDocumento: docName,
          urlDocumento: fileUrl
        }
      });
      if (res.success) {
        toast.success("Documento adicionado com sucesso!");
        setDocumentName("");
        setSelectedFile(null);
        const fileInput = document.getElementById("doc-file") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        fetchTecnicoDocsAndSkills(selectedTecnico.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao fazer upload do documento.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Deseja realmente excluir este documento?")) return;
    try {
      const res = await deleteTechnicianDocument({
        data: {
          documentId: docId
        }
      });
      if (res.success) {
        toast.success("Documento excluído com sucesso!");
        if (selectedTecnico) {
          fetchTecnicoDocsAndSkills(selectedTecnico.id);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir documento.");
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSubmitLoading(true);
    try {
      const res = await registerAdmin({
        data: {
          nome: adminNome,
          email: adminEmail,
          password: adminPassword,
          telefone: adminTelefone || null,
        }
      });
      if (res.success) {
        if (res.isNewUser === false) {
          toast.success("Usuário existente promovido a administrador com sucesso!");
        } else {
          toast.success("Administrador cadastrado com sucesso!");
        }
        setAdminDialogOpen(false);
        // Reset form
        setAdminNome("");
        setAdminEmail("");
        setAdminPassword("");
        setAdminTelefone("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar administrador.");
    } finally {
      setAdminSubmitLoading(false);
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const clean = rawVal.replace(/\D/g, "");
    setLocalCep(rawVal);
    
    if (clean.length === 8) {
      setFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) {
          toast.error("CEP não encontrado.");
        } else {
          setLocalEndereco(data.logradouro || "");
          setLocalBairro(data.bairro || "");
          setLocalCidade(data.localidade || "");
          setLocalEstado(data.uf || "");
          toast.success("Endereço preenchido com sucesso pelo CEP!");
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
        toast.error("Erro ao buscar endereço pelo CEP.");
      } finally {
        setFetchingCep(false);
      }
    }
  };

  const handleGoogleMapsUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setGoogleMapsUrl(rawVal);
    if (!rawVal) return;

    const urlMatch = rawVal.match(/(https?:\/\/[^\s]+)/);
    let url = urlMatch ? urlMatch[1] : rawVal;

    let coords = parseGoogleMapsCoords(url);
    if (coords) {
      setLocalLat(coords.lat.toString());
      setLocalLng(coords.lng.toString());
      toast.success("Coordenadas extraídas com sucesso!");
      return;
    }

    const isActuallyShort = url.includes("maps.app.goo.gl") || url.includes("g.co") || url.includes("goo.gl");
    
    if (isActuallyShort) {
      toast.loading("Resolvendo link curto do Google Maps...", { id: "resolve-maps" });
      try {
        const res = await resolveMapsUrl({ data: { url } });
        toast.dismiss("resolve-maps");
        if (res && res.resolvedUrl) {
          const resolvedCoords = parseGoogleMapsCoords(res.resolvedUrl);
          if (resolvedCoords) {
            setLocalLat(resolvedCoords.lat.toString());
            setLocalLng(resolvedCoords.lng.toString());
            toast.success("Coordenadas extraídas do link curto!");
          } else {
            toast.warning("Link resolvido, mas não encontramos as coordenadas na URL final.");
          }
        } else {
          toast.error("Não foi possível resolver o link curto.");
        }
      } catch (err: any) {
        toast.dismiss("resolve-maps");
        console.error("Erro ao resolver URL:", err);
        toast.error("Erro ao resolver o link curto.");
      }
    }
  };

  const handleVerifyLocation = async () => {
    let url = googleMapsUrl.trim();
    
    // If no URL is provided, but we have address, we can search for it on Google Maps
    if (!url) {
      const addressParts = [
        localEndereco,
        localNumero,
        localBairro,
        localCidade,
        localEstado
      ].filter(Boolean);

      if (addressParts.length > 0) {
        const queryStr = addressParts.join(", ");
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
        setGoogleMapsUrl(url);
        toast.info("Abrindo busca por endereço no Google Maps.");
      } else {
        toast.warning("Insira um link do Google Maps ou preencha o CEP/Endereço primeiro.");
        return;
      }
    }

    // Clean URL matches
    const urlMatch = url.match(/(https?:\/\/[^\s]+)/);
    let resolvedTargetUrl = urlMatch ? urlMatch[1] : url;

    // 1. Open the URL in a new tab so the user can verify
    window.open(resolvedTargetUrl, '_blank');

    // 2. Try to pull coordinates from the URL (directly or via short url resolution)
    let coords = parseGoogleMapsCoords(resolvedTargetUrl);
    if (coords) {
      setLocalLat(coords.lat.toString());
      setLocalLng(coords.lng.toString());
      toast.success("Coordenadas extraídas com sucesso!");
      return;
    }

    const isActuallyShort = resolvedTargetUrl.includes("maps.app.goo.gl") || 
                            resolvedTargetUrl.includes("g.co") || 
                            resolvedTargetUrl.includes("goo.gl");
    
    if (isActuallyShort) {
      toast.loading("Resolvendo link curto e buscando coordenadas...", { id: "resolve-maps-verify" });
      try {
        const res = await resolveMapsUrl({ data: { url: resolvedTargetUrl } });
        toast.dismiss("resolve-maps-verify");
        if (res && res.resolvedUrl) {
          const resolvedCoords = parseGoogleMapsCoords(res.resolvedUrl);
          if (resolvedCoords) {
            setLocalLat(resolvedCoords.lat.toString());
            setLocalLng(resolvedCoords.lng.toString());
            toast.success("Coordenadas extraídas com sucesso após resolver o link!");
          } else {
            toast.warning("Link aberto no navegador! Mas não foi possível extrair coordenadas automaticamente. Insira-as manualmente.");
          }
        } else {
          toast.error("Não foi possível resolver o link curto.");
        }
      } catch (err: any) {
        toast.dismiss("resolve-maps-verify");
        console.error("Erro ao resolver URL:", err);
        toast.error("Erro ao resolver o link curto.");
      }
    } else {
      toast.warning("Link aberto no navegador! Mas não detectamos coordenadas na URL. Insira-as manualmente.");
    }
  };

  const handleSaveLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLocal(true);
    try {
      let finalLat = localLat;
      let finalLng = localLng;

      if (googleMapsUrl) {
        const coords = parseGoogleMapsCoords(googleMapsUrl);
        if (coords) {
          finalLat = coords.lat.toString();
          finalLng = coords.lng.toString();
        } else {
          toast.warning("Não conseguimos extrair as coordenadas do link do Maps. Por favor, insira manualmente ou certifique-se de que o link contém '@latitude,longitude'.");
        }
      }

      const localData = {
        nome: localNome,
        tipo: localTipo,
        endereco: localEndereco,
        numero: localNumero || null,
        bairro: localBairro || null,
        cidade: localCidade,
        estado: localEstado,
        cep: localCep || null,
        latitude: finalLat !== "" ? Number(finalLat) : null,
        longitude: finalLng !== "" ? Number(finalLng) : null,
      };

      if (editingLocalId) {
        const { error } = await supabase
          .from("locais_checkin")
          .update(localData)
          .eq("id", editingLocalId);
        if (error) throw error;
        toast.success("Local de check-in atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("locais_checkin")
          .insert(localData);
        if (error) throw error;
        toast.success("Local de check-in cadastrado com sucesso!");
      }

      setShowLocalDialog(false);
      
      // Reset form
      setLocalNome("");
      setLocalTipo("Laboratorio");
      setLocalEndereco("");
      setLocalNumero("");
      setLocalBairro("");
      setLocalCidade("");
      setLocalEstado("");
      setLocalLat("");
      setLocalLng("");
      setGoogleMapsUrl("");
      setLocalCep("");
      setEditingLocalId(null);
      
      fetchLocais();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar local.");
    } finally {
      setSubmittingLocal(false);
    }
  };

  const handleEditLocalClick = (loc: any) => {
    setEditingLocalId(loc.id);
    setLocalNome(loc.nome);
    setLocalTipo(loc.tipo);
    setLocalEndereco(loc.endereco);
    setLocalNumero(loc.numero || "");
    setLocalBairro(loc.bairro || "");
    setLocalCidade(loc.cidade);
    setLocalEstado(loc.estado);
    setLocalCep(loc.cep || "");
    setLocalLat(loc.latitude !== null ? loc.latitude.toString() : "");
    setLocalLng(loc.longitude !== null ? loc.longitude.toString() : "");
    setGoogleMapsUrl("");
    setShowLocalDialog(true);
  };

  const handleAddLocalClick = () => {
    setEditingLocalId(null);
    setLocalNome("");
    setLocalTipo("Laboratorio");
    setLocalEndereco("");
    setLocalNumero("");
    setLocalBairro("");
    setLocalCidade("");
    setLocalEstado("");
    setLocalLat("");
    setLocalLng("");
    setGoogleMapsUrl("");
    setLocalCep("");
    setShowLocalDialog(true);
  };

  const handleDeleteLocal = async (localId: string) => {
    if (!confirm("Deseja realmente excluir este local de check-in?")) return;
    try {
      const { error } = await supabase
        .from("locais_checkin")
        .delete()
        .eq("id", localId);
      if (error) throw error;
      toast.success("Local excluído com sucesso!");
      fetchLocais();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir local.");
    }
  };

  const handleRegisterAlertSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlerta) return;
    try {
      // 1. Insert temporary location for check-in
      const { error: locErr } = await supabase.from("locais_checkin").insert({
        nome: localNome,
        tipo: localTipo,
        endereco: localEndereco,
        numero: localNumero || null,
        bairro: localBairro || null,
        cidade: localCidade,
        estado: localEstado,
        latitude: localLat !== "" ? Number(localLat) : null,
        longitude: localLng !== "" ? Number(localLng) : null,
        tecnico_id: selectedAlerta.tecnico_id,
        agendamento_id: selectedAlerta.agendamento_id
      });

      if (locErr) throw locErr;

      // 2. Resolve the alert
      await resolveAlert({ data: { alertId: selectedAlerta.id } });

      toast.success("Hospedagem cadastrada e alerta resolvido com sucesso!");
      setAlertSupportDialogOpen(false);
      
      // Reset form fields
      setLocalNome("");
      setLocalTipo("Hotel");
      setLocalEndereco("");
      setLocalNumero("");
      setLocalBairro("");
      setLocalCidade("");
      setLocalEstado("");
      setLocalLat("");
      setLocalLng("");
      
      fetchLocais();
      fetchAlertas();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao vincular hospedagem.");
    }
  };

  // Sidebar nav items definition
  const sidebarItems = [
    { id: "agendamentos",    label: "Gestão de Escala",         icon: ClipboardList, onClick: () => { setActiveTab("agendamentos"); fetchAdminAgendamentos(); }, badge: adminAgendamentos.filter(a => ["Pendente_Aprovacao_Gestor","Pendente_Tecnico"].includes(a.status_agendamento)).length || undefined },
    { id: "tecnicos",        label: "Gestão de Técnicos",      icon: Users,        onClick: () => { setActiveTab("tecnicos"); } },
    { id: "obras",           label: "Gestão de Obras",         icon: HardHat,      onClick: () => { setActiveTab("obras"); fetchObrasGestor(); fetchEmpresasClientes(); } },
    { id: "clientes",        label: "Gestão de Clientes",      icon: Building2,    onClick: () => { setActiveTab("clientes"); fetchEmpresasClientes(); } },
    { id: "locais",          label: "Locais de Check-in",      icon: MapPin,        onClick: () => { setActiveTab("locais"); fetchLocais(); } },
    { id: "alertas",         label: "Alertas de Escopo",       icon: AlertTriangle, onClick: () => { setActiveTab("alertas"); fetchAlertas(); }, badge: alertas.length > 0 ? alertas.length : undefined },
    { id: "alertas-escala",  label: "Alertas de Escala",       icon: Clock,         onClick: () => { setActiveTab("alertas-escala"); fetchScaleAlerts(); } },
    { id: "bloqueios",       label: "Bloqueios e Folgas",      icon: Settings2,    onClick: () => { setActiveTab("bloqueios"); fetchBlockerRequests(); }, badge: blockerRequests.filter(b => b.status === "Pendente").length || undefined },
    { id: "meus-dados",      label: "Meus Dados",              icon: Building2,    onClick: () => { setActiveTab("meus-dados"); fetchEmpresaPlataforma(); } },
    { id: "configuracoes",   label: "Configurações Globais",   icon: Settings,     onClick: () => { setActiveTab("configuracoes"); handleLoadGlobalConfigs(); } },
    { id: "produtos",        label: "Produtos e Serviços",     icon: FlaskConical,  onClick: () => { setActiveTab("produtos"); fetchAllServicos(); } },
    { id: "financeiro",      label: "Módulo Financeiro",       icon: BarChart3,    onClick: () => { setActiveTab("financeiro"); fetchFinancialSummary(); } },
  ];

  return (
    <div className="flex -mx-4 -mt-8 min-h-[calc(100vh-4rem)] animate-in fade-in-50 duration-200">

      {/* ══ SIDEBAR ESQUERDA FIXA ══ */}
      <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col sticky top-0 h-screen overflow-y-auto z-10">
        <div className="p-5 border-b border-border bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-primary/20 grid place-items-center">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground leading-tight">Painel do Gestor</h2>
              <p className="text-[10px] text-muted-foreground">Administração</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-${item.id}`}
                onClick={() => { item.onClick(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left group ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-red-500 text-white"
                  }`}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ══ CONTEÚDO PRINCIPAL ══ */}
      <main className="flex-1 min-w-0 p-8 overflow-y-auto">

        {/* ── PAINEL: GESTÃO DE ESCALA ── */}
        {activeTab === "agendamentos" && (
          <div className="space-y-5 -mx-4 -mt-4 px-6 pt-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <ClipboardList className="h-6 w-6 text-primary" />
                  Gestão de Escala
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Visão completa de todos os agendamentos. Aloque técnicos, acompanhe execuções e monitore o status em tempo real.</p>
              </div>
              <button
                onClick={fetchAdminAgendamentos}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-accent/50 transition-all font-medium"
              >
                <span className="text-base leading-none">↻</span> Atualizar
              </button>
            </div>

            {/* KPI Strip */}
            {!loadingAdminAgend && (() => {
              const pendAlloc = adminAgendamentos.filter(a => a.status_agendamento === "Pendente_Aprovacao_Gestor").length;
              const pendTec   = adminAgendamentos.filter(a => a.status_agendamento === "Pendente_Tecnico").length;
              const confirmed = adminAgendamentos.filter(a => a.status_agendamento === "Confirmado").length;
              const running   = adminAgendamentos.filter(a => a.status_agendamento === "Em_Execucao").length;
              const done      = adminAgendamentos.filter(a => ["Validado","Aguardando_Medicao","Laboratorio"].includes(a.status_agendamento)).length;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: "Aguardando Alocação", count: pendAlloc, color: "border-l-orange-500", textColor: "text-orange-600", bg: "bg-orange-500/5", filter: "Pendente_Aprovacao_Gestor", urgent: pendAlloc > 0 },
                    { label: "Pendente Técnico",    count: pendTec,   color: "border-l-yellow-500", textColor: "text-yellow-600", bg: "bg-yellow-500/5",  filter: "Pendente_Tecnico" },
                    { label: "Confirmados",         count: confirmed, color: "border-l-emerald-500",textColor: "text-emerald-600",bg: "bg-emerald-500/5", filter: "Confirmado" },
                    { label: "Em Execução",         count: running,   color: "border-l-blue-500",   textColor: "text-blue-600",   bg: "bg-blue-500/5",    filter: "Em_Execucao" },
                    { label: "Concluídos",          count: done,      color: "border-l-purple-500", textColor: "text-purple-600", bg: "bg-purple-500/5",  filter: "concluidos" },
                  ].map((kpi) => (
                    <button
                      key={kpi.filter}
                      onClick={() => setAdminAgendStatusFilter(kpi.filter)}
                      className={`text-left p-4 rounded-xl border-l-4 border border-border ${kpi.color} ${kpi.bg} transition-all hover:shadow-sm ${
                        adminAgendStatusFilter === kpi.filter ? "ring-2 ring-primary/40 shadow-sm" : ""
                      } ${kpi.urgent ? "animate-pulse" : ""}`}
                    >
                      <p className={`text-2xl font-extrabold ${kpi.textColor}`}>{kpi.count}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{kpi.label}</p>
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              {[
                { label: "Todos", value: "todos" },
                { label: "🟠 Aguardando Alocação", value: "Pendente_Aprovacao_Gestor" },
                { label: "🟡 Pendente Técnico",    value: "Pendente_Tecnico" },
                { label: "🟢 Confirmados",         value: "Confirmado" },
                { label: "🔵 Em Execução",         value: "Em_Execucao" },
                { label: "🟣 Aguardando Medição",  value: "Aguardando_Medicao" },
                { label: "✅ Concluídos",          value: "concluidos" },
                { label: "❌ Cancelados",          value: "Cancelado" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setAdminAgendStatusFilter(f.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                    adminAgendStatusFilter === f.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Agendamentos List */}
            {loadingAdminAgend ? (
              <div className="grid gap-3">
                {[1,2,3].map(i => (
                  <div key={i} className="border border-border rounded-xl bg-card p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted/60 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : (() => {
              const concluidos_statuses = ["Validado", "Aguardando_Medicao", "Laboratorio"];
              const filtered = adminAgendStatusFilter === "todos"
                ? adminAgendamentos
                : adminAgendStatusFilter === "concluidos"
                ? adminAgendamentos.filter(a => concluidos_statuses.includes(a.status_agendamento))
                : adminAgendamentos.filter(a => a.status_agendamento === adminAgendStatusFilter);

              const sortedFiltered = [...filtered].sort((a, b) => {
                const priority: Record<string, number> = {
                  Pendente_Aprovacao_Gestor: 0,
                  Pendente_Tecnico: 1,
                  Em_Execucao: 2,
                  Confirmado: 3,
                  Aguardando_Medicao: 4,
                  Validado: 5,
                  Laboratorio: 6,
                  Cancelado: 7,
                };
                const pa = priority[a.status_agendamento] ?? 9;
                const pb = priority[b.status_agendamento] ?? 9;
                if (pa !== pb) return pa - pb;
                return new Date(a.data_servico).getTime() - new Date(b.data_servico).getTime();
              });

              return sortedFiltered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  Nenhum agendamento encontrado com este filtro.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortedFiltered.map((ag) => {
                    const isPendingAlloc = ag.status_agendamento === "Pendente_Aprovacao_Gestor";
                    const isPendingTec   = ag.status_agendamento === "Pendente_Tecnico";
                    const isRunning      = ag.status_agendamento === "Em_Execucao";
                    const isConfirmed    = ag.status_agendamento === "Confirmado";
                    const statusStyle = isPendingAlloc
                      ? "border-l-orange-500 bg-orange-500/5"
                      : isPendingTec
                      ? "border-l-yellow-400 bg-yellow-500/5"
                      : isRunning
                      ? "border-l-blue-500 bg-blue-500/5"
                      : isConfirmed
                      ? "border-l-emerald-500 bg-emerald-500/5"
                      : ag.status_agendamento === "Aguardando_Medicao"
                      ? "border-l-purple-500 bg-purple-500/5"
                      : "border-l-border bg-card";

                    return (
                      <div
                        key={ag.id}
                        className={`border border-border border-l-4 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm transition-all ${statusStyle}`}
                      >
                        {/* Left: booking info */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground truncate">{ag.obra?.nome_obra || "Obra"}</span>
                            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              STATUS_COLORS[ag.status_agendamento] || "bg-muted text-muted-foreground border-border"
                            }`}>
                              {STATUS_LABELS[ag.status_agendamento] || ag.status_agendamento}
                            </span>
                            {isPendingAlloc && (
                              <span className="text-[10px] bg-orange-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
                                ⚡ Alocar Agora
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{ag.servico?.nome_servico || "Serviço"}</span>
                            <span>📋 {ag.codigo_pedido}</span>
                            <span>📅 {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0,5)}</span>
                            <span>📍 {ag.obra?.cidade || "-"}/{ag.obra?.estado || ""}</span>
                            <span>🔬 {ag.cps_contratados} CPs</span>
                            <span>💰 R$ {Number(ag.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Technician row */}
                          <div className="flex items-center gap-2">
                            {ag.tecnico ? (
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                                <Users className="h-3 w-3" />
                                {ag.tecnico.nome}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                                <Users className="h-3 w-3" />
                                Sem técnico alocado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: actions */}
                        <div className="flex gap-2 items-center shrink-0">
                          {isPendingAlloc && (
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 shadow-sm"
                              onClick={() => handleOpenAllocModal(ag)}
                            >
                              <Users className="h-3.5 w-3.5" />
                              Alocar Técnico
                            </Button>
                          )}
                          {(isPendingTec || isConfirmed || isRunning) && ag.tecnico && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-medium gap-1.5 text-xs"
                              onClick={() => handleOpenAllocModal(ag)}
                            >
                              <Edit className="h-3 w-3" />
                              Trocar Técnico
                            </Button>
                          )}
                          {(isPendingTec || isConfirmed) && !ag.tecnico && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-medium gap-1.5 text-xs border-yellow-400 text-yellow-600 hover:bg-yellow-50"
                              onClick={() => handleOpenAllocModal(ag)}
                            >
                              <Users className="h-3 w-3" />
                              Alocar Manualmente
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Modal de Alocação de Técnico */}
            <Dialog open={allocModalOpen} onOpenChange={setAllocModalOpen}>
              <DialogContent className="max-w-md border border-border bg-card">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    Alocar Técnico
                  </DialogTitle>
                  <DialogDescription>
                    Selecione o técnico para este agendamento. Após confirmar, o status será alterado para <strong>Confirmado</strong> e o técnico será notificado via WhatsApp.
                  </DialogDescription>
                </DialogHeader>

                {allocBooking && (
                  <div className="bg-muted/40 rounded-xl p-4 text-xs space-y-2 border border-border">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground block">Obra</span><strong className="text-foreground">{allocBooking.obra?.nome_obra}</strong></div>
                      <div><span className="text-muted-foreground block">Serviço</span><strong className="text-foreground">{allocBooking.servico?.nome_servico}</strong></div>
                      <div><span className="text-muted-foreground block">Data</span><strong className="text-foreground">{new Date(allocBooking.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {allocBooking.horario_na_obra?.substring(0,5)}</strong></div>
                      <div><span className="text-muted-foreground block">CPs</span><strong className="text-foreground">{allocBooking.cps_contratados}</strong></div>
                      <div><span className="text-muted-foreground block">Cidade</span><strong className="text-foreground">{allocBooking.obra?.cidade}</strong></div>
                      <div><span className="text-muted-foreground block">Valor</span><strong className="text-foreground">R$ {Number(allocBooking.valor_total||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div>
                    </div>
                    {allocBooking.tecnico && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-muted-foreground">Técnico atual: </span>
                        <strong className="text-primary">{allocBooking.tecnico.nome}</strong>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleAllocateTechnician} className="space-y-4 mt-1">
                  <div className="space-y-2">
                    <Label htmlFor="alloc-tecnico" className="text-sm font-semibold">Selecionar Técnico *</Label>
                    <select
                      id="alloc-tecnico"
                      value={allocTecnicoId}
                      onChange={(e) => setAllocTecnicoId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Escolha um técnico...</option>
                      {tecnicos.map((tec: any) => (
                        <option key={tec.id} value={tec.id}>
                          {tec.nome}{tec.especialidade ? ` — ${tec.especialidade}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <DialogFooter className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setAllocModalOpen(false)} disabled={allocating}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
                      disabled={allocating || !allocTecnicoId}
                    >
                      <Users className="h-4 w-4" />
                      {allocating ? "Confirmando..." : "Confirmar Alocação"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ── PAINEL: GESTÃO DE TÉCNICOS ── */}
        {/* ── PAINEL: GESTÃO DE TÉCNICOS ── */}
        {activeTab === "tecnicos" && <div className="space-y-6">
          <div className="flex justify-end gap-2 mb-4">
            {/* Modal Técnico */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 font-bold cursor-pointer">
                  <UserPlus className="h-4 w-4" />
                  Cadastrar Técnico
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-border bg-card">
                <DialogHeader>
                  <DialogTitle>Novo Técnico</DialogTitle>
                  <DialogDescription>Cadastre as credenciais de login e dados de campo do novo técnico.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTechnician} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao.tecnico@quantisobras.com.br" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Senha de Acesso (mínimo 6 caracteres)</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(15) 99999-9999" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="123.456.789-00" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rg">RG</Label>
                    <Input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} placeholder="12.345.678-9" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="lab-padrao">Laboratório Padrão</Label>
                      <select
                        id="lab-padrao"
                        value={laboratorioPadraoId}
                        onChange={(e) => setLaboratorioPadraoId(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">-- Sem Base Padrão --</option>
                        {locais
                          .filter((l) => l.tipo === "Laboratorio" && !l.agendamento_id)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="raio-atuacao">Raio de Atuação (km)</Label>
                      <Input
                        id="raio-atuacao"
                        type="number"
                        required
                        value={raioAtuacaoKm}
                        onChange={(e) => setRaioAtuacaoKm(Number(e.target.value))}
                        placeholder="Ex: 50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Habilidades e Serviços (Nível de Conhecimento 1 a 10)</Label>
                    <div className="border border-border rounded-lg p-3 space-y-3 max-h-48 overflow-y-auto bg-muted/20">
                      {availableServices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Carregando serviços disponíveis...</p>
                      ) : (
                        availableServices.map(svc => {
                          const skill = selectedSkills.find(s => s.servico_id === svc.id);
                          const isChecked = !!skill;
                          return (
                            <div key={svc.id} className="space-y-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`svc-reg-${svc.id}`}
                                  checked={isChecked}
                                  onChange={() => toggleSkill(svc.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-background"
                                />
                                <Label htmlFor={`svc-reg-${svc.id}`} className="text-xs font-semibold cursor-pointer text-foreground">
                                  {svc.nome_servico}
                                </Label>
                              </div>
                              {isChecked && (
                                <div className="flex items-center gap-3 pl-6">
                                  <span className="text-[10px] font-medium text-muted-foreground w-20">
                                    Nível: <span className="font-bold text-primary">{skill.nivel}</span>/10
                                  </span>
                                  <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={skill.nivel}
                                    onChange={(e) => updateSkillLevel(svc.id, parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitLoading}>Cancelar</Button>
                    <Button type="submit" disabled={submitLoading}>{submitLoading ? "Cadastrando..." : "Confirmar Cadastro"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Modal Administrador */}
            <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-bold cursor-pointer">
                  <ShieldCheck className="h-4 w-4" />
                  Cadastrar Administrador
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-border bg-card">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-500" />
                    Novo Administrador
                  </DialogTitle>
                  <DialogDescription>Cadastre as credenciais de acesso para um novo administrador da Quantis Obras.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateAdmin} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="admin-nome">Nome Completo</Label>
                    <Input id="admin-nome" required value={adminNome} onChange={(e) => setAdminNome(e.target.value)} placeholder="Ex: Felipe Medeiros" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-email">E-mail corporativo</Label>
                    <Input id="admin-email" type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="email@empresa.com" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-password">Senha de Acesso (mínimo 6 caracteres)</Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showAdminPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-telefone">Telefone / Contato</Label>
                    <Input id="admin-telefone" value={adminTelefone} onChange={(e) => setAdminTelefone(e.target.value)} placeholder="(15) 99999-9999" />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setAdminDialogOpen(false)} disabled={adminSubmitLoading}>Cancelar</Button>
                    <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-zinc-950 font-bold" disabled={adminSubmitLoading}>
                      {adminSubmitLoading ? "Cadastrando..." : "Confirmar Cadastro"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Grid de Resumo */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="border border-border bg-card">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Técnicos Ativos</p>
                <p className="text-3xl font-extrabold text-foreground mt-1">{tecnicos.length}</p>
              </CardContent>
            </Card>
            <Card className="border border-green-500/20 bg-green-500/5">
              <CardContent className="pt-5">
                <p className="text-xs text-green-600 font-medium uppercase tracking-wide font-bold">Disponíveis Hoje</p>
                <p className="text-3xl font-extrabold text-green-600 mt-1">
                  {tecnicos.filter(t => t.status === "Disponivel").length}
                </p>
              </CardContent>
            </Card>
            <Card className="border border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-5">
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wide font-bold">Em Campo</p>
                <p className="text-3xl font-extrabold text-amber-600 mt-1">
                  {tecnicos.filter(t => t.status === "Em_Campo").length}
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border bg-card">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Média de Avaliações</p>
                <p className="text-3xl font-extrabold text-foreground mt-1">
                  {tecnicos.length > 0
                    ? (tecnicos.reduce((acc, t) => acc + (t.ranking_score || 0), 0) / tecnicos.length).toFixed(1)
                    : "5.0"} ⭐
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Técnicos */}
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Técnicos Cadastrados</CardTitle>
              <CardDescription>Escala de profissionais ativos e habilitados para execução dos ensaios.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando técnicos...</div>
              ) : tecnicos.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">Nenhum técnico cadastrado ainda. Use o botão acima para adicionar.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground">
                        <th className="p-3">Nome</th>
                        <th className="p-3">CPF</th>
                        <th className="p-3">Certificações</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tecnicos.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-muted/20 text-foreground cursor-pointer transition-all"
                          onClick={() => setSelectedTecnico(t)}
                        >
                          <td className="p-3 font-semibold">{t.nome}</td>
                          <td className="p-3 font-mono">{t.cpf || "Não informado"}</td>
                          <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{t.certificacoes || "Sem certificações"}</td>
                          <td className="p-3 text-center font-bold text-amber-500">{t.ranking_score ? Number(t.ranking_score).toFixed(1) : "5.0"} ⭐</td>
                          <td className="p-3">
                            <Badge variant="outline" className={
                              t.status === "Disponivel" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                              t.status === "Em_Campo" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                              "bg-muted text-muted-foreground"
                            }>
                              {t.status === "Disponivel" ? "Disponível" : t.status === "Em_Campo" ? "Em Campo" : "De Folga"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTecnico(t);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>}

        {/* ── PAINEL: LOCAIS DE CHECK-IN ── */}
        {activeTab === "locais" && <div className="space-y-6">
          <div className="flex justify-end mb-4">
            <Dialog open={showLocalDialog} onOpenChange={setShowLocalDialog}>
              <Button className="gap-2 bg-primary hover:bg-primary/90 font-bold cursor-pointer" onClick={handleAddLocalClick}>
                <Plus className="h-4 w-4" />
                Cadastrar Local
              </Button>
              <DialogContent className="max-w-md border border-border bg-card">
                <DialogHeader>
                  <DialogTitle>{editingLocalId ? "Editar Local de Check-in" : "Novo Local de Check-in"}</DialogTitle>
                  <DialogDescription>
                    {editingLocalId ? "Edite as informações do local de check-in." : "Cadastre laboratórios, hotéis ou pontos de partida para check-in."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveLocal} className="space-y-4 pt-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5 col-span-1">
                      <Label htmlFor="loc-cep">CEP</Label>
                      <Input
                        id="loc-cep"
                        value={localCep}
                        onChange={handleCepChange}
                        placeholder="Ex: 18035-000"
                        disabled={fetchingCep}
                        className={fetchingCep ? "animate-pulse" : ""}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="loc-nome">Nome do Local</Label>
                      <Input id="loc-nome" required value={localNome} onChange={(e) => setLocalNome(e.target.value)} placeholder="Ex: Laboratório Central Sorocaba" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="loc-tipo">Tipo do Ponto</Label>
                    <select
                      id="loc-tipo"
                      value={localTipo}
                      onChange={(e) => setLocalTipo(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Laboratorio">Laboratório / Barracão</option>
                      <option value="Hotel">Hotel / Hospedagem</option>
                      <option value="Apoio">Ponto de Apoio / Obra Central</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-end">Endereço (Rua/Av.)</Label>
                    <Input id="loc-end" required value={localEndereco} onChange={(e) => setLocalEndereco(e.target.value)} placeholder="Ex: Rodovia Raposo Tavares" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="loc-num">Número</Label>
                      <Input id="loc-num" value={localNumero} onChange={(e) => setLocalNumero(e.target.value)} placeholder="Ex: Km 104" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="loc-bair">Bairro</Label>
                      <Input id="loc-bair" value={localBairro} onChange={(e) => setLocalBairro(e.target.value)} placeholder="Ex: Jardim Bandeirantes" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="loc-cid">Cidade</Label>
                      <Input id="loc-cid" required value={localCidade} onChange={(e) => setLocalCidade(e.target.value)} placeholder="Ex: Sorocaba" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="loc-est">Estado</Label>
                      <Input id="loc-est" required maxLength={2} value={localEstado} onChange={(e) => setLocalEstado(e.target.value)} placeholder="Ex: SP" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="loc-gmaps">Link do Google Maps (Extrai coordenadas automaticamente)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="loc-gmaps"
                        value={googleMapsUrl}
                        onChange={handleGoogleMapsUrlChange}
                        placeholder="Cole o link do Google Maps para extrair as coordenadas"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleVerifyLocation}
                        className="shrink-0 flex gap-1.5 items-center cursor-pointer bg-secondary hover:bg-secondary/80 text-foreground border border-input h-10 px-3 font-semibold text-xs"
                        title="Conferir a localização no Google Maps e puxar coordenadas"
                      >
                        <Eye className="h-4 w-4" />
                        Conferir
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Coordenadas Geográficas (Opcional)</Label>
                    <div className="flex items-end gap-2">
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <div className="space-y-1">
                          <Label htmlFor="loc-lat" className="text-[10px] text-muted-foreground">Latitude</Label>
                          <Input id="loc-lat" type="number" step="0.0000001" value={localLat} onChange={(e) => setLocalLat(e.target.value)} placeholder="Ex: -23.5015" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="loc-lng" className="text-[10px] text-muted-foreground">Longitude</Label>
                          <Input id="loc-lng" type="number" step="0.0000001" value={localLng} onChange={(e) => setLocalLng(e.target.value)} placeholder="Ex: -47.4526" />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-3 cursor-pointer shrink-0 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-indigo-900/50 dark:hover:bg-indigo-950/30"
                        title="Visualizar localização no Google Maps"
                        onClick={() => {
                          if (localLat && localLng) {
                            window.open(`https://www.google.com/maps/search/?api=1&query=${localLat},${localLng}`, '_blank');
                          } else {
                            toast.warning("Preencha a latitude e longitude primeiro.");
                          }
                        }}
                      >
                        <MapPin className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowLocalDialog(false)} disabled={submittingLocal}>Cancelar</Button>
                    <Button type="submit" disabled={submittingLocal}>{submittingLocal ? "Salvando..." : "Confirmar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Locais Registrados para Check-in</CardTitle>
              <CardDescription>Bases de apoio, laboratórios permanentes e hotéis credenciados para o início das escalas.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLocais ? (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando locais...</div>
              ) : locais.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">Nenhum local cadastrado. Use o botão acima para adicionar.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground">
                        <th className="p-3">Nome</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Endereço Completo</th>
                        <th className="p-3">Coordenadas (Lat/Lng)</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {locais.map((loc) => (
                        <tr key={loc.id} className="hover:bg-muted/10 text-foreground transition-all">
                          <td className="p-3 font-semibold">{loc.nome}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={
                              loc.tipo === "Laboratorio" ? "bg-teal-500/10 text-teal-600 border-teal-500/20" :
                              loc.tipo === "Hotel" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                              "bg-purple-500/10 text-purple-600 border-purple-500/20"
                            }>
                              {loc.tipo === "Laboratorio" ? "Laboratório / Barracão" :
                               loc.tipo === "Hotel" ? "Hotel / Hospedagem" :
                               loc.tipo === "Apoio" ? "B. Apoio / Obra" : "Outro"}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">
                            {loc.cep ? `CEP: ${loc.cep} · ` : ""}
                            {loc.endereco}, {loc.numero || "S/N"} - {loc.bairro}, {loc.cidade}/{loc.estado}
                          </td>
                          <td className="p-3 text-xs font-mono">
                            {loc.latitude !== null && loc.longitude !== null ? `${loc.latitude}, ${loc.longitude}` : "Não cadastradas"}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <div className="flex justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 p-1 cursor-pointer"
                                title="Checar localização no Google Maps"
                                onClick={() => {
                                  if (loc.latitude && loc.longitude) {
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`, '_blank');
                                  } else {
                                    toast.warning("Coordenadas não cadastradas para este local.");
                                  }
                                }}
                              >
                                <MapPin className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 p-1 cursor-pointer"
                                title="Editar local"
                                onClick={() => handleEditLocalClick(loc)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 cursor-pointer"
                                title="Excluir local"
                                onClick={() => handleDeleteLocal(loc.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>}

        {/* ── PAINEL: ALERTAS DE ESCOPO ── */}
        {activeTab === "alertas" && <div className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Alertas de Escopo Técnico</CardTitle>
              <CardDescription>Pendências de agendamentos aceitos fora do raio de atuação que necessitam de local de hospedagem ou apoio.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAlertas ? (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando pendências...</div>
              ) : alertas.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg bg-muted/10">
                  <CheckCircle2 className="h-8 w-8 text-green-500/40 mx-auto mb-2" />
                  Nenhum alerta pendente. Toda a logística dos técnicos está no raio correto.
                </div>
              ) : (
                <div className="space-y-4">
                  {alertas.map((alerta) => (
                    <div key={alerta.id} className="border-2 border-red-500/20 bg-red-500/5 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="destructive" className="font-bold">⚠️ Fora do Raio</Badge>
                          <span className="text-xs text-muted-foreground font-semibold font-mono">Agendamento: {alerta.agendamento?.codigo_pedido}</span>
                        </div>
                        <p className="text-sm font-semibold mt-1">{alerta.descricao}</p>
                        <p className="text-xs text-muted-foreground">Obra: {alerta.agendamento?.obra?.nome_obra} ({alerta.agendamento?.obra?.cidade}/{alerta.agendamento?.obra?.estado})</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                          onClick={() => {
                            setSelectedAlerta(alerta);
                            setLocalTipo("Hotel");
                            setLocalNome(`Hotel para ${alerta.tecnico?.nome} - ${alerta.agendamento?.obra?.cidade}`);
                            setLocalCidade(alerta.agendamento?.obra?.cidade || "");
                            setLocalEstado(alerta.agendamento?.obra?.estado || "SP");
                            setAlertSupportDialogOpen(true);
                          }}
                        >
                          Cadastrar Hospedagem
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-600 hover:bg-red-500/10 cursor-pointer font-semibold"
                          onClick={async () => {
                            if (confirm("Deseja realmente ignorar o alerta? O técnico poderá iniciar utilizando a opção 'Local sem definição'.")) {
                              try {
                                await resolveAlert({ data: { alertId: alerta.id } });
                                toast.info("Alerta resolvido.");
                                fetchAlertas();
                              } catch (err: any) {
                                toast.error(err?.message);
                              }
                            }
                          }}
                        >
                          Ignorar Alerta
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal Hospedagem Temporária do Alerta */}
          <Dialog open={alertSupportDialogOpen} onOpenChange={setAlertSupportDialogOpen}>
            <DialogContent className="max-w-md border border-border bg-card">
              <DialogHeader>
                <DialogTitle>Vincular Hospedagem / Base de Apoio</DialogTitle>
                <DialogDescription>
                  Cadastre o ponto de partida do técnico para este serviço específico para resolver a pendência logística.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRegisterAlertSupport} className="space-y-4 pt-2 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="h-nome">Nome da Hospedagem / Base</Label>
                  <Input id="h-nome" required value={localNome} onChange={(e) => setLocalNome(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-tipo">Tipo do Local</Label>
                  <select
                    id="h-tipo"
                    value={localTipo}
                    onChange={(e) => setLocalTipo(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background"
                  >
                    <option value="Hotel">Hotel / Hospedagem</option>
                    <option value="Apoio">Ponto de Apoio / Obra Central</option>
                    <option value="Laboratorio">Laboratório Auxiliar</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-end">Endereço (Rua/Av.)</Label>
                  <Input id="h-end" required value={localEndereco} onChange={(e) => setLocalEndereco(e.target.value)} placeholder="Ex: Av. Principal Tatuí" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="h-num">Número</Label>
                    <Input id="h-num" value={localNumero} onChange={(e) => setLocalNumero(e.target.value)} placeholder="Ex: 123" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="h-bair">Bairro</Label>
                    <Input id="h-bair" value={localBairro} onChange={(e) => setLocalBairro(e.target.value)} placeholder="Ex: Centro" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="h-cid">Cidade</Label>
                    <Input id="h-cid" required value={localCidade} onChange={(e) => setLocalCidade(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="h-est">Estado</Label>
                    <Input id="h-est" required maxLength={2} value={localEstado} onChange={(e) => setLocalEstado(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="h-lat">Latitude (opcional)</Label>
                    <Input id="h-lat" type="number" step="0.0000001" value={localLat} onChange={(e) => setLocalLat(e.target.value)} placeholder="-23.3512" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="h-lng">Longitude (opcional)</Label>
                    <Input id="h-lng" type="number" step="0.0000001" value={localLng} onChange={(e) => setLocalLng(e.target.value)} placeholder="-47.2844" />
                  </div>
                </div>

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setAlertSupportDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Vincular e Resolver</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>}

        {/* ── PAINEL: FOLGAS E BLOQUEIOS ── */}
        {activeTab === "bloqueios" && <div className="space-y-6">
          <div className="flex justify-end mb-4">
            <Dialog open={showBlockerDialog} onOpenChange={setShowBlockerDialog}>
              <Button className="gap-2 bg-primary hover:bg-primary/90 font-bold cursor-pointer" onClick={() => {
                setBlockerTecnicoId("global");
                setBlockerDataInicio("");
                setBlockerDataFim("");
                setBlockerTipo("Feriado");
                setBlockerDescricao("");
                setShowBlockerDialog(true);
              }}>
                <Plus className="h-4 w-4" />
                Adicionar Bloqueio / Feriado
              </Button>
              <DialogContent className="max-w-md border border-border bg-card">
                <DialogHeader>
                  <DialogTitle className="font-bold text-lg">Adicionar Bloqueio de Agenda</DialogTitle>
                  <DialogDescription>
                    Cadastre feriados, folgas ou indisponibilidades de técnicos para travar a agenda na data desejada.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateBlocker} className="space-y-4 pt-2 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="blk-scope">Escopo do Bloqueio</Label>
                    <select
                      id="blk-scope"
                      value={blockerTecnicoId === "global" ? "global" : "tecnico"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "global") {
                          setBlockerTecnicoId("global");
                          setBlockerTipo("Feriado");
                        } else {
                          setBlockerTecnicoId(tecnicos[0]?.id || "");
                          setBlockerTipo("Folga");
                        }
                      }}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="global">Global (Toda a Empresa / Feriado)</option>
                      <option value="tecnico">Técnico Específico</option>
                    </select>
                  </div>

                  {blockerTecnicoId !== "global" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="blk-tec">Selecionar Técnico</Label>
                      <select
                        id="blk-tec"
                        value={blockerTecnicoId}
                        onChange={(e) => setBlockerTecnicoId(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {tecnicos.map((tec) => (
                          <option key={tec.id} value={tec.id}>{tec.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="blk-tipo">Motivo / Tipo</Label>
                    <select
                      id="blk-tipo"
                      value={blockerTipo}
                      onChange={(e) => setBlockerTipo(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {blockerTecnicoId === "global" ? (
                        <>
                          <option value="Feriado">Feriado / Recesso</option>
                          <option value="Bloqueio_Global">Bloqueio Geral (Sem técnicos disponíveis)</option>
                        </>
                      ) : (
                        <>
                          <option value="Folga">🌴 Folga / Licença</option>
                          <option value="Medico">🔬 Exame / Atestado Médico</option>
                          <option value="Problema_Veiculo">🚗 Problema com Veículo</option>
                          <option value="Outro">Outro Motivo</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="blk-inicio">Data Início</Label>
                      <Input
                        id="blk-inicio"
                        type="date"
                        required
                        value={blockerDataInicio}
                        onChange={(e) => setBlockerDataInicio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="blk-fim">Data Fim</Label>
                      <Input
                        id="blk-fim"
                        type="date"
                        required
                        value={blockerDataFim}
                        onChange={(e) => setBlockerDataFim(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="blk-desc">Descrição / Justificativa</Label>
                    <Input
                      id="blk-desc"
                      value={blockerDescricao}
                      onChange={(e) => setBlockerDescricao(e.target.value)}
                      placeholder="Ex: Feriado de Tiradentes ou Ausência planejada"
                    />
                  </div>

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowBlockerDialog(false)} disabled={submittingBlocker}>Cancelar</Button>
                    <Button type="submit" disabled={submittingBlocker}>{submittingBlocker ? "Salvando..." : "Confirmar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Solicitações de Folgas e Bloqueios</CardTitle>
              <CardDescription>Revise e aprove ou rejeite as solicitações de ausência e indisponibilidade dos técnicos.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBlockers ? (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando solicitações...</div>
              ) : blockerRequests.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg bg-muted/10">
                  <CheckCircle2 className="h-8 w-8 text-green-500/40 mx-auto mb-2" />
                  Nenhuma solicitação de bloqueio registrada.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground">
                        <th className="p-3">Técnico</th>
                        <th className="p-3">Período</th>
                        <th className="p-3">Motivo</th>
                        <th className="p-3">Justificativa</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {blockerRequests.map((blk) => (
                        <tr key={blk.id} className="hover:bg-muted/10 text-foreground transition-all">
                          <td className="p-3 font-bold">{blk.tecnico?.nome || "⚠️ Todos (Bloqueio Global)"}</td>
                          <td className="p-3 font-semibold text-nowrap">
                            {new Date(blk.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")} até {new Date(blk.data_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={
                              blk.tipo === "Medico" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                              blk.tipo === "Folga" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                              blk.tipo === "Problema_Veiculo" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                              blk.tipo === "Feriado" ? "bg-sky-500/10 text-sky-600 border-sky-500/20" :
                              blk.tipo === "Bloqueio_Global" ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" :
                              "bg-purple-500/10 text-purple-600 border-purple-500/20"
                            }>
                              {blk.tipo === "Medico" ? "🔬 Médico" :
                               blk.tipo === "Folga" ? "🌴 Folga" :
                               blk.tipo === "Problema_Veiculo" ? "🚗 Veículo" :
                               blk.tipo === "Feriado" ? "🎉 Feriado" :
                               blk.tipo === "Bloqueio_Global" ? "🔒 Bloqueio Global" : "Outro"}
                            </Badge>
                          </td>
                          <td className="p-3 max-w-xs truncate">{blk.descricao || "Sem justificativa"}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={
                              blk.status === "Aprovado" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                              blk.status === "Rejeitado" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                              "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }>
                              {blk.status === "Aprovado" ? "✅ Aprovado" :
                               blk.status === "Rejeitado" ? "❌ Rejeitado" : "⏳ Pendente"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              {blk.status === "Pendente" ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 px-2.5 text-[10px] cursor-pointer"
                                    onClick={() => handleResolveBlocker(blk.id, 'Aprovado')}
                                  >
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/30 text-red-600 hover:bg-red-500/10 h-7 px-2.5 text-[10px] cursor-pointer"
                                    onClick={() => handleResolveBlocker(blk.id, 'Rejeitado')}
                                  >
                                    Rejeitar
                                  </Button>
                                </>
                              ) : (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  Resolvido
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 cursor-pointer h-7"
                                title="Excluir bloqueio"
                                onClick={() => handleDeleteBlocker(blk.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>}

        {/* ── PAINEL: MEUS DADOS ── */}
        {activeTab === "meus-dados" && <div className="space-y-6">
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Dados da Empresa Contratante
              </CardTitle>
              <CardDescription>
                Configure os dados oficiais da empresa que utiliza e contrata a plataforma. Esses dados serão exibidos nos painéis dos técnicos e clientes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEmpresa ? (
                <div className="py-8 text-center text-muted-foreground">Carregando dados da empresa...</div>
              ) : (
                <form onSubmit={handleSaveEmpresaPlataforma} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="empresa-razao">Razão Social</Label>
                      <Input
                        id="empresa-razao"
                        required
                        value={empresaPlataforma.razao_social}
                        onChange={(e) => setEmpresaPlataforma({ ...empresaPlataforma, razao_social: e.target.value })}
                        placeholder="Ex: Quantis Tecnologia Ltda"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="empresa-cnpj">CNPJ</Label>
                      <Input
                        id="empresa-cnpj"
                        required
                        value={empresaPlataforma.cnpj}
                        onChange={(e) => setEmpresaPlataforma({ ...empresaPlataforma, cnpj: e.target.value })}
                        placeholder="Ex: 00.000.000/0000-00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="empresa-telefone">Telefone / WhatsApp Comercial</Label>
                      <Input
                        id="empresa-telefone"
                        value={empresaPlataforma.telefone}
                        onChange={(e) => setEmpresaPlataforma({ ...empresaPlataforma, telefone: e.target.value })}
                        placeholder="Ex: (15) 99999-9999"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="empresa-email">E-mail Comercial</Label>
                      <Input
                        id="empresa-email"
                        type="email"
                        value={empresaPlataforma.email}
                        onChange={(e) => setEmpresaPlataforma({ ...empresaPlataforma, email: e.target.value })}
                        placeholder="Ex: contato@empresa.com"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="empresa-endereco">Endereço Principal</Label>
                      <Input
                        id="empresa-endereco"
                        value={empresaPlataforma.endereco}
                        onChange={(e) => setEmpresaPlataforma({ ...empresaPlataforma, endereco: e.target.value })}
                        placeholder="Ex: Av. Paulista, 1000 - São Paulo/SP"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={savingEmpresa} className="bg-primary hover:bg-primary/90 font-bold">
                      {savingEmpresa ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>}

        {/* ── PAINEL: PRODUTOS & SERVIÇOS ── */}
        {activeTab === "produtos" && <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-foreground">Catálogo de Serviços</h3>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 font-bold cursor-pointer"
              onClick={() => handleOpenServicoDialog(null)}
            >
              <Plus className="h-4 w-4" />
              Cadastrar Produto/Serviço
            </Button>
          </div>

          {loadingServicos && servicos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground animate-pulse">Carregando catálogo...</div>
          ) : servicos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg">Nenhum serviço cadastrado ainda.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servicos.map((serv) => (
                <Card key={serv.id} className="border border-border bg-card shadow-sm hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <Badge variant={serv.ativo ? "default" : "secondary"}>
                        {serv.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        SKU: {serv.sku}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold mt-2 text-foreground line-clamp-1">
                      {serv.nome_servico}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {serv.descricao || "Sem descrição cadastrada."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Categoria</span>
                        <span className="font-semibold text-foreground">{serv.categoria}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Cobrança</span>
                        <span className="font-semibold text-foreground">{serv.tipo_cobranca}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Unidade</span>
                        <span className="font-semibold text-foreground">{serv.unidade}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Mínimo à Vista</span>
                        <span className="font-semibold text-foreground text-[11px]">R$ {Number(serv.regra_minimo_a_vista).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">CP Excedente</span>
                        <span className="font-semibold text-foreground text-[11px]">R$ {Number(serv.valor_cp_excedente ?? 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleOpenServicoDialog(serv)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => handleOpenPrecosCidade(serv)}
                      >
                        Cidades e Preços
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>}

        {/* ── PAINEL: CONFIGURAÇÕES GLOBAIS ── */}
        {activeTab === "configuracoes" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" /> Configurações Globais
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Parâmetros de operação, cidades atendidas e coeficientes técnicos.</p>
            </div>

            {/* Parâmetros Globais */}
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Parâmetros Técnicos Globais</CardTitle>
                <CardDescription>Coeficientes usados nos cálculos de produção e horas extras de toda a plataforma.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveGlobalConfigs} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="gc-eficiencia">Eficiência de CP (%)</Label>
                      <Input
                        id="gc-eficiencia" type="number" min={50} max={100} step={1}
                        value={globalConfigs.eficiencia_cp}
                        onChange={(e) => setGlobalConfigs({ ...globalConfigs, eficiencia_cp: Number(e.target.value) })}
                      />
                      <p className="text-[10px] text-muted-foreground">% de aproveitamento médio dos CPs moldados por diária.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gc-he">Coeficiente de Horas Extras</Label>
                      <Input
                        id="gc-he" type="number" min={1} max={5} step={0.1}
                        value={globalConfigs.coeficiente_he}
                        onChange={(e) => setGlobalConfigs({ ...globalConfigs, coeficiente_he: Number(e.target.value) })}
                      />
                      <p className="text-[10px] text-muted-foreground">Multiplicador para horas extras (ex: 1.5 = 50% adicional).</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gc-prazo">Prazo de Faturamento (dias)</Label>
                      <Input
                        id="gc-prazo" type="number" min={1} max={90} step={1}
                        value={globalConfigs.prazo_faturamento_dias}
                        onChange={(e) => setGlobalConfigs({ ...globalConfigs, prazo_faturamento_dias: Number(e.target.value) })}
                      />
                      <p className="text-[10px] text-muted-foreground">Prazo padrão para faturamento após realização do serviço.</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={savingGlobalConfigs} className="bg-primary hover:bg-primary/90 font-bold">
                      {savingGlobalConfigs ? "Salvando..." : "Salvar Parâmetros"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* CRUD Cidades Atendidas */}
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Cidades Atendidas</CardTitle>
                    <CardDescription>Regiões cobertas pelos técnicos com parâmetros de mobilização e deslocamento.</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-primary hover:bg-primary/90 font-bold"
                    onClick={() => handleOpenCidadeDialog(null)}
                  >
                    <Plus className="h-4 w-4" /> Nova Cidade
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {cidades.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-sm">
                    Nenhuma cidade cadastrada ainda.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground text-xs">
                          <th className="p-3">Cidade</th>
                          <th className="p-3 text-right">Mobilização (R$)</th>
                          <th className="p-3 text-right">Pedágio Est. (R$)</th>
                          <th className="p-3 text-right">Deslocamento</th>
                          <th className="p-3 text-center">Base</th>
                          <th className="p-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cidades.map((cid) => (
                          <tr key={cid.id} className="hover:bg-muted/10 transition-all text-foreground">
                            <td className="p-3 font-semibold">{cid.nome_cidade}</td>
                            <td className="p-3 text-right font-mono text-xs">R$ {Number(cid.mobilizacao_base).toFixed(2)}</td>
                            <td className="p-3 text-right font-mono text-xs">R$ {Number(cid.pedagio_estimado).toFixed(2)}</td>
                            <td className="p-3 text-right text-xs">{cid.minutos_deslocamento} min</td>
                            <td className="p-3 text-center">
                              {cid.is_base ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Base</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="sm" className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20" onClick={() => handleOpenCidadeDialog(cid)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => handleDeleteCidade(cid.id)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── PAINEL: ALERTAS DE ESCALA ── */}
        {activeTab === "alertas-escala" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" /> Alertas de Escala
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Verificação de interjornada mínima de 11 horas entre atendimentos sequenciais de cada técnico.</p>
            </div>
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Verificação de Interjornada (Regra das 11h)</CardTitle>
                <CardDescription>Técnicos com menos de 11 horas de descanso entre serviços consecutivos são listados abaixo.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingScaleAlerts ? (
                  <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">Verificando escalas...</div>
                ) : scaleAlerts.length === 0 ? (
                  <div className="text-center py-10 border border-dashed rounded-lg bg-muted/10">
                    <CheckCircle2 className="h-10 w-10 text-green-500/40 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground">Nenhuma violação de interjornada detectada!</p>
                    <p className="text-xs text-muted-foreground mt-1">Todos os técnicos têm ao menos 11h de descanso entre atendimentos consecutivos.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scaleAlerts.map((al: any, i: number) => (
                      <div key={i} className="border-2 border-amber-500/20 bg-amber-500/5 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold">⚠️ Interjornada insuficiente</Badge>
                              <span className="text-xs font-bold text-foreground">{al.tecnicoNome}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Serviço 1: <strong className="text-foreground">{al.pedido1}</strong> em {al.data1} — encerra às {al.horaFim1}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Serviço 2: <strong className="text-foreground">{al.pedido2}</strong> em {al.data2} — inicia às {al.horaInicio2}
                            </p>
                            <p className="text-xs font-bold text-amber-600">
                              ⏱ Descanso calculado: {al.descansoHoras}h (mínimo exigido: 11h)
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── PAINEL: GESTÃO DE CLIENTES ── */}
        {activeTab === "clientes" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" /> Gestão de Clientes
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie o cadastro de empresas clientes da plataforma, remova duplicidades e adicione novas empresas.
                </p>
              </div>
              <Button onClick={handleOpenNewCliente} className="gap-2 font-bold bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Cadastrar Cliente
              </Button>
            </div>

            {/* Filtros */}
            <Card className="border border-border bg-card">
              <CardContent className="py-4">
                <Label htmlFor="search-clientes" className="sr-only">Buscar Clientes</Label>
                <Input
                  id="search-clientes"
                  placeholder="Buscar por razão social ou CNPJ..."
                  value={clientesSearch}
                  onChange={(e) => setClientesSearch(e.target.value)}
                  className="w-full"
                />
              </CardContent>
            </Card>

            {/* Listagem */}
            {loadingClientes ? (
              <div className="py-12 text-center text-muted-foreground animate-pulse">
                Carregando clientes...
              </div>
            ) : (() => {
              const filteredClientes = empresasClientes.filter(c => {
                return (
                  c.razao_social?.toLowerCase().includes(clientesSearch.toLowerCase()) ||
                  c.cnpj?.toLowerCase().includes(clientesSearch.toLowerCase())
                );
              });

              if (filteredClientes.length === 0) {
                return (
                  <Card className="border border-border bg-card p-12 text-center">
                    <p className="text-muted-foreground">Nenhuma empresa cliente encontrada.</p>
                  </Card>
                );
              }

              return (
                <Card className="border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="p-4">Razão Social</th>
                          <th className="p-4">CNPJ</th>
                          <th className="p-4 text-center">Aprovação Alocação</th>
                          <th className="p-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredClientes.map((emp) => (
                          <tr key={emp.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-4 font-bold text-foreground">
                              {emp.razao_social}
                            </td>
                            <td className="p-4 text-muted-foreground font-mono text-xs">
                              {emp.cnpj}
                            </td>
                            <td className="p-4 text-center">
                              {emp.requer_aprovacao_tecnico ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-[10px]">Ativa</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground font-medium text-[10px]">Inativa</Badge>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenEditCliente(emp)}
                                  className="h-8 px-2 text-xs font-bold"
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteCliente(emp.id)}
                                  className="h-8 px-2 text-xs font-bold"
                                >
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* ── PAINEL: GESTÃO DE OBRAS ── */}
        {activeTab === "obras" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <HardHat className="h-5 w-5 text-primary" /> Gestão de Obras
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie o catálogo de obras cadastradas, remova duplicidades e adicione novos endereços.
                </p>
              </div>
              <Button onClick={handleOpenNewObra} className="gap-2 font-bold bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Cadastrar Obra
              </Button>
            </div>

            {/* Filtros */}
            <Card className="border border-border bg-card">
              <CardContent className="py-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Label htmlFor="search-obras" className="sr-only">Buscar Obras</Label>
                  <Input
                    id="search-obras"
                    placeholder="Buscar por nome da obra, endereço, cidade ou responsável..."
                    value={obrasSearch}
                    onChange={(e) => setObrasSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="w-full sm:w-64">
                  <Label htmlFor="filter-empresa" className="sr-only">Empresa</Label>
                  <select
                    id="filter-empresa"
                    value={selectedEmpresaFiltro}
                    onChange={(e) => setSelectedEmpresaFiltro(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">Todas as Empresas</option>
                    {empresasClientes.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.razao_social}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Listagem */}
            {loadingObras ? (
              <div className="py-12 text-center text-muted-foreground animate-pulse">
                Carregando obras...
              </div>
            ) : (() => {
              const filteredObras = obrasGestor.filter(o => {
                const matchesSearch = 
                  o.nome_obra?.toLowerCase().includes(obrasSearch.toLowerCase()) ||
                  o.endereco?.toLowerCase().includes(obrasSearch.toLowerCase()) ||
                  o.cidade?.toLowerCase().includes(obrasSearch.toLowerCase()) ||
                  o.responsavel?.toLowerCase().includes(obrasSearch.toLowerCase());
                
                const matchesEmpresa = selectedEmpresaFiltro === "all" || o.empresa_id === selectedEmpresaFiltro;
                
                return matchesSearch && matchesEmpresa;
              });

              if (filteredObras.length === 0) {
                return (
                  <Card className="border border-border bg-card p-12 text-center">
                    <p className="text-muted-foreground">Nenhuma obra encontrada com os filtros selecionados.</p>
                  </Card>
                );
              }

              return (
                <Card className="border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="p-4">Obra</th>
                          <th className="p-4">Empresa / Cliente</th>
                          <th className="p-4">Endereço</th>
                          <th className="p-4">Cidade/UF</th>
                          <th className="p-4">CNO / Responsável</th>
                          <th className="p-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredObras.map((obra) => (
                          <tr key={obra.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-4 font-bold text-foreground">
                              {obra.nome_obra}
                            </td>
                            <td className="p-4 text-muted-foreground text-xs font-semibold">
                              {obra.empresa?.razao_social || "Empresa sem nome"}
                            </td>
                            <td className="p-4 text-xs text-muted-foreground">
                              {obra.endereco}{obra.numero ? `, ${obra.numero}` : ""}{obra.bairro ? ` - ${obra.bairro}` : ""}
                            </td>
                            <td className="p-4 text-xs">
                              {obra.cidade}{obra.estado ? `/${obra.estado}` : ""}
                            </td>
                            <td className="p-4 text-xs text-muted-foreground">
                              {obra.cno && <div><span className="font-semibold text-foreground">CNO:</span> {obra.cno}</div>}
                              {obra.responsavel && <div><span className="font-semibold text-foreground">Resp:</span> {obra.responsavel} {obra.cargo_responsavel ? `(${obra.cargo_responsavel})` : ""}</div>}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenEditObra(obra)}
                                  className="h-8 px-2 text-xs font-bold"
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteObra(obra.id)}
                                  className="h-8 px-2 text-xs font-bold"
                                >
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* ── PAINEL: MÓDULO FINANCEIRO ── */}
        {activeTab === "financeiro" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" /> Módulo Financeiro
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Resumo de receita confirmada, faturamento pendente e agrupamento por cliente.</p>
            </div>

            {loadingFinance ? (
              <div className="py-12 text-center text-muted-foreground animate-pulse">Carregando dados financeiros...</div>
            ) : !financeSummary ? (
              <div className="py-12 text-center">
                <Button onClick={fetchFinancialSummary} className="gap-2 font-bold">
                  <BarChart3 className="h-4 w-4" /> Carregar Dados Financeiros
                </Button>
              </div>
            ) : (() => {
              const adminFiltered = (financeSummary?.bookings || []).filter((b: any) => {
                if (adminFinStartDate && b.data_servico < adminFinStartDate) return false;
                if (adminFinEndDate && b.data_servico > adminFinEndDate) return false;
                if (adminFinClientId !== "all" && b.empresa_id !== adminFinClientId) return false;
                if (adminFinServiceId !== "all" && b.servico_id !== adminFinServiceId) return false;
                return true;
              });

              let adminTotalAgendado = 0;
              let adminTotalRealizado = 0;
              let adminTotalACobrar = 0;
              let adminTotalAcumulado = 0;

              adminFiltered.forEach((b: any) => {
                const val = Number(b.valor_total) || 0;
                adminTotalAcumulado += val;

                if (["Confirmado", "Em_Execucao"].includes(b.status_agendamento)) {
                  adminTotalAgendado += val;
                }
                if (["Aguardando_Medicao", "Laboratorio", "Validado"].includes(b.status_agendamento)) {
                  adminTotalRealizado += val;
                }
                if (b.status_agendamento === "Validado" && b.status_pagamento !== "Pago") {
                  adminTotalACobrar += val;
                }
              });

              const adminPorClienteMap: Record<string, { cliente: string; pago: number; pendente: number; total: number }> = {};
              adminFiltered.forEach((b: any) => {
                const val = Number(b.valor_total) || 0;
                const rSocial = b.empresa?.razao_social || "Empresa Desconhecida";
                const empId = b.empresa_id || "unknown";

                if (!adminPorClienteMap[empId]) {
                  adminPorClienteMap[empId] = { cliente: rSocial, pago: 0, pendente: 0, total: 0 };
                }

                adminPorClienteMap[empId].total += val;
                if (b.status_pagamento === "Pago") {
                  adminPorClienteMap[empId].pago += val;
                } else {
                  adminPorClienteMap[empId].pendente += val;
                }
              });
              const adminPorClienteList = Object.values(adminPorClienteMap);

              return (
                <>
                  {/* Filtros e Ações */}
                  <Card className="border border-border bg-card shadow-sm">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <Filter className="h-4 w-4 text-primary" /> Filtros Financeiros
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAdminExportCSV}
                            className="text-xs font-bold gap-1.5 h-8 bg-card border-border hover:bg-accent"
                          >
                            <FileDown className="h-3.5 w-3.5" /> Exportar Excel
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAdminPrintPDF}
                            className="text-xs font-bold gap-1.5 h-8 bg-card border-border hover:bg-accent"
                          >
                            <Printer className="h-3.5 w-3.5" /> Gerar PDF
                          </Button>
                          {(adminFinStartDate || adminFinEndDate || adminFinClientId !== "all" || adminFinServiceId !== "all") && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setAdminFinStartDate("");
                                setAdminFinEndDate("");
                                setAdminFinClientId("all");
                                setAdminFinServiceId("all");
                              }}
                              className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/25 h-8 px-2"
                            >
                              Limpar Filtros
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label htmlFor="admin-fin-start" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data Inicial</Label>
                          <Input
                            id="admin-fin-start"
                            type="date"
                            value={adminFinStartDate}
                            onChange={(e) => setAdminFinStartDate(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="admin-fin-end" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data Final</Label>
                          <Input
                            id="admin-fin-end"
                            type="date"
                            value={adminFinEndDate}
                            onChange={(e) => setAdminFinEndDate(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="admin-fin-client" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</Label>
                          <select
                            id="admin-fin-client"
                            value={adminFinClientId}
                            onChange={(e) => setAdminFinClientId(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
                          >
                            <option value="all">Todos os Clientes</option>
                            {empresasClientes.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.razao_social}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="admin-fin-service" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Serviço</Label>
                          <select
                            id="admin-fin-service"
                            value={adminFinServiceId}
                            onChange={(e) => setAdminFinServiceId(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
                          >
                            <option value="all">Todos os Serviços</option>
                            {servicos.map((svc) => (
                              <option key={svc.id} value={svc.id}>
                                {svc.nome_servico}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cards de resumo */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Card className="border border-blue-500/30 bg-blue-500/5">
                      <CardContent className="pt-5">
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Agendado</p>
                        <p className="text-3xl font-extrabold text-blue-600 mt-1">
                          R$ {adminTotalAgendado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Confirmados & em execução</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-emerald-500/30 bg-emerald-500/5">
                      <CardContent className="pt-5">
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Realizado</p>
                        <p className="text-3xl font-extrabold text-emerald-600 mt-1">
                          R$ {adminTotalRealizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Aguardando medição, no lab ou validado</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-amber-500/30 bg-amber-500/5">
                      <CardContent className="pt-5">
                        <p className="text-xs text-amber-600 font-bold uppercase tracking-wide">A Cobrar</p>
                        <p className="text-3xl font-extrabold text-amber-600 mt-1">
                          R$ {adminTotalACobrar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Validados com pagamento pendente</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-border bg-card">
                      <CardContent className="pt-5">
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Acumulado Geral</p>
                        <p className="text-3xl font-extrabold text-foreground mt-1">
                          R$ {adminTotalAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Soma de todos os registros filtrados</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tabela por cliente */}
                  <Card className="border border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-base font-bold">Faturamento por Cliente</CardTitle>
                      <CardDescription>Receita agrupada por empresa cliente — pago e pendente.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {adminPorClienteList.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum faturamento registrado ainda.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground text-xs">
                                <th className="p-3">Cliente</th>
                                <th className="p-3 text-right">Pago (R$)</th>
                                <th className="p-3 text-right">Pendente (R$)</th>
                                <th className="p-3 text-right">Total (R$)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {adminPorClienteList.map((c: any, i: number) => (
                                <tr key={i} className="hover:bg-muted/10 transition-all">
                                  <td className="p-3 font-semibold text-foreground">{c.cliente}</td>
                                  <td className="p-3 text-right font-mono text-xs text-emerald-600 font-bold">
                                    {Number(c.pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-right font-mono text-xs text-amber-600 font-bold">
                                    {Number(c.pendente).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-right font-mono text-xs font-bold text-foreground">
                                    {Number(c.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </div>
        )}

      {/* ── DIALOG: Nova / Edição de Cliente ── */}
      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent className="max-w-md border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Building2 className="h-5 w-5 text-primary" />
              {clienteId ? "Editar Cliente" : "Cadastrar Novo Cliente"}
            </DialogTitle>
            <DialogDescription>
              Insira a Razão Social e o CNPJ da empresa cliente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCliente} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="cli-razao" className="font-bold">Razão Social *</Label>
              <Input
                id="cli-razao"
                required
                value={clienteRazaoSocial}
                onChange={(e) => setClienteRazaoSocial(e.target.value)}
                placeholder="Ex: Construtora Alfa S.A."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cli-cnpj" className="font-bold">CNPJ *</Label>
              <Input
                id="cli-cnpj"
                required
                value={clienteCnpj}
                onChange={(e) => setClienteCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
              <div className="space-y-1">
                <Label htmlFor="cli-aprovacao-req" className="font-bold text-foreground cursor-pointer">Exigir aprovação de alocação de técnicos</Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed pr-4">
                  Se ativado, quando um técnico aceitar um serviço desta empresa, a alocação precisará de aprovação de um gestor da plataforma.
                </p>
              </div>
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="cli-aprovacao-req"
                  className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                  checked={clienteRequerAprovacaoTecnico}
                  onChange={(e) => setClienteRequerAprovacaoTecnico(e.target.checked)}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setClienteDialogOpen(false)} disabled={clienteSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={clienteSaving} className="bg-primary hover:bg-primary/90 font-bold">
                {clienteSaving ? "Salvando..." : "Salvar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Nova / Edição de Obra ── */}
      <Dialog open={obraDialogOpen} onOpenChange={setObraDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <HardHat className="h-5 w-5 text-primary" />
              {obraId ? "Editar Obra" : "Cadastrar Nova Obra"}
            </DialogTitle>
            <DialogDescription>
              Insira os dados cadastrais da obra para ser vinculada aos agendamentos e medições.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveObra} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="obra-empresa" className="font-bold">Cliente / Empresa Contratante *</Label>
                <select
                  id="obra-empresa"
                  required
                  value={obraEmpresaId}
                  onChange={(e) => setObraEmpresaId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>Selecione uma empresa...</option>
                  {empresasClientes.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.razao_social}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="obra-nome" className="font-bold">Nome da Obra *</Label>
                <Input
                  id="obra-nome"
                  required
                  value={obraNome}
                  onChange={(e) => setObraNome(e.target.value)}
                  placeholder="Ex: Residencial Splendor Torres A e B"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-cep" className="font-bold">CEP</Label>
                <div className="relative">
                  <Input
                    id="obra-cep"
                    value={obraCep}
                    onChange={handleObraCepChange}
                    placeholder="00000-000"
                  />
                  {fetchingObraCep && (
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground animate-pulse">Buscando...</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-cidade" className="font-bold">Cidade *</Label>
                <Input
                  id="obra-cidade"
                  required
                  value={obraCidade}
                  onChange={(e) => setObraCidade(e.target.value)}
                  placeholder="Ex: Sorocaba"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="obra-endereco" className="font-bold">Endereço *</Label>
                <Input
                  id="obra-endereco"
                  required
                  value={obraEndereco}
                  onChange={(e) => setObraEndereco(e.target.value)}
                  placeholder="Ex: Av. Engenheiro Carlos Reinaldo Mendes"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 md:col-span-2">
                <div className="space-y-1 col-span-1">
                  <Label htmlFor="obra-numero" className="font-bold">Número</Label>
                  <Input
                    id="obra-numero"
                    value={obraNumero}
                    onChange={(e) => setObraNumero(e.target.value)}
                    placeholder="123"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="obra-bairro" className="font-bold">Bairro</Label>
                  <Input
                    id="obra-bairro"
                    value={obraBairro}
                    onChange={(e) => setObraBairro(e.target.value)}
                    placeholder="Parque Campolim"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-estado" className="font-bold">Estado (UF)</Label>
                <Input
                  id="obra-estado"
                  maxLength={2}
                  value={obraEstado}
                  onChange={(e) => setObraEstado(e.target.value.toUpperCase())}
                  placeholder="SP"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-cno" className="font-bold">CNO (Cadastro Nacional de Obras)</Label>
                <Input
                  id="obra-cno"
                  value={obraCno}
                  onChange={(e) => setObraCno(e.target.value)}
                  placeholder="00.000.00000/00"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-resp" className="font-bold">Responsável no Campo</Label>
                <Input
                  id="obra-resp"
                  value={obraResponsavel}
                  onChange={(e) => setObraResponsavel(e.target.value)}
                  placeholder="Eng. Ricardo Silva"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-cargo" className="font-bold">Cargo do Responsável</Label>
                <Input
                  id="obra-cargo"
                  value={obraCargoResponsavel}
                  onChange={(e) => setObraCargoResponsavel(e.target.value)}
                  placeholder="Mestre de Obras / Engenheiro"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-lat" className="font-bold">Latitude (Opcional)</Label>
                <Input
                  id="obra-lat"
                  type="number"
                  step="any"
                  value={obraLat}
                  onChange={(e) => setObraLat(e.target.value)}
                  placeholder="-23.5489"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="obra-lng" className="font-bold">Longitude (Opcional)</Label>
                <Input
                  id="obra-lng"
                  type="number"
                  step="any"
                  value={obraLng}
                  onChange={(e) => setObraLng(e.target.value)}
                  placeholder="-46.6388"
                />
              </div>
            </div>

            <DialogFooter className="mt-6 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setObraDialogOpen(false)} disabled={obraSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={obraSaving} className="bg-primary hover:bg-primary/90 font-bold">
                {obraSaving ? "Salvando..." : "Salvar Obra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Nova / Edição de Cidade Atendida ── */}
      <Dialog open={cidadeDialogOpen} onOpenChange={setCidadeDialogOpen}>
        <DialogContent className="max-w-md border border-border bg-card">
          <DialogHeader>
            <DialogTitle>{cidadeId ? "Editar Cidade" : "Nova Cidade Atendida"}</DialogTitle>
            <DialogDescription>Configure os parâmetros logísticos para a cidade selecionada.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCidade} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="cid-nome">Nome da Cidade</Label>
              <Input id="cid-nome" required value={cidadeNome} onChange={(e) => setCidadeNome(e.target.value)} placeholder="Ex: Sorocaba" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cid-mob">Mobilização Base (R$)</Label>
                <Input id="cid-mob" type="number" step="0.01" min={0} value={cidadeMobilizacao} onChange={(e) => setCidadeMobilizacao(Number(e.target.value))} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cid-ped">Pedágio Estimado (R$)</Label>
                <Input id="cid-ped" type="number" step="0.01" min={0} value={cidadePedagio} onChange={(e) => setCidadePedagio(Number(e.target.value))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cid-min">Tempo de Deslocamento (min)</Label>
              <Input id="cid-min" type="number" min={0} value={cidadeMinutos} onChange={(e) => setCidadeMinutos(Number(e.target.value))} placeholder="60" />
            </div>
            <div className="flex items-center gap-2 border-t pt-3">
              <input
                type="checkbox" id="cid-base" checked={cidadeIsBase}
                onChange={(e) => setCidadeIsBase(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="cid-base" className="cursor-pointer">Esta cidade é uma Base de Operações</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCidadeDialogOpen(false)} disabled={cidadeSaving}>Cancelar</Button>
              <Button type="submit" disabled={cidadeSaving} className="bg-primary hover:bg-primary/90 font-bold">
                {cidadeSaving ? "Salvando..." : "Salvar Cidade"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração de Preço por Cidade */}
      {precosCidadeOpen && selectedServico && (
        <Dialog open={precosCidadeOpen} onOpenChange={setPrecosCidadeOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <MapPin className="h-5 w-5 text-indigo-500" />
                Preço por Cidade — {selectedServico.nome_servico}
              </DialogTitle>
              <DialogDescription>
                Defina os valores fixos e limites de CPs/unidades de cobrança para cada cidade atendida.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              {cidades.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cidade cadastrada no sistema.</p>
              ) : (
                <div className="space-y-3">
                  {cidades.map((cidade) => {
                    const rate = pricingCityRates[cidade.id] || { valorFixo: 0, limiteUnidades: 50 };
                    const isSaving = savingCityRates === cidade.id;
                    return (
                      <div key={cidade.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-border rounded-lg bg-muted/20 gap-3">
                        <div className="flex-1">
                          <span className="font-semibold text-foreground text-sm block">{cidade.nome_cidade}</span>
                          <span className="text-[10px] text-muted-foreground">Pedágio Estimado: R$ {Number(cidade.pedagio_estimado).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-28 space-y-1">
                            <label className="text-[10px] text-muted-foreground block">Valor Fixo</label>
                            <Input
                              type="number"
                              className="h-8 text-xs bg-background border-border text-foreground"
                              value={rate.valorFixo}
                              onChange={(e) => setPricingCityRates({
                                ...pricingCityRates,
                                [cidade.id]: { ...rate, valorFixo: Number(e.target.value) }
                              })}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="w-24 space-y-1">
                            <label className="text-[10px] text-muted-foreground block">Limite CPs/Unid</label>
                            <Input
                              type="number"
                              className="h-8 text-xs bg-background border-border text-foreground"
                              value={rate.limiteUnidades}
                              onChange={(e) => setPricingCityRates({
                                ...pricingCityRates,
                                [cidade.id]: { ...rate, limiteUnidades: Number(e.target.value) }
                              })}
                              placeholder="50"
                            />
                          </div>
                          <div className="self-end pb-0.5">
                            <Button
                              size="sm"
                              disabled={isSaving}
                              onClick={() => handleSaveCityPriceRate(cidade.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs px-3"
                            >
                              {isSaving ? "Salvar..." : "Salvar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-4 mt-6">
              <Button variant="outline" onClick={() => setPrecosCidadeOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Cadastro/Edição de Serviço */}
      {servicoDialogOpen && (
        <Dialog open={servicoDialogOpen} onOpenChange={setServicoDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-border bg-card">
            <DialogHeader>
              <DialogTitle>{selectedServico ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
              <DialogDescription>Cadastre ou modifique informações do catálogo de produtos/serviços.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveServicoSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sku">SKU / Código</Label>
                  <Input id="sku" required value={servicoSku} onChange={(e) => setServicoSku(e.target.value)} placeholder="ENS-CP-01" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="categoria">Categoria</Label>
                  <select
                    id="categoria"
                    value={servicoCategoria}
                    onChange={(e) => setServicoCategoria(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  >
                    <option value="Controle Tecnológico">Controle Tecnológico</option>
                    <option value="Solo / Asfalto">Solo / Asfalto</option>
                    <option value="Arrancamento">Arrancamento</option>
                    <option value="Blocos / Prismas">Blocos / Prismas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="nome_servico">Nome do Serviço</Label>
                <Input id="nome_servico" required value={servicoNome} onChange={(e) => setServicoNome(e.target.value)} placeholder="Moldagem e Ensaio de CPs" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="descricao">Descrição Detalhada</Label>
                <Textarea
                  id="descricao"
                  value={servicoDescricao}
                  onChange={(e) => setServicoDescricao(e.target.value)}
                  placeholder="Descreva o escopo do serviço para o cliente..."
                  className="min-h-[80px] bg-background border-border text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="unidade">Unidade de Medida</Label>
                  <Input id="unidade" required value={servicoUnidade} onChange={(e) => setServicoUnidade(e.target.value)} placeholder="m³ ou unidade" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tipo_cobranca">Forma de Cobrança</Label>
                  <select
                    id="tipo_cobranca"
                    value={servicoTipoCobranca}
                    onChange={(e) => setServicoTipoCobranca(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  >
                    <option value="Por Execucao">Por Execução (Fixo)</option>
                    <option value="Por Unidade">Por Unidade</option>
                    <option value="Por Hora">Por Hora</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="custo_base">Custo Base (R$)</Label>
                  <Input id="custo_base" type="number" required value={servicoCustoBase} onChange={(e) => setServicoCustoBase(Number(e.target.value))} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="venda_editavel">Venda Base (R$)</Label>
                  <Input id="venda_editavel" type="number" required value={servicoVendaEditavel} onChange={(e) => setServicoVendaEditavel(Number(e.target.value))} placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div className="space-y-1">
                  <Label htmlFor="regra_minimo">Mínimo à Vista (R$)</Label>
                  <Input id="regra_minimo" type="number" required value={servicoRegraMinimo} onChange={(e) => setServicoRegraMinimo(Number(e.target.value))} placeholder="1000.00" />
                  <p className="text-[9px] text-muted-foreground leading-tight">Pedidos abaixo exigirão pagamento à vista.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cp_excedente">Preço CP Excedente (R$)</Label>
                  <Input id="cp_excedente" type="number" required value={servicoCpExcedente} onChange={(e) => setServicoCpExcedente(Number(e.target.value))} placeholder="0.00" />
                  <p className="text-[9px] text-muted-foreground leading-tight">Cobrado por unidade extra moldada em campo.</p>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label>Formas de Pagamento Aceitas</Label>
                <div className="flex gap-4 text-sm">
                  {["PIX", "Boleto", "Cartao"].map((forma) => (
                    <label key={forma} className="flex items-center gap-2 cursor-pointer text-foreground">
                      <input
                        type="checkbox"
                        checked={servicoFormasPagamento.includes(forma)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setServicoFormasPagamento([...servicoFormasPagamento, forma]);
                          } else {
                            setServicoFormasPagamento(servicoFormasPagamento.filter((f) => f !== forma));
                          }
                        }}
                      />
                      {forma}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t pt-3">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={servicoAtivo}
                  onChange={(e) => setServicoAtivo(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="ativo" className="cursor-pointer">Serviço Ativo no Catálogo</Label>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setServicoDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={servicoSaving} className="bg-primary hover:bg-primary/90 font-bold">
                  {servicoSaving ? "Salvando..." : "Salvar Serviço"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Detalhes e Edição do Técnico */}
      {selectedTecnico && (
        <Dialog open={!!selectedTecnico} onOpenChange={(open) => { if (!open) setSelectedTecnico(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Perfil do Técnico: {selectedTecnico.nome}</DialogTitle>
              <DialogDescription>Gerencie dados cadastrais, habilidades e documentos de campo.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="cadastro" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="cadastro" className="font-semibold">Cadastro e Habilidades</TabsTrigger>
                <TabsTrigger value="documentos" className="font-semibold">Documentação</TabsTrigger>
              </TabsList>

              {/* Aba Cadastro e Habilidades */}
              <TabsContent value="cadastro" className="space-y-4">
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="edit-nome">Nome Completo</Label>
                      <Input id="edit-nome" required value={editNome} onChange={(e) => setEditNome(e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-status">Status de Escala</Label>
                      <select
                        id="edit-status"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        disabled={!isEditing}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        <option value="Disponivel">Disponível</option>
                        <option value="Em_Campo">Em Campo</option>
                        <option value="Folga">De Folga</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="edit-email">E-mail</Label>
                      <Input id="edit-email" type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-score">Score de Avaliação (0.0 a 5.0)</Label>
                      <Input
                        id="edit-score"
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        required
                        value={editRankingScore}
                        onChange={(e) => setEditRankingScore(parseFloat(e.target.value))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="edit-cpf">CPF</Label>
                      <Input id="edit-cpf" value={editCpf} onChange={(e) => setEditCpf(e.target.value)} placeholder="123.456.789-00" disabled={!isEditing} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-rg">RG</Label>
                      <Input id="edit-rg" value={editRg} onChange={(e) => setEditRg(e.target.value)} placeholder="12.345.678-9" disabled={!isEditing} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="edit-lab-padrao">Laboratório Padrão</Label>
                      <select
                        id="edit-lab-padrao"
                        value={editLaboratorioPadraoId}
                        onChange={(e) => setEditLaboratorioPadraoId(e.target.value)}
                        disabled={!isEditing}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        <option value="">-- Sem Base Padrão --</option>
                        {locais
                          .filter((l) => l.tipo === "Laboratorio" && !l.agendamento_id)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-raio-atuacao">Raio de Atuação (km)</Label>
                      <Input
                        id="edit-raio-atuacao"
                        type="number"
                        required
                        value={editRaioAtuacaoKm}
                        onChange={(e) => setEditRaioAtuacaoKm(Number(e.target.value))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Habilidades e Serviços (Nível de Conhecimento 1 a 10)</Label>
                    <div className="border border-border rounded-lg p-3 space-y-3 max-h-48 overflow-y-auto bg-muted/20">
                      {availableServices.map(svc => {
                        const skill = editSkills.find(s => s.servico_id === svc.id);
                        const isChecked = !!skill;
                        return (
                          <div key={svc.id} className="space-y-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`svc-edit-${svc.id}`}
                                checked={isChecked}
                                onChange={() => toggleEditSkill(svc.id)}
                                disabled={!isEditing}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-background disabled:opacity-50"
                              />
                              <Label htmlFor={`svc-edit-${svc.id}`} className="text-xs font-semibold cursor-pointer text-foreground">
                                {svc.nome_servico}
                              </Label>
                            </div>
                            {isChecked && (
                              <div className="flex items-center gap-3 pl-6">
                                <span className="text-[10px] font-medium text-muted-foreground w-20">
                                  Nível: <span className="font-bold text-primary">{skill.nivel}</span>/10
                                </span>
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  value={skill.nivel}
                                  onChange={(e) => updateEditSkillLevel(svc.id, parseInt(e.target.value))}
                                  disabled={!isEditing}
                                  className="w-full h-1.5 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    {!isEditing ? (
                      <>
                        <Button type="button" variant="outline" onClick={() => setSelectedTecnico(null)}>Fechar</Button>
                        <Button type="button" onClick={() => setIsEditing(true)} className="bg-primary text-primary-foreground font-bold gap-1">
                          <Edit className="h-4 w-4" /> Editar Perfil
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditNome(selectedTecnico.nome);
                            setEditEmail(selectedTecnico.email || "");
                            setEditStatus(selectedTecnico.status);
                            setEditRankingScore(selectedTecnico.ranking_score || 5);
                            setEditCpf(selectedTecnico.cpf || "");
                            setEditRg(selectedTecnico.rg || "");
                            fetchTecnicoDocsAndSkills(selectedTecnico.id);
                            setIsEditing(false);
                          }}
                          disabled={editSubmitLoading}
                        >
                          Cancelar
                        </Button>
                        <Button type="button" onClick={() => handleUpdateTechnician()} disabled={editSubmitLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                          {editSubmitLoading ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              </TabsContent>

              {/* Aba Documentos do Técnico */}
              <TabsContent value="documentos" className="space-y-6">
                {/* Upload Form */}
                <div className="bg-muted/30 border border-border p-4 rounded-lg space-y-4">
                  <h4 className="text-sm font-bold text-foreground">Enviar Novo Documento</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="doc-name">Nome do Documento</Label>
                      <Input
                        id="doc-name"
                        placeholder="Ex: Certificado NR-35, CNH"
                        value={documentName}
                        onChange={(e) => setDocumentName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="doc-file">Arquivo (Imagem ou PDF)</Label>
                        <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-1.5 py-0.5 rounded">Máx: 5MB</span>
                      </div>
                      <Input
                        id="doc-file"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file && file.size > 5 * 1024 * 1024) {
                            toast.warning("Atenção: Este arquivo excede o limite máximo de 5MB.");
                          }
                          setSelectedFile(file);
                        }}
                        disabled={uploadingDoc}
                        className="cursor-pointer file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-2 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">
                      * Formatos suportados: PDF, PNG, JPG, JPEG, WEBP.
                    </span>
                    <Button
                      type="button"
                      onClick={handleUploadDocument}
                      disabled={uploadingDoc || !selectedFile}
                      className="font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs py-1.5 h-8 self-end sm:self-auto"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingDoc ? "Enviando..." : "Salvar Documento"}
                    </Button>
                  </div>
                </div>

                {/* List and Preview grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* List */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-foreground border-b pb-2">Arquivos Registrados</h4>
                    {loadingDocsAndSkills ? (
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : tecnicoDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 italic">Nenhum documento anexado a este perfil.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {tecnicoDocs.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/10 transition-colors">
                            <button
                              type="button"
                              onClick={() => handleSelectAdminPreview(doc.url_documento, doc.nome_documento)}
                              className="flex items-center gap-2 text-left flex-1"
                            >
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">{doc.nome_documento}</span>
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 h-auto"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preview Container */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-foreground border-b pb-2">Visualização do Arquivo</h4>
                    {adminPreviewUrl ? (
                      <div 
                        className="relative border border-border rounded-lg bg-zinc-950 overflow-hidden w-full h-[250px] flex items-center justify-center select-none"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                      >
                        {adminPreviewType === "image" && (
                          <img
                            src={adminPreviewUrl}
                            alt="Visualização"
                            className="max-w-full max-h-full object-contain pointer-events-none"
                          />
                        )}
                        {adminPreviewType === "pdf" && (
                          <iframe
                            src={`${adminPreviewUrl}#toolbar=0&navpanes=0&statusbar=0&view=FitH`}
                            className="w-full h-full border-none pointer-events-none"
                            title="PDF Preview"
                          />
                        )}
                        {adminPreviewType === "other" && (
                          <div className="text-center p-4">
                            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-foreground font-semibold">Visualização indisponível</p>
                          </div>
                        )}
                        {/* Blocker overlay */}
                        <div className="absolute inset-0 bg-transparent z-10" />
                      </div>
                    ) : (
                      <div className="border border-dashed border-border rounded-lg h-[250px] flex flex-col items-center justify-center text-center p-4 bg-muted/10">
                        <Eye className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">Selecione um documento da lista para abrir a pré-visualização segura.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
      
      </main>{/* fim do conteúdo principal */}
    </div>
  );
}
