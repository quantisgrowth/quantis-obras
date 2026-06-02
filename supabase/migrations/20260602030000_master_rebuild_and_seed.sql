-- ══════════════════════════════════════════════════════════════════════
-- SCRIPT MASTER: RECONSTRUÇÃO COMPLETA E SEED DO BANCO DE DADOS
-- ══════════════════════════════════════════════════════════════════════

-- ==========================================
-- 1. TIPOS E ENUMS
-- ==========================================
CREATE TYPE public.app_role AS ENUM ('cliente', 'tecnico', 'admin');
CREATE TYPE public.tecnico_status AS ENUM ('Disponivel', 'Em_Campo', 'Folga');
CREATE TYPE public.agendamento_status AS ENUM (
  'Pendente_Tecnico','Confirmado','Em_Execucao','Aguardando_Medicao','Validado','Laboratorio','Cancelado'
);
CREATE TYPE public.pagamento_status AS ENUM ('Pendente','Pago','Boleto_Aberto','Cancelado');
CREATE TYPE public.forma_pagamento AS ENUM ('Pix','Cartao','Boleto_14','Boleto_28');
CREATE TYPE public.foto_tipo AS ENUM ('Ciclo_CP','Final_Panoramica','Retorno_Carga','Checkin_QR');

-- ==========================================
-- 2. TABELAS E ESTRUTURAS
-- ==========================================

-- --- 2.1 Empresas Clientes ---
CREATE TABLE public.empresas_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  cnpj text NOT NULL UNIQUE,
  total_servicos_concluidos integer NOT NULL DEFAULT 0,
  diarias_mes_atual integer NOT NULL DEFAULT 0,
  mes_referencia date NOT NULL DEFAULT date_trunc('month', now()),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.empresas_clientes TO authenticated;
GRANT ALL ON public.empresas_clientes TO service_role;
ALTER TABLE public.empresas_clientes ENABLE ROW LEVEL SECURITY;

-- --- 2.2 Tecnicos ---
CREATE TABLE public.tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  nome text NOT NULL,
  rg text,
  cpf text UNIQUE,
  certificacoes text,
  foto_url text,
  status public.tecnico_status NOT NULL DEFAULT 'Disponivel',
  ranking_score numeric(5,2) NOT NULL DEFAULT 0,
  horario_fim_ultimo_servico timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tecnicos TO authenticated;
GRANT ALL ON public.tecnicos TO service_role;
ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;

-- --- 2.3 Profiles (Com Chaves Estrangeiras Corretas e Explícitas!) ---
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  nome_completo text NOT NULL DEFAULT '',
  telefone text,
  empresa_id uuid REFERENCES public.empresas_clientes(id) ON DELETE SET NULL,
  tecnico_id uuid REFERENCES public.tecnicos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- --- 2.4 User Roles ---
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- --- 2.5 Obras ---
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
  nome_obra text NOT NULL,
  endereco text NOT NULL,
  numero text,
  bairro text,
  cidade text NOT NULL,
  estado text,
  cep text,
  cno text,
  responsavel text,
  cargo_responsavel text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- --- 2.6 Cidades Atendidas ---
CREATE TABLE public.cidades_atendidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cidade text NOT NULL UNIQUE,
  mobilizacao_base numeric(10,2) NOT NULL DEFAULT 0,
  pedagio_estimado numeric(10,2) NOT NULL DEFAULT 0,
  minutos_deslocamento integer NOT NULL DEFAULT 60,
  is_base boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cidades_atendidas TO authenticated, anon;
GRANT ALL ON public.cidades_atendidas TO service_role;
ALTER TABLE public.cidades_atendidas ENABLE ROW LEVEL SECURITY;

-- --- 2.7 Servicos Catalogo (Tabela Base) ---
CREATE TABLE public.servicos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  nome_servico text NOT NULL,
  unidade text NOT NULL,
  valor_custo_base numeric(10,2) NOT NULL DEFAULT 0,
  valor_venda_editavel numeric(10,2) NOT NULL DEFAULT 0,
  equipamentos_inclusos jsonb NOT NULL DEFAULT '[]'::jsonb,
  categoria text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.servicos_catalogo TO authenticated, anon;
