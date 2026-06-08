-- 1. Adicionar colunas à tabela servicos_catalogo
ALTER TABLE public.servicos_catalogo ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.servicos_catalogo ADD COLUMN IF NOT EXISTS tipo_cobranca text NOT NULL DEFAULT 'Por Execucao';
ALTER TABLE public.servicos_catalogo ADD COLUMN IF NOT EXISTS formas_pagamento_aceitas text[] NOT NULL DEFAULT ARRAY['PIX', 'Boleto', 'Cartao']::text[];
ALTER TABLE public.servicos_catalogo ADD COLUMN IF NOT EXISTS regra_minimo_a_vista numeric(10,2) NOT NULL DEFAULT 1000.00;

-- 2. Recriar a view servicos_catalogo_pub para incluir as novas colunas
DROP VIEW IF EXISTS public.servicos_catalogo_pub CASCADE;
CREATE VIEW public.servicos_catalogo_pub AS
  SELECT
    id,
    sku,
    nome_servico,
    unidade,
    valor_custo_base,
    valor_venda_editavel,
    equipamentos_inclusos,
    categoria,
    ativo,
    descricao,
    tipo_cobranca,
    formas_pagamento_aceitas,
    regra_minimo_a_vista,
    created_at
  FROM public.servicos_catalogo;
GRANT SELECT ON public.servicos_catalogo_pub TO authenticated, anon;

-- 3. Criar a tabela de precificação por cidades
CREATE TABLE IF NOT EXISTS public.servicos_precos_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid NOT NULL REFERENCES public.servicos_catalogo(id) ON DELETE CASCADE,
  cidade_id uuid NOT NULL REFERENCES public.cidades_atendidas(id) ON DELETE CASCADE,
  valor_fixo numeric(10,2) NOT NULL DEFAULT 0,
  limite_unidades integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(servico_id, cidade_id)
);

-- Habilitar RLS na tabela servicos_precos_cidades
ALTER TABLE public.servicos_precos_cidades ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para servicos_precos_cidades
CREATE POLICY "precos_cidades_read_all" ON public.servicos_precos_cidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "precos_cidades_admin_write" ON public.servicos_precos_cidades FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

GRANT SELECT ON public.servicos_precos_cidades TO authenticated, anon;
GRANT ALL ON public.servicos_precos_cidades TO service_role;

-- 4. Adicionar colunas de orçamento manual em agendamentos_medicoes
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS is_orcamento_manual boolean NOT NULL DEFAULT false;
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS orcamento_aprovado boolean NOT NULL DEFAULT false;

