import { redirect } from "next/navigation";
import type { Route } from "next";

export default function RmPage() {
  redirect("/app/rm/assets" as Route<"/app/rm/assets">);
}
