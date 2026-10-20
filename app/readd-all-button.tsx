"use client";

import { useActionState } from "react";
import { addAllPreviousEntrants, type EntrantActionState } from "./actions";
import { ConfirmButton } from "./confirm-button";

const initialState: EntrantActionState = {};

export function ReaddAllButton() {
  const [state, formAction, pending] = useActionState(
    addAllPreviousEntrants,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <ConfirmButton
        title="Re-add all losers"
        description="Add all previous losers to this raffle? Their ticket counts stay the same."
        confirmLabel="Re-add all"
        disabled={pending}
        className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background cursor-pointer transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-foreground dark:hover:bg-zinc-300 dark:disabled:hover:bg-foreground"
      >
        {pending ? "Adding…" : "Re-add all"}
      </ConfirmButton>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
