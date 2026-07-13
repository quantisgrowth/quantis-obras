-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO FINANCEIRO/CONTRATOS: ADICIONAR CAMPOS DE FATURAMENTO CORPORATIVO
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.empresas_clientes
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS telefone_financeiro text,
  ADD COLUMN IF NOT EXISTS email_financeiro text,
  ADD COLUMN IF NOT EXISTS endereco_faturamento text,
  ADD COLUMN IF NOT EXISTS numero_faturamento text,
  ADD COLUMN IF NOT EXISTS bairro_faturamento text,
  ADD COLUMN IF NOT EXISTS cidade_faturamento text,
  ADD COLUMN IF NOT EXISTS estado_faturamento text,
  ADD COLUMN IF NOT EXISTS cep_faturamento text;
