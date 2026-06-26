import { redirect } from "next/navigation";
import type { Route } from "next";

export default function FleetPage() {
  redirect("/app/fleet/vehicles" as Route);
}
