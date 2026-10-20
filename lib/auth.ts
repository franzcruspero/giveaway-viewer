import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

const COOKIE_NAME = "viewer_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function valuesMatch(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

function sessionToken(password: string) {
  return createHmac("sha256", password)
    .update("giveaway-viewer-session")
    .digest("hex");
}

function cookieValue(cookieHeader: string, name: string) {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }

    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

export async function isAuthenticated() {
  const password = process.env.VIEWER_PASSWORD;
  if (!password) {
    return false;
  }

  // Read the request Cookie header. `cookies()` throws in dev while a server
  // action re-renders this page, so the session check cannot use it.
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const token = cookieValue(cookieHeader, COOKIE_NAME);
  if (!token) {
    return false;
  }

  return valuesMatch(token, sessionToken(password));
}

export async function setViewerCookie(password: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearViewerCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function passwordMatches(submitted: string) {
  const password = process.env.VIEWER_PASSWORD;
  if (!password) {
    return false;
  }

  return valuesMatch(submitted, password);
}
