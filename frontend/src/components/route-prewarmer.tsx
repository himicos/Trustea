"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES = ["/app", "/app/create", "/app/trust", "/app/agent", "/app/memory", "/app/settings"];

export function RoutePrewarmer() {
  const router = useRouter();
  useEffect(() => {
    for (const r of ROUTES) router.prefetch(r);
  }, [router]);
  return null;
}
