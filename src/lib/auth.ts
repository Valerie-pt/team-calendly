import type { NextRequest } from "next/server";

export const AUTH_COOKIE = "admin_auth";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

export function isAuthenticated(request: NextRequest): boolean {
  const password = getAdminPassword();
  if (!password) return false;
  const cookie = request.cookies.get(AUTH_COOKIE);
  return cookie?.value === password;
}
