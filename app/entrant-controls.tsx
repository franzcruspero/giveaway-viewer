"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  addPreviousEntrant,
  deleteEntrant,
  returnDrawnWinner,
  editTicketQuantity,
  type EntrantActionState,
} from "./actions";
import { ConfirmButton } from "./confirm-button";

const initialState: EntrantActionState = {};

const primaryButtonClass =
  "h-9 cursor-pointer rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-foreground dark:hover:bg-zinc-300 dark:disabled:hover:bg-foreground";

const secondaryButtonClass =
  "h-9 cursor-pointer rounded-lg border border-red-300 px-3 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 dark:disabled:hover:bg-transparent";

const menuButtonClass = " whitespace-nowrap";

function dialogIsOpen() {
  return document.querySelector("dialog[open]") !== null;
}

function placeMenu(button: HTMLElement, menu: HTMLElement) {
  const rect = button.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const gap = 6;
  const margin = 8;
  let top = rect.bottom + gap;
  const fitsBelow = top + menuRect.height <= window.innerHeight - margin;
  const above = rect.top - gap - menuRect.height;
  if (!fitsBelow && above >= margin) {
    top = above;
  }
  top = Math.max(
    margin,
    Math.min(top, window.innerHeight - menuRect.height - margin),
  );

  let left = rect.right - menuRect.width;
  left = Math.max(
    margin,
    Math.min(left, window.innerWidth - menuRect.width - margin),
  );
  return { top, left };
}

