"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearViewerCookie,
  isAuthenticated,
  passwordMatches,
  setViewerCookie,
} from "@/lib/auth";
import {
  readdAllLosers,
  readdEntrant,
  removeEntrant,
  finalizeRaffle,
  moveWinnerToLosers,
  setSubLuck,
  clearAllEntrants as clearAllEntrantsFromDb,
  resetRaffleEntries,
  updateTicketCount,
  logAction,
} from "@/lib/supabase";

export type LoginState = {
  error?: string;
};

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!process.env.VIEWER_PASSWORD) {
    return { error: "Viewer password is not configured." };
  }

  const password = process.env.VIEWER_PASSWORD;
  const submitted = String(formData.get("password") ?? "");
  if (!passwordMatches(submitted)) {
    return { error: "Incorrect password." };
  }

  await setViewerCookie(password);
  redirect("/");
}

export async function logout() {
  await clearViewerCookie();
  redirect("/");
}

export type EntrantActionState = {
  error?: string;
};

async function requireEditor(): Promise<EntrantActionState | null> {
  if (!(await isAuthenticated())) {
    return { error: "You need to log in." };
  }
  return null;
}

export async function deleteEntrant(
  _previous: EntrantActionState,
  formData: FormData,
): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const username = String(formData.get("original_username") ?? "").trim();
  const isLoser = formData.get("is_loser") === "true";
  if (!username) {
    return { error: "Entrant was not found." };
  }

  const result = await removeEntrant(username, isLoser);
  if (result.error) {
    return result;
  }

  await logAction("delete", username, "Removed from raffle");
  revalidatePath("/");
  return {};
}

export async function addPreviousEntrant(
  _previous: EntrantActionState,
  formData: FormData,
): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const username = String(formData.get("original_username") ?? "").trim();
  if (!username) {
    return { error: "Entrant was not found." };
  }

  const result = await readdEntrant(username);
  if (result.error) {
    return result;
  }

  await logAction("readd", username, "Added back to raffle");
  revalidatePath("/");
  return {};
}

export async function addAllPreviousEntrants(): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const result = await readdAllLosers();
  if (result.error) {
    return result;
  }

  revalidatePath("/");
  return {};
}

export async function returnDrawnWinner(
  _previous: EntrantActionState,
  formData: FormData,
): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const username = String(formData.get("original_username") ?? "").trim();
  if (!username) {
    return { error: "Entrant was not found." };
  }

  const revokeTicket = formData.get("revoke_ticket") === "true";
  const result = await moveWinnerToLosers(username, revokeTicket);
  if (result.error) {
    return result;
  }

  const detail = revokeTicket
    ? "Moved to losers (ticket revoked)"
    : "Moved to losers (ticket kept)";
  await logAction("move_to_losers", username, detail);
  revalidatePath("/");
  return {};
}

export async function refreshGiveaway(): Promise<void> {
  if (!(await isAuthenticated())) {
    return;
  }
  revalidatePath("/");
}

export async function updateSubLuck(
  _previous: EntrantActionState,
  formData: FormData,
): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const value = Number(formData.get("sub_luck"));
  const result = await setSubLuck(value);
  if (result.error) {
    return result;
  }

  revalidatePath("/");
  return {};
}

export async function clearEntrants(): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const result = await clearAllEntrantsFromDb();
  if (result.error) {
    return result;
  }

  revalidatePath("/");
  return {};
}

export async function endRaffle(): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const result = await finalizeRaffle();
  if (result.error) {
    return result;
  }

  revalidatePath("/");
  return {};
}

export async function resetEntries(): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const result = await resetRaffleEntries();
  if (result.error) {
    return result;
  }

  revalidatePath("/");
  return {};
}

export async function editTicketQuantity(
  _previous: EntrantActionState,
  formData: FormData,
): Promise<EntrantActionState> {
  const denied = await requireEditor();
  if (denied) {
    return denied;
  }

  const username = String(formData.get("original_username") ?? "").trim();
  if (!username) {
    return { error: "Entrant was not found." };
  }

  const count = Number(formData.get("ticket_count"));
  if (!Number.isInteger(count) || count < 1 || count > 9999) {
    return { error: "Ticket count must be a whole number between 1 and 9999." };
  }

  const result = await updateTicketCount(username, count);
  if (result.error) {
    return result;
  }

  await logAction(
    "edit_tickets",
    username,
    `Tickets changed to ${count}`,
  );
  revalidatePath("/");
  return {};
}
