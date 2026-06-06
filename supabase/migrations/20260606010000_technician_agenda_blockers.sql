-- 1. Create table public.bloqueios_tecnicos
CREATE TABLE IF NOT EXISTS public.bloqueios_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id uuid NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Medico', 'Folga', 'Problema_Veiculo', 'Outro')),
  descricao text,
  status text NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Rejeitado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Grant privileges for bloqueios_tecnicos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloqueios_tecnicos TO authenticated;
GRANT ALL ON public.bloqueios_tecnicos TO service_role;

-- Enable RLS for bloqueios_tecnicos
ALTER TABLE public.bloqueios_tecnicos ENABLE ROW LEVEL SECURITY;

-- Policies for bloqueios_tecnicos
DROP POLICY IF EXISTS "bloqueios_select" ON public.bloqueios_tecnicos;
CREATE POLICY "bloqueios_select" ON public.bloqueios_tecnicos FOR SELECT TO authenticated USING (
  tecnico_id IN (SELECT id FROM public.tecnicos WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "bloqueios_insert" ON public.bloqueios_tecnicos;
CREATE POLICY "bloqueios_insert" ON public.bloqueios_tecnicos FOR INSERT TO authenticated WITH CHECK (
  tecnico_id IN (SELECT id FROM public.tecnicos WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "bloqueios_update" ON public.bloqueios_tecnicos;
CREATE POLICY "bloqueios_update" ON public.bloqueios_tecnicos FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "bloqueios_delete" ON public.bloqueios_tecnicos;
CREATE POLICY "bloqueios_delete" ON public.bloqueios_tecnicos FOR DELETE TO authenticated USING (
  tecnico_id IN (SELECT id FROM public.tecnicos WHERE user_id = auth.uid())
  AND status = 'Pendente'
);
