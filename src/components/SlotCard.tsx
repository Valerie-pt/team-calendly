"use client";

import type { Slot } from "@/lib/sheets";

interface SlotCardProps {
  slot: Slot;
  onClick: () => void;
}

export default function SlotCard({ slot, onClick }: SlotCardProps) {
  const dateObj = new Date(slot.date + "T00:00:00");
  const weekday = dateObj.toLocaleDateString("ru-RU", { weekday: "short" });
  const month = dateObj.toLocaleDateString("ru-RU", { month: "long" });
  const day = dateObj.getDate();

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card-bg rounded-2xl p-6 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm">
            <span className="text-xs font-medium text-text-secondary uppercase">{weekday}</span>
            <span className="text-lg font-bold text-foreground">{day}</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {slot.time} <span className="text-xs text-text-secondary font-normal">MSK</span>
              <span className="text-text-secondary font-normal ml-2">{slot.duration_minutes} мин</span>
            </p>
            <p className="text-sm text-text-secondary mt-0.5">
              {slot.interviewer_name} &middot; {day} {month}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-white rounded-full shadow-sm group-hover:bg-accent group-hover:text-white transition-colors">
          Записаться
        </span>
      </div>
    </button>
  );
}
