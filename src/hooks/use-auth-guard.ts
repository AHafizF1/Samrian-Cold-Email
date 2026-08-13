import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/lib/auth";

export function useAuthGuard() {
  const router = useRouter();
  const { data: session, isPending, error } = useAuthSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  return { session, isPending, user: session?.user };
}
