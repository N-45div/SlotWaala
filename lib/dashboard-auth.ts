import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ownerCookie = "slotwaala_owner_access";

function configuredToken() {
  const value = process.env.DASHBOARD_ACCESS_TOKEN?.trim();
  return value || null;
}

function tokensMatch(received: string | undefined, expected: string) {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function dashboardAuthConfigured() {
  return Boolean(configuredToken());
}

export async function dashboardAccessIsValid() {
  const expected = configuredToken();
  if (!expected) return process.env.NODE_ENV !== "production";

  const store = await cookies();
  return tokensMatch(store.get(ownerCookie)?.value, expected);
}

export async function requireDashboardAccess() {
  if (!(await dashboardAccessIsValid())) {
    redirect("/login");
  }
}

export async function signInDashboard(token: string) {
  const expected = configuredToken();
  if (!expected || !tokensMatch(token.trim(), expected)) {
    return false;
  }

  const store = await cookies();
  store.set(ownerCookie, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return true;
}
