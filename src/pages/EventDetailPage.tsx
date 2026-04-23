import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { EventStatus, OfferStatus, InvoiceStatus, StaffRole } from '../types/database'
import { EventStatusBadge, OfferStatusBadge, InvoiceStatusBadge } from '../components/events/EventStatusBadge'
import { WorkflowStepper } from '../components/events/WorkflowStepper'
import { CreateOfferModal } from '../components/events/CreateOfferModal'

// ─── Local types ────────────────────────────────────────────────────────────

type OfferItem = {
  id: string
  position: number
  label: string
  description: string | null
  quantity: number
  unit: string
  unit_price_cents: number
  total_cents: number
}

type Offer = {
  id: string
  event_id: string
  version: number
  status: OfferStatus
  valid_until: string | null
  total_net_cents: number
  tax_rate_pct: number
  discount_cents: number
  notes: string | null
  sent_at: string | null
  accepted_at: string | null
  created_at: string
  offer_items: OfferItem[]
}

type EventStaff = {
  id: string
  staff_member_id: string
  role_override: StaffRole | null
  start_time: string | null
  end_time: string | null
  hours_worked: number | null
  confirmed: boolean
  notes: string | null
  staff_members: {
    id: string
    first_name: string
    last_name: string
    role: StaffRole
    hourly_rate_cents: number
  } | null
}

type Invoice = {
  id: string
  event_id: string
  offer_id: string | null
  invoice_number: string | null
  status: InvoiceStatus
  issued_date: string
  due_date: string | null
  total_net_cents: number
  tax_rate_pct: number
  total_gross_cents: number
  paid_at: string | null
  notes: string | null
  created_at: string
}

type EventDetail = {
  id: string
  customer_id: string
  primary_contact_id: string | null
  title: string
  status: EventStatus
  event_date: string
  start_time: string | null
  end_time: string | null
  location_name: string | null
  location_address: string | null
  guest_count: number
  budget_cents: number | null
  internal_notes: string | null
  created_at: string
  customers: { id: string; company_name: string; industry: string | null } | null
  offers: Offer[]
  event_staff: EventStaff[]
  invoices: Invoice[]
}

type StaffMember = { id: string; first_name: string; last_name: string; role: StaffRole }

// ─── Helpers ────────────────────────────────────────────────────────────────

function eur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(d: string | null) {
  if (!d) return '–'
  return format(new Date(d), 'dd.MM.yyyy', { locale: de })
}

const ROLE_LABELS: Record<StaffRole, string> = {
  kueche:     'Küche',
  service:    'Service',
  logistik:   'Logistik',
  management: 'Management',
  sonstiges:  'Sonstiges',
}

const NEXT_STATUS: Partial<Record<EventStatus, { next: EventStatus; label: string }>> = {
  anfrage:       { next: 'angebot',       label: 'Status: Angebot läuft' },
  angebot:       { next: 'bestaetigt',    label: 'Auftrag bestätigen' },
  bestaetigt:    { next: 'durchfuehrung', label: 'Durchführung starten' },
  durchfuehrung: { next: 'abrechnung',    label: 'Zur Abrechnung' },
  abrechnung:    { next: 'abgeschlossen', label: 'Auftrag abschließen' },
}

// ─── Tab: Übersicht ──────────────────────────────────────────────────────────

