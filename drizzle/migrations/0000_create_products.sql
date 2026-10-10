CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  category text NOT NULL,
  highlights text[] NOT NULL DEFAULT '{}',
  specifications text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  image_data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique des produits" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Ajout public de produits" ON public.products FOR INSERT TO anon, authenticated WITH CHECK (true);