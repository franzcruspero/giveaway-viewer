"use client";

import { useActionState } from "react";
import {
  addPreviousEntrant,
  deleteEntrant,
  returnDrawnWinner,
  type EntrantActionState,
} from "./actions";
import { ConfirmButton } from "./confirm-button";

const initialState: EntrantActionState = {};

export function EntrantControls({
  username,
  isLoser,
  returnToPool = false,
}: {
  username: string;
  isLoser: boolean;
  returnToPool?: boolean;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEntrant,
    initialState,
  );
  const [readdState, readdAction, readdPending] = useActionState(
    addPreviousEntrant,
    initialState,
  );
  const [returnState, returnAction, returnPending] = useActionState(
    returnDrawnWinner,
    initialState,
  );
  const pending = deletePending || readdPending || returnPending;
  const error = deleteState.error || readdState.error || returnState.error;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2 sm:flex-nowrap">
        {returnToPool ? (
          <form action={returnAction}>
            <input type="hidden" name="original_username" value={username} />
            <ConfirmButton
              title="Move to losers"
              description={`${username || "This entrant"} leaves this raffle and is marked as a previous loser. Their ticket count stays the same.`}
              confirmLabel="Move to losers"
              disabled={pending}
              className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background cursor-pointer transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-foreground dark:hover:bg-zinc-300 dark:disabled:hover:bg-foreground"
            >
              {returnPending ? "Moving…" : "Move to losers"}
            </ConfirmButton>
          </form>
        ) : null}
        {isLoser ? (
          <form action={readdAction}>
            <input type="hidden" name="original_username" value={username} />
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background cursor-pointer transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-foreground dark:hover:bg-zinc-300 dark:disabled:hover:bg-foreground"
            >
              Add to raffle
            </button>
          </form>
        ) : null}
        <form action={deleteAction}>
          <input type="hidden" name="original_username" value={username} />
          <input type="hidden" name="is_loser" value={String(isLoser)} />
          <ConfirmButton
            title="Remove entrant"
            description={`Remove ${username || "this entrant"}?`}
            confirmLabel="Remove"
            tone="danger"
            disabled={pending}
            className="h-9 rounded-lg border border-zinc-300 px-3 text-sm cursor-pointer transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent"
          >
            Remove
          </ConfirmButton>
        </form>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
