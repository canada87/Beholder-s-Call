"use client"
import { useState, useEffect, useCallback } from "react"
import WeekSelector from "@/components/WeekSelector"
import { getNext2Weeks, weekStartToString, DAYS_SHORT, formatDayLabel } from "@/lib/utils"
import { parseISO } from "date-fns"

interface SessionInfo {
  campaignId: string
  campaignName: string
  campaignColor: string
  masterName: string
  isMaster: boolean
  date: string
  dayOfWeek: number
  isCancelled: boolean
  isOverridden: boolean
}

export default function CalendarPage() {
  const [weeks] = useState(getNext2Weeks)
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSessions = useCallback(async (week: Date) => {
    setLoading(true)
    const res = await fetch(`/api/sessions?weekStart=${weekStartToString(week)}`)
    const data = await res.json()
    setSessions(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSessions(selectedWeek) }, [selectedWeek, fetchSessions])

  const activeSessions = sessions.filter((s) => !s.isCancelled)
  const cancelledSessions = sessions.filter((s) => s.isCancelled)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Calendario</h1>
      <WeekSelector weeks={weeks} selected={selectedWeek} onChange={setSelectedWeek} />

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : (
        <>
          {activeSessions.length === 0 && (
            <p className="text-gray-400 text-center py-8">Nessuna sessione questa settimana</p>
          )}

          <div className="space-y-3">
            {activeSessions
              .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
              .map((s) => (
                <SessionCard key={s.campaignId} session={s} />
              ))}
          </div>

          {cancelledSessions.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Annullate
              </h2>
              <div className="space-y-2">
                {cancelledSessions.map((s) => (
                  <SessionCard key={s.campaignId} session={s} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SessionCard({ session: s }: { session: SessionInfo }) {
  const date = parseISO(s.date)
  return (
    <div
      className={`rounded-2xl p-4 border ${
        s.isCancelled ? "opacity-50 border-gray-700 bg-gray-800" : "border-gray-700 bg-gray-800"
      }`}
      style={s.isCancelled ? {} : { borderLeftColor: s.campaignColor, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.campaignColor }} />
            <span className={`font-semibold ${s.isCancelled ? "line-through text-gray-400" : ""}`}>
              {s.campaignName}
            </span>
            {s.isOverridden && !s.isCancelled && (
              <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">
                modif.
              </span>
            )}
            {s.isMaster && (
              <span className="text-xs bg-violet-900 text-violet-300 px-1.5 py-0.5 rounded">
                master
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {s.isCancelled ? (
              <span className="text-red-400">Sessione annullata</span>
            ) : (
              <>
                <strong className="text-gray-200">{DAYS_SHORT[s.dayOfWeek]}</strong>{" "}
                {formatDayLabel(date)}
              </>
            )}
          </p>
        </div>
        <span className="text-xs text-gray-500">DM: {s.masterName}</span>
      </div>
    </div>
  )
}
