-- Adiciona coluna para justificar a reprovação de uma medição pelo gestor/cliente
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS justificativa_reprovacao text;
