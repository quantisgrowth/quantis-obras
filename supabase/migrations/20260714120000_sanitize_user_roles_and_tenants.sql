-- Migration: Sanitize duplicate user roles and incorrect company associations (crossovers)
-- This fixes the legacy seed bug that assigned the 'cliente' role to technicians/admins.

-- 1. Remove 'cliente' role for users who already have 'admin' or 'tecnico' roles
DELETE FROM public.user_roles
WHERE role = 'cliente'
  AND user_id IN (
    SELECT user_id 
    FROM public.user_roles 
    WHERE role IN ('admin', 'tecnico')
  );

-- 2. Clear empresa_id for any user that is not strictly a client (i.e. is Admin or Technician)
UPDATE public.profiles
SET empresa_id = NULL
WHERE id IN (
  SELECT user_id 
  FROM public.user_roles 
  WHERE role IN ('admin', 'tecnico')
);

-- 3. Clear empresa_id for any profile that is associated with a technician profile
UPDATE public.profiles
SET empresa_id = NULL
WHERE tecnico_id IS NOT NULL;
