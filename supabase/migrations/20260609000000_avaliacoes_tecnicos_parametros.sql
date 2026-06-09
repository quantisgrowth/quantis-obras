-- Criar tabela de avaliações de técnicos se não existir e adicionar colunas para parâmetros de avaliação
CREATE TABLE IF NOT EXISTS public.avaliacoes_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id uuid NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos_medicoes(id) ON DELETE CASCADE,
  avaliador_id uuid NOT NULL,
  tipo_avaliador text NOT NULL CHECK (tipo_avaliador IN ('cliente', 'gestor')),
  nota numeric(3,2) NOT NULL DEFAULT 5.00,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Adicionar colunas se não existirem
ALTER TABLE public.avaliacoes_tecnicos ADD COLUMN IF NOT EXISTS nota_comunicacao integer CHECK (nota_comunicacao BETWEEN 1 AND 5);
ALTER TABLE public.avaliacoes_tecnicos ADD COLUMN IF NOT EXISTS nota_conhecimento_tecnico integer CHECK (nota_conhecimento_tecnico BETWEEN 1 AND 5);
ALTER TABLE public.avaliacoes_tecnicos ADD COLUMN IF NOT EXISTS nota_pontualidade integer CHECK (nota_pontualidade BETWEEN 1 AND 5);
ALTER TABLE public.avaliacoes_tecnicos ADD COLUMN IF NOT EXISTS nota_limpeza_materiais integer CHECK (nota_limpeza_materiais BETWEEN 1 AND 5);
ALTER TABLE public.avaliacoes_tecnicos ADD COLUMN IF NOT EXISTS nota_organizacao_trabalho integer CHECK (nota_organizacao_trabalho BETWEEN 1 AND 5);

-- Habilitar RLS na tabela
ALTER TABLE public.avaliacoes_tecnicos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "avaliacoes_read_all" ON public.avaliacoes_tecnicos;
CREATE POLICY "avaliacoes_read_all" ON public.avaliacoes_tecnicos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "avaliacoes_insert_auth" ON public.avaliacoes_tecnicos;
CREATE POLICY "avaliacoes_insert_auth" ON public.avaliacoes_tecnicos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = avaliador_id OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT ON public.avaliacoes_tecnicos TO authenticated;
GRANT ALL ON public.avaliacoes_tecnicos TO service_role;
