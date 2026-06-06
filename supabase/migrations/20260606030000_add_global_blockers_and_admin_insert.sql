-- 1. Drop the NOT NULL constraint on tecnico_id to allow global blockers (e.g. holidays)
ALTER TABLE public.bloqueios_tecnicos ALTER COLUMN tecnico_id DROP NOT NULL;

-- 2. Drop the old check constraint on tipo and create a new one that allows 'Feriado' and 'Bloqueio_Global'
ALTER TABLE public.bloqueios_tecnicos DROP CONSTRAINT IF EXISTS bloqueios_tecnicos_tipo_check;
ALTER TABLE public.bloqueios_tecnicos ADD CONSTRAINT bloqueios_tecnicos_tipo_check CHECK (tipo IN ('Medico', 'Folga', 'Problema_Veiculo', 'Outro', 'Feriado', 'Bloqueio_Global'));

-- 3. Update RLS policies to allow admins to insert any blockers (global or technician-specific) and technicians to see global blockers
DROP POLICY IF EXISTS "bloqueios_select" ON public.bloqueios_tecnicos;
CREATE POLICY "bloqueios_select" ON public.bloqueios_tecnicos FOR SELECT TO authenticated USING (
  tecnico_id IS NULL
  OR tecnico_id IN (SELECT id FROM public.tecnicos WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "bloqueios_insert" ON public.bloqueios_tecnicos;
CREATE POLICY "bloqueios_insert" ON public.bloqueios_tecnicos FOR INSERT TO authenticated WITH CHECK (
  tecnico_id IN (SELECT id FROM public.tecnicos WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "bloqueios_delete" ON public.bloqueios_tecnicos;
CREATE POLICY "bloqueios_delete" ON public.bloqueios_tecnicos FOR DELETE TO authenticated USING (
  (tecnico_id IN (SELECT id FROM public.tecnicos WHERE user_id = auth.uid()) AND status = 'Pendente')
  OR public.has_role(auth.uid(), 'admin')
);
