import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth, primaryRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus, ClipboardList, Users, Settings, MapPin, Camera,
  Bell, BarChart3, Clock, FlaskConical, ChevronRight, X, Check, AlertTriangle,
  Upload, Eye, UserPlus, Plus, CheckCircle2, FileText, Calendar, LucideIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Geraltest Brasil" }] }),
  component: Dashboard,
});

// ── Helpers ────────────────────────────────────────────────────────────────
function Dashboard() {
  const { roles, user } = useAuth();
  const role = primaryRole(roles);
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
  Confirmado: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Em_Execucao: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  Aguardando_Medicao: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Validado: "bg-green-500/10 text-green-600 border-green-500/20",
  Laboratorio: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  Cancelado: "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  Pendente_Tecnico: "⏳ Aguardando Técnico",
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
  const [activeTab, setActiveTab] = useState("aguardados");

  // Booking detail modal state
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [bookingPhotos, setBookingPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("agendamentos_medicoes")
        .select("*, obra:obras(*), servico:servicos_catalogo_pub(*)")
        .eq("criado_por", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setAgendamentos(data);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
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

  const handleValidate = async (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail modal
    if (!confirm("Deseja confirmar a conclusão e validar as medições deste serviço?")) return;
    try {
      const { validateBooking } = await import("@/lib/booking.functions");
      const res = await validateBooking({ data: { bookingId } });
      if (res.success) {
        toast.success("Medições validadas e serviço concluído com sucesso!");
        fetchBookings();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao validar agendamento.");
    }
  };

  const aguardados = agendamentos.filter((a) =>
    ["Pendente_Tecnico", "Confirmado", "Em_Execucao", "Aguardando_Medicao"].includes(a.status_agendamento)
  );
  const concluidos = agendamentos.filter((a) =>
    ["Validado", "Laboratorio", "Cancelado"].includes(a.status_agendamento)
  );

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <SectionTitle
        title="Painel do Cliente"
        subtitle={`Bem-vindo, ${email}. Gerencie seus agendamentos de controle tecnológico.`}
      />

      {/* ── Cards de Resumo ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border border-border bg-card">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Pedidos</p>
            <p className="text-3xl font-extrabold text-foreground mt-1">{agendamentos.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Aguardados / Pendentes</p>
            <p className="text-3xl font-extrabold text-amber-600 mt-1">{aguardados.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-green-500/30 bg-green-500/5">
          <CardContent className="pt-5">
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Concluídos / Realizados</p>
            <p className="text-3xl font-extrabold text-green-600 mt-1">{concluidos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Abas do Painel ── */}
      <Tabs defaultValue="aguardados" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
          <TabsTrigger value="solicitar" className="font-semibold gap-1">
            <CalendarPlus className="h-4 w-4" /> Solicitação
          </TabsTrigger>
          <TabsTrigger value="aguardados" className="font-semibold gap-1">
            <Clock className="h-4 w-4" /> Aguardados ({aguardados.length})
          </TabsTrigger>
          <TabsTrigger value="realizados" className="font-semibold gap-1">
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

        {/* ── TAB: AGUARDADOS ── */}
        <TabsContent value="aguardados" className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando agendamentos aguardados…</div>
          ) : aguardados.length === 0 ? (
            <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
              <CardContent className="space-y-3">
                <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento aguardado ou pendente.</p>
                <Button onClick={() => setActiveTab("solicitar")} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  Agendar agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {aguardados.map((ag) => (
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
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1 self-stretch sm:self-auto"
                          onClick={(e) => handleValidate(ag.id, e)}
                        >
                          <Check className="h-4 w-4" />
                          Validar Medições
                        </Button>
                      ) : (
                        <div className="text-[10px] text-muted-foreground italic flex items-center gap-1 bg-muted px-2 py-1 rounded">
                          <Eye className="h-3 w-3" /> Clique para acompanhar em tempo real
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
  const [convites, setConvites] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [activeExec, setActiveExec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Active execution screen states
  const [activePhotos, setActivePhotos] = useState<any[]>([]);
  const [loadingExecPhotos, setLoadingExecPhotos] = useState(false);
  const [uploadingCheckin, setUploadingCheckin] = useState(false);
  
  // Molding cycle form states
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [slump, setSlump] = useState(100);
  const [numCaminhao, setNumCaminhao] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [pecaConcretada, setPecaConcretada] = useState("");
  const [cpsMoldados, setCpsMoldados] = useState(2);
  const [cyclePhoto, setCyclePhoto] = useState<File | null>(null);
  const [savingCycle, setSavingCycle] = useState(false);

  // Conclude form states
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [photoFinal, setPhotoFinal] = useState<File | null>(null);
  const [photoRetorno, setPhotoRetorno] = useState<File | null>(null);
  const [finalizing, setFinalizing] = useState(false);

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
    } catch (err) {
      console.error("Error fetching technician dashboard data:", err);
    } finally {
      setLoading(false);
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
      const { acceptInvite: dynamicAcceptInvite } = await import("@/lib/booking.functions");
      await dynamicAcceptInvite({ data: { bookingId } });
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
      const { rejectInvite: dynamicRejectInvite } = await import("@/lib/booking.functions");
      await dynamicRejectInvite({ data: { bookingId } });
      toast.info("Convite recusado.");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao recusar o convite.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartExecution = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { startExecution: dynamicStart } = await import("@/lib/booking.functions");
      await dynamicStart({ data: { bookingId } });
      toast.success("Execução iniciada! Registre os ensaios e check-in.");
      await fetchTecnicoData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao iniciar execução.");
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
      const { recordCheckin: dynamicCheckin } = await import("@/lib/booking.functions");
      await dynamicCheckin({
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

  // Step 2: Add Molding Cycle
  const handleAddCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cyclePhoto || !activeExec) {
      toast.error("A foto do ciclo é obrigatória.");
      return;
    }
    setSavingCycle(true);
    try {
      const url = await uploadPhotoOrBase64(cyclePhoto);
      const { addMoldingCycle: dynamicAddCycle } = await import("@/lib/booking.functions");
      await dynamicAddCycle({
        data: {
          bookingId: activeExec.id,
          urlFoto: url,
          slump,
          numeroCaminhao: numCaminhao,
          notaFiscal,
          pecaConcretada,
          cpsMoldados,
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

      const { finalizeExecution: dynamicFinalize } = await import("@/lib/booking.functions");
      await dynamicFinalize({
        data: {
          bookingId: activeExec.id,
          cpsMoldadosReal: totalCps,
          urlFotoFinal: finalUrl,
          urlFotoRetorno: retornoUrl,
        }
      });

      toast.success("Serviço concluído e enviado para validação!");
      setConcludeDialogOpen(false);
      setPhotoFinal(null);
      setPhotoRetorno(null);
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
        <SectionTitle
          title={`Painel do Técnico — ${tecnico.nome}`}
          subtitle={`Bem-vindo, ${email}. Gerencie seus convites de serviço e sua escala.`}
        />
        <div className="flex items-center gap-2 bg-emerald-600/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-500 text-sm font-semibold self-start sm:self-center">
          ⭐ Score de Avaliação: {tecnico.ranking_score ? Number(tecnico.ranking_score).toFixed(1) : "0.0"}
        </div>
      </div>

      {/* ── SEÇÃO: EXECUÇÃO EM EXECUÇÃO ATIVA ── */}
      {activeExec && (
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
            <div className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
              📍 {activeExec.obra?.cidade}
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            {/* Infos do pedido */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>📍 <strong className="text-foreground">Endereço:</strong> {activeExec.obra?.endereco}, {activeExec.obra?.numero} · {activeExec.obra?.bairro}</p>
              <p>🧪 <strong className="text-foreground">Serviço:</strong> {activeExec.servico?.nome_servico || "Controle Tecnológico"}</p>
              <p>🧱 <strong className="text-foreground">CPs Contratados:</strong> {activeExec.cps_contratados} unidades ({activeExec.qtd_caminhoes} caminhões)</p>
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
                  <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
                    <DialogTrigger asChild disabled={!checkinRecord}>
                      <Button className="w-full text-xs font-bold gap-1 h-9" size="sm">
                        <Plus className="h-4 w-4" /> Lançar Novo Caminhão
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Lançar Ensaio / Moldagem</DialogTitle>
                        <DialogDescription>Preencha os dados do ensaio de concreto deste ciclo.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddCycle} className="space-y-4 pt-2">
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
                        <div key={c.id} className="py-1 flex justify-between">
                          <span>Cam. {c.metadata?.numero_caminhao} ({c.metadata?.peca_concretada})</span>
                          <span className="font-bold">{c.metadata?.cps_moldados} CPs · Slump: {c.metadata?.slump}mm</span>
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

                <Dialog open={concludeDialogOpen} onOpenChange={setConcludeDialogOpen}>
                  <DialogTrigger asChild disabled={cycleRecords.length === 0}>
                    <Button className="w-full text-xs font-bold gap-1 h-9 bg-emerald-600 hover:bg-emerald-700" size="sm">
                      <Check className="h-4 w-4" /> Finalizar e Enviar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
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
          </CardContent>
        </Card>
      )}

      {/* ── SEÇÃO: CONVITES PENDENTES ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          Convites Pendentes ({convites.length})
        </h2>

        {convites.length === 0 ? (
          <Card className="border border-dashed border-border py-10 text-center bg-muted/10">
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
                      🧪 <strong className="text-foreground">Quantidade CPs:</strong> {ag.cps_contratados} unidades ({ag.qtd_caminhoes} caminhão/ões)
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
      </div>

      {/* ── SEÇÃO: MINHA ESCALA / AGENDA ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-primary" />
          Minha Escala / Próximos Serviços ({agenda.length})
        </h2>

        {agenda.length === 0 ? (
          <Card className="border border-dashed border-border py-12 text-center bg-muted/10">
            <CardContent className="space-y-2">
              <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum serviço confirmado na sua agenda por enquanto.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {agenda.map((ag) => (
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

                  <div className="flex flex-col sm:items-end justify-center min-w-[150px]">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-muted px-2.5 py-1 rounded">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {new Date(ag.data_servico + "T00:00:00").toLocaleDateString("pt-BR")} às {ag.horario_na_obra?.substring(0, 5)}
                    </div>

                    {ag.status_agendamento === "Confirmado" && (
                      <Button
                        size="sm"
                        className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1"
                        onClick={() => handleStartExecution(ag.id)}
                        disabled={actionLoading !== null || activeExec !== null}
                      >
                        <Camera className="h-4 w-4" /> Iniciar Atendimento
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ────────────────────────────────────────────────────────
function AdminDash() {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form states for technician creation
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [certificacoes, setCertificacoes] = useState("Moldagem de CPs, Ensaio de Concreto");
  const [submitLoading, setSubmitLoading] = useState(false);

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

  useEffect(() => {
    fetchTecnicos();
  }, []);

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const { registerTechnician } = await import("@/lib/booking.functions");
      const res = await registerTechnician({
        data: {
          nome,
          email,
          password,
          telefone,
          cpf,
          rg,
          certificacoes,
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
        setCertificacoes("Moldagem de CPs, Ensaio de Concreto");
        // Refetch list
        fetchTecnicos();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar técnico.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SectionTitle title="Painel do Gestor" subtitle="Gerenciamento de técnicos, escala e configurações." />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90 font-bold self-start sm:self-center">
              <UserPlus className="h-4 w-4" />
              Cadastrar Novo Técnico
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
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao.tecnico@geraltest.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Senha de Acesso (mínimo 6 caracteres)</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rg">RG</Label>
                  <Input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} placeholder="12.345.678-9" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="certificacoes">Certificações</Label>
                  <Input id="certificacoes" value={certificacoes} onChange={(e) => setCertificacoes(e.target.value)} placeholder="Ex: Moldagem de CPs, NBR 5738" />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitLoading}>Cancelar</Button>
                <Button type="submit" disabled={submitLoading}>{submitLoading ? "Cadastrando..." : "Confirmar Cadastro"}</Button>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tecnicos.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/20 text-foreground">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Cards adicionais da Fase 2 */}
      <div className="grid gap-4 md:grid-cols-3 border-t border-border pt-8">
        <PlaceholderCard icon={Bell} title="Alertas de escala" desc="Risco de banco de horas e descanso 11h." badge="Fase 2" />
        <PlaceholderCard icon={Settings} title="Configurações globais" desc="Eficiência CP, coef. HE, preços, cidades." badge="Fase 2" />
        <PlaceholderCard icon={BarChart3} title="Financeiro" desc="Previsão de receita e cobranças mensais." badge="Fase 2" />
      </div>
    </div>
  );
}
