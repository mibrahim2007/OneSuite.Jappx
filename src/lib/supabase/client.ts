import { createClient } from "@supabase/supabase-js";

// This client is for Realtime subscriptions and Storage ONLY.
// All data queries must use Drizzle ORM via src/lib/db/index.ts
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
