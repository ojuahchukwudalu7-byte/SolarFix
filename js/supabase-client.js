// ============================================================
// SolarFix — Supabase connection
// ============================================================
// 1. Go to your Supabase project → Project Settings → API
// 2. Copy the "Project URL" and the "anon public" key
// 3. Paste them below. These are safe to expose in frontend code —
//    Row Level Security (see sql/schema.sql) is what actually protects
//    your data, not secrecy of this key.
// ============================================================

const SUPABASE_URL = "https://eeczqnwqpytviytvpwou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY3pxbndxcHl0dml5dHZwd291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMzExMDksImV4cCI6MjEwMzgwNzEwOX0.HRYw_aGm7L6mWq_ZviLHCkbYvPzxZ8Mvz3Rax7kqLMg";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
