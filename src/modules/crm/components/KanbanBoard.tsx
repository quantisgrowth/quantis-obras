import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Users, DollarSign, Edit3, ArrowRight, FolderKanban,
  CheckCircle, XCircle, HelpCircle, Loader2
} from "lucide-react";
import {
  getPipelines,
  getPipelineStages,
  getOportunidades,
  updateOportunidadeStage
} from "../crm.api";
import { OpportunityModal } from "./OpportunityModal";

interface Pipeline {
  id: string;
  nome: string;
}

interface Stage {
  id: string;
  nome: string;
  posicao: number;
}

interface Opportunity {
  id: string;
  pipeline_id: string;
  etapa_id: string;
  nome_oportunidade: string;
  valor_estimado: number;
  cliente_contato_nome: string | null;
  cliente_contato_email: string | null;
  cliente_contato_telefone: string | null;
  status: "Aberta" | "Ganha" | "Perdida";
  posicao_etapa: number;
  created_at: string;
}

export function KanbanBoard() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [modalStageId, setModalStageId] = useState<string | null>(null);

  // Load pipelines
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPipelines();
      setPipelines(data);
      if (data.length > 0) {
        setSelectedPipeline(data[0]);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar funis de venda: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load board content (stages and opportunities)
  const loadBoardContent = async (pipelineId: string) => {
    setBoardLoading(true);
    try {
      const [stagesData, oppsData] = await Promise.all([
        getPipelineStages({ data: pipelineId }),
        getOportunidades({ data: pipelineId })
      ]);
      setStages(stagesData);
      setOpportunities(oppsData as any);
    } catch (err: any) {
      toast.error("Erro ao carregar dados do Kanban: " + err.message);
    } finally {
      setBoardLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPipeline) {
      loadBoardContent(selectedPipeline.id);
    }
  }, [selectedPipeline]);

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, opportunityId: string) => {
    e.dataTransfer.setData("text/plain", opportunityId);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle Drag Drop
  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const opportunityId = e.dataTransfer.getData("text/plain");
    if (!opportunityId) return;

    // Find opportunity in state
    const opp = opportunities.find((o) => o.id === opportunityId);
    if (!opp) return;

    // If dropped in the same stage, do nothing
    if (opp.etapa_id === targetStageId) return;

    // Optimistic Update
    const previousOpps = [...opportunities];
    const updatedOpps = opportunities.map((o) => {
      if (o.id === opportunityId) {
        return { ...o, etapa_id: targetStageId };
      }
      return o;
    });
    setOpportunities(updatedOpps);

    try {
      await updateOportunidadeStage({
        data: {
          oportunidadeId: opportunityId,
          etapaId: targetStageId,
          posicaoEtapa: 0 // Default to top of list
        }
      });
      toast.success(`Oportunidade movida!`);
    } catch (err: any) {
      toast.error("Erro ao mover oportunidade: " + err.message);
      // Revert if API call fails
      setOpportunities(previousOpps);
    }
  };

  const handleOpenCreateModal = (stageId: string) => {
    setSelectedOpp(null);
    setModalStageId(stageId);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setIsModalOpen(true);
  };

  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const getStatusBadge = (status: "Aberta" | "Ganha" | "Perdida") => {
    switch (status) {
      case "Ganha":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 font-normal hover:bg-green-500/20">Ganho</Badge>;
      case "Perdida":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 font-normal hover:bg-red-500/20">Perdido</Badge>;
      default:
        return <Badge variant="secondary" className="font-normal">Em aberto</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando CRM...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Pipeline Select */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {selectedPipeline ? (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Funil Ativo:</span>
            <Select
              value={selectedPipeline.id}
              onValueChange={(id) => {
                const pip = pipelines.find((p) => p.id === id);
                if (pip) setSelectedPipeline(pip);
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px] h-10">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Crie um pipeline nas configurações para iniciar.</div>
        )}

        {selectedPipeline && (
          <Button
            onClick={() => handleOpenCreateModal(stages[0]?.id || "")}
            className="w-full sm:w-auto gap-1.5 h-10"
            disabled={stages.length === 0}
          >
            <Plus className="h-4 w-4" /> Adicionar Lead
          </Button>
        )}
      </div>

      {boardLoading ? (
        <div className="flex h-96 flex-col items-center justify-center gap-3 bg-card border border-dashed rounded-xl">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando visualização Kanban...</p>
        </div>
      ) : selectedPipeline && stages.length > 0 ? (
        /* Kanban Board Horizontal Scroll Container */
        <div className="overflow-x-auto pb-4 -mx-6 px-6">
          <div className="flex gap-4 min-w-max" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
            {stages.map((stage) => {
              const stageOpps = opportunities.filter((o) => o.etapa_id === stage.id);
              const columnTotal = stageOpps.reduce((acc, curr) => acc + curr.valor_estimado, 0);

              return (
                <div
                  key={stage.id}
                  className="w-[280px] flex flex-col bg-accent/15 rounded-xl border border-border/80 overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b bg-muted/20 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate max-w-[190px]">{stage.nome}</h3>
                      <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
                        {stageOpps.length}
                      </Badge>
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Total: {formatCurrency(columnTotal)}
                    </div>
                  </div>

                  {/* Cards Area */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 max-h-full">
                    {stageOpps.map((opp) => (
                      <Card
                        key={opp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opp.id)}
                        onClick={() => handleOpenEditModal(opp)}
                        className="cursor-grab active:cursor-grabbing hover:shadow-[var(--shadow-elegant)] border border-border bg-card transition-all duration-200 select-none group"
                      >
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                              {opp.nome_oportunidade}
                            </h4>
                          </div>

                          <div className="text-xs font-bold text-foreground">
                            {formatCurrency(opp.valor_estimado)}
                          </div>

                          {opp.cliente_contato_nome && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span>{opp.cliente_contato_nome}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            {getStatusBadge(opp.status)}
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
                              title="Editar lead"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(opp);
                              }}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {stageOpps.length === 0 && (
                      <div className="h-24 border border-dashed rounded-lg flex flex-col items-center justify-center text-xs text-muted-foreground/75 p-4 text-center">
                        Arraste cartões aqui ou crie um novo lead
                      </div>
                    )}
                  </div>

                  {/* Add stage footer button */}
                  <button
                    onClick={() => handleOpenCreateModal(stage.id)}
                    className="w-full text-center py-2.5 bg-muted/10 hover:bg-muted/30 border-t border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Lead
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : selectedPipeline ? (
        <div className="h-64 border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 p-8 text-center bg-card">
          <p className="text-sm font-semibold">Este funil não possui etapas configuradas.</p>
          <p className="text-xs text-muted-foreground">Acesse as configurações do pipeline para criar colunas.</p>
        </div>
      ) : (
        <div className="h-64 border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 p-8 text-center bg-card">
          <FolderKanban className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-semibold">Nenhum pipeline criado.</p>
          <p className="text-xs text-muted-foreground">Abra as configurações do pipeline ao lado para configurar seus canais.</p>
        </div>
      )}

      {/* Opportunity Creation/Editing Modal */}
      {selectedPipeline && (
        <OpportunityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          opportunity={selectedOpp}
          pipelineId={selectedPipeline.id}
          stages={stages}
          onSaveSuccess={() => selectedPipeline && loadBoardContent(selectedPipeline.id)}
        />
      )}
    </div>
  );
}
