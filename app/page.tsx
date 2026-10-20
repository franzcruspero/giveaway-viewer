import { Suspense, type ReactNode } from "react";
import { logout } from "./actions";
import { EntrantControls } from "./entrant-controls";
import { LoginForm } from "./login-form";
import { ReaddAllButton } from "./readd-all-button";
import { RaffleControls } from "./raffle-controls";
import { RealtimeListener } from "./realtime-listener";
import { ThemeToggle } from "./theme-toggle";
import { isAuthenticated } from "@/lib/auth";
import { loadPityRows, loadRaffleState, type PityRow } from "@/lib/supabase";

type CardAccent = "neutral" | "amber" | "blue" | "zinc";
type EntrantVariant = "winner" | "active" | "loser";

const variantAccent: Record<EntrantVariant, CardAccent> = {
  winner: "amber",
  active: "blue",
  loser: "zinc",
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Giveaway entrants
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Current raffle, drawn winners, and previous losers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={null}>
            <LogoutButton />
          </Suspense>
          <ThemeToggle />
        </div>
      </div>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm">Loading…</p>}>
          <EntrantView />
        </Suspense>
      </div>
    </main>
  );
}

async function LogoutButton() {
  const authed = await isAuthenticated();
  if (!authed) {
    return null;
  }

  return (
    <form action={logout}>
      <button
        type="submit"
        className="h-9 rounded-lg border border-zinc-300 px-3 text-sm cursor-pointer transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Log out
      </button>
    </form>
  );
}

function CardBox({
  accent,
  children,
}: {
  accent: CardAccent;
  children: ReactNode;
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

async function EntrantView() {
  const authed = await isAuthenticated();
  if (!authed) {
    return <LoginForm />;
  }

  const [result, raffle] = await Promise.all([
    loadPityRows(),
    loadRaffleState(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <RealtimeListener />
      {"error" in raffle ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {raffle.error}
        </p>
      ) : (
        <CardBox accent="neutral">
          <RaffleControls
            status={raffle.state.status}
            winnerCount={raffle.state.winnerCount}
            subLuck={raffle.state.subLuck}
          />
        </CardBox>
      )}
      {"error" in result ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {result.error}
        </p>
      ) : (
        <EntrantLists
          rows={result.rows}
          drawnUsernames={"error" in raffle ? [] : raffle.state.drawnUsernames}
        />
      )}
    </div>
  );
}

function EntrantLists({
  rows,
  drawnUsernames,
}: {
  rows: PityRow[];
  drawnUsernames: string[];
}) {
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

  return (
    <>
      {winnerRows.length > 0 ? (
        <EntrantSection
          title="Drawn winners"
          emptyMessage="No winners drawn yet."
          noun="winner"
          rows={winnerRows}
          variant="winner"
          moveToLosers
        />
      ) : null}
      <EntrantSection
        title="In this raffle"
        emptyMessage="No one is in this raffle."
        rows={rows.filter(
          (row) =>
            !row.is_loser && !drawn.has(row.username.trim().toLowerCase()),
        )}
        variant="active"
        moveToLosers
      />
      <EntrantSection
        title="Previous losers"
        emptyMessage="No previous losers."
        rows={rows.filter((row) => row.is_loser)}
        variant="loser"
        readdAll
      />
    </>
  );
}

function EntrantSection({
  title,
  emptyMessage,
  rows,
  noun = "entrant",
  variant,
  readdAll = false,
  moveToLosers = false,
}: {
  title: string;
  emptyMessage: string;
  rows: PityRow[];
  noun?: "entrant" | "winner";
  variant: EntrantVariant;
  readdAll?: boolean;
  moveToLosers?: boolean;
}) {
  const personLabel = `${rows.length} ${rows.length === 1 ? noun : `${noun}s`}`;
  const totalTickets = rows.reduce((sum, row) => sum + row.pity_tickets, 0);
  const ticketLabel = `${totalTickets.toLocaleString("en-US")} ${totalTickets === 1 ? "ticket" : "tickets"}`;

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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-zinc-100/60 dark:bg-zinc-800/60">
                  <th scope="col" className="rounded-l-md py-2 pr-4 pl-3 font-medium">
                    Username
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Tickets
                  </th>
                  <th
                    scope="col"
                    className="rounded-r-md py-2 pr-3 text-right font-medium"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.username}-${index}`}
                    className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/80"
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
