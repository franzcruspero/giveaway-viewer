"use client";

import { useActionState } from "react";
import { clearEntrants, type EntrantActionState } from "./actions";
import { ConfirmButton } from "./confirm-button";

const initialState: EntrantActionState = {};

export function ClearAllButton() {
  const [state, formAction, pending] = useActionState(clearEntrants, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <ConfirmButton
        title="Clear all entrants"
        description="This permanently removes every entrant from the pity system — active, previous losers, and drawn winners. This cannot be undone."
        confirmLabel="Clear all"
        tone="danger"
        disabled={pending}
        className="h-9 rounded-lg border border-red-300 px-3 text-sm text-red-600 cursor-pointer transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 dark:disabled:hover:bg-transparent"
      >
        {pending ? "Clearing…" : "Clear all"}
      </ConfirmButton>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
