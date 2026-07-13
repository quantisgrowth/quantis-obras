-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO CRM: PIPELINES, ETAPAS PERSONALIZADAS E OPORTUNIDADES
-- ══════════════════════════════════════════════════════════════════════

-- 1. Pipelines (Funis de Vendas)
CREATE TABLE IF NOT EXISTS public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS) para crm_pipelines
CREATE POLICY "Empresas acessam apenas seus pipelines" ON public.crm_pipelines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.empresa_id = crm_pipelines.empresa_id
    )
  );

-- Trigger para limitar no máximo 5 pipelines por empresa
CREATE OR REPLACE FUNCTION public.check_max_pipelines()
RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM public.crm_pipelines WHERE empresa_id = NEW.empresa_id) >= 5 THEN
    RAISE EXCEPTION 'Limite máximo de 5 pipelines por empresa atingido.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tg_check_max_pipelines
  BEFORE INSERT ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.check_max_pipelines();


-- 2. Etapas do Pipeline
CREATE TABLE IF NOT EXISTS public.crm_pipeline_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  nome text NOT NULL,
  posicao integer NOT NULL, -- Ordem de exibição horizontal no Kanban (0, 1, 2...)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_pipeline_etapas ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS) para crm_pipeline_etapas
CREATE POLICY "Empresas acessam apenas etapas de seus pipelines" ON public.crm_pipeline_etapas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_pipelines cp
      JOIN public.profiles p ON p.empresa_id = cp.empresa_id
      WHERE cp.id = crm_pipeline_etapas.pipeline_id AND p.id = auth.uid()
    )
  );

-- Trigger para limitar no máximo 15 etapas por pipeline
CREATE OR REPLACE FUNCTION public.check_max_pipeline_stages()
RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM public.crm_pipeline_etapas WHERE pipeline_id = NEW.pipeline_id) >= 15 THEN
    RAISE EXCEPTION 'Limite máximo de 15 etapas por pipeline atingido.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tg_check_max_pipeline_stages
  BEFORE INSERT ON public.crm_pipeline_etapas
  FOR EACH ROW EXECUTE FUNCTION public.check_max_pipeline_stages();

-- Trigger para impedir deletar etapa se houver apenas 2 ou menos no pipeline
CREATE OR REPLACE FUNCTION public.check_min_pipeline_stages()
RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM public.crm_pipeline_etapas WHERE pipeline_id = OLD.pipeline_id) <= 2 THEN
    RAISE EXCEPTION 'Um pipeline deve conter no mínimo 2 etapas. Adicione outra antes de remover esta.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tg_check_min_pipeline_stages
  BEFORE DELETE ON public.crm_pipeline_etapas
  FOR EACH ROW EXECUTE FUNCTION public.check_min_pipeline_stages();


-- 3. Oportunidades (Negócios no Pipeline)
CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.crm_pipeline_etapas(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
  nome_oportunidade text NOT NULL,
  valor_estimado numeric(10,2) NOT NULL DEFAULT 0,
  cliente_contato_nome text,
  cliente_contato_email text,
  cliente_contato_telefone text,
  status text NOT NULL CHECK (status IN ('Aberta', 'Ganha', 'Perdida')) DEFAULT 'Aberta',
  posicao_etapa integer NOT NULL DEFAULT 0, -- Ordenação vertical dentro de uma coluna/etapa
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS) para crm_oportunidades
CREATE POLICY "Empresas acessam apenas suas oportunidades" ON public.crm_oportunidades
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.empresa_id = crm_oportunidades.empresa_id
    )
  );

-- Trigger para atualizar timestamp de alteração
CREATE OR REPLACE FUNCTION public.update_crm_oportunidade_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tg_update_crm_oportunidade_timestamp
  BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_oportunidade_timestamp();
