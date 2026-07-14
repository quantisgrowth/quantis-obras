ALTER TABLE public.empresas_clientes
  ADD COLUMN IF NOT EXISTS formas_pagamento_habilitadas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS regras_parcelamento jsonb DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
