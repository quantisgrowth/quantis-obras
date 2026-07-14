import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus, Trash2, ArrowUp, ArrowDown, Settings, Edit, Check, X,
  FolderKanban, PlusCircle, AlertTriangle
} from "lucide-react";
import {
  getPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
  getPipelineStages,
  savePipelineStages
} from "../crm.api";

interface Pipeline {
  id: string;
  nome: string;
  created_at: string;
}

interface Stage {
  id?: string;
  nome: string;
  posicao: number;
}

export function PipelineSettings() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [editingPipelineName, setEditingPipelineName] = useState("");
  const [isEditingPipeline, setIsEditingPipeline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stagesLoading, setStagesLoading] = useState(false);

  // Load pipelines
  const loadPipelines = async () => {
    setLoading(true);
    try {
      const data = await getPipelines();
      setPipelines(data);
      if (data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0]);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar funis: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load stages when selected pipeline changes
  const loadStages = async (pipelineId: string) => {
    setStagesLoading(true);
    try {
      const data = await getPipelineStages({ data: pipelineId });
      setStages(data);
    } catch (err: any) {
      toast.error("Erro ao carregar etapas: " + err.message);
    } finally {
      setStagesLoading(false);
    }
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  useEffect(() => {
    if (selectedPipeline) {
      loadStages(selectedPipeline.id);
      setEditingPipelineName(selectedPipeline.nome);
      setIsEditingPipeline(false);
    } else {
      setStages([]);
    }
  }, [selectedPipeline]);

  // Create new pipeline
  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipelineName.trim()) return;

    if (pipelines.length >= 5) {
      toast.error("Você já atingiu o limite de 5 pipelines cadastrados.");
      return;
    }

    try {
      const created = await createPipeline({ data: { nome: newPipelineName.trim() } });
      toast.success("Funil de vendas criado com sucesso!");
      setNewPipelineName("");
      // Reload and select the newly created pipeline
      const data = await getPipelines();
      setPipelines(data);
      const newPip = data.find((p: any) => p.id === created.id);
      if (newPip) setSelectedPipeline(newPip);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Rename pipeline
  const handleUpdatePipelineName = async () => {
    if (!selectedPipeline || !editingPipelineName.trim()) return;

    try {
      await updatePipeline({ data: { id: selectedPipeline.id, nome: editingPipelineName.trim() } });
      toast.success("Nome do funil atualizado!");
      setIsEditingPipeline(false);
      setSelectedPipeline({ ...selectedPipeline, nome: editingPipelineName.trim() });
      loadPipelines();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Delete pipeline
  const handleDeletePipeline = async () => {
    if (!selectedPipeline) return;
    if (!confirm("Deseja realmente excluir este pipeline inteiro e todas as suas etapas e oportunidades? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      await deletePipeline({ data: { id: selectedPipeline.id } });
      toast.success("Funil excluído com sucesso!");
      const nextIndex = pipelines.findIndex((p) => p.id === selectedPipeline.id);
      const updatedList = pipelines.filter((p) => p.id !== selectedPipeline.id);
      setPipelines(updatedList);
      
      if (updatedList.length > 0) {
        setSelectedPipeline(updatedList[nextIndex] || updatedList[updatedList.length - 1]);
      } else {
        setSelectedPipeline(null);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Move stage Up
  const moveStageUp = (index: number) => {
    if (index === 0) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[index - 1];
    newStages[index - 1] = temp;

    // Recalculate positions
    const updated = newStages.map((s, idx) => ({ ...s, posicao: idx }));
    setStages(updated);
  };

  // Move stage Down
  const moveStageDown = (index: number) => {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[index + 1];
    newStages[index + 1] = temp;

    // Recalculate positions
    const updated = newStages.map((s, idx) => ({ ...s, posicao: idx }));
    setStages(updated);
  };

  // Rename individual stage
  const renameStage = (index: number, newName: string) => {
    const updated = stages.map((s, idx) => {
      if (idx === index) {
        return { ...s, nome: newName };
      }
      return s;
    });
    setStages(updated);
  };

  // Add new stage to local state
  const addLocalStage = () => {
    if (stages.length >= 15) {
      toast.error("O limite máximo é de 15 etapas por pipeline.");
      return;
    }
    const newStage: Stage = {
      nome: `Nova Etapa ${stages.length + 1}`,
      posicao: stages.length
    };
    setStages([...stages, newStage]);
  };

  // Delete stage from local state (subject to DB constraints on save)
  const deleteLocalStage = (index: number) => {
    if (stages.length <= 2) {
      toast.error("Você deve manter no mínimo 2 etapas no pipeline.");
      return;
    }
    const filtered = stages.filter((_, idx) => idx !== index);
    const updated = filtered.map((s, idx) => ({ ...s, posicao: idx }));
    setStages(updated);
  };

  // Save stage configuration to database
  const handleSaveStages = async () => {
    if (!selectedPipeline) return;

    // Validation
    if (stages.some((s) => !s.nome.trim())) {
      toast.error("Todas as etapas devem conter um nome preenchido.");
      return;
    }

    try {
      setLoading(true);
      await savePipelineStages({
        data: {
          pipelineId: selectedPipeline.id,
          stages: stages.map((s) => ({
            id: s.id,
            nome: s.nome.trim(),
            posicao: s.posicao
          }))
        }
      });
      toast.success("Estrutura do funil salva com sucesso!");
      loadStages(selectedPipeline.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* List / Management of Pipelines */}
      <Card className="md:col-span-1 border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            Meus Funis ({pipelines.length}/5)
          </CardTitle>
          <CardDescription>
            Alterne entre pipelines ou cadastre novos canais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* List of pipelines */}
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPipeline(p)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
                  selectedPipeline?.id === p.id
                    ? "bg-primary/10 text-primary border-primary/20 font-medium"
                    : "hover:bg-accent border-transparent text-muted-foreground"
                }`}
              >
                {p.nome}
              </button>
            ))}
            {pipelines.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum funil criado ainda.
              </p>
            )}
          </div>

          {/* Create Pipeline Form */}
          {pipelines.length < 5 ? (
            <form onSubmit={handleCreatePipeline} className="space-y-3 pt-4 border-t">
              <div className="space-y-1">
                <Label htmlFor="new-pipeline" className="text-xs font-semibold">
                  Novo Pipeline
                </Label>
                <Input
                  id="new-pipeline"
                  placeholder="Ex: Tráfego Pago, Indicação..."
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button type="submit" size="sm" className="w-full gap-1.5 h-9">
                <PlusCircle className="h-4 w-4" /> Criar Funil
              </Button>
            </form>
          ) : (
            <div className="p-3 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg flex gap-2 items-start text-xs">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Você atingiu o limite de 5 funis. Exclua um para criar outro.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editing Stages for Selected Pipeline */}
      <Card className="md:col-span-2 border border-border bg-card">
        {selectedPipeline ? (
          <>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
              <div className="space-y-1">
                {isEditingPipeline ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingPipelineName}
                      onChange={(e) => setEditingPipelineName(e.target.value)}
                      className="max-w-[250px] h-9"
                    />
                    <Button onClick={handleUpdatePipelineName} size="icon" className="h-9 w-9 bg-green-600 hover:bg-green-700">
                      <Check className="h-4 w-4 text-white" />
                    </Button>
                    <Button onClick={() => setIsEditingPipeline(false)} size="icon" variant="outline" className="h-9 w-9">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{selectedPipeline.nome}</CardTitle>
                    <button
                      onClick={() => setIsEditingPipeline(true)}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                      title="Editar nome do pipeline"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <CardDescription>
                  Personalize as etapas do seu funil. Mínimo 2, máximo 15 colunas.
                </CardDescription>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeletePipeline}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Excluir Funil
              </Button>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
              {stagesLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Carregando etapas...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {stages.map((stage, index) => (
                      <div
                        key={stage.id || `local-${index}`}
                        className="flex items-center gap-2 bg-accent/30 p-2.5 rounded-lg border border-border transition-all hover:bg-accent/50"
                      >
                        {/* Position Badge */}
                        <div className="grid h-6 w-6 place-items-center rounded bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </div>

                        {/* Name Input */}
                        <Input
                          value={stage.nome}
                          onChange={(e) => renameStage(index, e.target.value)}
                          placeholder="Nome da etapa"
                          className="h-9 flex-1"
                        />

                        {/* Reordering Controls */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => moveStageUp(index)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => moveStageDown(index)}
                            disabled={index === stages.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Delete Action */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteLocalStage(index)}
                          disabled={stages.length <= 2}
                          title={stages.length <= 2 ? "Funis devem ter pelo menos 2 etapas." : "Excluir etapa"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Stage Buttons and Save Footer */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLocalStage}
                      disabled={stages.length >= 15}
                      className="gap-1.5 h-9"
                    >
                      <Plus className="h-4 w-4" /> Adicionar Etapa ({stages.length}/15)
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveStages}
                      disabled={loading}
                      className="gap-1.5 h-9"
                    >
                      Salvar Alterações
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </>
        ) : (
          <div className="py-24 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-3">
            <Settings className="h-10 w-10 text-muted-foreground/50 animate-spin" />
            <p>Selecione ou crie um pipeline para editar suas configurações.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
