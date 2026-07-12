-- ============================================================
-- 028_custom_access_token_hook.sql
-- JWT claim: user_role — role'u profiles tablosundan JWT'ye göm.
--
-- Motivasyon:
-- Middleware her /company, /team, /superadmin request'inde
-- profiles.role için ekstra DB read yapıyordu. Bu hook role'u JWT
-- claim'ine gömer, middleware base64 decode ile okur — DB read yok.
--
-- Nasıl calisir:
-- Supabase Auth, her access token mint ettiğinde (signIn / refresh /
-- auto-refresh) bu function'ı çağırır. Function `claims` JSON'una
-- `user_role` ekleyip döner. Sonraki request'lerde JWT payload'ında
-- claim mevcut olur.
--
-- ONEMLI DEPLOY ADIMI:
-- Bu function tanımlandıktan SONRA Supabase Dashboard'da
--   Authentication → Hooks → "Custom Access Token"
-- olarak enable edilmeli ve public.custom_access_token_hook seçilmeli.
-- Enable edilmezse function tanımlıdır ama çağrılmaz — middleware
-- fallback DB read'e düşer, davranış eskisi gibi kalır (regression yok).
--
-- Rollback:
-- Dashboard'dan hook disable et; function drop et:
--   drop function public.custom_access_token_hook(jsonb);
-- Middleware zaten fallback ile geriye uyumlu.
-- ============================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  claims jsonb;
  user_role_val text;
begin
  claims := event->'claims';

  select role
    into user_role_val
    from public.profiles
   where user_id = (event->>'user_id')::uuid;

  -- Profile yoksa (edge case: user auth.users'da var ama profiles'ta yok)
  -- veya role null ise default 'individual'
  claims := jsonb_set(
    claims,
    '{user_role}',
    to_jsonb(coalesce(user_role_val, 'individual'))
  );

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Auth service function'ı çağırabilsin
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Function security definer olduğu için profiles'i owner (postgres) yetkisiyle
-- okur — supabase_auth_admin'e ekstra SELECT gerekmez.
