import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/infra/auth";

/**
 * Avoid `/` → `/admin` → `/login` chains (extra hop can confuse RSC/prefetch and look like a redirect loop).
 */
export default async function Home() {
  try {
    const user = await getCurrentUser();
    if (user) {
      redirect("/admin");
    }
  } catch {
    // DB unavailable: still land on login; user will see errors when signing in.
  }
  redirect("/login");
}
