import { NextRequest } from "next/server";
import { getEvents, addEvent, deleteEvent, updateEventNotificationEmails } from "@/lib/sheets";
import { isAuthenticated } from "@/lib/auth";

function parseEmails(input: unknown): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join(",") : String(input);
  return raw
    .split(/[,\n;]/)
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await getEvents();
    return Response.json(events);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return Response.json({ error: "Failed to fetch events" }, { status: 500 });
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
      const { name, slug, zoom_link, notification_emails } = body;
      if (!name || !slug) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      // Validate slug
      const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!cleanSlug) {
        return Response.json({ error: "Invalid slug" }, { status: 400 });
      }
      // Check uniqueness
      const events = await getEvents();
      if (events.some((e) => e.slug === cleanSlug)) {
        return Response.json({ error: "Slug already exists" }, { status: 409 });
      }

      const id = await addEvent({
        name,
        slug: cleanSlug,
        zoom_link: zoom_link || "",
        notification_emails: parseEmails(notification_emails),
      });
      return Response.json({ id, slug: cleanSlug });
    }

    if (action === "update_notifications") {
      const { eventId, notification_emails } = body;
      if (!eventId) {
        return Response.json({ error: "Missing eventId" }, { status: 400 });
      }
      const success = await updateEventNotificationEmails(eventId, parseEmails(notification_emails));
      if (!success) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }
      return Response.json({ success: true });
    }

    if (action === "delete") {
      const { eventId } = body;
      if (!eventId) {
        return Response.json({ error: "Missing eventId" }, { status: 400 });
      }
      const success = await deleteEvent(eventId);
      if (!success) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/events error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
