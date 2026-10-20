import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PityRow = {
  username: string;
  pity_tickets: number;
  is_loser: boolean;
};

export type WriteResult = {
  error?: string;
};

export type RaffleStatus = "open" | "closed" | "ended";

export type RaffleState = {
  status: RaffleStatus;
  winnerCount: number;
  lastWinners: string[];
  drawnUsernames: string[];
  subLuck: number;
};

const MAX_WINNERS = 50;

type PityRowRecord = {
  username: string | null;
  pity_tickets: number | string | null;
  is_loser: boolean | null;
};

function normalizeRow(row: PityRowRecord): PityRow {
  const tickets = Number(row.pity_tickets ?? 0);

  return {
    username: row.username?.trim() ?? "",
    pity_tickets: Number.isFinite(tickets) ? tickets : 0,
    is_loser: row.is_loser === true,
  };
}

function createSupabase(): SupabaseClient | { error: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return { error: "Supabase is not configured." };
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

function writeError(error: { message: string; code?: string }): WriteResult {
  console.error("pity_system write failed", error.message);
  if (
    error.code === "42501" ||
    /row-level security|permission denied/i.test(error.message)
  ) {
    return {
      error:
        "The Supabase key cannot change entrants. Set SUPABASE_KEY to the secret key.",
    };
  }
  if (error.code === "23505") {
    return { error: "That username is already in the list." };
  }
  return { error: "Could not update entrants." };
}

export async function loadPityRows(): Promise<
  { rows: PityRow[] } | { error: string }
> {
  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const { data, error } = await supabase
    .from("pity_system")
    .select("username, pity_tickets, is_loser")
    .order("pity_tickets", { ascending: false })
    .returns<PityRowRecord[]>();

  if (error) {
    console.error("pity_system query failed", error.message);
    return { error: "Could not load entrants." };
  }

  return { rows: (data ?? []).map(normalizeRow) };
}

export async function removeEntrant(
  username: string,
  isLoser: boolean,
): Promise<WriteResult> {
  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const name = username.trim();
  if (!name) {
    return { error: "Entrant was not found." };
  }

  const { data, error } = await supabase
    .from("pity_system")
    .delete()
    .eq("username", name)
    .eq("is_loser", isLoser)
    .select("username");

  if (error) {
    return writeError(error);
  }

  const dropped = await dropFromRaffleLists(supabase, name);
  if (dropped.error) {
    return dropped;
  }
  if (!data?.length && !dropped.removed) {
    return { error: "Entrant was not found." };
  }
  return {};
}

async function dropFromRaffleLists(
  supabase: SupabaseClient,
  username: string,
): Promise<WriteResult & { removed: boolean }> {
  const name = username.trim().toLowerCase();
  if (!name) {
    return { removed: false };
  }

  const { data: raffle, error: readError } = await supabase
    .from("raffle_state")
    .select("last_winners, drawn_usernames")
    .eq("id", 1)
    .maybeSingle();

  if (readError) {
    return { ...raffleWriteError(readError), removed: false };
  }
  if (!raffle) {
    return { error: "Could not update the raffle.", removed: false };
  }

  const drawn = usernameList(raffle.drawn_usernames);
  const winners = usernameList(raffle.last_winners);
  if (!drawn.includes(name) && !winners.includes(name)) {
    return { removed: false };
  }

  const { data, error } = await supabase
    .from("raffle_state")
    .update({
      last_winners: winners.filter((winner) => winner !== name),
      drawn_usernames: drawn.filter((winner) => winner !== name),
    })
    .eq("id", 1)
    .select("id");

  if (error) {
    return { ...raffleWriteError(error), removed: false };
  }
  if (!data?.length) {
    return { error: "Could not update the raffle.", removed: false };
  }
  return { removed: true };
}

export async function readdEntrant(username: string): Promise<WriteResult> {
  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const { data, error } = await supabase
    .from("pity_system")
    .update({ is_loser: false })
    .eq("username", username)
    .eq("is_loser", true)
    .select("username");

  if (error) {
    return writeError(error);
  }
  if (!data?.length) {
    return { error: "Entrant was not found." };
  }
  return {};
}

export async function readdAllLosers(): Promise<WriteResult> {
  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const { data, error } = await supabase
    .from("pity_system")
    .update({ is_loser: false })
    .eq("is_loser", true)
    .select("username");

  if (error) {
    return writeError(error);
  }
  if (!data?.length) {
    return { error: "No previous losers to add." };
  }
  return {};
}

function raffleWriteError(error: { message: string; code?: string }): WriteResult {
  console.error("raffle_state write failed", error.message);
  if (
    error.code === "42501" ||
    /row-level security|permission denied/i.test(error.message)
  ) {
    return {
      error:
        "The Supabase key cannot change the raffle. Set SUPABASE_KEY to the secret key.",
    };
  }
  return { error: "Could not update the raffle." };
}

function subLuckValue(value: unknown): number {
  const luck = Number(value);
  if (!Number.isInteger(luck) || luck < 1) {
    return 1;
  }
  return Math.min(luck, 10);
}

function raffleStatus(value: unknown): RaffleStatus {
  if (value === "open" || value === "closed" || value === "ended") {
    return value;
  }
  return "ended";
}

function usernameList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((name) => String(name ?? "").trim().toLowerCase())
    .filter(Boolean);
}

