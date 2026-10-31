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

export type ActionLogEntry = {
  id: number;
  created_at: string;
  action_type: string;
  entrant_username: string;
  detail: string;
};

const MAX_WINNERS = 50;

type FixtureEntrant = {
  username: string;
  pity_tickets: number;
  is_loser: boolean;
};

const fixtureEntrants: FixtureEntrant[] = [
  { username: "nova", pity_tickets: 4, is_loser: false },
  { username: "pixel", pity_tickets: 2, is_loser: false },
  { username: "ash", pity_tickets: 8, is_loser: false },
  { username: "birch", pity_tickets: 7, is_loser: false },
  { username: "ember", pity_tickets: 6, is_loser: false },
  { username: "cedar", pity_tickets: 5, is_loser: false },
  { username: "dune", pity_tickets: 4, is_loser: false },
  { username: "fern", pity_tickets: 3, is_loser: false },
  { username: "glen", pity_tickets: 3, is_loser: false },
  { username: "haze", pity_tickets: 2, is_loser: false },
  { username: "iris", pity_tickets: 2, is_loser: false },
  { username: "jade", pity_tickets: 1, is_loser: false },
  { username: "kelp", pity_tickets: 1, is_loser: false },
  { username: "quartz", pity_tickets: 1, is_loser: false },
  { username: "lark", pity_tickets: 9, is_loser: true },
  { username: "mink", pity_tickets: 8, is_loser: true },
  { username: "newt", pity_tickets: 7, is_loser: true },
  { username: "onyx", pity_tickets: 6, is_loser: true },
  { username: "kite", pity_tickets: 5, is_loser: true },
  { username: "pebble", pity_tickets: 4, is_loser: true },
  { username: "quail", pity_tickets: 4, is_loser: true },
  { username: "moss", pity_tickets: 3, is_loser: true },
  { username: "reed", pity_tickets: 3, is_loser: true },
  { username: "sage", pity_tickets: 2, is_loser: true },
  { username: "thorn", pity_tickets: 2, is_loser: true },
  { username: "umber", pity_tickets: 1, is_loser: true },
];

const fixtureRaffle = {
  status: "closed" as RaffleStatus,
  winner_count: 2,
  last_winners: ["nova", "pixel"],
  drawn_usernames: ["nova", "pixel"],
  sub_luck: 3,
};

let fixtureActionLogs: ActionLogEntry[] = [
  {
    id: 1,
    created_at: new Date(Date.now() - 2 * 60000).toISOString(), // 2 minutes ago
    action_type: "edit_tickets",
    entrant_username: "nova",
    detail: "Tickets changed to 5",
  },
  {
    id: 2,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
    action_type: "move_to_losers",
    entrant_username: "pixel",
    detail: "Moved to losers (ticket revoked)",
  },
  {
    id: 3,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(), // 15 minutes ago
    action_type: "delete",
    entrant_username: "ash",
    detail: "Removed from raffle",
  },
  {
    id: 4,
    created_at: new Date(Date.now() - 45 * 60000).toISOString(), // 45 minutes ago
    action_type: "readd",
    entrant_username: "birch",
    detail: "Added back to raffle",
  },
  {
    id: 5,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    action_type: "edit_tickets",
    entrant_username: "ember",
    detail: "Tickets changed to 12",
  },
];
let fixtureLogIdCounter = 6;

function usingFixtures(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY;
}

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
  if (usingFixtures()) {
    return { rows: sortedFixtureRows() };
  }

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
  if (usingFixtures()) {
    return removeFixtureEntrant(username, isLoser);
  }

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
  if (usingFixtures()) {
    return readdFixtureEntrant(username);
  }

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
  if (usingFixtures()) {
    return readdAllFixtureLosers();
  }

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

function sortedFixtureRows(): PityRow[] {
  return [...fixtureEntrants]
    .sort(
      (left, right) =>
        right.pity_tickets - left.pity_tickets ||
        left.username.localeCompare(right.username),
    )
    .map((row) => ({ ...row }));
}

