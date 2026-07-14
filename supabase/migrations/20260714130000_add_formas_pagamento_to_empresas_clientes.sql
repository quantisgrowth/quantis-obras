-- Migration: add formas_pagamento_habilitadas to empresas_clientes
-- This column stores an array of enabled payment methods for each client company.
-- Possible values: 'Boleto_28', 'Pix', 'Cartao', 'Dinheiro'

ALTER TABLE public.empresas_clientes
  ADD COLUMN IF NOT EXISTS formas_pagamento_habilitadas text[]
    NOT NULL
    DEFAULT ARRAY['Boleto_28', 'Pix', 'Cartao', 'Dinheiro']::text[];

-- Ensure existing rows get the default value
UPDATE public.empresas_clientes
  SET formas_pagamento_habilitadas = ARRAY['Boleto_28', 'Pix', 'Cartao', 'Dinheiro']::text[]
  WHERE formas_pagamento_habilitadas IS NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
