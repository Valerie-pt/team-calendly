import { NextRequest } from "next/server";
import { getZoomAccounts, addZoomAccount, deleteZoomAccount } from "@/lib/sheets";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Only admins can see this list (zoom links are sensitive)
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accounts = await getZoomAccounts();
    return Response.json(accounts);
  } catch (error) {
    console.error("GET /api/zoom-accounts error:", error);
    return Response.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "add") {
      const { email, zoom_link, notes } = body;
      if (!email || !zoom_link) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const id = await addZoomAccount({ email, zoom_link, notes: notes || "" });
      return Response.json({ id });
    }

    if (action === "delete") {
      const { accountId } = body;
      if (!accountId) {
        return Response.json({ error: "Missing accountId" }, { status: 400 });
      }
      const success = await deleteZoomAccount(accountId);
      if (!success) {
        return Response.json({ error: "Account not found" }, { status: 404 });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/zoom-accounts error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
