"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicSettings } from "@/lib/settings";

export function useSettings() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.ok) setSettings(await res.json());
  }, []);
  useEffect(() => {
    // Carga inicial de los ajustes guardados.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);
  return { settings, setSettings, reload };
}
