"use client";

import { useEffect, useState } from "react";
import type { Slot } from "@/lib/sheets";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import SlotCard from "@/components/SlotCard";
import BookingModal from "@/components/BookingModal";

const ZOOM_LINK = process.env.NEXT_PUBLIC_ZOOM_LINK || "https://zoom.us/j/your-meeting-id";

interface BookedInfo {
  slot: Slot;
  candidateName: string;
}

export default function CandidatePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookedInfo, setBookedInfo] = useState<BookedInfo | null>(null);

  async function fetchSlots() {
    setLoading(true);
    try {
      const res = await fetch("/api/slots");
      const data: Slot[] = await res.json();
      const available = data
        .filter((s) => s.status === "available" && s.id)
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
    fetchSlots();
  }, []);

  function handleBooked(candidateName: string) {
    if (selectedSlot) {
      setBookedInfo({ slot: selectedSlot, candidateName });
    }
    setSelectedSlot(null);
    fetchSlots();
  }

  if (bookedInfo) {
    const { slot, candidateName } = bookedInfo;
    const eventTitle = `Интервью: ${candidateName} & ${slot.interviewer_name}`;
    const eventDescription = `Интервью\\nZoom: ${ZOOM_LINK}`;

    const googleUrl = generateGoogleCalendarUrl({
      title: eventTitle,
      date: slot.date,
      time: slot.time,
      duration_minutes: slot.duration_minutes,
      description: `Интервью\nZoom: ${ZOOM_LINK}`,
      location: ZOOM_LINK,
    });

    const icsParams = new URLSearchParams({
      title: eventTitle,
      date: slot.date,
      time: slot.time,
      duration: String(slot.duration_minutes),
      description: eventDescription,
      location: ZOOM_LINK,
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
            Zoom: <a href={ZOOM_LINK} className="text-accent hover:underline break-all">{ZOOM_LINK}</a>
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
            onClick={() => setBookedInfo(null)}
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
            Запись на интервью
          </h1>
          <p className="text-text-secondary text-lg">Выберите удобный слот</p>
          <p className="text-sm text-text-secondary mt-1">Время указано по Москве (MSK, UTC+3)</p>
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
          <div className="space-y-3">
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onClick={() => setSelectedSlot(slot)} />
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          zoomLink={ZOOM_LINK}
          onClose={() => setSelectedSlot(null)}
          onBooked={handleBooked}
        />
      )}
    </main>
  );
}
