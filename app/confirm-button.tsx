"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ConfirmButtonProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function ConfirmButton({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  disabled = false,
  className,
  children,
}: ConfirmButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const confirmLock = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function openDialog(event: MouseEvent<HTMLButtonElement>) {
    formRef.current = event.currentTarget.form;
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
    const form = formRef.current;
    closeDialog();
    form?.requestSubmit();
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="confirm-dialog m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-background p-0 text-left text-foreground shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      onClose={() => {
        confirmLock.current = false;
      }}
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-base font-medium">
            {title}
          </h2>
          <p
            id={descriptionId}
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            {description}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            className="h-9 cursor-pointer rounded-lg border border-zinc-300 px-3 text-sm transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirm}
            className={
              tone === "danger"
                ? "h-9 cursor-pointer rounded-lg bg-red-600 px-3 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                : "h-9 cursor-pointer rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:hover:bg-zinc-300"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openDialog}
        className={className}
      >
        {children}
      </button>
      {mounted ? createPortal(dialog, document.body) : null}
    </>
  );
}
