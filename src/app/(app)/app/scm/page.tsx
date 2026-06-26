import { redirect } from "next/navigation";
import type { Route } from "next";

export default function ScmPage() {
  redirect("/app/inventory" as Route);
}
