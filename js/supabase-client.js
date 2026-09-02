// ============================================================
// SolarFix — Supabase connection
// ============================================================
// 1. Go to your Supabase project → Project Settings → API
// 2. Copy the "Project URL" and the "anon public" key
// 3. Paste them below. These are safe to expose in frontend code —
//    Row Level Security (see sql/schema.sql) is what actually protects
//    your data, not secrecy of this key.
// ============================================================

const SUPABASE_URL = "https://wdrhaycddiffhwicaqie.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcmhheWNkZGlmZmh3aWNhcWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDcxMTQsImV4cCI6MjEwMzg4MzExNH0.rMDZrvTQi_hVNxjtaJRhthTGTfHVRC987GYoeztH-IA";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
