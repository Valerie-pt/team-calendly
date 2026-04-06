"use client";

import { useEffect, useState } from "react";
import type { Slot } from "@/lib/sheets";

export default function AdminPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");

  async function fetchSlots() {
    setLoading(true);
    try {
      const res = await fetch("/api/slots");
      const data: Slot[] = await res.json();
      setSlots(data.filter((s) => s.id));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSlots();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          interviewer_name: name,
          interviewer_email: email,
          date,
          time,
          duration_minutes: parseInt(duration, 10),
        }),
      });
      setDate("");
      setTime("");
      fetchSlots();
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(slotId: string) {
    try {
      await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", slotId }),
      });
      fetchSlots();
    } catch {
      // silently fail
    }
  }

  const available = slots.filter((s) => s.status === "available");
  const booked = slots.filter((s) => s.status === "booked");

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-14 sm:py-20">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-10">
          Admin Panel
        </h1>

        {/* Add slot form */}
        <section className="bg-card-bg rounded-2xl p-6 sm:p-8 mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-5">Add Available Slot</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Your Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  placeholder="jane@company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Time</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Duration (min)</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding..." : "Add Slot"}
            </button>
          </form>
        </section>

        {/* Slots list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Available slots */}
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Available Slots
                <span className="text-text-secondary font-normal ml-2">({available.length})</span>
              </h2>
              {available.length === 0 ? (
                <p className="text-text-secondary bg-card-bg rounded-2xl p-6 text-center">No available slots</p>
              ) : (
                <div className="space-y-2">
                  {available.map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-card-bg rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {slot.date} &middot; {slot.time}
                          <span className="text-text-secondary font-normal ml-2">{slot.duration_minutes} min</span>
                        </p>
                        <p className="text-sm text-text-secondary">{slot.interviewer_name} ({slot.interviewer_email})</p>
                      </div>
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="px-4 py-1.5 text-sm text-red-600 bg-white rounded-full hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Booked slots */}
            {booked.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Booked Slots
                  <span className="text-text-secondary font-normal ml-2">({booked.length})</span>
                </h2>
                <div className="space-y-2">
                  {booked.map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-card-bg rounded-2xl p-4 opacity-75"
                    >
                      <p className="font-medium text-foreground">
                        {slot.date} &middot; {slot.time}
                        <span className="text-text-secondary font-normal ml-2">{slot.duration_minutes} min</span>
                      </p>
                      <p className="text-sm text-text-secondary">
                        {slot.interviewer_name} &rarr; {slot.candidate_name} ({slot.candidate_email})
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
