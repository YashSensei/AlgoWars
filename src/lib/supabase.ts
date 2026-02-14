/**
 * Supabase Admin Client
 * Uses secret key (sb_secret_...) for server-side operations (user management, etc.)
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