function EntrantActions({
  username,
  disabled,
  children,
}: {
  username: string;
  disabled: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [concealed, setConcealed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const instanceId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onOther(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== instanceId && !dialogIsOpen()) {
        setOpen(false);
        setPosition(null);
      }
    }

    window.addEventListener("entrant-actions-open", onOther);
    return () => window.removeEventListener("entrant-actions-open", onOther);
  }, [instanceId]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      setConcealed(false);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("entrant-actions-open", { detail: instanceId }),
    );

    const button = buttonRef.current;
    const menu = menuRef.current;
    if (button && menu) {
      setPosition(placeMenu(button, menu));
    }

    const anchorTop = button?.getBoundingClientRect().top ?? 0;

    function close() {
      setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      if (dialogIsOpen()) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      close();
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !dialogIsOpen()) {
        close();
      }
    }

    function onScroll() {
      if (dialogIsOpen()) {
        return;
      }
      const nextTop = buttonRef.current?.getBoundingClientRect().top;
      if (nextTop === undefined || Math.abs(nextTop - anchorTop) < 1) {
        return;
      }
      close();
    }

    function onResize() {
      const currentButton = buttonRef.current;
      const currentMenu = menuRef.current;
      if (currentButton && currentMenu) {
        setPosition(placeMenu(currentButton, currentMenu));
      }
    }

    function onDialogClose(event: Event) {
      if (event.target instanceof HTMLDialogElement) {
        close();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("close", onDialogClose, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("close", onDialogClose, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, instanceId]);

  function toggle() {
    setOpen((current) => !current);
  }

  function onMenuClick(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest("button");
    if (!button || button.disabled) {
      return;
    }
    if (button.type === "submit") {
      // Let the browser submit the form before this menu unmounts it.
      setTimeout(() => setOpen(false), 0);
      return;
    }
    setConcealed(true);
  }

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        id={menuId}
        role="group"
        aria-label={`Actions for ${username || "entrant"}`}
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
        }}
        onClick={onMenuClick}
        className={`fixed z-50 flex w-max min-w-44 flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${
          position && !concealed ? "" : "invisible"
        }`}
        inert={concealed || undefined}
      >
        {children}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={toggle}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Actions
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`size-4 text-zinc-500 transition-transform dark:text-zinc-400 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}

type TicketChoice = "keep" | "revoke";

function EditTicketsButton({
  username,
  currentTickets,
  formAction,
  pending,
  busy,
  className,
}: {
  username: string;
  currentTickets: number;
  formAction: (formData: FormData) => void;
  pending: boolean;
  busy: boolean;
  className: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmLock = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);
  const [ticketCount, setTicketCount] = useState(String(currentTickets));
  const name = username || "This entrant";

  useEffect(() => {
    setMounted(true);
  }, []);

  function openDialog(event: MouseEvent<HTMLButtonElement>) {
    formRef.current = event.currentTarget.form;
    setTicketCount(String(currentTickets));
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function confirm() {
    if (confirmLock.current) {
      return;
    }
    confirmLock.current = true;
    if (inputRef.current) {
      inputRef.current.value = ticketCount;
    }
    const form = formRef.current;
    closeDialog();
    form?.requestSubmit();
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="confirm-dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-background p-0 text-left text-foreground shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      onClose={() => {
        confirmLock.current = false;
        setTicketCount(String(currentTickets));
      }}
    >
      <form
        className="flex flex-col gap-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-base font-medium">
            Edit tickets
          </h2>
          <p
            id={descriptionId}
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Manually set the ticket count for @{name}. This directly overrides
            their current total.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ticket_count_input" className="text-sm font-medium">
            Ticket count
          </label>
          <input
            id="ticket_count_input"
            ref={inputRef}
            type="number"
            min="1"
            max="9999"
            value={ticketCount}
            onChange={(event) => setTicketCount(event.target.value)}
            className="h-9 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            className="h-9 cursor-pointer rounded-lg border border-zinc-300 px-3 text-sm transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 cursor-pointer rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:hover:bg-zinc-300"
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );

  return (
    <form action={formAction} className="flex flex-col">
      <input type="hidden" name="original_username" value={username} />
      <input
        ref={inputRef}
        type="hidden"
        name="ticket_count"
        defaultValue={String(currentTickets)}
      />
      <button
        type="button"
        disabled={pending}
        onClick={openDialog}
        className={className}
      >
        {busy ? "Saving…" : "Edit tickets"}
      </button>
      {mounted ? createPortal(dialog, document.body) : null}
    </form>
  );
}

function MoveToLosersButton({
  username,
  formAction,
  pending,
  busy,
  className,
}: {
  username: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
  busy: boolean;
  className: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const revokeInputRef = useRef<HTMLInputElement>(null);
  const confirmLock = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const choiceName = useId();
  const [mounted, setMounted] = useState(false);
  const [choice, setChoice] = useState<TicketChoice>("keep");
  const name = username || "This entrant";

  useEffect(() => {
    setMounted(true);
  }, []);

  function openDialog(event: MouseEvent<HTMLButtonElement>) {
    formRef.current = event.currentTarget.form;
    setChoice("keep");
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function confirm() {
    if (confirmLock.current) {
      return;
    }
    confirmLock.current = true;
    if (revokeInputRef.current) {
      revokeInputRef.current.value = choice === "revoke" ? "true" : "false";
    }
    const form = formRef.current;
    closeDialog();
    form?.requestSubmit();
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="confirm-dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-background p-0 text-left text-foreground shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      onClose={() => {
        confirmLock.current = false;
        setChoice("keep");
      }}
    >
      <form
        className="flex flex-col gap-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-base font-medium">
            Move to losers
          </h2>
          <p
            id={descriptionId}
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            {name} leaves this raffle.
          </p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Ticket outcome</legend>
          <label
            className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2 ${
              choice === "keep"
                ? "border-foreground"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <input
              type="radio"
              name={choiceName}
              value="keep"
              checked={choice === "keep"}
              onChange={() => setChoice("keep")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Keep their ticket</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                Mark them as a previous loser and keep the ticket count.
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2 ${
              choice === "revoke"
                ? "border-foreground"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <input
              type="radio"
              name={choiceName}
              value="revoke"
              checked={choice === "revoke"}
              onChange={() => setChoice("revoke")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                Take the ticket away
              </span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                Undo the ticket from this entry. Someone with only 1 ticket is
                removed.
              </span>
            </span>
          </label>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            className="h-9 cursor-pointer rounded-lg border border-zinc-300 px-3 text-sm transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 cursor-pointer rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:hover:bg-zinc-300"
          >
            Move to losers
          </button>
        </div>
      </form>
    </dialog>
  );

  return (
    <form action={formAction} className="flex flex-col">
      <input type="hidden" name="original_username" value={username} />
      <input
        ref={revokeInputRef}
        type="hidden"
        name="revoke_ticket"
        defaultValue="false"
      />
      <button
        type="button"
        disabled={pending}
        onClick={openDialog}
        className={className}
      >
        {busy ? "Moving…" : "Move to losers"}
      </button>
      {mounted ? createPortal(dialog, document.body) : null}
    </form>
  );
}

export function EntrantControls({
  username,
  isLoser,
  returnToPool = false,
  tickets = 0,
}: {
  username: string;
  isLoser: boolean;
  returnToPool?: boolean;
  tickets?: number;
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
  const [editState, editAction, editPending] = useActionState(
    editTicketQuantity,
    initialState,
  );
  const pending = deletePending || readdPending || returnPending || editPending;
  const error = deleteState.error || readdState.error || returnState.error || editState.error;

  function renderActions() {
    const primaryClass = primaryButtonClass + menuButtonClass;
    const secondaryClass = secondaryButtonClass + menuButtonClass;

    return (
      <>
        <EditTicketsButton
          username={username}
          currentTickets={tickets}
          formAction={editAction}
          pending={pending}
          busy={editPending}
          className={primaryClass}
        />
        {returnToPool ? (
          <MoveToLosersButton
            username={username}
            formAction={returnAction}
            pending={pending}
            busy={returnPending}
            className={primaryClass}
          />
        ) : null}
        {isLoser ? (
          <form action={readdAction} className="flex flex-col">
            <input type="hidden" name="original_username" value={username} />
            <button
              type="submit"
              disabled={pending}
              className={primaryClass}
            >
              {readdPending ? "Adding…" : "Add to raffle"}
            </button>
          </form>
        ) : null}
        <form action={deleteAction} className="flex flex-col">
          <input type="hidden" name="original_username" value={username} />
          <input type="hidden" name="is_loser" value={String(isLoser)} />
          <ConfirmButton
            title="Remove entrant"
            description={`Remove ${username || "this entrant"}?`}
            confirmLabel="Remove"
            tone="danger"
            disabled={pending}
            className={secondaryClass}
          >
            {deletePending ? "Removing…" : "Remove"}
          </ConfirmButton>
        </form>
      </>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <EntrantActions username={username} disabled={pending}>
        {renderActions()}
      </EntrantActions>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