GRANT ALL ON public.servicos_catalogo TO service_role;
ALTER TABLE public.servicos_catalogo ENABLE ROW LEVEL SECURITY;

-- --- 2.8 Agendamentos Medicaoes ---
CREATE TABLE public.agendamentos_medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_pedido text NOT NULL UNIQUE DEFAULT ('GTB-' || to_char(now(),'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  empresa_id uuid NOT NULL REFERENCES public.empresas_clientes(id),
  servico_id uuid NOT NULL REFERENCES public.servicos_catalogo(id),
  criado_por uuid,
  tecnico_id uuid REFERENCES public.tecnicos(id),
  data_servico date NOT NULL,
  horario_na_obra time NOT NULL,
  horario_saida_lab time,
  volume_m3 numeric(10,2) NOT NULL DEFAULT 0,
  qtd_caminhoes integer NOT NULL DEFAULT 1,
  idades_selecionadas integer[] NOT NULL DEFAULT ARRAY[7,14,28]::integer[],
  cps_contratados integer NOT NULL DEFAULT 0,
  cps_moldados_real integer,
  diarias_necessarias integer NOT NULL DEFAULT 1,
  status_pagamento public.pagamento_status NOT NULL DEFAULT 'Pendente',
  forma_pagamento public.forma_pagamento,
  status_agendamento public.agendamento_status NOT NULL DEFAULT 'Pendente_Tecnico',
  valor_subtotal numeric(10,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(10,2) NOT NULL DEFAULT 0,
  valor_imposto_12 numeric(10,2) NOT NULL DEFAULT 0,
  valor_total numeric(10,2) NOT NULL DEFAULT 0,
  memoria_calculo jsonb,
  observacoes text,
  idades_cp jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agendamentos_medicoes TO authenticated;
GRANT ALL ON public.agendamentos_medicoes TO service_role;
ALTER TABLE public.agendamentos_medicoes ENABLE ROW LEVEL SECURITY;

-- --- 2.9 Historico Fotos ---
CREATE TABLE public.historico_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos_medicoes(id) ON DELETE CASCADE,
  tipo_foto public.foto_tipo NOT NULL,
  url_foto text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.historico_fotos TO authenticated;
GRANT ALL ON public.historico_fotos TO service_role;
ALTER TABLE public.historico_fotos ENABLE ROW LEVEL SECURITY;

-- --- 2.10 App Settings ---
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. VIEWS PÚBLICAS E SEGURAS
-- ==========================================

-- --- 3.1 Catalogo Pub (View Segura) ---
DROP VIEW IF EXISTS public.servicos_catalogo_pub CASCADE;
CREATE VIEW public.servicos_catalogo_pub AS
  SELECT
    id,
    sku,
    nome_servico,
    unidade,
    valor_venda_editavel,
    equipamentos_inclusos, -- Campo necessário no formulário
    categoria,
    ativo,
    created_at
  FROM public.servicos_catalogo;
GRANT SELECT ON public.servicos_catalogo_pub TO authenticated, anon;

-- --- 3.2 Tecnicos Pub (View Segura) ---
DROP VIEW IF EXISTS public.tecnicos_pub CASCADE;
CREATE VIEW public.tecnicos_pub
WITH (security_invoker = true) AS
  SELECT
    id,
    nome,
    certificacoes,
    foto_url,
    status,
    ranking_score,
    created_at
  FROM public.tecnicos;
GRANT SELECT ON public.tecnicos_pub TO authenticated;

-- ==========================================
-- 4. FUNÇÕES E TRIGGERS INTERNOS
-- ==========================================

-- Helper para checar regras
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger para criar perfil no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'telefone'
  );
  -- Adiciona role padrão
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Nota: O trigger on_auth_user_created na tabela auth.users já existe e foi criado pelo deployer.
-- Como o painel SQL roda como a role postgres (que não tem privilégios de superusuário para alterar a tabela auth.users),
-- nós não precisamos recriar o trigger aqui, apenas a função handle_new_user() no schema public.


-- Trigger do updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_agendamentos BEFORE UPDATE ON public.agendamentos_medicoes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger do total_servicos_concluidos
CREATE OR REPLACE FUNCTION public.bump_empresa_on_validado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status_agendamento = 'Validado' AND (OLD.status_agendamento IS DISTINCT FROM 'Validado') THEN
    UPDATE public.empresas_clientes
       SET total_servicos_concluidos = total_servicos_concluidos + 1
     WHERE id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER ag_bump_empresa AFTER UPDATE ON public.agendamentos_medicoes
FOR EACH ROW EXECUTE FUNCTION public.bump_empresa_on_validado();

-- Revogar execução das funções internas dos usuários normais
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_empresa_on_validado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- ==========================================
-- 5. POLÍTICAS DE SEGURANÇA (RLS)
-- ==========================================

-- --- Profiles RLS ---
CREATE POLICY "profile_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profile_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profile_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- --- User Roles RLS ---
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "empresas_read" ON public.empresas_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresas_insert_onboarding" ON public.empresas_clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "empresas_admin_update" ON public.empresas_clientes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- --- Obras RLS ---
CREATE POLICY "obras_read" ON public.obras FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = obras.empresa_id)
);
CREATE POLICY "obras_write" ON public.obras FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = obras.empresa_id)
);
CREATE POLICY "obras_update" ON public.obras FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = obras.empresa_id)
);

