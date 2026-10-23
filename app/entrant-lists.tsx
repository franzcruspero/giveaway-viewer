"use client";

import { useState } from "react";
import { EntrantControls } from "./entrant-controls";
import { ReaddAllButton } from "./readd-all-button";
import type { PityRow } from "@/lib/supabase";

type CardAccent = "neutral" | "amber" | "blue" | "zinc";
type EntrantVariant = "winner" | "active" | "loser";

const variantAccent: Record<EntrantVariant, CardAccent> = {
  winner: "amber",
  active: "blue",
  loser: "zinc",
};

function CardBox({
  accent,
  children,
}: {
  accent: CardAccent;
  children: React.ReactNode;
}) {
  const strip = {
    neutral: "bg-zinc-400 dark:bg-zinc-600",
    amber: "bg-amber-400",
    blue: "bg-blue-500",
    zinc: "bg-zinc-300 dark:bg-zinc-700",
  }[accent];

  return (
    <div className="flex overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className={`w-1 shrink-0 ${strip}`} />
      <div className="min-w-0 flex-1 bg-zinc-50/50 p-5 dark:bg-zinc-900/50">
        {children}
      </div>
    </div>
  );
}

function EntrantSection({
  title,
  emptyMessage,
  rows,
  totalRows,
  noun = "entrant",
  variant,
  readdAll = false,
  moveToLosers = false,
  scrollable = false,
}: {
  title: string;
  emptyMessage: string;
  rows: PityRow[];
  totalRows: number;
  noun?: "entrant" | "winner";
  variant: EntrantVariant;
  readdAll?: boolean;
  moveToLosers?: boolean;
  scrollable?: boolean;
}) {
  const isFiltered = rows.length !== totalRows;
  const personLabel = isFiltered
    ? `${rows.length} of ${totalRows} ${totalRows === 1 ? noun : `${noun}s`}`
    : `${totalRows} ${totalRows === 1 ? noun : `${noun}s`}`;
  const totalTickets = rows.reduce((sum, row) => sum + row.pity_tickets, 0);
  const ticketLabel = `${totalTickets.toLocaleString("en-US")} ${totalTickets === 1 ? "ticket" : "tickets"}`;
  const stickyHeader = scrollable
    ? "sticky top-0 z-10 border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
    : "";

  return (
    <CardBox accent={variantAccent[variant]}>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">{title}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {personLabel} · {ticketLabel}
            </p>
          </div>
          {readdAll && rows.length > 0 ? <ReaddAllButton /> : null}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm">{emptyMessage}</p>
        ) : (
          <div
            className={
              scrollable
                ? "max-h-96 overflow-auto overscroll-y-contain"
                : "overflow-x-auto"
            }
          >
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-zinc-100/60 dark:bg-zinc-800/60">
                  <th
                    scope="col"
                    className={`rounded-l-md py-2 pr-4 pl-3 font-medium ${stickyHeader}`}
                  >
                    Username
                  </th>
                  <th
                    scope="col"
                    className={`py-2 pr-4 text-right font-medium ${stickyHeader}`}
                  >
                    Tickets
                  </th>
                  <th
                    scope="col"
                    className={`rounded-r-md py-2 pr-3 text-right font-medium ${stickyHeader}`}
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.username}-${index}`}
                    className="[&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-zinc-100 dark:[&:not(:last-child)>td]:border-zinc-800/80"
                  >
                    <td className="py-2 pr-4 pl-3">{row.username || "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.pity_tickets.toLocaleString("en-US")}
                    </td>
                    <td className="py-2 pr-3">
                      <EntrantControls
                        username={row.username}
                        isLoser={row.is_loser}
                        returnToPool={moveToLosers}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </CardBox>
  );
}

export function EntrantLists({
  rows,
  drawnUsernames,
}: {
  rows: PityRow[];
  drawnUsernames: string[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const drawn = new Set(drawnUsernames);
  const byName = new Map(
    rows.map((row) => [row.username.trim().toLowerCase(), row]),
  );
  const winnerRows = drawnUsernames.map(
    (username) =>
      byName.get(username) ?? {
        username,
        pity_tickets: 0,
        is_loser: false,
      },
  );

  const matchesQuery = (row: PityRow) =>
    !normalizedQuery || row.username.toLowerCase().includes(normalizedQuery);

  const filteredWinners = winnerRows.filter(matchesQuery);
  const activeRows = rows.filter(
    (row) => !row.is_loser && !drawn.has(row.username.trim().toLowerCase()),
  );
  const filteredActive = activeRows.filter(matchesQuery);
  const loserRows = rows.filter((row) => row.is_loser);
  const filteredLosers = loserRows.filter(matchesQuery);
  const totalResults =
    filteredWinners.length + filteredActive.length + filteredLosers.length;

  return (
    <>
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search entrants…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
        />
        {normalizedQuery && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {totalResults} {totalResults === 1 ? "result" : "results"}
          </p>
        )}
      </div>
      {winnerRows.length > 0 ? (
        <EntrantSection
          title="Drawn winners"
          emptyMessage="No winners match your search."
          noun="winner"
          rows={filteredWinners}
          totalRows={winnerRows.length}
          variant="winner"
          moveToLosers
        />
      ) : null}
      <EntrantSection
        title="In this raffle"
        emptyMessage={normalizedQuery ? "No entrants match your search." : "No one is in this raffle."}
        rows={filteredActive}
        totalRows={activeRows.length}
        variant="active"
        moveToLosers
        scrollable
      />
      <EntrantSection
        title="Previous losers"
        emptyMessage={normalizedQuery ? "No losers match your search." : "No previous losers."}
        rows={filteredLosers}
        totalRows={loserRows.length}
        variant="loser"
        readdAll
        scrollable
      />
    </>
  );
}
