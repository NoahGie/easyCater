import type { EventStatus, OfferStatus, InvoiceStatus } from '../../types/database'

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const configs: Record<EventStatus, { label: string; cls: string }> = {
    anfrage:      { label: 'Anfrage',      cls: 'bg-blue-100 text-blue-700' },
    angebot:      { label: 'Angebot',      cls: 'bg-yellow-100 text-yellow-700' },
    bestaetigt:   { label: 'Bestätigt',    cls: 'bg-green-100 text-green-700' },
    durchfuehrung:{ label: 'Durchführung', cls: 'bg-purple-100 text-purple-700' },
    abrechnung:   { label: 'Abrechnung',   cls: 'bg-orange-100 text-orange-700' },
    abgeschlossen:{ label: 'Abgeschlossen',cls: 'bg-gray-200 text-gray-700' },
    storniert:    { label: 'Storniert',    cls: 'bg-red-100 text-red-700' },
  }
  const { label, cls } = configs[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const configs: Record<OfferStatus, { label: string; cls: string }> = {
    entwurf:   { label: 'Entwurf',    cls: 'bg-gray-100 text-gray-600' },
    gesendet:  { label: 'Gesendet',   cls: 'bg-blue-100 text-blue-700' },
    angenommen:{ label: 'Angenommen', cls: 'bg-green-100 text-green-700' },
    abgelehnt: { label: 'Abgelehnt',  cls: 'bg-red-100 text-red-700' },
    abgelaufen:{ label: 'Abgelaufen', cls: 'bg-gray-100 text-gray-500' },
  }
  const { label, cls } = configs[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const configs: Record<InvoiceStatus, { label: string; cls: string }> = {
    entwurf:    { label: 'Entwurf',    cls: 'bg-gray-100 text-gray-600' },
    gesendet:   { label: 'Gesendet',   cls: 'bg-blue-100 text-blue-700' },
    bezahlt:    { label: 'Bezahlt',    cls: 'bg-green-100 text-green-700' },
    ueberfaellig:{ label: 'Überfällig', cls: 'bg-red-100 text-red-700' },
    storniert:  { label: 'Storniert',  cls: 'bg-gray-100 text-gray-500' },
  }
  const { label, cls } = configs[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}
