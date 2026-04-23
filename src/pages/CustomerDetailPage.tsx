import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import type { EventStatus } from '../types/database'
import { EventStatusBadge } from '../components/events/EventStatusBadge'

// ─── Types ───────────────────────────────────────────────────────────────────

type Contact = {
  id: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
}

type EventHistoryRow = {
  id: string
  title: string
  status: EventStatus
  event_date: string
  guest_count: number
  budget_cents: number | null
  location_name: string | null
}

type CustomerDetail = {
  id: string
  company_name: string
  industry: string | null
  street: string | null
  city: string | null
  postal_code: string | null
  country: string
  notes: string | null
  preferences: Record<string, unknown> | null
  is_repeat_client: boolean
  created_at: string
  customer_contacts: Contact[]
  events: EventHistoryRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '–'
  return format(new Date(d), 'dd.MM.yyyy', { locale: de })
}

function eur(cents: number | null) {
  if (!cents) return '–'
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

const COUNTRY_LABELS: Record<string, string> = {
  DE: 'Deutschland',
  AT: 'Österreich',
  CH: 'Schweiz',
}

// ─── Tab: Stammdaten ──────────────────────────────────────────────────────────

function StammdatenTab({ customer, onRefresh }: { customer: CustomerDetail; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name: customer.company_name,
    industry: customer.industry ?? '',
    street: customer.street ?? '',
    city: customer.city ?? '',
    postal_code: customer.postal_code ?? '',
    country: customer.country,
    notes: customer.notes ?? '',
    is_repeat_client: customer.is_repeat_client,
  })

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save() {
    setSaving(true)
    await supabase.from('customers').update({
      company_name: form.company_name.trim(),
      industry: form.industry.trim() || null,
      street: form.street.trim() || null,
      city: form.city.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country,
      notes: form.notes.trim() || null,
      is_repeat_client: form.is_repeat_client,
    }).eq('id', customer.id)
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  if (editing) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 max-w-lg">
        <h3 className="text-sm font-semibold text-gray-800">Stammdaten bearbeiten</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Firmenname *</label>
          <input
            value={form.company_name}
            onChange={e => set('company_name', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Branche</label>
          <input
            value={form.industry}
            onChange={e => set('industry', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Straße</label>
          <input
            value={form.street}
            onChange={e => set('street', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">PLZ</label>
            <input
              value={form.postal_code}
              onChange={e => set('postal_code', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Stadt</label>
            <input
              value={form.city}
              onChange={e => set('city', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Land</label>
          <select
            value={form.country}
            onChange={e => set('country', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="DE">Deutschland</option>
            <option value="AT">Österreich</option>
            <option value="CH">Schweiz</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notizen</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_repeat_client}
            onChange={e => set('is_repeat_client', e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-gray-700">Stammkunde</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving || !form.company_name.trim()}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Bearbeiten
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Unternehmen</h3>
        </div>
        <dl className="divide-y divide-gray-100">
          <DetailRow label="Firmenname" value={customer.company_name} />
          <DetailRow label="Branche" value={customer.industry ?? '–'} />
          <DetailRow
            label="Adresse"
            value={[
              customer.street,
              [customer.postal_code, customer.city].filter(Boolean).join(' '),
              COUNTRY_LABELS[customer.country] ?? customer.country,
            ].filter(Boolean).join(', ') || '–'}
          />
          <DetailRow label="Typ" value={customer.is_repeat_client ? 'Stammkunde' : 'Neukunde'} />
          <DetailRow label="Angelegt am" value={fmtDate(customer.created_at)} />
        </dl>
      </div>

      {customer.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-5 py-4">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">Notizen</p>
          <p className="text-sm text-yellow-900 whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-5 py-3">
      <dt className="w-36 text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  )
}

// ─── Tab: Kontakte ────────────────────────────────────────────────────────────

function KontakteTab({ customer, onRefresh }: { customer: CustomerDetail; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    title: '',
    email: '',
    phone: '',
    is_primary: false,
    notes: '',
  })

  function setField(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setSaving(true)
    await supabase.from('customer_contacts').insert({
      customer_id: customer.id,
      full_name: form.full_name.trim(),
      title: form.title.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      is_primary: form.is_primary,
      notes: form.notes.trim() || null,
    })
    setForm({ full_name: '', title: '', email: '', phone: '', is_primary: false, notes: '' })
    setShowAdd(false)
    setSaving(false)
    onRefresh()
  }

  async function deleteContact(id: string) {
    if (!window.confirm('Kontakt wirklich löschen?')) return
    await supabase.from('customer_contacts').delete().eq('id', id)
    onRefresh()
  }

  async function setPrimary(id: string) {
    await supabase.from('customer_contacts').update({ is_primary: false }).eq('customer_id', customer.id)
    await supabase.from('customer_contacts').update({ is_primary: true }).eq('id', id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {customer.customer_contacts.length === 0
            ? 'Noch keine Kontakte vorhanden.'
            : `${customer.customer_contacts.length} Kontakt${customer.customer_contacts.length !== 1 ? 'e' : ''}`}
        </p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700"
          >
            + Kontakt hinzufügen
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={addContact} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">Neuer Kontakt</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                value={form.full_name}
                onChange={e => setField('full_name', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Titel / Position</label>
              <input
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Einkaufsleiter"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="max@firma.de"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setField('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="+49 30 123456"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notizen</label>
            <input
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Bevorzugte Kommunikationsart, Hinweise..."
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={e => setField('is_primary', e.target.checked)}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Hauptansprechpartner</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !form.full_name.trim()}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      )}

      {customer.customer_contacts.length === 0 && !showAdd && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg py-10 text-center">
          <p className="text-sm text-gray-400">Noch keine Kontakte eingetragen.</p>
        </div>
      )}

      {customer.customer_contacts.length > 0 && (
        <div className="space-y-3">
          {[...customer.customer_contacts]
            .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
            .map(contact => (
              <div key={contact.id} className="bg-white border border-gray-200 rounded-lg px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-gray-900 text-sm">{contact.full_name}</span>
                      {contact.is_primary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Hauptkontakt
                        </span>
                      )}
                    </div>
                    {contact.title && (
                      <p className="text-xs text-gray-400 mb-1">{contact.title}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="hover:text-red-600 transition-colors">
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="hover:text-red-600 transition-colors">
                          {contact.phone}
                        </a>
                      )}
                    </div>
                    {contact.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">{contact.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!contact.is_primary && (
                      <button
                        onClick={() => setPrimary(contact.id)}
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        Als Hauptkontakt
                      </button>
                    )}
                    <button
                      onClick={() => deleteContact(contact.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Auftragshistorie ────────────────────────────────────────────────────

function HistorieTab({ customer }: { customer: CustomerDetail }) {
  const events = [...customer.events].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  )

  const totalBudget = events.reduce((sum, e) => sum + (e.budget_cents ?? 0), 0)

  return (
    <div className="space-y-4">
      {events.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Aufträge gesamt</p>
            <p className="text-xl font-bold text-gray-900">{events.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Letzter Auftrag</p>
            <p className="text-sm font-semibold text-gray-900">{fmtDate(events[0]?.event_date ?? null)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Gesamtbudget</p>
            <p className="text-sm font-semibold text-gray-900">{totalBudget > 0 ? eur(totalBudget) : '–'}</p>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg py-10 text-center">
          <p className="text-sm text-gray-400">Noch keine Aufträge für diesen Kunden.</p>
          <Link
            to="/events"
            className="text-sm text-red-600 hover:text-red-700 font-medium mt-2 inline-block"
          >
            Erste Anfrage anlegen →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Auftrag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Gäste</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Budget</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map(ev => (
                <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/events/${ev.id}`}
                      className="font-medium text-gray-900 hover:text-red-600 transition-colors"
                    >
                      {ev.title}
                    </Link>
                    {ev.location_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{ev.location_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {fmtDate(ev.event_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{ev.guest_count}</td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">{eur(ev.budget_cents)}</td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={ev.status} />
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

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'stammdaten' | 'kontakte' | 'historie'

const TABS: { id: Tab; label: string }[] = [
  { id: 'stammdaten', label: 'Stammdaten' },
  { id: 'kontakte',   label: 'Kontakte' },
  { id: 'historie',   label: 'Auftragshistorie' },
]

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('stammdaten')

  const loadCustomer = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('customers')
      .select(`
        *,
        customer_contacts (*),
        events (
          id, title, status, event_date, guest_count,
          budget_cents, location_name
        )
      `)
      .eq('id', id)
      .single()

    setCustomer(data as unknown as CustomerDetail)
    setLoading(false)
  }, [id])

  useEffect(() => { loadCustomer() }, [loadCustomer])

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Laden...</div>
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Kunde nicht gefunden.</p>
        <Link to="/customers" className="text-sm text-red-600 hover:underline mt-2 inline-block">
          ← Zurück zur Liste
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/customers" className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
          ← Kunden
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.company_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {[
                customer.industry,
                customer.city ? `${customer.postal_code ? customer.postal_code + ' ' : ''}${customer.city}` : null,
              ].filter(Boolean).join(' · ') || 'Kein Eintrag'}
            </p>
          </div>
          {customer.is_repeat_client && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 shrink-0">
              Stammkunde
            </span>
          )}
        </div>
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
              {t.id === 'kontakte' && customer.customer_contacts.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {customer.customer_contacts.length}
                </span>
              )}
              {t.id === 'historie' && customer.events.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {customer.events.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'stammdaten' && (
          <StammdatenTab customer={customer} onRefresh={loadCustomer} />
        )}
        {tab === 'kontakte' && (
          <KontakteTab customer={customer} onRefresh={loadCustomer} />
        )}
        {tab === 'historie' && (
          <HistorieTab customer={customer} />
        )}
      </div>
    </div>
  )
}