function readFixtureRaffle(): { state: RaffleState } {
  const count = Number(fixtureRaffle.winner_count);
  const winnerCount =
    Number.isInteger(count) && count >= 1 ? Math.min(count, MAX_WINNERS) : 1;

  return {
    state: {
      status: raffleStatus(fixtureRaffle.status),
      winnerCount,
      lastWinners: usernameList(fixtureRaffle.last_winners),
      drawnUsernames: usernameList(fixtureRaffle.drawn_usernames),
      subLuck: subLuckValue(fixtureRaffle.sub_luck),
    },
  };
}

function dropFixtureFromRaffleLists(username: string): boolean {
  const name = username.trim().toLowerCase();
  if (!name) {
    return false;
  }

  const drawn = usernameList(fixtureRaffle.drawn_usernames);
  const winners = usernameList(fixtureRaffle.last_winners);
  if (!drawn.includes(name) && !winners.includes(name)) {
    return false;
  }

  fixtureRaffle.last_winners = winners.filter((winner) => winner !== name);
  fixtureRaffle.drawn_usernames = drawn.filter((winner) => winner !== name);
  return true;
}

function removeFixtureEntrant(username: string, isLoser: boolean): WriteResult {
  const name = username.trim();
  if (!name) {
    return { error: "Entrant was not found." };
  }

  const index = fixtureEntrants.findIndex(
    (row) => row.username === name && row.is_loser === isLoser,
  );
  if (index >= 0) {
    fixtureEntrants.splice(index, 1);
  }

  const removedFromLists = dropFixtureFromRaffleLists(name);
  if (index < 0 && !removedFromLists) {
    return { error: "Entrant was not found." };
  }
  return {};
}

function readdFixtureEntrant(username: string): WriteResult {
  const row = fixtureEntrants.find(
    (entrant) => entrant.username === username && entrant.is_loser,
  );
  if (!row) {
    return { error: "Entrant was not found." };
  }
  row.is_loser = false;
  return {};
}

function readdAllFixtureLosers(): WriteResult {
  const losers = fixtureEntrants.filter((entrant) => entrant.is_loser);
  if (!losers.length) {
    return { error: "No previous losers to add." };
  }
  for (const loser of losers) {
    loser.is_loser = false;
  }
  return {};
}

function applyFixtureLoserMove(row: FixtureEntrant, revokeTicket: boolean) {
  if (revokeTicket && row.pity_tickets <= 1) {
    const index = fixtureEntrants.indexOf(row);
    if (index >= 0) {
      fixtureEntrants.splice(index, 1);
    }
    return;
  }
  if (revokeTicket) {
    row.pity_tickets -= 1;
  }
  row.is_loser = true;
}

function moveFixtureWinnerToLosers(
  username: string,
  revokeTicket: boolean,
): WriteResult {
  const name = username.trim().toLowerCase();
  if (!name) {
    return { error: "Entrant was not found." };
  }
  if (fixtureRaffle.status === "ended") {
    return { error: "The raffle has already ended." };
  }

  const drawn = usernameList(fixtureRaffle.drawn_usernames);
  const row = drawn.includes(name)
    ? fixtureEntrants.find((entrant) => entrant.username === name)
    : fixtureEntrants.find(
        (entrant) => entrant.username === name && !entrant.is_loser,
      );
  if (!row || row.is_loser) {
    return { error: "Entrant was not found." };
  }

  applyFixtureLoserMove(row, revokeTicket);
  if (!drawn.includes(name)) {
    return {};
  }

  fixtureRaffle.last_winners = usernameList(fixtureRaffle.last_winners).filter(
    (winner) => winner !== name,
  );
  fixtureRaffle.drawn_usernames = drawn.filter((winner) => winner !== name);
  return {};
}

function finalizeFixtureRaffle(): WriteResult {
  if (fixtureRaffle.status === "ended") {
    return { error: "The raffle has already ended." };
  }

  const winners = new Set(usernameList(fixtureRaffle.last_winners));
  for (let index = fixtureEntrants.length - 1; index >= 0; index -= 1) {
    if (winners.has(fixtureEntrants[index].username)) {
      fixtureEntrants.splice(index, 1);
    }
  }
  for (const entrant of fixtureEntrants) {
    entrant.is_loser = true;
  }

  fixtureRaffle.status = "ended";
  fixtureRaffle.last_winners = [];
  fixtureRaffle.drawn_usernames = [];
  return {};
}

