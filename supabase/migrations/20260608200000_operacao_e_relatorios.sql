-- 1. Alterar o tipo enumerado agendamento_status para incluir o novo status Pendente_Aprovacao_Gestor
ALTER TYPE public.agendamento_status ADD VALUE IF NOT EXISTS 'Pendente_Aprovacao_Gestor' AFTER 'Pendente_Tecnico';

-- 2. Adicionar coluna requer_aprovacao_tecnico em empresas_clientes
ALTER TABLE public.empresas_clientes ADD COLUMN IF NOT EXISTS requer_aprovacao_tecnico boolean NOT NULL DEFAULT false;

-- 3. Adicionar coluna valor_cp_excedente em servicos_catalogo
ALTER TABLE public.servicos_catalogo ADD COLUMN IF NOT EXISTS valor_cp_excedente numeric(10,2) NOT NULL DEFAULT 0.00;

-- 4. Adicionar colunas operacionais em agendamentos_medicoes
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS qtd_caminhoes_real integer;
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS horario_saida_real time;
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS horas_extras_minutos integer NOT NULL DEFAULT 0;
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS status_horas_extras text NOT NULL DEFAULT 'Sem_Horas_Extras';

-- 5. Recriar a view servicos_catalogo_pub
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
    valor_cp_excedente,
    created_at
  FROM public.servicos_catalogo;

GRANT SELECT ON public.servicos_catalogo_pub TO authenticated, anon;
