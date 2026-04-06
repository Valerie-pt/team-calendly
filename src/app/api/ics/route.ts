import { NextRequest } from "next/server";
import { generateICSContent } from "@/lib/calendar";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const title = p.get("title") || "Interview";
  const date = p.get("date") || "";
  const time = p.get("time") || "";
  const duration = parseInt(p.get("duration") || "30", 10);
  const description = p.get("description") || "";
  const location = p.get("location") || "";
  const organizer_name = p.get("organizer_name") || "";
  const organizer_email = p.get("organizer_email") || "";

  if (!date || !time) {
    return Response.json({ error: "Missing date or time" }, { status: 400 });
  }

  const ics = generateICSContent({
    title,
    date,
    time,
    duration_minutes: duration,
    description,
    location,
    organizer_name,
    organizer_email,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="interview.ics"`,
    },
  });
}
