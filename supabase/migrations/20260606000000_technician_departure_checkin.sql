-- 1. Create table public.locais_checkin
CREATE TABLE IF NOT EXISTS public.locais_checkin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  endereco text NOT NULL,
  numero text,
  bairro text,
  cidade text NOT NULL,
  estado text NOT NULL,
  latitude numeric(10,7),
  longitude numeric(10,7),
  tipo text NOT NULL CHECK (tipo IN ('Laboratorio', 'Hotel', 'Apoio', 'Outro')),
  tecnico_id uuid, -- Associated technician (optional)
  agendamento_id uuid, -- Associated booking (optional) for temporary hotel/lodging
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grant privileges for locais_checkin
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais_checkin TO authenticated;
GRANT ALL ON public.locais_checkin TO service_role;

-- Enable RLS for locais_checkin
ALTER TABLE public.locais_checkin ENABLE ROW LEVEL SECURITY;

-- Policies for locais_checkin
DROP POLICY IF EXISTS "locais_read" ON public.locais_checkin;
CREATE POLICY "locais_read" ON public.locais_checkin FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "locais_write" ON public.locais_checkin;
CREATE POLICY "locais_write" ON public.locais_checkin FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);

-- 2. Create table public.alertas_gestao
CREATE TABLE IF NOT EXISTS public.alertas_gestao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL,
  tecnico_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'Fora_Raio_Atuacao',
  descricao text NOT NULL,
  resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz
);

-- Grant privileges for alertas_gestao
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_gestao TO authenticated;
GRANT ALL ON public.alertas_gestao TO service_role;

-- Enable RLS for alertas_gestao
ALTER TABLE public.alertas_gestao ENABLE ROW LEVEL SECURITY;

-- Policies for alertas_gestao
DROP POLICY IF EXISTS "alertas_insert" ON public.alertas_gestao;
CREATE POLICY "alertas_insert" ON public.alertas_gestao FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "alertas_select" ON public.alertas_gestao;
CREATE POLICY "alertas_select" ON public.alertas_gestao FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "alertas_update" ON public.alertas_gestao;
CREATE POLICY "alertas_update" ON public.alertas_gestao FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);

-- 3. Add columns to public.tecnicos
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS laboratorio_padrao_id uuid REFERENCES public.locais_checkin(id) ON DELETE SET NULL;
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS raio_atuacao_km numeric(10,2) DEFAULT 50.00;

-- 4. Add columns to public.agendamentos_medicoes
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS ponto_partida_id uuid REFERENCES public.locais_checkin(id) ON DELETE SET NULL;
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS partida_custom_endereco text;
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS partida_lat numeric(10,7);
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS partida_lng numeric(10,7);
ALTER TABLE public.agendamentos_medicoes ADD COLUMN IF NOT EXISTS partido_em timestamptz;

-- 5. Foreign Keys setup for public.alertas_gestao
ALTER TABLE public.alertas_gestao DROP CONSTRAINT IF EXISTS fk_alertas_agendamento;
ALTER TABLE public.alertas_gestao ADD CONSTRAINT fk_alertas_agendamento FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos_medicoes(id) ON DELETE CASCADE;

ALTER TABLE public.alertas_gestao DROP CONSTRAINT IF EXISTS fk_alertas_tecnico;
ALTER TABLE public.alertas_gestao ADD CONSTRAINT fk_alertas_tecnico FOREIGN KEY (tecnico_id) REFERENCES public.tecnicos(id) ON DELETE CASCADE;
