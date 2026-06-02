-- Migração: Adicionar convidado_em e tecnicos_rejeitados na tabela agendamentos_medicoes

ALTER TABLE public.agendamentos_medicoes 
  ADD COLUMN IF NOT EXISTS convidado_em timestamptz,
  ADD COLUMN IF NOT EXISTS tecnicos_rejeitados uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.agendamentos_medicoes.convidado_em IS 'Data/hora em que o técnico atual foi convidado para o agendamento';
COMMENT ON COLUMN public.agendamentos_medicoes.tecnicos_rejeitados IS 'IDs dos técnicos que rejeitaram ou não aceitaram a tempo este agendamento';
