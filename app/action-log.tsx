"use client";

import { useRef } from "react";
import type { ActionLogEntry } from "@/lib/supabase";

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    edit_tickets: "Edit tickets",
    delete: "Remove",
    move_to_losers: "Move to losers",
    readd: "Readd",
  };
  return labels[actionType] || actionType;
}

export function ActionLogButton({ entries }: { entries: ActionLogEntry[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openModal() {
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  const badge = entries.length;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="h-9 rounded-lg border border-zinc-300 px-3 text-sm cursor-pointer transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Action log{badge > 0 ? ` (${badge})` : ""}
      </button>

      <dialog
        ref={dialogRef}
        className="m-0 h-screen w-screen max-h-screen max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent sm:w-auto sm:max-w-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeModal();
          }
        }}
      >
        <div className="fixed right-0 top-0 h-screen w-full max-w-96 flex flex-col overflow-hidden rounded-l-xl border-l border-zinc-200 bg-background shadow-lg dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h2 className="text-lg font-medium">Action log</h2>
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Close"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-5 py-8">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No actions recorded yet.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-zinc-100/60 dark:bg-zinc-800/60">
                    <th className="py-2 px-4 font-medium text-left">Time</th>
                    <th className="py-2 px-4 font-medium text-left">Action</th>
                    <th className="py-2 px-4 font-medium text-left">Entrant</th>
                    <th className="py-2 px-4 font-medium text-left">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/30"
                    >
                      <td className="py-2 px-4 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {formatTime(entry.created_at)}
                      </td>
                      <td className="py-2 px-4 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        {actionLabel(entry.action_type)}
                      </td>
                      <td className="py-2 px-4 break-words text-zinc-700 dark:text-zinc-300 max-w-24">
                        {entry.entrant_username || "—"}
                      </td>
                      <td className="py-2 px-4 text-zinc-600 dark:text-zinc-400">
                        {entry.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
