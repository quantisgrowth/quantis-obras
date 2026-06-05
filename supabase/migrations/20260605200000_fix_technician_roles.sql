-- Fix any technician users that don't have the 'tecnico' role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'tecnico'::public.app_role
FROM public.tecnicos
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
