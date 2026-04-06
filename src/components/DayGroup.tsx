"use client";

import type { Slot } from "@/lib/sheets";
import SlotCard from "@/components/SlotCard";

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

interface DayGroupProps {
  date: string;
  slots: Slot[];
  onSelect: (slot: Slot) => void;
}

export default function DayGroup({ date, slots, onSelect }: DayGroupProps) {
  const dateObj = new Date(date + "T00:00:00");
  const weekday = dateObj.toLocaleDateString("ru-RU", { weekday: "long" });
  const day = dateObj.getDate();
  const month = MONTHS_GENITIVE[dateObj.getMonth()];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let label = `${weekday}, ${day} ${month}`;
  if (dateObj.getTime() === today.getTime()) {
    label = `Сегодня, ${day} ${month}`;
  } else if (dateObj.getTime() === tomorrow.getTime()) {
    label = `Завтра, ${day} ${month}`;
  }

  return (
    <section>
      <h3 className="text-lg font-semibold text-foreground mb-3 capitalize">{label}</h3>
      <div className="bg-card-bg rounded-2xl p-4 space-y-3">
        {slots.map((slot) => (
          <SlotCard key={slot.id} slot={slot} onClick={() => onSelect(slot)} />
        ))}
      </div>
    </section>
  );
}