export async function loadRaffleState(): Promise<
  { state: RaffleState } | { error: string }
> {
  if (usingFixtures()) {
    return readFixtureRaffle();
  }

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
  if (usingFixtures()) {
    fixtureRaffle.sub_luck = value;
    return {};
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

export async function updateTicketCount(
  username: string,
  tickets: number,
): Promise<WriteResult> {
  if (!Number.isInteger(tickets) || tickets < 1) {
    return { error: "Ticket count must be a positive whole number." };
  }
  if (usingFixtures()) {
    const row = fixtureEntrants.find(
      (entrant) => entrant.username.toLowerCase() === username.toLowerCase(),
    );
    if (!row) {
      return { error: "Entrant was not found." };
    }
    row.pity_tickets = tickets;
    return {};
  }

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
    .update({ pity_tickets: tickets })
    .eq("username", name)
    .select("username");

  if (error) {
    return writeError(error);
  }
  if (!data?.length) {
    return { error: "Entrant was not found." };
  }
  return {};
}

export async function logAction(
  actionType: string,
  entrantUsername: string,
  detail: string,
): Promise<void> {
  if (usingFixtures()) {
    fixtureActionLogs.unshift({
      id: fixtureLogIdCounter++,
      created_at: new Date().toISOString(),
      action_type: actionType,
      entrant_username: entrantUsername,
      detail,
    });
    return;
  }

  const supabase = createSupabase();
  if ("error" in supabase) {
    console.error("action_logs insert failed: supabase not configured");
    return;
  }

  const { error } = await supabase.from("action_logs").insert({
    action_type: actionType,
    entrant_username: entrantUsername,
    detail,
  });

  if (error) {
    console.error("action_logs insert failed", error.message);
  }
}

export async function loadActionLogs(): Promise<ActionLogEntry[]> {
  if (usingFixtures()) {
    return fixtureActionLogs;
  }

  const supabase = createSupabase();
  if ("error" in supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("action_logs")
    .select("id, created_at, action_type, entrant_username, detail")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ActionLogEntry[]>();

  if (error) {
    console.error("action_logs query failed", error.message);
    return [];
  }

  return data ?? [];
}

async function movePityRowToLosers(
  supabase: SupabaseClient,
  name: string,
  revokeTicket: boolean,
): Promise<WriteResult> {
  const { data: row, error: readError } = await supabase
    .from("pity_system")
    .select("pity_tickets, is_loser")
    .eq("username", name)
    .maybeSingle();

  if (readError) {
    return writeError(readError);
  }
  if (!row || row.is_loser === true) {
    return { error: "Entrant was not found." };
  }

  const tickets = Number(row.pity_tickets);
  if (!Number.isFinite(tickets)) {
    return { error: "Entrant was not found." };
  }

  if (revokeTicket && tickets <= 1) {
    const { data: deleted, error } = await supabase
      .from("pity_system")
      .delete()
      .eq("username", name)
      .eq("is_loser", false)
      .select("username");

    if (error) {
      return writeError(error);
    }
    if (!deleted?.length) {
      return { error: "Entrant was not found." };
    }
    return {};
  }

  const { data: moved, error } = await supabase
    .from("pity_system")
    .update(
      revokeTicket
        ? { pity_tickets: tickets - 1, is_loser: true }
        : { is_loser: true },
    )
    .eq("username", name)
    .eq("is_loser", false)
    .select("username");

  if (error) {
    return writeError(error);
  }
  if (!moved?.length) {
    return { error: "Entrant was not found." };
  }
  return {};
}

export async function moveWinnerToLosers(
  username: string,
  revokeTicket = false,
): Promise<WriteResult> {
  if (usingFixtures()) {
    return moveFixtureWinnerToLosers(username, revokeTicket);
  }

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
  const moved = await movePityRowToLosers(supabase, name, revokeTicket);
  if (moved.error) {
    return moved;
  }
  if (!drawn.includes(name)) {
    return {};
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

function clearFixtureEntrants(): WriteResult {
  fixtureEntrants.splice(0, fixtureEntrants.length);
  fixtureRaffle.last_winners = [];
  fixtureRaffle.drawn_usernames = [];
  return {};
}

function resetFixtureRaffleEntries(): WriteResult {
  for (let i = fixtureEntrants.length - 1; i >= 0; i--) {
    const row = fixtureEntrants[i];
    if (row.is_loser) continue;
    if (row.pity_tickets === 1) {
      fixtureEntrants.splice(i, 1);
    } else {
      row.pity_tickets -= 1;
      row.is_loser = true;
    }
  }
  fixtureRaffle.last_winners = [];
  fixtureRaffle.drawn_usernames = [];
  fixtureRaffle.status = "ended";
  return {};
}

export async function clearAllEntrants(): Promise<WriteResult> {
  if (usingFixtures()) {
    return clearFixtureEntrants();
  }

  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const { error: deleteError } = await supabase.from("pity_system").delete().neq("username", "");

  if (deleteError) {
    return writeError(deleteError);
  }

  const { data, error: raffleError } = await supabase
    .from("raffle_state")
    .update({ last_winners: [], drawn_usernames: [] })
    .eq("id", 1)
    .select("id");

  if (raffleError) {
    return raffleWriteError(raffleError);
  }
  if (!data?.length) {
    return { error: "Could not update the raffle." };
  }
  return {};
}

async function loadCurrentEntrants(
  supabase: SupabaseClient,
): Promise<{ rows: { username: string; pity_tickets: number }[] } | WriteResult> {
  const pageSize = 1000;
  const rows: { username: string; pity_tickets: number }[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("pity_system")
      .select("username, pity_tickets")
      .eq("is_loser", false)
      .range(from, from + pageSize - 1);

    if (error) {
      return writeError(error);
    }

    for (const row of data ?? []) {
      const username = String(row.username ?? "").trim();
      const tickets = Number(row.pity_tickets);
      if (!username || !Number.isFinite(tickets)) {
        continue;
      }
      rows.push({ username, pity_tickets: tickets });
    }

    if (!data || data.length < pageSize) {
      return { rows };
    }
  }
}

async function deleteFreshEntrants(
  supabase: SupabaseClient,
  usernames: string[],
): Promise<WriteResult> {
  const chunkSize = 100;

  for (let from = 0; from < usernames.length; from += chunkSize) {
    const { error } = await supabase
      .from("pity_system")
      .delete()
      .in("username", usernames.slice(from, from + chunkSize))
      .eq("is_loser", false)
      .eq("pity_tickets", 1);

    if (error) {
      return writeError(error);
    }
  }

  return {};
}

async function returnEntrantsToLosers(
  supabase: SupabaseClient,
  rows: { username: string; pity_tickets: number }[],
): Promise<WriteResult> {
  const batchSize = 20;

  for (let from = 0; from < rows.length; from += batchSize) {
    const results = await Promise.all(
      rows.slice(from, from + batchSize).map((row) =>
        supabase
          .from("pity_system")
          .update({ pity_tickets: row.pity_tickets - 1, is_loser: true })
          .eq("username", row.username)
          .eq("is_loser", false),
      ),
    );

    for (const result of results) {
      if (result.error) {
        return writeError(result.error);
      }
    }
  }

  return {};
}

export async function resetRaffleEntries(): Promise<WriteResult> {
  if (usingFixtures()) {
    return resetFixtureRaffleEntries();
  }

  const supabase = createSupabase();
  if ("error" in supabase) {
    return supabase;
  }

  const loaded = await loadCurrentEntrants(supabase);
  if (!("rows" in loaded)) {
    return loaded;
  }

  const fresh = loaded.rows
    .filter((row) => row.pity_tickets === 1)
    .map((row) => row.username);
  const returning = loaded.rows.filter((row) => row.pity_tickets > 1);

  const deleted = await deleteFreshEntrants(supabase, fresh);
  if (deleted.error) {
    return deleted;
  }

  const returned = await returnEntrantsToLosers(supabase, returning);
  if (returned.error) {
    return returned;
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

export async function finalizeRaffle(): Promise<WriteResult> {
  if (usingFixtures()) {
    return finalizeFixtureRaffle();
  }

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
