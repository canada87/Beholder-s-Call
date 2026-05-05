"use client"
import { formatWeekLabel, weekStartToString } from "@/lib/utils"

interface Props {
  weeks: Date[]
  selected: Date
  onChange: (week: Date) => void
}

export default function WeekSelector({ weeks, selected, onChange }: Props) {
  const selectedStr = weekStartToString(selected)
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {weeks.map((week) => {
        const str = weekStartToString(week)
        const active = str === selectedStr
        return (
          <button
            key={str}
            onClick={() => onChange(week)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? "bg-violet-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {formatWeekLabel(week)}
          </button>
        )
      })}
    </div>
  )
}
