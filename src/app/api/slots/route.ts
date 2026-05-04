import { NextRequest } from "next/server";
import { getSlots, addSlot, bookSlot, deleteSlot, getEvents, getBlocks } from "@/lib/sheets";
import { createCalendarEvent } from "@/lib/gcal";
import { isAuthenticated } from "@/lib/auth";
import { findSlotConflict, isTooSoonForBooking, MIN_BOOKING_LEAD_HOURS } from "@/lib/conflict";

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
      const { interviewer_name, interviewer_email, date, time, duration_minutes, event_id } = body;
      if (!interviewer_name || !interviewer_email || !date || !time || !event_id) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }
      const events = await getEvents();
      if (!events.some((e) => e.id === event_id)) {
        return Response.json({ error: "Event not found" }, { status: 400 });
      }
      const duration = duration_minutes || 30;
      const [slots, blocks] = await Promise.all([getSlots(), getBlocks()]);
      const conflict = findSlotConflict(date, time, duration, slots, blocks);
      if (conflict.conflict) {
        return Response.json({ error: conflict.reason }, { status: 409 });
      }
      const id = await addSlot({
        interviewer_name,
        interviewer_email,
        date,
        time,
        duration_minutes: duration,
        event_id,
      });
      return Response.json({ id });
    }

    if (action === "book") {
      const { slotId, candidate_name, candidate_email, candidate_telegram } = body;
      if (!slotId || !candidate_name || !candidate_email) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      // Check 3-hour minimum lead time before booking
      const allSlots = await getSlots();
      const targetSlot = allSlots.find((s) => s.id === slotId);
      if (!targetSlot) {
        return Response.json({ error: "Slot not found" }, { status: 404 });
      }
      if (targetSlot.status === "booked") {
        return Response.json({ error: "Slot is no longer available" }, { status: 409 });
      }
      if (isTooSoonForBooking(targetSlot.date, targetSlot.time)) {
        return Response.json({
          error: `Бронировать можно не позднее, чем за ${MIN_BOOKING_LEAD_HOURS} часа до встречи`,
        }, { status: 409 });
      }

      const success = await bookSlot(slotId, candidate_name, candidate_email, candidate_telegram || "");
      if (!success) {
        return Response.json({ error: "Slot is no longer available" }, { status: 409 });
      }

      // Create calendar event in the interviewer's calendar
      const events = await getEvents();
      const slotEvent = events.find((e) => e.id === targetSlot.event_id);
      const zoomLink = slotEvent?.zoom_link || process.env.NEXT_PUBLIC_ZOOM_LINK || "";

      await createCalendarEvent({
        interviewer_email: targetSlot.interviewer_email,
        interviewer_name: targetSlot.interviewer_name,
        candidate_name,
        candidate_email,
        candidate_telegram: candidate_telegram || "",
        date: targetSlot.date,
        time: targetSlot.time,
        duration_minutes: targetSlot.duration_minutes,
        zoom_link: zoomLink,
      });

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
