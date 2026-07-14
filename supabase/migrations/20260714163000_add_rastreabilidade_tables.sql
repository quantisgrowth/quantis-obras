-- 1. CAMINHÕES CONCRETAGEM
CREATE TABLE IF NOT EXISTS public.caminhoes_concretagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos_medicoes(id) ON DELETE CASCADE,
  numero_caminhao int,
  numero_lacre text,
  nota_fiscal_concreto text,
  elemento_estrutural text,
  volume_m3 float,
  slump_test_mm int,
  hora_moldagem timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.caminhoes_concretagem ENABLE ROW LEVEL SECURITY;

-- Políticas para caminhoes_concretagem
CREATE POLICY "Allow authenticated read on caminhoes" 
  ON public.caminhoes_concretagem FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated insert/update on caminhoes" 
  ON public.caminhoes_concretagem FOR ALL
  TO authenticated 
  USING (true)
  WITH CHECK (true);


-- 2. CORPOS PROVA
CREATE TABLE IF NOT EXISTS public.corpos_prova (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos_medicoes(id) ON DELETE CASCADE,
  caminhao_id uuid REFERENCES public.caminhoes_concretagem(id) ON DELETE CASCADE,
  codigo_barras text UNIQUE NOT NULL,
  idade_alvo_dias int NOT NULL,
  data_moldagem date NOT NULL,
  data_prevista_rompimento date NOT NULL,
  status text NOT NULL DEFAULT 'Moldado' CHECK (status IN ('Moldado', 'Recebido_Lab', 'Estufa', 'Rompido', 'Perdido')),
  localizacao_estufa text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.corpos_prova ENABLE ROW LEVEL SECURITY;

-- Políticas para corpos_prova
CREATE POLICY "Allow authenticated read on corpos_prova" 
  ON public.corpos_prova FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated insert/update on corpos_prova" 
  ON public.corpos_prova FOR ALL
  TO authenticated 
  USING (true)
  WITH CHECK (true);


-- 3. ENSAIOS ROMPIMENTO
CREATE TABLE IF NOT EXISTS public.ensaios_rompimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corpo_prova_id uuid REFERENCES public.corpos_prova(id) ON DELETE CASCADE UNIQUE,
  data_ensaio timestamp with time zone DEFAULT timezone('utc'::text, now()),
  carga_ruptura_kn float NOT NULL,
  diametro_mm float NOT NULL DEFAULT 100,
  altura_mm float NOT NULL DEFAULT 200,
  resistencia_mpa float NOT NULL,
  tipo_ruptura text,
  operador_id uuid REFERENCES auth.users(id),
  status_conformidade text CHECK (status_conformidade IN ('Conforme', 'Nao_Conforme', 'Abaixo_Fck_Esperado')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.ensaios_rompimento ENABLE ROW LEVEL SECURITY;

-- Políticas para ensaios_rompimento
CREATE POLICY "Allow authenticated read on ensaios" 
  ON public.ensaios_rompimento FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated insert/update on ensaios" 
  ON public.ensaios_rompimento FOR ALL
  TO authenticated 
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
