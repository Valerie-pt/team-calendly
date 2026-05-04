"use client";

import { useState } from "react";
import type { Slot } from "@/lib/sheets";

interface BookingModalProps {
  slot: Slot;
  zoomLink: string;
  notificationEmails?: string[];
  onClose: () => void;
  onBooked: (candidateName: string) => void;
}

export default function BookingModal({ slot, zoomLink, notificationEmails, onClose, onBooked }: BookingModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book",
          slotId: slot.id,
          candidate_name: name,
          candidate_email: email,
          candidate_telegram: telegram,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Booking failed");
      }

      try {
        const { sendBookingEmails } = await import("@/lib/email");
        await sendBookingEmails({
          candidate_name: name,
          candidate_email: email,
          interviewer_name: slot.interviewer_name,
          interviewer_email: slot.interviewer_email,
          notification_emails: notificationEmails,
          candidate_telegram: telegram,
          date: slot.date,
          time: slot.time,
          duration_minutes: slot.duration_minutes,
          zoom_link: zoomLink,
        });
      } catch {
        // Email is best-effort
      }

      onBooked(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-display font-bold text-foreground mb-1">Забронировать слот</h2>
        <p className="text-sm text-text-secondary mb-6">
          {slot.date}, {slot.time} MSK ({slot.duration_minutes} мин) &middot; {slot.interviewer_name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Ваше имя</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-card-bg border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground placeholder:text-text-secondary"
              placeholder="Иван Иванов"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Ваш email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-card-bg border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground placeholder:text-text-secondary"
              placeholder="ivan@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Telegram</label>
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              className="w-full px-4 py-2.5 bg-card-bg border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground placeholder:text-text-secondary"
              placeholder="@username"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-card-bg text-foreground rounded-full font-medium hover:bg-border transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {loading ? "Бронирую..." : "Подтвердить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
