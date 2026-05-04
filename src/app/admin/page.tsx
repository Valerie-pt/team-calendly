"use client";

import { useEffect, useState } from "react";
import type { Slot, Event, Block } from "@/lib/sheets";

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const WEEKDAYS_GENITIVE = [
  "воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу",
];

function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

function slugify(name: string) {
  return name.toLowerCase()
    .replace(/[а-я]/g, (c) => {
      const map: Record<string, string> = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
        "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
        "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
      };
      return map[c] || c;
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  // Event form
  const [eventName, setEventName] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [eventZoom, setEventZoom] = useState("");
  const [eventError, setEventError] = useState("");

  // Slot form
  const [slotEventId, setSlotEventId] = useState("");
  const [slotName, setSlotName] = useState("");
  const [slotEmail, setSlotEmail] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotDuration, setSlotDuration] = useState("30");
  const [slotError, setSlotError] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");

  // Block form
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockDuration, setBlockDuration] = useState("60");
  const [blockRecurring, setBlockRecurring] = useState(false);
  const [blockLabel, setBlockLabel] = useState("");

  async function fetchAll() {
    setLoading(true);
    try {
      const [eRes, sRes, bRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/slots"),
        fetch("/api/blocks"),
      ]);
      const evs: Event[] = await eRes.json();
      const sls: Slot[] = await sRes.json();
      const blks: Block[] = await bRes.json();
      setEvents(evs.filter((e) => e.id));
      setSlots(sls.filter((s) => s.id));
      setBlocks(blks.filter((b) => b.id));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    setEventError("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        name: eventName,
        slug: eventSlug || slugify(eventName),
        zoom_link: eventZoom,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setEventError(data.error || "Ошибка");
      return;
    }
    setEventName("");
    setEventSlug("");
    setEventZoom("");
    fetchAll();
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm("Удалить тип события? Связанные слоты останутся, но их нужно будет удалить вручную.")) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", eventId: id }),
    });
    fetchAll();
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    setSlotError("");
    const res = await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        event_id: slotEventId,
        interviewer_name: slotName,
        interviewer_email: slotEmail,
        date: slotDate,
        time: slotTime,
        duration_minutes: parseInt(slotDuration, 10),
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSlotError(data.error || "Ошибка");
      return;
    }
    setSlotDate("");
    setSlotTime("");
    fetchAll();
  }

  async function handleDeleteSlot(id: string) {
    await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", slotId: id }),
    });
    fetchAll();
  }

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        date: blockDate,
        time: blockTime,
        duration_minutes: parseInt(blockDuration, 10),
        recurring: blockRecurring,
        label: blockLabel,
      }),
    });
    setBlockDate("");
    setBlockTime("");
    setBlockLabel("");
    setBlockRecurring(false);
    fetchAll();
  }

  async function handleDeleteBlock(id: string) {
    await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", blockId: id }),
    });
    fetchAll();
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  function copyEventLink(slug: string) {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
  }

  const eventById = (id: string) => events.find((e) => e.id === id);
  const filteredSlots = slotFilter === "all"
    ? slots
    : slots.filter((s) => s.event_id === slotFilter);
  const availableSlots = filteredSlots.filter((s) => s.status === "available");
  const bookedSlots = filteredSlots.filter((s) => s.status === "booked");
  const orphanSlots = slots.filter((s) => !s.event_id);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-14 sm:py-20">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            Панель управления
          </h1>
          <button
            onClick={handleLogout}
            className="text-sm text-text-secondary hover:text-foreground transition-colors"
          >
            Выйти
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* EVENTS */}
            <section className="bg-card-bg rounded-2xl p-6 sm:p-8 mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-1">Типы встреч</h2>
              <p className="text-sm text-text-secondary mb-5">
                Каждому типу — своя ссылка для респондентов и свой Zoom.
              </p>

              <form onSubmit={handleAddEvent} className="space-y-3 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={eventName}
                    onChange={(e) => {
                      setEventName(e.target.value);
                      if (!eventSlug) setEventSlug(slugify(e.target.value));
                    }}
                    className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                    placeholder="Название (Customer Interview)"
                  />
                  <input
                    type="text"
                    required
                    value={eventSlug}
                    onChange={(e) => setEventSlug(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                    placeholder="slug (customer-interview)"
                  />
                </div>
                <input
                  type="url"
                  required
                  value={eventZoom}
                  onChange={(e) => setEventZoom(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  placeholder="https://zoom.us/j/..."
                />
                {eventError && (
                  <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">{eventError}</p>
                )}
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover transition-colors"
                >
                  Добавить тип
                </button>
              </form>

              {events.length === 0 ? (
                <p className="text-text-secondary text-sm">Пока нет ни одного типа встречи</p>
              ) : (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{ev.name}</p>
                        <p className="text-xs text-text-secondary truncate">/{ev.slug}</p>
                      </div>
                      <button
                        onClick={() => copyEventLink(ev.slug)}
                        className="px-3 py-1.5 text-xs text-foreground bg-card-bg rounded-full hover:bg-border transition-colors"
                      >
                        Копировать ссылку
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SLOTS */}
            <section className="bg-card-bg rounded-2xl p-6 sm:p-8 mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-1">Слоты</h2>
              <p className="text-sm text-text-secondary mb-5">Время по Москве (MSK)</p>

              {events.length === 0 ? (
                <p className="text-text-secondary text-sm">Сначала создайте хотя бы один тип встречи</p>
              ) : (
                <form onSubmit={handleAddSlot} className="space-y-3 mb-6">
                  <select
                    required
                    value={slotEventId}
                    onChange={(e) => setSlotEventId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  >
                    <option value="">Тип встречи</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={slotName}
                      onChange={(e) => setSlotName(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                      placeholder="Ваше имя"
                    />
                    <input
                      type="email"
                      required
                      value={slotEmail}
                      onChange={(e) => setSlotEmail(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                      placeholder="Ваш email"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="date"
                      required
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                    />
                    <input
                      type="time"
                      required
                      value={slotTime}
                      onChange={(e) => setSlotTime(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                    />
                    <select
                      value={slotDuration}
                      onChange={(e) => setSlotDuration(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                    >
                      <option value="15">15 мин</option>
                      <option value="30">30 мин</option>
                      <option value="45">45 мин</option>
                      <option value="60">60 мин</option>
                      <option value="90">90 мин</option>
                    </select>
                  </div>
                  {slotError && (
                    <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">{slotError}</p>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover transition-colors"
                  >
                    Добавить слот
                  </button>
                </form>
              )}

              <div className="mb-4">
                <select
                  value={slotFilter}
                  onChange={(e) => setSlotFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-white border border-border rounded-full focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                >
                  <option value="all">Все типы</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              {availableSlots.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Свободные ({availableSlots.length})
                  </h3>
                  <div className="space-y-2">
                    {availableSlots.map((s) => {
                      const ev = eventById(s.event_id);
                      return (
                        <div key={s.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">
                              {formatDate(s.date)} в {s.time}
                              <span className="text-text-secondary font-normal ml-2 text-sm">{s.duration_minutes} мин</span>
                            </p>
                            <p className="text-xs text-text-secondary truncate">
                              {ev?.name || "—"} · {s.interviewer_name}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteSlot(s.id)}
                            className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          >
                            Удалить
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {bookedSlots.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Забронированные ({bookedSlots.length})
                  </h3>
                  <div className="space-y-2">
                    {bookedSlots.map((s) => {
                      const ev = eventById(s.event_id);
                      return (
                        <div key={s.id} className="bg-white rounded-xl px-4 py-3 opacity-75">
                          <p className="font-medium text-foreground">
                            {formatDate(s.date)} в {s.time}
                            <span className="text-text-secondary font-normal ml-2 text-sm">{s.duration_minutes} мин</span>
                          </p>
                          <p className="text-xs text-text-secondary">
                            {ev?.name || "—"} · {s.interviewer_name} → {s.candidate_name} ({s.candidate_email})
                            {s.candidate_telegram && <> · TG: {s.candidate_telegram}</>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {orphanSlots.length > 0 && slotFilter === "all" && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Без типа ({orphanSlots.length})
                  </h3>
                  <p className="text-xs text-text-secondary mb-2">Старые слоты без привязки к типу — не отображаются у респондентов.</p>
                  <div className="space-y-2">
                    {orphanSlots.map((s) => (
                      <div key={s.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {formatDate(s.date)} в {s.time}
                          </p>
                          <p className="text-xs text-text-secondary">{s.interviewer_name}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteSlot(s.id)}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableSlots.length === 0 && bookedSlots.length === 0 && orphanSlots.length === 0 && (
                <p className="text-text-secondary text-sm">Слотов пока нет</p>
              )}
            </section>

            {/* BLOCKS */}
            <section className="bg-card-bg rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-foreground mb-1">Заблокированное время</h2>
              <p className="text-sm text-text-secondary mb-5">
                Когда Zoom-аккаунт занят (например, другая встреча) — заблокируйте время, чтобы новые слоты не пересекались.
              </p>

              <form onSubmit={handleAddBlock} className="space-y-3 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="date"
                    required
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  />
                  <input
                    type="time"
                    required
                    value={blockTime}
                    onChange={(e) => setBlockTime(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  />
                  <select
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  >
                    <option value="15">15 мин</option>
                    <option value="30">30 мин</option>
                    <option value="60">60 мин</option>
                    <option value="90">90 мин</option>
                    <option value="120">2 часа</option>
                    <option value="240">4 часа</option>
                    <option value="480">8 часов</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={blockLabel}
                  onChange={(e) => setBlockLabel(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  placeholder="Описание (необязательно)"
                />
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={blockRecurring}
                    onChange={(e) => setBlockRecurring(e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  Повторять каждую неделю в этот же день
                </label>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover transition-colors"
                >
                  Заблокировать
                </button>
              </form>

              {blocks.length === 0 ? (
                <p className="text-text-secondary text-sm">Нет заблокированного времени</p>
              ) : (
                <div className="space-y-2">
                  {blocks.map((b) => {
                    const d = new Date(b.date + "T00:00:00");
                    return (
                      <div key={b.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {b.recurring
                              ? `Каждую ${WEEKDAYS_GENITIVE[d.getDay()]} в ${b.time}`
                              : `${formatDate(b.date)} в ${b.time}`}
                            <span className="text-text-secondary font-normal ml-2 text-sm">{b.duration_minutes} мин</span>
                          </p>
                          {b.label && <p className="text-xs text-text-secondary truncate">{b.label}</p>}
                        </div>
                        <button
                          onClick={() => handleDeleteBlock(b.id)}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          Снять
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
