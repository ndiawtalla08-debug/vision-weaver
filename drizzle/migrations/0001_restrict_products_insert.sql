DROP POLICY IF EXISTS "Ajout public de produits" ON public.products;
REVOKE INSERT ON public.products FROM anon, authenticated;