-- Migration: Resolução de Recursão Infinita em RLS (Sistema Completo)
-- Substitui chamadas da função pública has_role() dentro de políticas RLS por subconsultas diretas,
-- eliminando travamentos, loops de carregamento e lentidões para perfis admin/técnicos.

-- ==========================================
-- 1. user_roles
-- ==========================================
DROP POLICY IF EXISTS "roles_self_read" ON public.user_roles;
CREATE POLICY "roles_self_read" ON public.user_roles 
  FOR SELECT TO authenticated 
  USING (true); -- Permite leitura segura por qualquer usuário autenticado (remove recursão)

-- ==========================================
-- 2. profiles
-- ==========================================
DROP POLICY IF EXISTS "profile_self_select" ON public.profiles;
CREATE POLICY "profile_self_select" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (
    id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "profile_self_insert" ON public.profiles;
CREATE POLICY "profile_self_insert" ON public.profiles 
  FOR INSERT TO authenticated 
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profile_self_update" ON public.profiles;
CREATE POLICY "profile_self_update" ON public.profiles 
  FOR UPDATE TO authenticated 
  USING (
    id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ==========================================
-- 3. empresas_clientes
-- ==========================================
DROP POLICY IF EXISTS "empresas_admin_update" ON public.empresas_clientes;
CREATE POLICY "empresas_admin_update" ON public.empresas_clientes 
  FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "empresas_update_branding" ON public.empresas_clientes;
CREATE POLICY "empresas_update_branding" ON public.empresas_clientes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.empresa_id = empresas_clientes.id
        AND p.is_admin_empresa = true
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.empresa_id = empresas_clientes.id
        AND p.is_admin_empresa = true
    )
  );

-- ==========================================
-- 4. obras
-- ==========================================
DROP POLICY IF EXISTS "obras_read" ON public.obras;
CREATE POLICY "obras_read" ON public.obras 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = obras.empresa_id)
  );

DROP POLICY IF EXISTS "obras_write" ON public.obras;
CREATE POLICY "obras_write" ON public.obras 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = obras.empresa_id)
  );

DROP POLICY IF EXISTS "obras_update" ON public.obras;
CREATE POLICY "obras_update" ON public.obras 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = obras.empresa_id)
  );

-- ==========================================
-- 5. servicos_catalogo
-- ==========================================
DROP POLICY IF EXISTS "catalogo_read_admin_only" ON public.servicos_catalogo;
CREATE POLICY "catalogo_read_admin_only" ON public.servicos_catalogo 
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ==========================================
-- 6. tecnicos
-- ==========================================
DROP POLICY IF EXISTS "tecnicos_read_admin" ON public.tecnicos;
CREATE POLICY "tecnicos_read_admin" ON public.tecnicos 
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "tecnicos_admin_write" ON public.tecnicos;
CREATE POLICY "tecnicos_admin_write" ON public.tecnicos 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')) 
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ==========================================
-- 7. agendamentos_medicoes
-- ==========================================
DROP POLICY IF EXISTS "ag_read" ON public.agendamentos_medicoes;
CREATE POLICY "ag_read" ON public.agendamentos_medicoes 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    criado_por = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = agendamentos_medicoes.empresa_id) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = agendamentos_medicoes.tecnico_id)
  );

DROP POLICY IF EXISTS "ag_insert" ON public.agendamentos_medicoes;
CREATE POLICY "ag_insert" ON public.agendamentos_medicoes 
  FOR INSERT TO authenticated 
  WITH CHECK (
    criado_por = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "ag_update" ON public.agendamentos_medicoes;
CREATE POLICY "ag_update" ON public.agendamentos_medicoes 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    criado_por = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = agendamentos_medicoes.tecnico_id)
  );

-- ==========================================
-- 8. historico_fotos
-- ==========================================
DROP POLICY IF EXISTS "fotos_read" ON public.historico_fotos;
CREATE POLICY "fotos_read" ON public.historico_fotos 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (
      SELECT 1 FROM public.agendamentos_medicoes a 
      WHERE a.id = historico_fotos.agendamento_id AND (
        a.criado_por = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tecnico_id = a.tecnico_id) OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.empresa_id = a.empresa_id)
      )
    )
  );

DROP POLICY IF EXISTS "fotos_insert" ON public.historico_fotos;
CREATE POLICY "fotos_insert" ON public.historico_fotos 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (
      SELECT 1 FROM public.agendamentos_medicoes a 
      JOIN public.tecnicos t ON t.id = a.tecnico_id 
      WHERE a.id = historico_fotos.agendamento_id 
        AND t.user_id = auth.uid()
    )
  );