-- --- Cidades RLS ---
CREATE POLICY "cidades_read_all" ON public.cidades_atendidas FOR SELECT USING (true);
CREATE POLICY "cidades_admin_write" ON public.cidades_atendidas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- --- Catalogo RLS ---
CREATE POLICY "catalogo_read_admin_only" ON public.servicos_catalogo FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "catalogo_admin_write" ON public.servicos_catalogo FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- --- Tecnicos RLS ---
CREATE POLICY "tecnicos_read_admin" ON public.tecnicos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tecnicos_read_self" ON public.tecnicos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "tecnicos_admin_write" ON public.tecnicos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tecnicos_self_update" ON public.tecnicos FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- --- Agendamentos RLS ---
CREATE POLICY "ag_read" ON public.agendamentos_medicoes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  criado_por = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = agendamentos_medicoes.empresa_id) OR
  EXISTS (SELECT 1 FROM public.tecnicos t WHERE t.id = agendamentos_medicoes.tecnico_id AND t.user_id = auth.uid())
);
CREATE POLICY "ag_insert" ON public.agendamentos_medicoes FOR INSERT TO authenticated WITH CHECK (
  criado_por = auth.uid() OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "ag_update" ON public.agendamentos_medicoes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  criado_por = auth.uid() OR
  EXISTS (SELECT 1 FROM public.tecnicos t WHERE t.id = agendamentos_medicoes.tecnico_id AND t.user_id = auth.uid())
);

-- --- Fotos RLS ---
CREATE POLICY "fotos_read" ON public.historico_fotos FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (SELECT 1 FROM public.agendamentos_medicoes a WHERE a.id = historico_fotos.agendamento_id AND (
    a.criado_por = auth.uid() OR
    EXISTS (SELECT 1 FROM public.tecnicos t WHERE t.id = a.tecnico_id AND t.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = a.empresa_id)
  ))
);
CREATE POLICY "fotos_insert" ON public.historico_fotos FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR
  EXISTS (SELECT 1 FROM public.agendamentos_medicoes a JOIN public.tecnicos t ON t.id = a.tecnico_id WHERE a.id = historico_fotos.agendamento_id AND t.user_id = auth.uid())
);

-- --- App Settings RLS ---
CREATE POLICY "settings_read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));


