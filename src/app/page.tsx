import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  let dbStatus: "connected" | "error" | "no-env" = "no-env";

  if (process.env.DATABASE_URL) {
    try {
      await db.execute(sql`SELECT 1`);
      dbStatus = "connected";
    } catch {
      dbStatus = "error";
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">OneSuite ERP</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Supabase Postgres:</span>
        <Badge
          variant={
            dbStatus === "connected"
              ? "default"
              : dbStatus === "no-env"
                ? "secondary"
                : "destructive"
          }
        >
          {dbStatus}
        </Badge>
      </div>
      <Button>shadcn/ui working</Button>
      <p className="text-xs text-muted-foreground">
        Story 1.1 bootstrap — set DATABASE_URL in .env.local to test DB connection
      </p>
    </main>
  );
}
