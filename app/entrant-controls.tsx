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
  type EntrantActionState,
} from "./actions";
import { ConfirmButton } from "./confirm-button";

const initialState: EntrantActionState = {};

const primaryButtonClass =
  "h-9 cursor-pointer rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-foreground dark:hover:bg-zinc-300 dark:disabled:hover:bg-foreground";

const secondaryButtonClass =
  "h-9 cursor-pointer rounded-lg border border-zinc-300 px-3 text-sm transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800 dark:disabled:hover:bg-transparent";

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

function MobileActions({
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
      if (window.matchMedia("(min-width: 640px)").matches) {
        close();
        return;
      }
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

  function renderActions(layout: "inline" | "menu") {
    const primaryClass =
      primaryButtonClass + (layout === "menu" ? menuButtonClass : "");
    const secondaryClass =
      secondaryButtonClass + (layout === "menu" ? menuButtonClass : "");
    const formClass = layout === "menu" ? "flex flex-col" : undefined;

    return (
      <>
        {returnToPool ? (
          <form action={returnAction} className={formClass}>
            <input type="hidden" name="original_username" value={username} />
            <ConfirmButton
              title="Move to losers"
              description={`${username || "This entrant"} leaves this raffle and is marked as a previous loser. Their ticket count stays the same.`}
              confirmLabel="Move to losers"
              disabled={pending}
              className={primaryClass}
            >
              {returnPending ? "Moving…" : "Move to losers"}
            </ConfirmButton>
          </form>
        ) : null}
        {isLoser ? (
          <form action={readdAction} className={formClass}>
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
        <form action={deleteAction} className={formClass}>
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
      <div className="hidden justify-end gap-2 sm:flex sm:flex-nowrap">
        {renderActions("inline")}
      </div>
      <div className="sm:hidden">
        <MobileActions username={username} disabled={pending}>
          {renderActions("menu")}
        </MobileActions>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