function OverviewTab({ event, onStatusChange }: {
  event: EventDetail
  onStatusChange: (status: EventStatus) => Promise<void>
}) {
  const [advancing, setAdvancing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const next = NEXT_STATUS[event.status]

  async function advance() {
    if (!next) return
    setAdvancing(true)
    await onStatusChange(next.next)
    setAdvancing(false)
  }

  async function cancel() {
    if (!window.confirm('Auftrag wirklich stornieren?')) return
    setCancelling(true)
    await onStatusChange('storniert')
    setCancelling(false)
  }

  return (
    <div className="space-y-6">
      {/* Status actions */}
      {event.status !== 'abgeschlossen' && event.status !== 'storniert' && (
        <div className="flex items-center gap-3">
          {next && (
            <button
              onClick={advance}
              disabled={advancing}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {advancing ? 'Wird aktualisiert...' : next.label + ' →'}
            </button>
          )}
          <button
            onClick={cancel}
            disabled={cancelling}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelling ? '...' : 'Stornieren'}
          </button>
        </div>
      )}

      {/* Event details */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Auftragsdetails</h3>
        </div>
        <dl className="divide-y divide-gray-100">
          <Row label="Kunde" value={event.customers?.company_name ?? '–'} />
          <Row label="Datum" value={fmtDate(event.event_date)} />
          {(event.start_time || event.end_time) && (
            <Row
              label="Uhrzeit"
              value={[event.start_time, event.end_time].filter(Boolean).join(' – ')}
            />
          )}
          {event.location_name && (
            <Row label="Veranstaltungsort" value={event.location_name} />
          )}
          {event.location_address && (
            <Row label="Adresse" value={event.location_address} />
          )}
          <Row label="Gästeanzahl" value={String(event.guest_count)} />
          {event.budget_cents && (
            <Row label="Budget" value={eur(event.budget_cents)} />
          )}
          <Row label="Angelegt am" value={fmtDate(event.created_at)} />
        </dl>
      </div>

      {event.internal_notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-5 py-4">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">Interne Notizen</p>
          <p className="text-sm text-yellow-900 whitespace-pre-wrap">{event.internal_notes}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-5 py-3">
      <dt className="w-40 text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  )
}

// ─── Tab: Angebote ───────────────────────────────────────────────────────────

function OffersTab({ event, onRefresh }: { event: EventDetail; onRefresh: () => void }) {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const nextVersion = (event.offers.reduce((max, o) => Math.max(max, o.version), 0)) + 1

  async function updateOfferStatus(offerId: string, status: OfferStatus) {
    if (status === 'angenommen') {
      await supabase.from('offers').update({ status, accepted_at: new Date().toISOString() }).eq('id', offerId)
      await supabase.from('events').update({ status: 'bestaetigt' }).eq('id', event.id)
    } else if (status === 'gesendet') {
      await supabase.from('offers').update({ status, sent_at: new Date().toISOString() }).eq('id', offerId)
    } else {
      await supabase.from('offers').update({ status }).eq('id', offerId)
    }
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {event.offers.length === 0 ? 'Noch keine Angebote vorhanden.' : `${event.offers.length} Angebot${event.offers.length !== 1 ? 'e' : ''}`}
        </p>
        {event.status !== 'abgeschlossen' && event.status !== 'storniert' && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700"
          >
            + Neues Angebot
          </button>
        )}
      </div>

      {event.offers.length === 0 && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg py-10 text-center">
          <p className="text-sm text-gray-400">Erstelle das erste Angebot für diesen Auftrag.</p>
        </div>
      )}

      {event.offers
        .sort((a, b) => b.version - a.version)
        .map(offer => (
          <div key={offer.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expandedId === offer.id ? null : offer.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">Angebot v{offer.version}</span>
                <OfferStatusBadge status={offer.status} />
                {offer.valid_until && (
                  <span className="text-xs text-gray-400">Gültig bis {fmtDate(offer.valid_until)}</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {eur(Math.round(offer.total_net_cents * (1 + offer.tax_rate_pct / 100)))} brutto
                </span>
                {offer.status === 'entwurf' && (
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/quotes/${offer.id}/edit`) }}
                    className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 shrink-0"
                  >
                    Im Editor öffnen
                  </button>
                )}
                <span className="text-gray-400 text-sm">{expandedId === offer.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expandedId === offer.id && (
              <div className="border-t border-gray-100">
                {/* Line items */}
                {offer.offer_items.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-2 text-left text-xs text-gray-500 font-medium">Pos.</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Bezeichnung</th>
                        <th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Menge</th>
                        <th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Einheit</th>
                        <th className="px-3 py-2 text-right text-xs text-gray-500 font-medium">Einzelpreis</th>
                        <th className="px-5 py-2 text-right text-xs text-gray-500 font-medium">Gesamt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offer.offer_items
                        .sort((a, b) => a.position - b.position)
                        .map(item => (
                          <tr key={item.id}>
                            <td className="px-5 py-2 text-gray-400">{item.position}</td>
                            <td className="px-3 py-2 text-gray-900">
                              {item.label}
                              {item.description && (
                                <p className="text-xs text-gray-400">{item.description}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{item.unit}</td>
                            <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{eur(item.unit_price_cents)}</td>
                            <td className="px-5 py-2 text-right font-medium text-gray-900 tabular-nums">{eur(item.total_cents)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}

                {/* Totals */}
                <div className="flex justify-end px-5 py-3 border-t border-gray-100">
                  <div className="w-56 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Netto</span>
                      <span className="tabular-nums">{eur(offer.total_net_cents)}</span>
                    </div>
                    {offer.discount_cents > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Rabatt</span>
                        <span className="tabular-nums">− {eur(offer.discount_cents)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-500">
                      <span>MwSt. {offer.tax_rate_pct}%</span>
                      <span className="tabular-nums">{eur(Math.round(offer.total_net_cents * offer.tax_rate_pct / 100))}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1">
                      <span>Brutto</span>
                      <span className="tabular-nums">{eur(Math.round(offer.total_net_cents * (1 + offer.tax_rate_pct / 100)))}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
                  {offer.status === 'entwurf' && (
                    <button
                      onClick={() => updateOfferStatus(offer.id, 'gesendet')}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                    >
                      Als gesendet markieren
                    </button>
                  )}
                  {(offer.status === 'entwurf' || offer.status === 'gesendet') && (
                    <button
                      onClick={() => updateOfferStatus(offer.id, 'angenommen')}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                    >
                      Angebot annehmen ✓
                    </button>
                  )}
                  {offer.status === 'gesendet' && (
                    <button
                      onClick={() => updateOfferStatus(offer.id, 'abgelehnt')}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-white"
                    >
                      Abgelehnt
                    </button>
                  )}
                  {offer.notes && (
                    <span className="ml-auto text-xs text-gray-400 italic">{offer.notes}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

      {showCreate && (
        <CreateOfferModal
          eventId={event.id}
          nextVersion={nextVersion}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ─── Tab: Rechnung ───────────────────────────────────────────────────────────

function InvoiceTab({ event, onRefresh }: { event: EventDetail; onRefresh: () => void }) {
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)
  const [newDueDate, setNewDueDate] = useState('')

  const acceptedOffer = event.offers.find(o => o.status === 'angenommen')

  async function createInvoice() {
    if (!acceptedOffer) return
    setCreating(true)
    await supabase.from('invoices').insert({
      event_id: event.id,
      offer_id: acceptedOffer.id,
      status: 'entwurf' as const,
      issued_date: new Date().toISOString().slice(0, 10),
      due_date: newDueDate || null,
      total_net_cents: acceptedOffer.total_net_cents,
      tax_rate_pct: acceptedOffer.tax_rate_pct,
      created_by: user?.id ?? null,
    })
    // Advance event to billing phase
    if (event.status === 'bestaetigt' || event.status === 'durchfuehrung') {
      await supabase.from('events').update({ status: 'abrechnung' }).eq('id', event.id)
    }
    setCreating(false)
    onRefresh()
  }

  async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
    if (status === 'bezahlt') {
      await supabase.from('invoices').update({ status, paid_at: new Date().toISOString() }).eq('id', invoiceId)
      await supabase.from('events').update({ status: 'abgeschlossen' }).eq('id', event.id)
    } else {
      await supabase.from('invoices').update({ status }).eq('id', invoiceId)
    }
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Create invoice */}
      {event.invoices.length === 0 && acceptedOffer && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rechnung erstellen</h3>
          <p className="text-sm text-gray-500 mb-4">
            Basiert auf Angebot v{acceptedOffer.version} ({eur(acceptedOffer.total_net_cents)} netto).
          </p>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fälligkeitsdatum</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <button
              onClick={createInvoice}
              disabled={creating}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {creating ? 'Erstelle...' : 'Rechnung erstellen'}
            </button>
          </div>
        </div>
      )}

      {event.invoices.length === 0 && !acceptedOffer && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg py-10 text-center">
          <p className="text-sm text-gray-400">Noch kein angenommenes Angebot vorhanden.</p>
          <p className="text-xs text-gray-400 mt-1">Nimm zuerst ein Angebot an, um eine Rechnung zu erstellen.</p>
        </div>
      )}

      {event.invoices
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map(inv => (
          <div key={inv.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold text-gray-900">
                    {inv.invoice_number ?? 'Rechnung (Nummer wird generiert)'}
                  </span>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                <div className="text-xs text-gray-400 space-x-3">
                  <span>Ausgestellt: {fmtDate(inv.issued_date)}</span>
                  {inv.due_date && <span>Fällig: {fmtDate(inv.due_date)}</span>}
                  {inv.paid_at && <span>Bezahlt: {fmtDate(inv.paid_at)}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900 tabular-nums">
                  {eur(inv.total_gross_cents)}
                </div>
                <div className="text-xs text-gray-400">brutto inkl. {inv.tax_rate_pct}% MwSt.</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
              {inv.status === 'entwurf' && (
                <button
                  onClick={() => updateInvoiceStatus(inv.id, 'gesendet')}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                >
                  Als gesendet markieren
                </button>
              )}
              {(inv.status === 'entwurf' || inv.status === 'gesendet' || inv.status === 'ueberfaellig') && (
                <button
                  onClick={() => updateInvoiceStatus(inv.id, 'bezahlt')}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                >
                  Als bezahlt markieren ✓
                </button>
              )}
              {inv.status === 'gesendet' && (
                <button
                  onClick={() => updateInvoiceStatus(inv.id, 'ueberfaellig')}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-xs hover:bg-white"
                >
                  Überfällig markieren
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  )
}

// ─── Tab: Personal ───────────────────────────────────────────────────────────

function StaffTab({ event, onRefresh }: { event: EventDetail; onRefresh: () => void }) {
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    supabase
      .from('staff_members')
      .select('id, first_name, last_name, role')
      .eq('is_active', true)
      .order('last_name')
      .then(({ data }) => { if (data) setAllStaff(data as StaffMember[]) })
  }, [])

  const assignedIds = new Set(event.event_staff.map(es => es.staff_member_id))
  const available = allStaff.filter(s => !assignedIds.has(s.id))

  async function assignStaff() {
    if (!selectedStaffId) return
    setAdding(true)
    await supabase.from('event_staff').insert({
      event_id: event.id,
      staff_member_id: selectedStaffId,
      confirmed: false,
    })
    setSelectedStaffId('')
    setShowAdd(false)
    setAdding(false)
    onRefresh()
  }

  async function toggleConfirmed(assignmentId: string, current: boolean) {
    await supabase.from('event_staff').update({ confirmed: !current }).eq('id', assignmentId)
    onRefresh()
  }

  async function removeAssignment(assignmentId: string) {
    await supabase.from('event_staff').delete().eq('id', assignmentId)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {event.event_staff.length === 0
            ? 'Noch kein Personal zugeordnet.'
            : `${event.event_staff.length} Person${event.event_staff.length !== 1 ? 'en' : ''} eingeplant`}
        </p>
        {event.status !== 'abgeschlossen' && event.status !== 'storniert' && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700"
          >
            + Personal zuordnen
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Mitarbeiter wählen</label>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Mitarbeiter auswählen...</option>
              {available.map(s => (
                <option key={s.id} value={s.id}>
                  {s.last_name}, {s.first_name} ({ROLE_LABELS[s.role]})
                </option>
              ))}
            </select>
            {available.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Alle aktiven Mitarbeiter sind bereits eingeplant.</p>
            )}
          </div>
          <button
            onClick={assignStaff}
            disabled={!selectedStaffId || adding}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {adding ? '...' : 'Hinzufügen'}
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-3 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50"
          >
            Abbrechen
          </button>
        </div>
      )}

      {event.event_staff.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Rolle</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Stunden</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {event.event_staff.map(es => (
                <tr key={es.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {es.staff_members
                      ? `${es.staff_members.last_name}, ${es.staff_members.first_name}`
                      : '–'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {ROLE_LABELS[es.role_override ?? es.staff_members?.role ?? 'sonstiges']}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {es.hours_worked != null ? `${es.hours_worked} h` : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleConfirmed(es.id, es.confirmed)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        es.confirmed
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {es.confirmed ? '✓ Bestätigt' : 'Ausstehend'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeAssignment(es.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Entfernen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

type Tab = 'uebersicht' | 'angebote' | 'rechnung' | 'personal'

const TABS: { id: Tab; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'angebote',   label: 'Angebote' },
  { id: 'rechnung',   label: 'Rechnung' },
  { id: 'personal',   label: 'Personal' },
]

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('uebersicht')

  const loadEvent = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('events')
      .select(`
        *,
        customers (id, company_name, industry),
        offers (
          *,
          offer_items (*)
        ),
        event_staff (
          *,
          staff_members (id, first_name, last_name, role, hourly_rate_cents)
        ),
        invoices (*)
      `)
      .eq('id', id)
      .single()

    setEvent(data as unknown as EventDetail)
    setLoading(false)
  }, [id])

  useEffect(() => { loadEvent() }, [loadEvent])

  async function handleStatusChange(newStatus: EventStatus) {
    if (!event) return
    await supabase.from('events').update({ status: newStatus }).eq('id', event.id)
    await loadEvent()
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Laden...</div>
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Auftrag nicht gefunden.</p>
        <Link to="/events" className="text-sm text-red-600 hover:underline mt-2 inline-block">← Zurück zur Liste</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/events" className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
          ← Aufträge
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {event.customers?.company_name} · {fmtDate(event.event_date)}
              {event.guest_count > 0 && ` · ${event.guest_count} Gäste`}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </div>
      </div>

      {/* Workflow stepper */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 mb-6 overflow-x-auto">
        <WorkflowStepper status={event.status} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-red-600 text-red-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
              {t.id === 'angebote' && event.offers.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {event.offers.length}
                </span>
              )}
              {t.id === 'personal' && event.event_staff.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {event.event_staff.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'uebersicht' && (
          <OverviewTab event={event} onStatusChange={handleStatusChange} />
        )}
        {tab === 'angebote' && (
          <OffersTab event={event} onRefresh={loadEvent} />
        )}
        {tab === 'rechnung' && (
          <InvoiceTab event={event} onRefresh={loadEvent} />
        )}
        {tab === 'personal' && (
          <StaffTab event={event} onRefresh={loadEvent} />
        )}
      </div>
    </div>
  )
}
