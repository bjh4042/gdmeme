DROP POLICY IF EXISTS app_state_select_all ON public.app_state;
DROP POLICY IF EXISTS app_state_insert_all ON public.app_state;
DROP POLICY IF EXISTS app_state_update_all ON public.app_state;
REVOKE ALL ON public.app_state FROM anon;
REVOKE ALL ON public.app_state FROM authenticated;
GRANT ALL ON public.app_state TO service_role;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;