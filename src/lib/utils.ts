import { startOfWeek, addDays, format, parseISO } from "date-fns"
import { it } from "date-fns/locale/it"

export const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
export const DAYS_FULL = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
]

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function getNext4Weeks(from: Date = new Date()): Date[] {
  const current = getWeekStart(from)
  return Array.from({ length: 4 }, (_, i) => addDays(current, i * 7))
}

export function weekStartToString(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function stringToDate(str: string): Date {
  return parseISO(str)
}

export function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  return `${format(weekStart, "d MMM", { locale: it })} – ${format(end, "d MMM", { locale: it })}`
}

export function formatDayLabel(date: Date): string {
  return format(date, "d MMM", { locale: it })
}

export function defaultSessionDate(weekStart: Date, dayOfWeek: number): Date {
  return addDays(weekStart, dayOfWeek)
}

export const CAMPAIGN_COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#f97316",
]