-- ==========================================
-- 6. POPULAÇÃO DOS DADOS INICIAIS (SEED)
-- ==========================================

-- --- Seed App Settings ---
INSERT INTO public.app_settings(key, value, descricao) VALUES
  ('eficiencia_cps_tecnico', '70'::jsonb, 'CPs máximos moldados por técnico/diária'),
  ('limite_caminhoes_tecnico', '12'::jsonb, 'Caminhões máximos atendidos por técnico/diária'),
  ('valor_minimo_base', '1750.00'::jsonb, 'Valor mínimo bruto na região base'),
  ('imposto_percentual', '12.00'::jsonb, 'Percentual de imposto sobre faturamento'),
  ('desconto_pix_cartao', '5.00'::jsonb, 'Desconto % para Pix/Cartão'),
  ('limite_diarias_mes_cnpj', '10'::jsonb, 'Limite self-service por CNPJ/mês'),
  ('janela_aceitacao_min', '60'::jsonb, 'Janela de aceitação do técnico (minutos)'),
  ('descanso_interjornada_h', '11'::jsonb, 'Descanso interjornada obrigatório (horas)'),
  ('coef_hora_extra_util', '1.50'::jsonb, 'Coeficiente HE útil'),
  ('coef_hora_extra_fds', '2.00'::jsonb, 'Coeficiente HE fim de semana'),
  ('whatsapp_thais', '"5515999999999"'::jsonb, 'WhatsApp da vendedora Thais (com DDI)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, descricao = EXCLUDED.descricao;

-- --- Seed Serviços Geraltest (IDs Oficiais Mantidos!) ---
INSERT INTO public.servicos_catalogo (id, sku, nome_servico, unidade, valor_custo_base, valor_venda_editavel, equipamentos_inclusos, categoria, ativo) VALUES
  ('44eb0e9b-7277-40e4-80e9-83a632a98379', 'GTB-CP-25', 'Moldagem e Ensaio de Compressão (fck 25 MPa)', 'CP', 80.00, 120.00, '[]'::jsonb, 'Concreto', true),
  ('ca4cee1f-1e22-4a39-8f03-244a6205c99a', 'GTB-CP-30', 'Moldagem e Ensaio de Compressão (fck 30 MPa)', 'CP', 90.00, 130.00, '[]'::jsonb, 'Concreto', true),
  ('976ea993-b4bb-4743-9df8-cc22e76f8faf', 'GTB-CP-40', 'Moldagem e Ensaio de Compressão (fck 40 MPa)', 'CP', 100.00, 150.00, '[]'::jsonb, 'Concreto', true),
  ('50502570-bb65-4476-a7c1-b12b48e89208', 'GTB-SLUMP', 'Ensaio de Abatimento (Slump Test)', 'Ensaio', 50.00, 80.00, '[]'::jsonb, 'Concreto', true),
  ('18cdee53-8bb4-4bb9-9d67-2cca01a29acc', 'GTB-DIARIA', 'Diária do Técnico em Campo', 'Diária', 900.00, 1350.00, '[]'::jsonb, 'Geral', true)
ON CONFLICT (sku) DO UPDATE SET 
  nome_servico = EXCLUDED.nome_servico,
  unidade = EXCLUDED.unidade,
  valor_custo_base = EXCLUDED.valor_custo_base,
  valor_venda_editavel = EXCLUDED.valor_venda_editavel,
  equipamentos_inclusos = EXCLUDED.equipamentos_inclusos,
  categoria = EXCLUDED.categoria,
  ativo = EXCLUDED.ativo;

-- ==========================================
-- 7. RECONSTRUIR PERFIS E ROLES PARA USUÁRIOS EXISTENTES NO AUTH.USERS
--    (Impede que usuários fiquem sem perfil após o reset do schema public)
-- ==========================================
INSERT INTO public.profiles (id, nome_completo, created_at, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'nome_completo', raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'cliente'::public.app_role
FROM auth.users
ON CONFLICT DO NOTHING;

