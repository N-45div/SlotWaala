import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ownerCookie = "slotwaala_owner_access";
const accessModeCookie = "slotwaala_access_mode";

export type DashboardAccessMode = "owner" | "demo";

function configuredToken() {
  const value = process.env.DASHBOARD_ACCESS_TOKEN?.trim();
  return value || null;
}

function configuredDemoToken() {
  const value = process.env.DEMO_ACCESS_TOKEN?.trim();
  return value || null;
}

function tokensMatch(received: string | undefined, expected: string) {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function dashboardAuthConfigured() {
  return Boolean(configuredToken() || configuredDemoToken());
}

export function demoAccessConfigured() {
  return Boolean(configuredDemoToken());
}

export async function dashboardAccessMode(): Promise<DashboardAccessMode | null> {
  const expected = configuredToken();
  const demo = configuredDemoToken();
  if (!expected && !demo) return process.env.NODE_ENV !== "production" ? "owner" : null;

  const store = await cookies();
  const received = store.get(ownerCookie)?.value;
  if (expected && tokensMatch(received, expected)) return "owner";
  if (demo && tokensMatch(received, demo)) return "demo";
  return null;
}

export async function dashboardAccessIsValid() {
  return Boolean(await dashboardAccessMode());
}

export async function requireDashboardWriteAccess() {
  const mode = await dashboardAccessMode();
  if (!mode) redirect("/login");
  if (mode === "demo") {
    throw new Error("Demo access is read-only.");
  }
}

export async function requireDashboardAccess() {
  const mode = await dashboardAccessMode();
  if (!mode) {
    redirect("/login");
  }
  return mode;
}

export async function signInDashboard(token: string) {
  const expected = configuredToken();
  const demo = configuredDemoToken();
  const received = token.trim();
  const mode = expected && tokensMatch(received, expected)
    ? "owner"
    : demo && tokensMatch(received, demo)
      ? "demo"
      : null;
  if (!mode) {
    return false;
  }

  const store = await cookies();
  store.set(ownerCookie, received, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  store.set(accessModeCookie, mode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return true;
}

export async function signInDemoDashboard() {
  const demo = configuredDemoToken();
  if (!demo) return false;

  const store = await cookies();
  store.set(ownerCookie, demo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  store.set(accessModeCookie, "demo", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return true;
}