export async function loadRaffleState(): Promise<
  { state: RaffleState } | { error: string }
> {
  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const { data, error } = await supabase
    .from("raffle_state")
    .select("status, winner_count, last_winners, drawn_usernames, sub_luck")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("raffle_state query failed", error.message);
    return { error: "Could not load the raffle." };
  }
  if (!data) {
    return { error: "Could not load the raffle." };
  }

  const count = Number(data.winner_count);
  const winnerCount =
    Number.isInteger(count) && count >= 1 ? Math.min(count, MAX_WINNERS) : 1;

  return {
    state: {
      status: raffleStatus(data.status),
      winnerCount,
      lastWinners: usernameList(data.last_winners),
      drawnUsernames: usernameList(data.drawn_usernames),
      subLuck: subLuckValue(data.sub_luck),
    },
  };
}

export async function setSubLuck(value: number): Promise<WriteResult> {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return { error: "Subscriber luck must be a whole number from 1 to 10." };
  }

  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const { data, error } = await supabase
    .from("raffle_state")
    .update({ sub_luck: value })
    .eq("id", 1)
    .select("id");

  if (error) {
    return raffleWriteError(error);
  }
  if (!data?.length) {
    return { error: "Could not update the raffle." };
  }
  return {};
}

export async function moveWinnerToLosers(username: string): Promise<WriteResult> {
  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const name = username.trim().toLowerCase();
  if (!name) {
    return { error: "Entrant was not found." };
  }

  const { data: raffle, error: readError } = await supabase
    .from("raffle_state")
    .select("status, last_winners, drawn_usernames")
    .eq("id", 1)
    .maybeSingle();

  if (readError) {
    return raffleWriteError(readError);
  }
  if (!raffle) {
    return { error: "Could not update the raffle." };
  }
  if (raffle.status === "ended") {
    return { error: "The raffle has already ended." };
  }

  const drawn = usernameList(raffle.drawn_usernames);
  if (!drawn.includes(name)) {
    const { data: moved, error: loserError } = await supabase
      .from("pity_system")
      .update({ is_loser: true })
      .eq("username", name)
      .eq("is_loser", false)
      .select("username");

    if (loserError) {
      return writeError(loserError);
    }
    if (!moved?.length) {
      return { error: "Entrant was not found." };
    }
    return {};
  }

  const { data: moved, error: loserError } = await supabase
    .from("pity_system")
    .update({ is_loser: true })
    .eq("username", name)
    .select("username");

  if (loserError) {
    return writeError(loserError);
  }
  if (!moved?.length) {
    return { error: "Entrant was not found." };
  }

  const { data, error } = await supabase
    .from("raffle_state")
    .update({
      last_winners: usernameList(raffle.last_winners).filter(
        (winner) => winner !== name,
      ),
      drawn_usernames: drawn.filter((winner) => winner !== name),
    })
    .eq("id", 1)
    .select("id");

  if (error) {
    return raffleWriteError(error);
  }
  if (!data?.length) {
    return { error: "Could not update the raffle." };
  }
  return {};
}

export async function finalizeRaffle(): Promise<WriteResult> {
  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const { data: raffle, error: readError } = await supabase
    .from("raffle_state")
    .select("status, last_winners")
    .eq("id", 1)
    .maybeSingle();

  if (readError) {
    return raffleWriteError(readError);
  }
  if (!raffle) {
    return { error: "Could not update the raffle." };
  }
  if (raffle.status === "ended") {
    return { error: "The raffle has already ended." };
  }

  const winners = usernameList(raffle.last_winners);
  if (winners.length) {
    const { error: deleteError } = await supabase
      .from("pity_system")
      .delete()
      .in("username", winners);
    if (deleteError) {
      return writeError(deleteError);
    }
  }

  const { error: loserError } = await supabase
    .from("pity_system")
    .update({ is_loser: true })
    .eq("is_loser", false);
  if (loserError) {
    return writeError(loserError);
  }

  const { data, error } = await supabase
    .from("raffle_state")
    .update({
      status: "ended",
      last_winners: [],
      drawn_usernames: [],
    })
    .eq("id", 1)
    .select("id");

  if (error) {
    return raffleWriteError(error);
  }
  if (!data?.length) {
    return { error: "Could not update the raffle." };
  }
  return {};
}
