import { NextRequest } from "next/server";
import { getSlots, addSlot, bookSlot, deleteSlot } from "@/lib/sheets";
import { createCalendarEvent } from "@/lib/gcal";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const slots = await getSlots();
    return Response.json(slots);
  } catch (error) {
    console.error("GET /api/slots error:", error);
    return Response.json({ error: "Failed to fetch slots" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "add") {
      if (!isAuthenticated(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { interviewer_name, interviewer_email, date, time, duration_minutes } = body;
      if (!interviewer_name || !interviewer_email || !date || !time) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const id = await addSlot({
        interviewer_name,
        interviewer_email,
        date,
        time,
        duration_minutes: duration_minutes || 30,
      });
      return Response.json({ id });
    }

    if (action === "book") {
      const { slotId, candidate_name, candidate_email, candidate_telegram } = body;
      if (!slotId || !candidate_name || !candidate_email) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const success = await bookSlot(slotId, candidate_name, candidate_email, candidate_telegram || "");
      if (!success) {
        return Response.json({ error: "Slot is no longer available" }, { status: 409 });
      }

      // Find the slot data to create calendar event
      const allSlots = await getSlots();
      const bookedSlot = allSlots.find((s) => s.id === slotId);
      if (bookedSlot) {
        await createCalendarEvent({
          interviewer_email: bookedSlot.interviewer_email,
          interviewer_name: bookedSlot.interviewer_name,
          candidate_name,
          candidate_email,
          candidate_telegram: candidate_telegram || "",
          date: bookedSlot.date,
          time: bookedSlot.time,
          duration_minutes: bookedSlot.duration_minutes,
        });
      }

      return Response.json({ success: true });
    }

    if (action === "delete") {
      if (!isAuthenticated(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { slotId } = body;
      if (!slotId) {
        return Response.json({ error: "Missing slotId" }, { status: 400 });
      }
      const success = await deleteSlot(slotId);
      if (!success) {
        return Response.json({ error: "Slot not found" }, { status: 404 });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/slots error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
