import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Plus, FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/laboratorio")({
  head: () => ({ meta: [{ title: "Operação Laboratório — Quantis Obras" }] }),
  component: LaboratorioPage,
});

function LaboratorioPage() {
  const [labSchedule, setLabSchedule] = useState<any[]>([]);
  const [loadingLab, setLoadingLab] = useState(false);
  const [labSearchText, setLabSearchText] = useState("");
  const [selectedLabDate, setSelectedLabDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [labSubTab, setLabSubTab] = useState<"agenda" | "recebimento">("agenda");

  // Crush / Ruptura dialog states
  const [crushDialogOpen, setCrushDialogOpen] = useState(false);
  const [selectedCpForCrush, setSelectedCpForCrush] = useState<any | null>(null);
  const [crushCargaKn, setCrushCargaKn] = useState("");
  const [crushDiametroMm, setCrushDiametroMm] = useState(100);
  const [crushAlturaMm, setCrushAlturaMm] = useState(200);
  const [crushTipoRuptura, setCrushTipoRuptura] = useState("Cônica");
  const [savingCrush, setSavingCrush] = useState(false);

  // Intake / Recebimento states
  const [intakeBarcode, setIntakeBarcode] = useState("");
  const [intakeEstufa, setIntakeEstufa] = useState("");
  const [submittingIntake, setSubmittingIntake] = useState(false);

  const fetchLabSchedule = async () => {
    setLoadingLab(true);
    try {
      const { getWeeklyCrushingSchedule } = await import("@/lib/booking.functions");
      const res = await getWeeklyCrushingSchedule();
      if (res.success) {
        setLabSchedule(res.schedule || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar a agenda do laboratório.");
    } finally {
      setLoadingLab(false);
    }
  };

  useEffect(() => {
    fetchLabSchedule();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" /> Operação Laboratório
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o recebimento de corpos de prova (CPs), cura na estufa e ensaios de rompimento hidráulico.
          </p>
        </div>
        <Button onClick={fetchLabSchedule} className="gap-2 font-bold bg-primary hover:bg-primary/90">
          ↻ Atualizar Painel
        </Button>
      </div>

      {/* Sub-abas de Navegação Interna */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={labSubTab === "agenda" ? "default" : "ghost"}
          size="sm"
          onClick={() => setLabSubTab("agenda")}
          className="font-bold cursor-pointer"
        >
          <ClipboardList className="h-4 w-4 mr-1.5" /> Agenda de Rupturas
        </Button>
        <Button
          variant={labSubTab === "recebimento" ? "default" : "ghost"}
          size="sm"
          onClick={() => setLabSubTab("recebimento")}
          className="font-bold cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Recebimento de Amostras
        </Button>
      </div>

      {/* CONTEÚDO SUB-ABA: AGENDA DE RUPTURAS */}
      {labSubTab === "agenda" && (
        <div className="space-y-6">
          {/* Filtros da Agenda */}
          <Card className="border border-border bg-card">
            <CardContent className="py-4 grid gap-4 sm:grid-cols-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="lab-date" className="text-xs font-bold text-muted-foreground uppercase">Data de Rompimento</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="lab-date"
                    type="date"
                    value={selectedLabDate}
                    onChange={(e) => setSelectedLabDate(e.target.value)}
                    className="h-10"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedLabDate(new Date().toISOString().split("T")[0])}
                    className="h-10 font-bold"
                  >
                    Hoje
                  </Button>
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="lab-search" className="text-xs font-bold text-muted-foreground uppercase">Busca Rápida</Label>
                <Input
                  id="lab-search"
                  placeholder="Buscar por código de barras, obra ou cliente..."
                  value={labSearchText}
                  onChange={(e) => setLabSearchText(e.target.value)}
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Listagem */}
          {loadingLab ? (
            <div className="py-12 text-center text-muted-foreground animate-pulse">Carregando agenda...</div>
          ) : (() => {
            const filteredCps = labSchedule.filter(cp => {
              // Filter by date
              if (selectedLabDate && cp.data_prevista_rompimento !== selectedLabDate) return false;
              
              // Filter by search text
              if (labSearchText) {
                const search = labSearchText.toLowerCase();
                const barcode = (cp.codigo_barras || "").toLowerCase();
                const obra = (cp.agendamento?.obra?.nome_obra || "").toLowerCase();
                const servico = (cp.agendamento?.servico?.nome_servico || "").toLowerCase();
                return barcode.includes(search) || obra.includes(search) || servico.includes(search);
              }
              return true;
            });

            if (filteredCps.length === 0) {
              return (
                <Card className="border border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground">Nenhum corpo de prova programado para esta data.</p>
                </Card>
              );
            }

            return (
              <Card className="border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="p-4">Cód. Barras (Etiqueta)</th>
                        <th className="p-4">Obra / Local</th>
                        <th className="p-4">Idade Alvo</th>
                        <th className="p-4">Serviço Técnico</th>
                        <th className="p-4 text-center">Cura / Estufa</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredCps.map((cp) => {
                        const isRompido = cp.status === "Rompido";
                        const isEstufa = cp.status === "Estufa";
                        const isMoldado = cp.status === "Moldado";

                        return (
                          <tr key={cp.id} className="hover:bg-muted/5 transition-all">
                            <td className="p-4 font-mono font-bold text-primary flex items-center gap-1.5">
                              <span className="text-lg leading-none">║</span> {cp.codigo_barras}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-foreground">{cp.agendamento?.obra?.nome_obra || "Obra Desconhecida"}</div>
                              <div className="text-[10px] text-muted-foreground">{cp.agendamento?.obra?.cidade || "Sorocaba/SP"}</div>
                            </td>
                            <td className="p-4 font-bold text-foreground">
                              {cp.idade_alvo_dias} dias
                            </td>
                            <td className="p-4 text-xs">
                              {cp.agendamento?.servico?.nome_servico || "Ensaios de Concreto"}
                            </td>
                            <td className="p-4 text-center text-xs font-semibold">
                              {cp.localizacao_estufa || <span className="text-red-500 font-bold">Não Recebido</span>}
                            </td>
                            <td className="p-4 text-center">
                              <Badge className={
                                isRompido ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                isEstufa ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              }>
                                {cp.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-right">
                              {isRompido ? (
                                <div className="text-right">
                                  <span className="font-bold font-mono text-sm text-emerald-600 mr-2">
                                    {cp.ensaio?.resistencia_mpa} MPa
                                  </span>
                                  <Badge className={cp.ensaio?.status_conformidade === "Conforme" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}>
                                    {cp.ensaio?.status_conformidade?.replace("_", " ")}
                                  </Badge>
                                </div>
                              ) : isEstufa ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCpForCrush(cp);
                                    setCrushCargaKn("");
                                    setCrushDialogOpen(true);
                                  }}
                                  className="bg-primary hover:bg-primary/90 font-bold text-xs cursor-pointer"
                                >
                                  Romper CP
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const { registerLaboratoryArrival } = await import("@/lib/booking.functions");
                                      const res = await registerLaboratoryArrival({
                                        data: { codigoBarras: cp.codigo_barras, localizacaoEstufa: "Estufa Principal" }
                                      });
                                      if (res.success) {
                                        toast.success(`CP ${cp.codigo_barras} recebido na estufa!`);
                                        fetchLabSchedule();
                                      }
                                    } catch (err: any) {
                                      toast.error(err.message || "Erro ao receber amostra.");
                                    }
                                  }}
                                  className="border-blue-500 text-blue-500 hover:bg-blue-50 font-bold text-xs cursor-pointer"
                                >
                                  Dar Entrada
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })()}
        </div>
      )}

      {/* CONTEÚDO SUB-ABA: RECEBIMENTO DE AMOSTRAS */}
      {labSubTab === "recebimento" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Form de Entrada */}
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Entrada de CP
              </CardTitle>
              <p className="text-xs text-muted-foreground">Bipe o código de barras para transferir o status para a Estufa de Cura.</p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!intakeBarcode) return;
                  setSubmittingIntake(true);
                  try {
                    const { registerLaboratoryArrival: arrival } = await import("@/lib/booking.functions");
                    const res = await arrival({
                      data: { codigoBarras: intakeBarcode, localizacaoEstufa: intakeEstufa || "Estufa Principal" }
                    });
                    if (res.success) {
                      toast.success(`Amostra ${intakeBarcode} dada entrada na estufa com sucesso!`);
                      setIntakeBarcode("");
                      fetchLabSchedule();
                    }
                  } catch (err: any) {
                    toast.error(err.message || "Erro ao processar recebimento.");
                  } finally {
                    setSubmittingIntake(false);
                  }
                }}
                className="space-y-4 text-xs"
              >
                <div className="space-y-1">
                  <Label htmlFor="intake-barcode" className="font-bold text-foreground">Código de Barras (Etiqueta)</Label>
                  <Input
                    id="intake-barcode"
                    required
                    autoFocus
                    value={intakeBarcode}
                    onChange={(e) => setIntakeBarcode(e.target.value)}
                    placeholder="Bipe ou digite o código..."
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="intake-estufa" className="font-bold text-foreground">Localização na Estufa / Cura</Label>
                  <Input
                    id="intake-estufa"
                    value={intakeEstufa}
                    onChange={(e) => setIntakeEstufa(e.target.value)}
                    placeholder="Ex: Tanque 1, Fileira B"
                    className="h-10"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submittingIntake}
                  className="w-full bg-primary hover:bg-primary/90 font-bold h-10 cursor-pointer"
                >
                  {submittingIntake ? "Processando..." : "Dar Entrada na Estufa"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de Recentes */}
          <Card className="border border-border bg-card md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-bold">Últimos CPs na Estufa</CardTitle>
              <p className="text-xs text-muted-foreground">Lista de CPs atualmente armazenados para cura úmida na estufa.</p>
            </CardHeader>
            <CardContent className="max-h-[350px] overflow-y-auto">
              {labSchedule.filter(cp => cp.status === "Estufa").length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Nenhum CP na estufa atualmente.</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border font-medium text-muted-foreground">
                        <th className="p-2.5">CP</th>
                        <th className="p-2.5">Data Moldagem</th>
                        <th className="p-2.5">Prev. Rompimento</th>
                        <th className="p-2.5">Idade</th>
                        <th className="p-2.5">Estufa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {labSchedule.filter(cp => cp.status === "Estufa").map((cp) => (
                        <tr key={cp.id} className="hover:bg-muted/10 transition-all">
                          <td className="p-2.5 font-semibold text-foreground font-mono">{cp.codigo_barras}</td>
                          <td className="p-2.5 font-mono">{cp.data_moldagem ? new Date(cp.data_moldagem + "T00:00:00").toLocaleDateString("pt-BR") : "--"}</td>
                          <td className="p-2.5 font-mono">{cp.data_prevista_rompimento ? new Date(cp.data_prevista_rompimento + "T00:00:00").toLocaleDateString("pt-BR") : "--"}</td>
                          <td className="p-2.5 font-bold">{cp.idade_alvo_dias} dias</td>
                          <td className="p-2.5 font-semibold text-blue-600">{cp.localizacao_estufa}</td>
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

      {/* DIALOG DE ROMPIMENTO (CRUSH DIALOG) */}
      <Dialog open={crushDialogOpen} onOpenChange={setCrushDialogOpen}>
        <DialogContent className="max-w-sm border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" /> Ensaio de Ruptura de Concreto
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Insira as leituras físicas do rompimento do CP <strong className="font-mono text-foreground font-bold">{selectedCpForCrush?.codigo_barras}</strong>.
            </p>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!crushCargaKn) return;
              setSavingCrush(true);
              try {
                const { registerSpecimenCrushing: crush } = await import("@/lib/booking.functions");
                const res = await crush({
                  data: {
                    codigoBarras: selectedCpForCrush.codigo_barras,
                    cargaRupturaKn: Number(crushCargaKn),
                    diametroMm: Number(crushDiametroMm),
                    alturaMm: Number(crushAlturaMm),
                    tipoRuptura: crushTipoRuptura,
                  }
                });
                if (res.success) {
                  toast.success(`CP ${selectedCpForCrush.codigo_barras} rompido com sucesso! Resistencia: ${res.resistenciaMpa} MPa (${res.conformidade})`);
                  setCrushDialogOpen(false);
                  fetchLabSchedule();
                }
              } catch (err: any) {
                toast.error(err.message || "Erro ao salvar rompimento.");
              } finally {
                setSavingCrush(false);
              }
            }}
            className="space-y-4 pt-2 text-xs"
          >
            <div className="space-y-1">
              <Label htmlFor="crush-force" className="font-bold text-foreground">Força / Carga Máxima (kN) *</Label>
              <Input
                id="crush-force"
                type="number"
                step="any"
                required
                value={crushCargaKn}
                onChange={(e) => setCrushCargaKn(e.target.value)}
                placeholder="Ex: 157.8"
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="crush-diameter" className="font-bold text-foreground">Diâmetro do CP (mm)</Label>
                <Input
                  id="crush-diameter"
                  type="number"
                  required
                  value={crushDiametroMm}
                  onChange={(e) => setCrushDiametroMm(Number(e.target.value))}
                  placeholder="Ex: 100"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="crush-height" className="font-bold text-foreground">Altura do CP (mm)</Label>
                <Input
                  id="crush-height"
                  type="number"
                  required
                  value={crushAlturaMm}
                  onChange={(e) => setCrushAlturaMm(Number(e.target.value))}
                  placeholder="Ex: 200"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="crush-type" className="font-bold text-foreground">Tipo de Ruptura (Visual)</Label>
              <select
                id="crush-type"
                value={crushTipoRuptura}
                onChange={(e) => setCrushTipoRuptura(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground text-xs"
              >
                <option value="Cônica">Cônica</option>
                <option value="Cônica e Cisalhada">Cônica e Cisalhada</option>
                <option value="Cônica e Fendida">Cônica e Fendida</option>
                <option value="Cisalhada">Cisalhada</option>
                <option value="Fendida">Fendida</option>
                <option value="Coluna">Coluna</option>
              </select>
            </div>

            {/* Visualização em tempo real do cálculo */}
            {crushCargaKn && (
              <Card className="border border-indigo-100 bg-indigo-50/30 p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Resistência MPa Estimada</p>
                <p className="text-xl font-extrabold text-indigo-700 mt-1">
                  {(() => {
                    const area = Math.PI * Math.pow(Number(crushDiametroMm) / 2, 2);
                    const force = Number(crushCargaKn) * 1000;
                    return (force / area).toFixed(1);
                  })()} MPa
                </p>
                <p className="text-[9px] text-indigo-500/80 mt-1">Calculado por compressão axial no cilindro.</p>
              </Card>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCrushDialogOpen(false)} disabled={savingCrush}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingCrush} className="bg-primary hover:bg-primary/90 font-bold">
                {savingCrush ? "Salvando..." : "Registrar Rompimento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
