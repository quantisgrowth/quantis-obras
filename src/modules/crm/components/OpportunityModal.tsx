import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { saveOportunidade, deleteOportunidade } from "../crm.api";

interface Stage {
  id: string;
  nome: string;
}

interface OpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: any | null; // null means creating a new one
  pipelineId: string;
  stages: Stage[];
  onSaveSuccess: () => void;
}

export function OpportunityModal({
  isOpen,
  onClose,
  opportunity,
  pipelineId,
  stages,
  onSaveSuccess
}: OpportunityModalProps) {
  const [loading, setLoading] = useState(false);
  const [nomeOportunidade, setNomeOportunidade] = useState("");
  const [valorEstimado, setValorEstimado] = useState("0");
  const [clienteContatoNome, setClienteContatoNome] = useState("");
  const [clienteContatoEmail, setClienteContatoEmail] = useState("");
  const [clienteContatoTelefone, setClienteContatoTelefone] = useState("");
  const [status, setStatus] = useState<"Aberta" | "Ganha" | "Perdida">("Aberta");
  const [etapaId, setEtapaId] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (opportunity) {
        setNomeOportunidade(opportunity.nome_oportunidade);
        setValorEstimado(opportunity.valor_estimado.toString());
        setClienteContatoNome(opportunity.cliente_contato_nome || "");
        setClienteContatoEmail(opportunity.cliente_contato_email || "");
        setClienteContatoTelefone(opportunity.cliente_contato_telefone || "");
        setStatus(opportunity.status);
        setEtapaId(opportunity.etapa_id);
      } else {
        setNomeOportunidade("");
        setValorEstimado("0");
        setClienteContatoNome("");
        setClienteContatoEmail("");
        setClienteContatoTelefone("");
        setStatus("Aberta");
        setEtapaId(stages[0]?.id || "");
      }
    }
  }, [isOpen, opportunity, stages]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeOportunidade.trim()) {
      toast.error("Nome da oportunidade é obrigatório.");
      return;
    }
    if (!etapaId) {
      toast.error("Selecione uma etapa.");
      return;
    }

    setLoading(true);
    try {
      await saveOportunidade({
        id: opportunity?.id,
        pipeline_id: pipelineId,
        etapa_id: etapaId,
        nome_oportunidade: nomeOportunidade.trim(),
        valor_estimado: parseFloat(valorEstimado) || 0,
        cliente_contato_nome: clienteContatoNome.trim() || null,
        cliente_contato_email: clienteContatoEmail.trim() || null,
        cliente_contato_telefone: clienteContatoTelefone.trim() || null,
        status,
        posicao_etapa: opportunity?.posicao_etapa || 0
      });

      toast.success(opportunity ? "Oportunidade atualizada!" : "Oportunidade criada com sucesso!");
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar oportunidade: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!opportunity?.id) return;
    if (!confirm("Deseja realmente excluir esta oportunidade?")) return;

    setLoading(true);
    try {
      await deleteOportunidade({ id: opportunity.id });
      toast.success("Oportunidade excluída!");
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {opportunity ? "Editar Oportunidade" : "Nova Oportunidade"}
          </DialogTitle>
          <DialogDescription>
            {opportunity
              ? "Atualize as informações do negócio ou contatos cadastrados."
              : "Preencha os dados do lead para começar a negociar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="opp-name">Nome da Oportunidade/Empresa *</Label>
            <Input
              id="opp-name"
              placeholder="Ex: Construtora Alfa - Obra Residencial"
              value={nomeOportunidade}
              onChange={(e) => setNomeOportunidade(e.target.value)}
              className="h-10"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="opp-value">Valor Estimado (R$)</Label>
              <Input
                id="opp-value"
                type="number"
                step="0.01"
                min="0"
                value={valorEstimado}
                onChange={(e) => setValorEstimado(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-stage">Etapa do Funil</Label>
              <Select value={etapaId} onValueChange={setEtapaId}>
                <SelectTrigger id="opp-stage" className="h-10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="opp-contact-name">Nome do Contato</Label>
            <Input
              id="opp-contact-name"
              placeholder="Ex: João da Silva"
              value={clienteContatoNome}
              onChange={(e) => setClienteContatoNome(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="opp-contact-phone">Telefone</Label>
              <Input
                id="opp-contact-phone"
                placeholder="Ex: (11) 99999-9999"
                value={clienteContatoTelefone}
                onChange={(e) => setClienteContatoTelefone(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-contact-email">E-mail</Label>
              <Input
                id="opp-contact-email"
                type="email"
                placeholder="Ex: joao@alfa.com"
                value={clienteContatoEmail}
                onChange={(e) => setClienteContatoEmail(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="opp-status">Status da Negociação</Label>
            <Select value={status} onValueChange={(val: any) => setStatus(val)}>
              <SelectTrigger id="opp-status" className="h-10">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                <SelectItem value="Aberta">📂 Em Negociação (Aberta)</SelectItem>
                <SelectItem value="Ganha">🎉 Ganha (Aceita)</SelectItem>
                <SelectItem value="Perdida">❌ Perdida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4 border-t flex items-center justify-between sm:justify-between w-full">
            {opportunity ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            ) : (
              <div /> // Spacer
            )}
            
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
