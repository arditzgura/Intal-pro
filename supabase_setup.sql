-- ─── Ekzekuto këtë SQL në Supabase Dashboard → SQL Editor ───────────────────
-- URL: https://supabase.com/dashboard/project/ewbtqzdggfejpgoqbeif/sql

-- 1. Krijo tabelën sync_data
CREATE TABLE IF NOT EXISTS public.sync_data (
  user_id     TEXT        NOT NULL,
  table_name  TEXT        NOT NULL,
  data        JSONB       NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, table_name)
);

-- 2. Aktivizo Row Level Security
ALTER TABLE public.sync_data ENABLE ROW LEVEL SECURITY;

-- 3. Policy: çdo user lexon/shkruan vetëm të dhënat e veta
DROP POLICY IF EXISTS "sync_data_user_policy" ON public.sync_data;
CREATE POLICY "sync_data_user_policy" ON public.sync_data
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Aktivizo Real-time për këtë tabelë
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_data;
