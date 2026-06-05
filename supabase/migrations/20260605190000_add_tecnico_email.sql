-- Add email column to public.tecnicos if it does not exist
ALTER TABLE public.tecnicos ADD COLUMN IF NOT EXISTS email text;

-- Populate existing email addresses from auth.users
UPDATE public.tecnicos t
SET email = u.email
FROM auth.users u
WHERE t.user_id = u.id AND t.email IS NULL;

-- Drop and recreate view to include email
DROP VIEW IF EXISTS public.tecnicos_pub CASCADE;
CREATE VIEW public.tecnicos_pub
WITH (security_invoker = true) AS
  SELECT
    id,
    nome,
    email,
    certificacoes,
    foto_url,
    status,
    ranking_score,
    created_at
  FROM public.tecnicos;
GRANT SELECT ON public.tecnicos_pub TO authenticated;

-- Create the helper function to query email by CPF securely
CREATE OR REPLACE FUNCTION public.get_email_by_cpf(p_cpf text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
BEGIN
  -- Clean CPF to only digits to compare
  SELECT email INTO v_email
  FROM public.tecnicos
  WHERE regexp_replace(cpf, '\D', '', 'g') = regexp_replace(p_cpf, '\D', '', 'g')
  LIMIT 1;
  
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_cpf(text) TO anon, authenticated;
