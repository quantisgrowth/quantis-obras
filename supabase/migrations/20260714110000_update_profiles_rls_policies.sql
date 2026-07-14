-- Create helper functions to retrieve company context without triggering policy recursion
CREATE OR REPLACE FUNCTION public.get_user_empresa_id(user_uid uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE id = user_uid;
$$;

CREATE OR REPLACE FUNCTION public.is_user_master(user_uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sub_role = 'master', false) FROM public.profiles WHERE id = user_uid;
$$;

-- Drop old profile policies
DROP POLICY IF EXISTS "profile_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profile_self_update" ON public.profiles;

-- Create new robust policies
CREATE POLICY "profile_company_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    empresa_id = public.get_user_empresa_id(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profile_company_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid() OR
    (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.is_user_master(auth.uid())) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
