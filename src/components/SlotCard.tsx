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
      className="bg-white rounded-xl px-4 py-3 hover:shadow-md transition-all group text-left border border-transparent hover:border-accent/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {slot.time}
            <span className="text-text-secondary font-normal text-sm ml-2">{slot.duration_minutes} мин</span>
          </p>
          <p className="text-sm text-text-secondary truncate">{slot.interviewer_name}</p>
        </div>
        <span className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-text-secondary bg-card-bg rounded-full group-hover:bg-accent group-hover:text-white transition-colors">
          Записаться
        </span>
      </div>
    </button>
  );
}
