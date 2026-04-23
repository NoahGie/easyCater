import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  format,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  isSameMonth, isToday,
  addMonths, subMonths,
  addWeeks, subWeeks,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import type { EventStatus } from '../types/database'
import { EventStatusBadge } from '../components/events/EventStatusBadge'

type CalendarEvent = {
  id: string
  title: string
  status: EventStatus
  event_date: string
  start_time: string | null
  end_time: string | null
  location_name: string | null
  guest_count: number
  customers: { company_name: string } | null
}

type StaffAssignment = {
  event_id: string
  staff_member_id: string
  staff_members: { first_name: string; last_name: string } | null
}

type ViewMode = 'month' | 'week'

const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const STATUS_CHIP: Record<EventStatus, string> = {
  anfrage:       'bg-blue-50 text-blue-800 border-blue-200',
  angebot:       'bg-yellow-50 text-yellow-800 border-yellow-200',
  bestaetigt:    'bg-green-50 text-green-800 border-green-200',
  durchfuehrung: 'bg-purple-50 text-purple-800 border-purple-200',
  abrechnung:    'bg-orange-50 text-orange-800 border-orange-200',
  abgeschlossen: 'bg-gray-50 text-gray-600 border-gray-200',
  storniert:     'bg-red-50 text-red-400 border-red-100',
}

const STATUS_DOT: Record<EventStatus, string> = {
  anfrage:       'bg-blue-500',
  angebot:       'bg-yellow-500',
  bestaetigt:    'bg-green-500',
  durchfuehrung: 'bg-purple-500',
  abrechnung:    'bg-orange-500',
  abgeschlossen: 'bg-gray-400',
  storniert:     'bg-red-300',
}

function formatTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5) // "HH:MM" from "HH:MM:SS"
}

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const rangeStart = useMemo(() =>
    viewMode === 'month'
      ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      : startOfWeek(currentDate, { weekStartsOn: 1 }),
    [viewMode, currentDate]
  )

  const rangeEnd = useMemo(() =>
    viewMode === 'month'
      ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
      : endOfWeek(currentDate, { weekStartsOn: 1 }),
    [viewMode, currentDate]
  )

  const days = useMemo(() =>
    eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  )

  const fromStr = useMemo(() => format(rangeStart, 'yyyy-MM-dd'), [rangeStart])
  const toStr   = useMemo(() => format(rangeEnd,   'yyyy-MM-dd'), [rangeEnd])

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: eventsData } = await supabase
      .from('events')
      .select('id, title, status, event_date, start_time, end_time, location_name, guest_count, customers(company_name)')
      .gte('event_date', fromStr)
      .lte('event_date', toStr)
      .order('event_date', { ascending: true })

    const loaded = (eventsData ?? []) as unknown as CalendarEvent[]
    setEvents(loaded)

    if (loaded.length > 0) {
      const ids = loaded.map(e => e.id)
      const { data: staffData } = await supabase
        .from('event_staff')
        .select('event_id, staff_member_id, staff_members(first_name, last_name)')
        .in('event_id', ids)
      setStaffAssignments((staffData ?? []) as unknown as StaffAssignment[])
    } else {
      setStaffAssignments([])
    }

    setLoading(false)
  }, [fromStr, toStr])

  useEffect(() => { loadData() }, [loadData])

  // Detect conflicts: same staff on multiple non-cancelled events on the same date
  const { conflictSet, conflictNames } = useMemo(() => {
    // date -> staffId -> [eventId, ...]
    const map = new Map<string, Map<string, string[]>>()

    for (const sa of staffAssignments) {
      const event = events.find(e => e.id === sa.event_id)
      if (!event || event.status === 'storniert') continue
      const d = event.event_date
      if (!map.has(d)) map.set(d, new Map())
      const sm = map.get(d)!
      if (!sm.has(sa.staff_member_id)) sm.set(sa.staff_member_id, [])
      sm.get(sa.staff_member_id)!.push(sa.event_id)
    }

    const conflictSet = new Set<string>()
    const conflictNames = new Map<string, string[]>() // eventId -> staff names

    for (const sm of map.values()) {
      for (const [staffId, eids] of sm) {
        if (eids.length <= 1) continue
        const sa = staffAssignments.find(s => s.staff_member_id === staffId)
        const name = sa?.staff_members
          ? `${sa.staff_members.first_name} ${sa.staff_members.last_name}`
          : 'Unbekannt'
        for (const eid of eids) {
          conflictSet.add(eid)
          if (!conflictNames.has(eid)) conflictNames.set(eid, [])
          if (!conflictNames.get(eid)!.includes(name)) conflictNames.get(eid)!.push(name)
        }
      }
    }
    return { conflictSet, conflictNames }
  }, [events, staffAssignments])

  function navigate(dir: 1 | -1) {
    if (viewMode === 'month') {
      setCurrentDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1))
    } else {
      setCurrentDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1))
    }
  }

  function eventsForDay(day: Date) {
    const key = format(day, 'yyyy-MM-dd')
    return events.filter(e => e.event_date === key)
  }

  const maxPerCell = viewMode === 'week' ? 6 : 3
  const totalConflicts = conflictSet.size

  return (
    <div className="flex gap-6">
      {/* ── Calendar panel ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Ressourcenkalender</h1>
            {totalConflicts > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200">
                ⚠ {totalConflicts} Konflikt{totalConflicts !== 1 ? 'e' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm">
              {(['month', 'week'] as ViewMode[]).map((mode, i) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 transition-colors ${
                    i > 0 ? 'border-l border-gray-200' : ''
                  } ${viewMode === mode ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {mode === 'month' ? 'Monat' : 'Woche'}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 text-lg leading-none"
                aria-label="Zurück"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[152px] text-center">
                {viewMode === 'month'
                  ? format(currentDate, 'MMMM yyyy', { locale: de })
                  : `${format(rangeStart, 'dd.MM.')} – ${format(rangeEnd, 'dd.MM.yyyy')}`
                }
              </span>
              <button
                onClick={() => navigate(1)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 text-lg leading-none"
                aria-label="Vorwärts"
              >
                ›
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="ml-1 px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Heute
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {WEEKDAYS_DE.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="py-24 text-center text-sm text-gray-400">Laden...</div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const dayEvts   = eventsForDay(day)
                const outside   = viewMode === 'month' && !isSameMonth(day, currentDate)
                const today     = isToday(day)
                const hasCflct  = dayEvts.some(e => conflictSet.has(e.id))
                const isLastCol = (i + 1) % 7 === 0

                return (
                  <div
                    key={i}
                    className={`border-b border-r border-gray-100 p-1.5 ${
                      isLastCol ? 'border-r-0' : ''
                    } ${outside ? 'bg-gray-50/60' : 'bg-white'} ${
                      viewMode === 'week' ? 'min-h-[160px]' : 'min-h-[100px]'
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                          today
                            ? 'bg-red-600 text-white'
                            : outside
                              ? 'text-gray-300'
                              : 'text-gray-700'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {hasCflct && (
                        <span className="text-amber-500 text-xs leading-none" title="Personalkonflikt">⚠</span>
                      )}
                    </div>

                    {/* Event chips */}
                    <div className="space-y-0.5">
                      {dayEvts.slice(0, maxPerCell).map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          title={ev.title}
                          className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] truncate leading-4 transition-all hover:opacity-80 ${
                            STATUS_CHIP[ev.status]
                          } ${conflictSet.has(ev.id) ? 'ring-1 ring-red-400' : ''} ${
                            ev.status === 'storniert' ? 'opacity-50' : ''
                          }`}
                        >
                          {conflictSet.has(ev.id) && <span className="text-red-500 mr-0.5">⚠</span>}
                          {ev.start_time ? formatTime(ev.start_time) + ' ' : ''}
                          {ev.title}
                        </button>
                      ))}
                      {dayEvts.length > maxPerCell && (
                        <div className="text-[10px] text-gray-400 pl-1">
                          +{dayEvts.length - maxPerCell} weitere
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
          {([
            ['anfrage',       'Anfrage'],
            ['angebot',       'Angebot'],
            ['bestaetigt',    'Bestätigt'],
            ['durchfuehrung', 'Durchführung'],
            ['abrechnung',    'Abrechnung'],
            ['abgeschlossen', 'Abgeschlossen'],
          ] as [EventStatus, string][]).map(([s, label]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-sm inline-block ${STATUS_DOT[s]}`} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-amber-600 font-medium">
            ⚠ Personalkonflikt
          </span>
        </div>
      </div>

      {/* ── Detail sidebar ── */}
      {selectedEvent && (
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 leading-snug flex-1 pr-2">
                {selectedEvent.title}
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center text-base shrink-0"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>

            <div className="mb-3">
              <EventStatusBadge status={selectedEvent.status} />
            </div>

            {conflictSet.has(selectedEvent.id) && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 leading-relaxed">
                <strong>⚠ Personalkonflikt:</strong>{' '}
                {conflictNames.get(selectedEvent.id)?.join(', ')}{' '}
                {(conflictNames.get(selectedEvent.id)?.length ?? 0) === 1 ? 'ist' : 'sind'}{' '}
                an diesem Tag mehrfach eingeplant.
              </div>
            )}

            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Datum</dt>
                <dd className="text-gray-700">
                  {format(new Date(selectedEvent.event_date + 'T00:00:00'), 'EEEE, dd. MMMM yyyy', { locale: de })}
                </dd>
              </div>

              {(selectedEvent.start_time || selectedEvent.end_time) && (
                <div>
                  <dt className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Uhrzeit</dt>
                  <dd className="text-gray-700">
                    {selectedEvent.start_time ? formatTime(selectedEvent.start_time) : ''}
                    {selectedEvent.end_time ? ` – ${formatTime(selectedEvent.end_time)}` : ''} Uhr
                  </dd>
                </div>
              )}

              {selectedEvent.customers && (
                <div>
                  <dt className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Kunde</dt>
                  <dd className="text-gray-700">{selectedEvent.customers.company_name}</dd>
                </div>
              )}

              {selectedEvent.location_name && (
                <div>
                  <dt className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Location</dt>
                  <dd className="text-gray-700">{selectedEvent.location_name}</dd>
                </div>
              )}

              <div>
                <dt className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Gäste</dt>
                <dd className="text-gray-700">{selectedEvent.guest_count}</dd>
              </div>

              {(() => {
                const staff = staffAssignments.filter(sa => sa.event_id === selectedEvent.id)
                if (staff.length === 0) return null
                const conflicted = conflictNames.get(selectedEvent.id) ?? []
                return (
                  <div>
                    <dt className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">
                      Personal ({staff.length})
                    </dt>
                    <dd className="space-y-0.5">
                      {staff.map(sa => {
                        const name = sa.staff_members
                          ? `${sa.staff_members.first_name} ${sa.staff_members.last_name}`
                          : '–'
                        const isConflicted = conflicted.includes(name)
                        return (
                          <div
                            key={sa.staff_member_id}
                            className={`flex items-center gap-1 ${isConflicted ? 'text-red-600 font-medium' : 'text-gray-700'}`}
                          >
                            {isConflicted && <span className="text-red-500 text-[10px]">⚠</span>}
                            {name}
                          </div>
                        )
                      })}
                    </dd>
                  </div>
                )
              })()}
            </dl>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <Link
                to={`/events/${selectedEvent.id}`}
                className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Auftrag öffnen →
              </Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
