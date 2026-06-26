import { redirect } from "next/navigation";

export default function HrmPage() {
  redirect("/app/hrm/employees" as never);
}
