-- Add cep column to public.locais_checkin table
ALTER TABLE public.locais_checkin ADD COLUMN IF NOT EXISTS cep text;
