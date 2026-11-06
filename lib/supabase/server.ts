import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configurationProblem } from "./config";
export function configurationError() {
  return configurationProblem(process.env);
}
export function isConfigured() {
  return configurationError() === null;
}
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
