-- Migration: Add request tracking SKU (codigo_solicitacao) and fix client cancellation RLS policy
-- 1. Add column codigo_solicitacao to agendamentos_medicoes
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS codigo_solicitacao text;

-- 2. Backfill existing rows
UPDATE public.agendamentos_medicoes SET codigo_solicitacao = codigo_pedido WHERE codigo_solicitacao IS NULL;

-- 3. Update the RLS policy for update on agendamentos_medicoes
DROP POLICY IF EXISTS "ag_update" ON public.agendamentos_medicoes;
CREATE POLICY "ag_update" ON public.agendamentos_medicoes 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    criado_por = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = agendamentos_medicoes.empresa_id) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = agendamentos_medicoes.tecnico_id)
  );
