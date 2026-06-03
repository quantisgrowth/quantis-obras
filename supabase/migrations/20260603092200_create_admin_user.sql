-- 1. Update handle_new_user() trigger function to assign 'admin' to the master admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'telefone'
  );
  
  -- If email matches master admin, set admin role; otherwise, client
  IF NEW.email = 'felipe@quantisgrowth.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Insert the admin user into auth.users (if they don't already exist)
DO $$
DECLARE
  new_uid uuid := gen_random_uuid();
  user_exists boolean;
BEGIN
  -- Check if user already exists
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = 'felipe@quantisgrowth.com.br') INTO user_exists;

  IF NOT user_exists THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_uid,
      'authenticated',
      'authenticated',
      'felipe@quantisgrowth.com.br',
      crypt('Guiarados140315@', gen_salt('bf')),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"nome_completo":"Felipe Medeiros","telefone":""}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Ensure that if user already exists or was just created, they have the admin role in user_roles
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin' FROM auth.users WHERE email = 'felipe@quantisgrowth.com.br'
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

END $$;
