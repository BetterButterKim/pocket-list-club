import { createClient } from "@supabase/supabase-js";

// 브라우저/서버 공용 읽기 클라이언트 (익명 키)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 서버 전용 클라이언트 (Service Role 키 — 절대 브라우저에 노출 금지)
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
