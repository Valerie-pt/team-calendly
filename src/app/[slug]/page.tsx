"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import type { Slot, Event } from "@/lib/sheets";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import { MIN_BOOKING_LEAD_HOURS } from "@/lib/conflict";
import DayGroup from "@/components/DayGroup";
import BookingModal from "@/components/BookingModal";

interface BookedInfo {
  slot: Slot;
  candidateName: string;
}

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// Returns the Monday of the week containing the given date (in local time).
function startOfWeek(d: Date): Date {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Mon = 0 offset
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function addDays(d: Date, n: number): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const startDay = start.getDate();
  const startMonth = MONTHS_GENITIVE[start.getMonth()];
  const endDay = end.getDate();
  const endMonth = MONTHS_GENITIVE[end.getMonth()];
  if (start.getMonth() === end.getMonth()) {
    return `${startDay}–${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookedInfo, setBookedInfo] = useState<BookedInfo | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  async function fetchData() {
    setLoading(true);
    try {
      const [eventsRes, slotsRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/slots"),
      ]);
      const events: Event[] = await eventsRes.json();
      const allSlots: Slot[] = await slotsRes.json();

      const matched = events.find((e) => e.slug === slug);
      if (!matched) {
        setNotFound(true);
        return;
      }
      setEvent(matched);

      const minBookingTime = Date.now() + MIN_BOOKING_LEAD_HOURS * 60 * 60 * 1000;
      const available = allSlots
        .filter((s) => s.id && s.status === "available" && s.event_id === matched.id)
        .filter((s) => new Date(`${s.date}T${s.time}:00+03:00`).getTime() > minBookingTime)
        .sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time}`);
          const dateB = new Date(`${b.date}T${b.time}`);
          return dateA.getTime() - dateB.getTime();
        });
      setSlots(available);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function handleBooked(candidateName: string) {
    if (selectedSlot) {
      setBookedInfo({ slot: selectedSlot, candidateName });
    }
    setSelectedSlot(null);
    fetchData();
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-2xl p-10 max-w-md w-full text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            Страница не найдена
          </h1>
          <p className="text-text-secondary">Проверьте ссылку у организатора</p>
        </div>
      </main>
    );
  }

  const defaultZoom = process.env.NEXT_PUBLIC_ZOOM_LINK || "";

  if (bookedInfo && event) {
    const { slot, candidateName } = bookedInfo;
    const zoomLink = event.zoom_link || defaultZoom;
    const eventTitle = `Интервью: ${candidateName} & ${slot.interviewer_name}`;
    const eventDescription = `Интервью\\nZoom: ${zoomLink}`;

    const googleUrl = generateGoogleCalendarUrl({
      title: eventTitle,
      date: slot.date,
      time: slot.time,
      duration_minutes: slot.duration_minutes,
      description: `Интервью\nZoom: ${zoomLink}`,
      location: zoomLink,
    });

    const icsParams = new URLSearchParams({
      title: eventTitle,
      date: slot.date,
      time: slot.time,
      duration: String(slot.duration_minutes),
      description: eventDescription,
      location: zoomLink,
      organizer_name: slot.interviewer_name,
      organizer_email: slot.interviewer_email,
    });
    const icsUrl = `/api/ics?${icsParams.toString()}`;

    return (
      <main className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-2xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Забронировано!</h1>
          <p className="text-text-secondary mb-1">
            {slot.date}, {slot.time} MSK ({slot.duration_minutes} мин)
          </p>
          <p className="text-text-secondary mb-4">с {slot.interviewer_name}</p>
          <p className="text-sm text-text-secondary mb-6">
            Zoom: <a href={zoomLink} className="text-accent hover:underline break-all">{zoomLink}</a>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2.5 bg-white text-foreground rounded-full font-medium hover:shadow-md transition-all text-sm text-center"
            >
              Google Calendar
            </a>
            <a
              href={icsUrl}
              className="flex-1 px-4 py-2.5 bg-white text-foreground rounded-full font-medium hover:shadow-md transition-all text-sm text-center"
            >
              Apple / Outlook (.ics)
            </a>
          </div>

          <button
            onClick={() => {
              setBookedInfo(null);
              router.refresh();
            }}
            className="text-sm text-accent hover:underline"
          >
            Назад к доступным слотам
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-14 sm:py-20">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3">
            {event?.name || "Запись на встречу"}
          </h1>
          <p className="text-text-secondary text-lg">Выберите удобный слот</p>
          <p className="text-sm text-text-secondary mt-1">
            Время указано по Москве (MSK, UTC+3) · бронирование не позднее, чем за {MIN_BOOKING_LEAD_HOURS} часа
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : slots.length === 0 ? (
          <div className="bg-card-bg rounded-2xl p-10 text-center">
            <p className="text-text-secondary text-lg">Сейчас нет доступных слотов</p>
            <p className="text-text-secondary text-sm mt-1">Загляните позже</p>
          </div>
        ) : (
          <WeekView
            slots={slots}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            onSelect={setSelectedSlot}
          />
        )}
      </div>

      {selectedSlot && event && (
        <BookingModal
          slot={selectedSlot}
          zoomLink={event.zoom_link || defaultZoom}
          notificationEmails={event.notification_emails}
          onClose={() => setSelectedSlot(null)}
          onBooked={handleBooked}
        />
      )}
    </main>
  );
}

