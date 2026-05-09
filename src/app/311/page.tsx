// app/311/page.tsx — permanent redirect to the canonical project page.
import { redirect } from "next/navigation";

export default function Page311() {
  redirect("/work/boston-civic-data");
}
