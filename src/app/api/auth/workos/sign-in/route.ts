import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { withPublicLimit } from "@/server/limits/http";

export async function GET(request: Request) {
  return withPublicLimit(request, "auth.workos.sign-in", async () => {
    redirect(await getSignInUrl({ returnTo: "/dashboard" }));
  });
}
