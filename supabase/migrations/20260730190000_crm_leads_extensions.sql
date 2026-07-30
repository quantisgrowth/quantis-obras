-- Migration: Estender a tabela crm_leads com novos campos para visualização detalhada de dados do CRM

-- 1. Adicionar novas colunas para armazenar tags, dados financeiros e de comportamento
ALTER TABLE public.crm_leads 
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ticket_medio numeric(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_compras numeric(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS compras_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ciclo_compra_dias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_compra_dias integer NOT NULL DEFAULT 0;

-- 2. Garantir privilégios de leitura e escrita nas novas colunas para o authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
