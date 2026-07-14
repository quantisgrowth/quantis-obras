-- Migration: add regras_parcelamento to empresas_clientes
-- Stores per-company installment configuration as JSONB.
-- Structure:
-- {
--   "habilitado": bool,
--   "prazo_primeiro_vencimento_dias": int (0|7|14|21|28),
--   "valor_minimo_parcela": float,
--   "taxa_juros_mensal": float (%),
--   "entrada_percentual": float (%),
--   "faixas": [{ "valor_minimo": float, "max_parcelas": int }]
-- }

ALTER TABLE public.empresas_clientes
  ADD COLUMN IF NOT EXISTS regras_parcelamento jsonb
    NOT NULL
    DEFAULT '{"habilitado":false,"prazo_primeiro_vencimento_dias":7,"valor_minimo_parcela":150,"taxa_juros_mensal":0,"entrada_percentual":0,"faixas":[]}'::jsonb;

NOTIFY pgrst, 'reload schema';
