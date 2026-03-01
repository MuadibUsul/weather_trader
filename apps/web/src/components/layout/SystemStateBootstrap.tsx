"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSystemState } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

export function SystemStateBootstrap() {
  const hydrateSystemState = useUiStore((s) => s.hydrateSystemState);
  const { data } = useQuery({
    queryKey: ["system-state"],
    queryFn: getSystemState,
    refetchInterval: 5_000,
    retry: 1,
  });

  useEffect(() => {
    if (data) {
      hydrateSystemState(data);
    }
  }, [data, hydrateSystemState]);

  return null;
}
