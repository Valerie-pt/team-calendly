export function generateGoogleCalendarUrl(params: {
  title: string;
  date: string;
  time: string;
  duration_minutes: number;
  description: string;
  location: string;
}) {
  const startDate = toUTCFromMSK(params.date, params.time);
  const endDate = new Date(startDate.getTime() + params.duration_minutes * 60000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", params.title);
  url.searchParams.set("dates", `${fmt(startDate)}/${fmt(endDate)}`);
  url.searchParams.set("details", params.description);
  url.searchParams.set("location", params.location);

  return url.toString();
}

export function generateICSContent(params: {
  title: string;
  date: string;
  time: string;
  duration_minutes: number;
  description: string;
  location: string;
  organizer_name: string;
  organizer_email: string;
}) {
  const startDate = toUTCFromMSK(params.date, params.time);
  const endDate = new Date(startDate.getTime() + params.duration_minutes * 60000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@team-calendly`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Team Calendly//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${fmt(startDate)}`,
    `DTEND:${fmt(endDate)}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${params.description.replace(/\n/g, "\\n")}`,
    `LOCATION:${params.location}`,
    `ORGANIZER;CN=${params.organizer_name}:mailto:${params.organizer_email}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function toUTCFromMSK(date: string, time: string): Date {
  // MSK = UTC+3, so subtract 3 hours to get UTC
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(hours - 3, minutes, 0, 0);
  return d;
}