function WeekView({
  slots,
  weekStart,
  setWeekStart,
  onSelect,
}: {
  slots: Slot[];
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  onSelect: (slot: Slot) => void;
}) {
  // Determine the earliest and latest weeks that have slots, used to disable navigation.
  const slotDates = slots.map((s) => new Date(s.date + "T00:00:00"));
  const earliestSlotDate = slotDates.length
    ? new Date(Math.min(...slotDates.map((d) => d.getTime())))
    : null;
  const latestSlotDate = slotDates.length
    ? new Date(Math.max(...slotDates.map((d) => d.getTime())))
    : null;
  const earliestWeek = earliestSlotDate ? startOfWeek(earliestSlotDate) : null;
  const latestWeek = latestSlotDate ? startOfWeek(latestSlotDate) : null;
  const todayWeek = startOfWeek(new Date());

  // Clamp weekStart so that empty weeks are skipped initially.
  const visibleWeekStart = useMemo(() => {
    if (!earliestWeek || !latestWeek) return weekStart;
    if (weekStart.getTime() < earliestWeek.getTime() && earliestWeek.getTime() >= todayWeek.getTime()) {
      return earliestWeek;
    }
    return weekStart;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, earliestWeek?.getTime(), latestWeek?.getTime()]);

  const weekEnd = addDays(visibleWeekStart, 7);
  const weekSlots = slots.filter((s) => {
    const dt = new Date(s.date + "T00:00:00");
    return dt.getTime() >= visibleWeekStart.getTime() && dt.getTime() < weekEnd.getTime();
  });

  const groupedByDay = weekSlots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(visibleWeekStart, i);
    return { date: d, iso: toISODate(d), slots: groupedByDay[toISODate(d)] || [] };
  });

  const canGoBack = !earliestWeek || visibleWeekStart.getTime() > earliestWeek.getTime();
  const canGoForward = !latestWeek || visibleWeekStart.getTime() < latestWeek.getTime();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setWeekStart(addDays(visibleWeekStart, -7))}
          disabled={!canGoBack}
          aria-label="Предыдущая неделя"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-card-bg text-foreground hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-semibold text-foreground capitalize">{formatWeekRange(visibleWeekStart)}</p>
        <button
          onClick={() => setWeekStart(addDays(visibleWeekStart, 7))}
          disabled={!canGoForward}
          aria-label="Следующая неделя"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-card-bg text-foreground hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {weekSlots.length === 0 ? (
        <div className="bg-card-bg rounded-2xl p-10 text-center">
          <p className="text-text-secondary">На этой неделе свободных слотов нет</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.filter((d) => d.slots.length > 0).map((d) => (
            <DayGroup
              key={d.iso}
              date={d.iso}
              slots={d.slots}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
