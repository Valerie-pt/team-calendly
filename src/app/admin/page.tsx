"use client";

import { useEffect, useMemo, useState } from "react";
import type { Slot, Event, Block, ZoomAccount } from "@/lib/sheets";
import { accountsAvailability } from "@/lib/conflict";

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

const DEFAULT_ZOOM = process.env.NEXT_PUBLIC_ZOOM_LINK || "";

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [zoomAccounts, setZoomAccounts] = useState<ZoomAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Zoom account form
  const [zaEmail, setZaEmail] = useState("");
  const [zaLink, setZaLink] = useState("");
  const [zaNotes, setZaNotes] = useState("");

  // Event form
  const [eventName, setEventName] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [eventZoom, setEventZoom] = useState("");
  const [eventNotifications, setEventNotifications] = useState("");
  const [eventError, setEventError] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEmails, setEditingEmails] = useState("");

  // Slot form
  const [slotEventId, setSlotEventId] = useState("");
  const [slotName, setSlotName] = useState("");
  const [slotEmail, setSlotEmail] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotDuration, setSlotDuration] = useState("30");
  const [slotZoomLink, setSlotZoomLink] = useState("");
  const [slotError, setSlotError] = useState("");
  const [slotConflictType, setSlotConflictType] = useState<"block" | "slot" | null>(null);
  const [slotFilter, setSlotFilter] = useState("all");

  // Block form
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockDuration, setBlockDuration] = useState("60");
  const [blockRecurring, setBlockRecurring] = useState(false);
  const [blockLabel, setBlockLabel] = useState("");
  const [blockZoomLink, setBlockZoomLink] = useState("");

  async function fetchAll() {
    setLoading(true);
    try {
      const [eRes, sRes, bRes, zRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/slots"),
        fetch("/api/blocks"),
        fetch("/api/zoom-accounts"),
      ]);
      const evs: Event[] = await eRes.json();
      const sls: Slot[] = await sRes.json();
      const blks: Block[] = await bRes.json();
      const zas: ZoomAccount[] = zRes.ok ? await zRes.json() : [];
      setEvents(evs.filter((e) => e.id));
      setSlots(sls.filter((s) => s.id));
      setBlocks(blks.filter((b) => b.id));
      setZoomAccounts(zas.filter((z) => z.id));
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
        notification_emails: eventNotifications,
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
    setEventNotifications("");
    fetchAll();
  }

  async function handleSaveNotifications(eventId: string) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_notifications",
        eventId,
        notification_emails: editingEmails,
      }),
    });
    setEditingEventId(null);
    setEditingEmails("");
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
    setSlotConflictType(null);
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
        zoom_link: slotZoomLink,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSlotError(data.error || "Ошибка");
      if (data.conflict_type === "block" || data.conflict_type === "slot") {
        setSlotConflictType(data.conflict_type);
      } else {
        setSlotConflictType(null);
      }
      return;
    }
    setSlotDate("");
    setSlotTime("");
    setSlotZoomLink("");
    setSlotConflictType(null);
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

  async function handleCancelBooking(slot: Slot) {
    const startMs = new Date(`${slot.date}T${slot.time}:00+03:00`).getTime();
    const willRelease = startMs - Date.now() > 4 * 60 * 60 * 1000;
    const question = willRelease
      ? `Отменить бронирование ${slot.candidate_name}? Слот вернётся в пул свободных — другой респондент сможет на него записаться.`
      : `Отменить бронирование ${slot.candidate_name}? До встречи меньше 4 часов — слот будет удалён (повторно забронировать не успеют).`;
    if (!confirm(question)) return;
    await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", slotId: slot.id }),
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
        zoom_link: blockZoomLink,
      }),
    });
    setBlockZoomLink("");
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

  async function handleAddZoomAccount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/zoom-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        email: zaEmail,
        zoom_link: zaLink,
        notes: zaNotes,
      }),
    });
    if (!res.ok) return;
    setZaEmail("");
    setZaLink("");
    setZaNotes("");
    fetchAll();
  }

  async function handleDeleteZoomAccount(id: string) {
    if (!confirm("Удалить Zoom-аккаунт? Существующие слоты/блокировки с этой ссылкой останутся.")) return;
    await fetch("/api/zoom-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", accountId: id }),
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
  const now = Date.now();
  const slotTimeMs = (s: Slot) => new Date(`${s.date}T${s.time}:00+03:00`).getTime();
  const isFuture = (s: Slot) => slotTimeMs(s) > now;
  const futureSlots = slots
    .filter(isFuture)
    .sort((a, b) => slotTimeMs(a) - slotTimeMs(b));

  const accountByLink = (link: string) =>
    zoomAccounts.find((a) => a.zoom_link.trim().toLowerCase() === link.trim().toLowerCase());

  const slotAccountsAvailability = useMemo(() => {
    if (!slotDate || !slotTime || zoomAccounts.length === 0) return {};
    return accountsAvailability({
      date: slotDate,
      time: slotTime,
      duration: parseInt(slotDuration, 10) || 30,
      zoomLinks: zoomAccounts.map((a) => a.zoom_link),
      slots,
      blocks,
      events,
      defaultZoom: DEFAULT_ZOOM,
    });
  }, [slotDate, slotTime, slotDuration, zoomAccounts, slots, blocks, events]);

  const blockAccountsAvailability = useMemo(() => {
    if (!blockDate || !blockTime || zoomAccounts.length === 0) return {};
    return accountsAvailability({
      date: blockDate,
      time: blockTime,
      duration: parseInt(blockDuration, 10) || 60,
      zoomLinks: zoomAccounts.map((a) => a.zoom_link),
      slots,
      blocks,
      events,
      defaultZoom: DEFAULT_ZOOM,
    });
  }, [blockDate, blockTime, blockDuration, zoomAccounts, slots, blocks, events]);
  const filteredSlots = slotFilter === "all"
    ? futureSlots
    : futureSlots.filter((s) => s.event_id === slotFilter);
  const availableSlots = filteredSlots.filter((s) => s.status === "available");
  const bookedSlots = filteredSlots.filter((s) => s.status === "booked");
  const orphanSlots = futureSlots.filter((s) => !s.event_id);
  const visibleBlocks = blocks
    .filter((b) => {
      if (b.recurring) return true;
      const end = new Date(`${b.date}T${b.time}:00+03:00`).getTime() + b.duration_minutes * 60000;
      return end > now;
    })
    .sort((a, b) => {
      // Recurring blocks last; within group, sort by date+time
      if (a.recurring !== b.recurring) return a.recurring ? 1 : -1;
      return new Date(`${a.date}T${a.time}:00+03:00`).getTime() - new Date(`${b.date}T${b.time}:00+03:00`).getTime();
    });

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
                  value={eventZoom}
                  onChange={(e) => setEventZoom(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  placeholder="Zoom-ссылка (необязательно — иначе используется ссылка по умолчанию)"
                />
                <textarea
                  value={eventNotifications}
                  onChange={(e) => setEventNotifications(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground resize-none"
                  placeholder="Уведомления на email (через запятую) — кому ещё писать о новых бронированиях"
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
                    <div key={ev.id} className="bg-white rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between gap-3 mb-1">
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

                      {editingEventId === ev.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editingEmails}
                            onChange={(e) => setEditingEmails(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 text-sm bg-card-bg border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground resize-none"
                            placeholder="email через запятую"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNotifications(ev.id)}
                              className="px-3 py-1.5 text-xs text-white bg-accent rounded-full hover:bg-accent-hover transition-colors"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={() => { setEditingEventId(null); setEditingEmails(""); }}
                              className="px-3 py-1.5 text-xs text-text-secondary hover:text-foreground transition-colors"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-text-secondary truncate flex-1">
                            Уведомления: {ev.notification_emails.length > 0 ? ev.notification_emails.join(", ") : "только организатору слота"}
                          </p>
                          <button
                            onClick={() => {
                              setEditingEventId(ev.id);
                              setEditingEmails(ev.notification_emails.join(", "));
                            }}
                            className="px-2 py-1 text-xs text-text-secondary hover:text-foreground transition-colors"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ZOOM ACCOUNTS */}
            <section className="bg-card-bg rounded-2xl p-6 sm:p-8 mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-1">Zoom-аккаунты</h2>
              <p className="text-sm text-text-secondary mb-5">
                Пул Zoom-аккаунтов команды. При создании слота можно выбрать один из них — система покажет, какие свободны в указанное время.
              </p>

              <form onSubmit={handleAddZoomAccount} className="space-y-3 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="email"
                    required
                    value={zaEmail}
                    onChange={(e) => setZaEmail(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                    placeholder="email (например, support@zamesin.ru)"
                  />
                  <input
                    type="url"
                    required
                    value={zaLink}
                    onChange={(e) => setZaLink(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
                <input
                  type="text"
                  value={zaNotes}
                  onChange={(e) => setZaNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                  placeholder="Заметка — например, «Ключ организатора: 615274» (необязательно)"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover transition-colors"
                >
                  Добавить аккаунт
                </button>
              </form>

              {zoomAccounts.length === 0 ? (
                <p className="text-text-secondary text-sm">Пока нет ни одного аккаунта</p>
              ) : (
                <div className="space-y-2">
                  {zoomAccounts.map((acc) => (
                    <div key={acc.id} className="bg-white rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{acc.email}</p>
                        <p className="text-xs text-text-secondary truncate">{acc.zoom_link}</p>
                        {acc.notes && <p className="text-xs text-text-secondary mt-0.5">{acc.notes}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteZoomAccount(acc.id)}
                        className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
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
                      placeholder="Твоё имя"
                    />
                    <input
                      type="email"
                      required
                      value={slotEmail}
                      onChange={(e) => setSlotEmail(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-foreground"
                      placeholder="Твой email"
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

                  {/* Zoom account picker with availability badges */}
                  {zoomAccounts.length === 0 ? (
                    <p className="text-xs text-text-secondary">
                      Добавь хотя бы один Zoom-аккаунт в секции «Zoom-аккаунты» ниже, чтобы выбирать его для слота.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Zoom-аккаунт</label>
                      {!slotDate || !slotTime ? (
                        <p className="text-xs text-text-secondary">Сначала укажи дату и время — покажу, какие аккаунты свободны</p>
                      ) : null}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {zoomAccounts.map((acc) => {
                          const status = slotAccountsAvailability[acc.zoom_link];
                          const busy = status?.conflict;
                          const selected = slotZoomLink === acc.zoom_link;
                          return (
                            <button
                              type="button"
                              key={acc.id}
                              onClick={() => setSlotZoomLink(acc.zoom_link)}
                              className={`text-left p-3 rounded-xl border transition-colors ${
                                selected
                                  ? "bg-accent/10 border-accent"
                                  : busy
                                    ? "bg-red-50 border-red-200 hover:bg-red-100"
                                    : "bg-white border-border hover:border-accent/40"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-foreground truncate">{acc.email}</span>
                                {slotDate && slotTime && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                    busy ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                  }`}>
                                    {busy ? "занят" : "свободен"}
                                  </span>
                                )}
                              </div>
                              {busy && status?.reason && (
                                <p className="text-xs text-red-700 mt-1 line-clamp-2">{status.reason}</p>
                              )}
                              {acc.notes && (
                                <p className="text-xs text-text-secondary mt-1 truncate">{acc.notes}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {slotError && (
                    <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                      {slotError}
                      {slotConflictType && (
                        <span className="block text-xs text-red-700 mt-1">
                          Выбери другой Zoom-аккаунт выше — тот, что помечен «свободен».
                        </span>
                      )}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!slotZoomLink}
                    className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      const slotZoom = s.zoom_link || ev?.zoom_link || DEFAULT_ZOOM;
                      const slotAcc = accountByLink(slotZoom);
                      return (
                        <div key={s.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">
                              {formatDate(s.date)} в {s.time}
                              <span className="text-text-secondary font-normal ml-2 text-sm">{s.duration_minutes} мин</span>
                            </p>
                            <p className="text-xs text-text-secondary truncate">
                              {ev?.name || "—"} · {s.interviewer_name}
                              {slotAcc && ` · ${slotAcc.email}`}
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

              {availableSlots.length === 0 && (
                <p className="text-text-secondary text-sm">Свободных слотов пока нет</p>
              )}
            </section>

            {/* BLOCKS */}
            <section className="bg-card-bg rounded-2xl p-6 sm:p-8 mb-10">
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

                {zoomAccounts.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Какой Zoom-аккаунт занят
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {zoomAccounts.map((acc) => {
                        const status = blockAccountsAvailability[acc.zoom_link];
                        const busy = status?.conflict;
                        const selected = blockZoomLink === acc.zoom_link;
                        return (
                          <button
                            type="button"
                            key={acc.id}
                            onClick={() => setBlockZoomLink(acc.zoom_link)}
                            className={`text-left p-3 rounded-xl border transition-colors ${
                              selected
                                ? "bg-accent/10 border-accent"
                                : "bg-white border-border hover:border-accent/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-foreground truncate">{acc.email}</span>
                              {blockDate && blockTime && (
                                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  busy ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                }`}>
                                  {busy ? "уже занят" : "сейчас свободен"}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={zoomAccounts.length > 0 && !blockZoomLink}
                  className="px-6 py-2.5 bg-accent text-white rounded-full font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Заблокировать
                </button>
              </form>

              {visibleBlocks.length === 0 ? (
                <p className="text-text-secondary text-sm">Нет заблокированного времени</p>
              ) : (
                <div className="space-y-2">
                  {visibleBlocks.map((b) => {
                    const d = new Date(b.date + "T00:00:00");
                    const blockAcc = b.zoom_link ? accountByLink(b.zoom_link) : null;
                    return (
                      <div key={b.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {b.recurring
                              ? `Каждую ${WEEKDAYS_GENITIVE[d.getDay()]} в ${b.time}`
                              : `${formatDate(b.date)} в ${b.time}`}
                            <span className="text-text-secondary font-normal ml-2 text-sm">{b.duration_minutes} мин</span>
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            {blockAcc?.email || "(аккаунт не указан)"}
                            {b.label && ` · ${b.label}`}
                          </p>
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

            {/* BOOKED */}
            {bookedSlots.length > 0 && (
              <section className="bg-card-bg rounded-2xl p-6 sm:p-8 mb-10">
                <h2 className="text-lg font-semibold text-foreground mb-5">
                  Забронированные ({bookedSlots.length})
                </h2>
                <div className="space-y-2">
                  {bookedSlots.map((s) => {
                    const ev = eventById(s.event_id);
                    const slotZoom = s.zoom_link || ev?.zoom_link || DEFAULT_ZOOM;
                    const slotAcc = accountByLink(slotZoom);
                    return (
                      <div key={s.id} className="bg-white rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {formatDate(s.date)} в {s.time}
                            <span className="text-text-secondary font-normal ml-2 text-sm">{s.duration_minutes} мин</span>
                            {slotAcc && (
                              <span className="text-text-secondary font-normal ml-2 text-xs">· {slotAcc.email}</span>
                            )}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {ev?.name || "—"} · {s.interviewer_name} → {s.candidate_name} ({s.candidate_email})
                            {s.candidate_telegram && <> · TG: {s.candidate_telegram}</>}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelBooking(s)}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
                        >
                          Отменить
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ORPHANS */}
            {orphanSlots.length > 0 && slotFilter === "all" && (
              <section className="bg-card-bg rounded-2xl p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Без типа ({orphanSlots.length})
                </h2>
                <p className="text-sm text-text-secondary mb-5">
                  Старые слоты без привязки к типу — не отображаются у респондентов.
                </p>
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
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
