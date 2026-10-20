"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { refreshGiveaway } from "./actions";

export function RealtimeListener() {
  const router = useRouter();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return;
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const refresh = () => {
      startTransition(async () => {
        await refreshGiveaway();
        router.refresh();
      });
    };

    const channel = supabase
      .channel("giveaway-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pity_system" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raffle_state" },
        refresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
