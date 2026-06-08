-- Migration: Fix profiles and user roles for technicians
UPDATE public.profiles p
SET tecnico_id = t.id
FROM public.tecnicos t
WHERE p.id = t.user_id AND p.tecnico_id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'tecnico'::public.app_role
FROM public.tecnicos
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;
