import { Suspense } from "react";
import { logout } from "./actions";
import { ActionLogButton } from "./action-log";
import { ClearAllButton } from "./clear-all-button";
import { EntrantLists } from "./entrant-lists";
import { LoginForm } from "./login-form";
import { RaffleControls } from "./raffle-controls";
import { RealtimeListener } from "./realtime-listener";
import { ThemeToggle } from "./theme-toggle";
import { isAuthenticated } from "@/lib/auth";
import { loadPityRows, loadRaffleState, loadActionLogs } from "@/lib/supabase";


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
            <AuthButtons />
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

async function AuthButtons() {
  const authed = await isAuthenticated();
  if (!authed) {
    return null;
  }

  const logs = await loadActionLogs();

  return (
    <div className="flex items-center gap-2">
      <ActionLogButton entries={logs} />
      <form action={logout}>
        <button
          type="submit"
          className="h-9 rounded-lg border border-zinc-300 px-3 text-sm cursor-pointer transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Log out
        </button>
      </form>
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
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {raffle.error}
          </p>
          <ClearAllButton />
        </div>
      ) : (
        <div className="flex overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="w-1 shrink-0 bg-zinc-400 dark:bg-zinc-600" />
          <div className="min-w-0 flex-1 bg-zinc-50/50 p-5 dark:bg-zinc-900/50">
            <RaffleControls
              status={raffle.state.status}
              winnerCount={raffle.state.winnerCount}
              subLuck={raffle.state.subLuck}
            />
          </div>
        </div>
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
