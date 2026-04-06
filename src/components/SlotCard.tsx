"use client";

import type { Slot } from "@/lib/sheets";

interface SlotCardProps {
  slot: Slot;
  onClick: () => void;
}

export default function SlotCard({ slot, onClick }: SlotCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl px-5 py-4 hover:shadow-md transition-all group text-left border border-transparent hover:border-accent/30"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">
          {slot.time}
          <span className="text-text-secondary font-normal text-sm ml-2">{slot.duration_minutes} мин</span>
        </p>
        <span className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-text-secondary bg-card-bg rounded-full group-hover:bg-accent group-hover:text-white transition-colors">
          Записаться
        </span>
      </div>
    </button>
  );
}
