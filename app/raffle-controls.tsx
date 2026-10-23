"use client";

import { createClient } from "@supabase/supabase-js";
import { useActionState, useEffect, useState } from "react";
import { endRaffle, updateSubLuck, type EntrantActionState } from "./actions";
import { ConfirmButton } from "./confirm-button";
import type { RaffleStatus } from "@/lib/supabase";

const initialState: EntrantActionState = {};

function asStatus(value: unknown): RaffleStatus | null {
  if (value === "open" || value === "closed" || value === "ended") {
    return value;
  }
  return null;
}

function asSubLuck(value: unknown): number | null {
  const luck = Number(value);
  if (!Number.isInteger(luck) || luck < 1 || luck > 10) {
    return null;
  }
  return luck;
}

export function RaffleControls({
  status,
  winnerCount,
  subLuck,
}: {
  status: RaffleStatus;
  winnerCount: number;
  subLuck: number;
}) {
  const [liveStatus, setLiveStatus] = useState(status);
  const [liveCount, setLiveCount] = useState(winnerCount);
  const [luck, setLuck] = useState({ saved: subLuck, draft: subLuck });
  const [synced, setSynced] = useState({ status, winnerCount, subLuck });
  if (
    status !== synced.status ||
    winnerCount !== synced.winnerCount ||
    subLuck !== synced.subLuck
  ) {
    setSynced({ status, winnerCount, subLuck });
    setLiveStatus(status);
    setLiveCount(winnerCount);
    setLuck({ saved: subLuck, draft: subLuck });
  }
  const [endState, endAction, endPending] = useActionState(
    endRaffle,
    initialState,
  );
  const [luckState, luckAction, luckPending] = useActionState(
    updateSubLuck,
    initialState,
  );
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return;
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const channel = supabase
      .channel("raffle-state-controls")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "raffle_state" },
        (payload) => {
          const row = payload.new;
          const nextStatus = asStatus(row.status);
          if (nextStatus) {
            setLiveStatus(nextStatus);
          }
          const count = Number(row.winner_count);
          if (Number.isInteger(count) && count >= 1) {
            setLiveCount(count);
          }
          const nextLuck = asSubLuck(row.sub_luck);
          if (nextLuck) {
            setLuck((current) => ({
              saved: nextLuck,
              draft: current.draft === current.saved ? nextLuck : current.draft,
            }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const winnerLabel = `${liveCount} ${liveCount === 1 ? "winner" : "winners"}`;
  const statusLabel =
    liveStatus === "open"
      ? "Raffle is open"
      : liveStatus === "closed"
        ? "Entries are closed"
        : "Raffle is ended";

  return (
    <div className="flex flex-col gap-2">
      {liveStatus === "ended" ? (
        <form action={luckAction} className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{statusLabel}</p>
          <label className="flex flex-col gap-1 text-sm" htmlFor="sub-luck">
            <span>Subscriber luck: {luck.draft}×</span>
            <input
              id="sub-luck"
              name="sub_luck"
              type="range"
              min={1}
              max={10}
              step={1}
              value={luck.draft}
              disabled={luckPending}
              onChange={(event) => {
                const next = asSubLuck(event.currentTarget.value);
                if (next) {
                  setLuck((current) => ({ ...current, draft: next }));
                }
              }}
              className="w-full max-w-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={luckPending || luck.draft === luck.saved}
            className="h-9 w-fit rounded-lg border border-zinc-300 px-3 text-sm cursor-pointer transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent"
          >
            {luckPending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : (
        <form action={endAction} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              {statusLabel}
              <span className="text-zinc-600 dark:text-zinc-400">
                {" "}
                · {winnerLabel} · Subscriber luck {luck.saved}×
              </span>
            </p>
            <ConfirmButton
              title="End the raffle"
              description="Drawn winners are removed and everyone else is marked as a loser."
              confirmLabel="End raffle"
              tone="danger"
              disabled={endPending}
              className="h-9 rounded-lg border border-zinc-300 px-3 text-sm cursor-pointer transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent"
            >
              {endPending ? "Ending…" : "End raffle"}
            </ConfirmButton>
          </div>
        </form>
      )}
      {endState.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {endState.error}
        </p>
      ) : null}
      {luckState.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {luckState.error}
        </p>
      ) : null}
    </div>
  );
}
