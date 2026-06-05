-- Fix infinite recursion in RLS policies by refactoring agendamentos_medicoes and historico_fotos policies
-- to check profiles.tecnico_id instead of joining public.tecnicos table directly.

-- 1. Update agendamentos_medicoes policies
DROP POLICY IF EXISTS "ag_read" ON public.agendamentos_medicoes;
CREATE POLICY "ag_read" ON public.agendamentos_medicoes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  criado_por = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = agendamentos_medicoes.empresa_id) OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = agendamentos_medicoes.tecnico_id)
);

DROP POLICY IF EXISTS "ag_update" ON public.agendamentos_medicoes;
CREATE POLICY "ag_update" ON public.agendamentos_medicoes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  criado_por = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = agendamentos_medicoes.tecnico_id)
);

-- 2. Update historico_fotos policies
DROP POLICY IF EXISTS "fotos_read" ON public.historico_fotos;
CREATE POLICY "fotos_read" ON public.historico_fotos FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (SELECT 1 FROM public.agendamentos_medicoes a WHERE a.id = historico_fotos.agendamento_id AND (
    a.criado_por = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = a.tecnico_id) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = a.empresa_id)
  ))
);

DROP POLICY IF EXISTS "fotos_insert" ON public.historico_fotos;
CREATE POLICY "fotos_insert" ON public.historico_fotos FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (
    SELECT 1 FROM public.agendamentos_medicoes a
    WHERE a.id = historico_fotos.agendamento_id AND
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = a.tecnico_id)
  )
);
