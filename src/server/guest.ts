import { cookies } from "next/headers";

export const GUEST_COOKIE = "dayfolio_guest";

const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGuestId(value: string | undefined): value is string {
  return value != null && GUEST_ID.test(value);
}

export async function readGuestId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(GUEST_COOKIE)?.value;
  return isGuestId(value) ? value : null;
}

export async function ensureGuestId(): Promise<string> {
  const existing = await readGuestId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  const jar = await cookies();
  jar.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return id;
}
