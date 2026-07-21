import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// proxy.ts already sends unauthenticated requests to /login before this
// ever renders; this only needs to pick a destination for an authenticated
// hit on "/".
export default async function RootPage() {
  const session = await auth();
  redirect(session?.user ? "/dashboard" : "/login");
}
