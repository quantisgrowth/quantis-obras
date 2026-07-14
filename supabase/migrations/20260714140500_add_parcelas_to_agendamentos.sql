ALTER TABLE public.agendamentos_medicoes
  ADD COLUMN IF NOT EXISTS quantidade_parcelas int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS valor_entrada float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_juros_total float DEFAULT 0;

NOTIFY pgrst, 'reload schema';
