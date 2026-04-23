import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import type { CatalogItemType } from '../types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

type CatalogCategory = { id: string; name: string; sort_order: number }

type CatalogItem = {
  id: string
  name: string
  description: string | null
  unit: string
  unit_price_cents: number
  type: CatalogItemType
  category_id: string | null
}

type LineItem = {
  id: string          // temp UUID for dnd key (real DB id after save)
  catalogItemId: string | null
  label: string
  description: string
  quantity: string
  unit: string
  unitPriceCents: string  // in euros string for input
  saved: boolean          // false = not yet persisted
}

type OfferMeta = {
  id: string
  version: number
  status: string
  valid_until: string | null
  tax_rate_pct: number
  discount_cents: number
  notes: string | null
  event_id: string
  eventTitle: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function eur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseEur(s: string): number {
  return Math.round((parseFloat(s.replace(',', '.')) || 0) * 100)
}

function lineTotalCents(item: LineItem): number {
  return Math.round((parseFloat(item.quantity) || 0) * parseEur(item.unitPriceCents))
}

function newId() {
  return crypto.randomUUID()
}

// ─── Sortable line item row ───────────────────────────────────────────────────

function SortableRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: LineItem
  onUpdate: (id: string, field: keyof LineItem, value: string) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const total = lineTotalCents(item)

  return (
    <tr ref={setNodeRef} style={style} className="group hover:bg-amber-50/40 transition-colors">
      <td className="pl-2 py-1.5 w-6">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none px-1"
          tabIndex={-1}
          aria-label="Zeile verschieben"
        >
          ⠿
        </button>
      </td>
      <td className="px-1 py-1.5">
        <input
          value={item.label}
          onChange={e => onUpdate(item.id, 'label', e.target.value)}
          className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
          placeholder="Bezeichnung..."
        />
        <input
          value={item.description}
          onChange={e => onUpdate(item.id, 'description', e.target.value)}
          className="w-full text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-1 py-0 text-gray-400"
          placeholder="Beschreibung (optional)..."
        />
      </td>
      <td className="px-1 py-1.5 w-20">
        <input
          type="number"
          min="0"
          step="0.5"
          value={item.quantity}
          onChange={e => onUpdate(item.id, 'quantity', e.target.value)}
          className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5 text-right tabular-nums"
        />
      </td>
      <td className="px-1 py-1.5 w-20">
        <input
          value={item.unit}
          onChange={e => onUpdate(item.id, 'unit', e.target.value)}
          className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5"
        />
      </td>
      <td className="px-1 py-1.5 w-28">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.unitPriceCents}
          onChange={e => onUpdate(item.id, 'unitPriceCents', e.target.value)}
          className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-red-400 rounded px-1 py-0.5 text-right tabular-nums"
          placeholder="0,00"
        />
      </td>
      <td className="px-2 py-1.5 text-right text-sm font-medium text-gray-700 tabular-nums w-28">
        {eur(total)} €
      </td>
      <td className="pr-2 py-1.5 w-6 text-right">
        <button
          onClick={() => onRemove(item.id)}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
          title="Zeile entfernen"
        >
          ×
        </button>
      </td>
    </tr>
  )
}

// ─── Catalog item card (draggable) ────────────────────────────────────────────

function CatalogCard({ item }: { item: CatalogItem }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm shadow-sm">
      <div className="font-medium text-gray-800 truncate">{item.name}</div>
      <div className="text-xs text-gray-400 mt-0.5 flex justify-between">
        <span>{item.unit}</span>
        <span className="tabular-nums font-medium text-gray-600">{eur(item.unit_price_cents)} €</span>
      </div>
    </div>
  )
}

function DraggableCatalogCard({ item }: { item: CatalogItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `catalog:${item.id}`,
    data: { type: 'catalog', item },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-30' : ''}`}
    >
      <CatalogCard item={item} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function QuoteEditorPage() {
  const { offerId } = useParams<{ offerId: string }>()
  const navigate = useNavigate()

  const [offer, setOffer] = useState<OfferMeta | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'all' | 'uncategorized'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Offer meta fields
  const [taxRate, setTaxRate] = useState('19')
  const [discountEur, setDiscountEur] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const loadData = useCallback(async () => {
    if (!offerId) return

    const [{ data: offerData }, { data: cats }, { data: catItems }] = await Promise.all([
      supabase
        .from('offers')
        .select('*, offer_items(*), events(id, title)')
        .eq('id', offerId)
        .single(),
      supabase.from('catalog_categories').select('*').order('sort_order'),
      supabase.from('catalog_items').select('*').eq('is_active', true).order('name'),
    ])

    if (offerData) {
      const ev = offerData.events as unknown as { id: string; title: string } | null
      setOffer({
        id: offerData.id,
        version: offerData.version,
        status: offerData.status,
        valid_until: offerData.valid_until,
        tax_rate_pct: offerData.tax_rate_pct,
        discount_cents: offerData.discount_cents,
        notes: offerData.notes,
        event_id: offerData.event_id,
        eventTitle: ev?.title ?? '',
      })
      setTaxRate(String(offerData.tax_rate_pct ?? 19))
      setDiscountEur(offerData.discount_cents ? eur(offerData.discount_cents) : '')
      setValidUntil(offerData.valid_until ?? '')
      setNotes(offerData.notes ?? '')

      const dbItems: LineItem[] = ((offerData.offer_items ?? []) as Array<{
        id: string
        catalog_item_id: string | null
        label: string
        description: string | null
        quantity: number
        unit: string
        unit_price_cents: number
        position: number
      }>)
        .sort((a, b) => a.position - b.position)
        .map(i => ({
          id: i.id,
          catalogItemId: i.catalog_item_id,
          label: i.label,
          description: i.description ?? '',
          quantity: String(i.quantity),
          unit: i.unit,
          unitPriceCents: String(i.unit_price_cents / 100),
          saved: true,
        }))
      setItems(dbItems)
    }

    if (cats) setCategories(cats as CatalogCategory[])
    if (catItems) setCatalogItems(catItems as CatalogItem[])

    setLoading(false)
  }, [offerId])

  useEffect(() => { loadData() }, [loadData])

  // ── Pricing ────────────────────────────────────────────────────────────────

  const subtotalCents = items.reduce((s, i) => s + lineTotalCents(i), 0)
  const discountCents = parseEur(discountEur)
  const netCents = Math.max(0, subtotalCents - discountCents)
  const taxPct = parseFloat(taxRate) || 0
  const taxCents = Math.round(netCents * taxPct / 100)
  const grossCents = netCents + taxCents

  // ── Line item mutations ────────────────────────────────────────────────────

  function updateItem(id: string, field: keyof LineItem, value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function addBlankLine() {
    setItems(prev => [...prev, {
      id: newId(),
      catalogItemId: null,
      label: '',
      description: '',
      quantity: '1',
      unit: 'Stk.',
      unitPriceCents: '',
      saved: false,
    }])
  }

  // ── DnD ───────────────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const activeStr = String(active.id)
    const overStr = String(over.id)

    if (activeStr.startsWith('catalog:')) {
      // Drop catalog item onto the list (over any row or the drop zone)
      const catItemId = activeStr.replace('catalog:', '')
      const catItem = catalogItems.find(c => c.id === catItemId)
      if (!catItem) return

      const newLine: LineItem = {
        id: newId(),
        catalogItemId: catItem.id,
        label: catItem.name,
        description: catItem.description ?? '',
        quantity: '1',
        unit: catItem.unit,
        unitPriceCents: String(catItem.unit_price_cents / 100),
        saved: false,
      }

      if (overStr.startsWith('catalog:') || overStr === 'drop-zone') {
        setItems(prev => [...prev, newLine])
      } else {
        // Insert before the target row
        setItems(prev => {
          const idx = prev.findIndex(i => i.id === overStr)
          if (idx === -1) return [...prev, newLine]
          const next = [...prev]
          next.splice(idx, 0, newLine)
          return next
        })
      }
      return
    }

    // Reorder within list
    if (activeStr !== overStr) {
      setItems(prev => {
        const oldIdx = prev.findIndex(i => i.id === activeStr)
        const newIdx = prev.findIndex(i => i.id === overStr)
        if (oldIdx === -1 || newIdx === -1) return prev
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!offerId || !offer) return
    const validItems = items.filter(i => i.label.trim())
    setSaving(true)
    setSaveError(null)

    // Update offer meta
    const { error: offerErr } = await supabase.from('offers').update({
      valid_until: validUntil || null,
      tax_rate_pct: taxPct,
      discount_cents: discountCents,
      total_net_cents: netCents,
      notes: notes || null,
    }).eq('id', offerId)

    if (offerErr) { setSaveError(offerErr.message); setSaving(false); return }

    // Delete old items, re-insert in order
    const { error: delErr } = await supabase.from('offer_items').delete().eq('offer_id', offerId)
    if (delErr) { setSaveError(delErr.message); setSaving(false); return }

    if (validItems.length > 0) {
      const rows = validItems.map((item, idx) => ({
        offer_id: offerId,
        catalog_item_id: item.catalogItemId ?? null,
        position: idx + 1,
        label: item.label.trim(),
        description: item.description || null,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'Stk.',
        unit_price_cents: parseEur(item.unitPriceCents),
      }))
      const { error: insErr } = await supabase.from('offer_items').insert(rows)
      if (insErr) { setSaveError(insErr.message); setSaving(false); return }
    }

    setSaving(false)
    navigate(`/events/${offer.event_id}`)
  }

  // ── Catalog filtering ─────────────────────────────────────────────────────

  const filteredCatalog = catalogItems.filter(item => {
    if (activeCategoryId === 'all') return true
    if (activeCategoryId === 'uncategorized') return item.category_id === null
    return item.category_id === activeCategoryId
  })

  const activeDragItem = activeId?.startsWith('catalog:')
    ? catalogItems.find(c => c.id === activeId.replace('catalog:', ''))
    : null

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Lädt Angebot…</div>
  if (!offer) return (
    <div className="text-center py-16">
      <p className="text-gray-500">Angebot nicht gefunden.</p>
      <Link to="/events" className="text-sm text-red-600 hover:underline mt-2 inline-block">← Aufträge</Link>
    </div>
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <Link
              to={`/events/${offer.event_id}`}
              className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block"
            >
              ← {offer.eventTitle || 'Auftrag'}
            </Link>
            <h1 className="text-xl font-bold text-gray-900">
              Angebotseditor – v{offer.version}
              <span className="ml-2 text-sm font-normal text-gray-400">Entwurf</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
            <button
              onClick={() => navigate(`/events/${offer.event_id}`)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Angebot speichern'}
            </button>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

          {/* Left: Catalog browser */}
          <div className="w-64 shrink-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Katalog</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ziehe Positionen in das Angebot</p>
            </div>

            {/* Category tabs */}
            <div className="flex flex-col border-b border-gray-100">
              {[
                { id: 'all' as const, label: 'Alle' },
                ...categories.map(c => ({ id: c.id, label: c.name })),
                { id: 'uncategorized' as const, label: 'Ohne Kategorie' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`text-left px-4 py-2 text-xs font-medium transition-colors border-l-2 ${
                    activeCategoryId === cat.id
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat.label}
                  {cat.id !== 'all' && cat.id !== 'uncategorized' && (
                    <span className="ml-1 text-gray-400">
                      ({catalogItems.filter(i => i.category_id === cat.id).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Catalog items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              <SortableContext items={catalogItems.map(c => `catalog:${c.id}`)} strategy={verticalListSortingStrategy}>
                {filteredCatalog.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">Keine Einträge in dieser Kategorie.</p>
                )}
                {filteredCatalog.map(item => (
                  <DraggableCatalogCard key={item.id} item={item} />
                ))}
              </SortableContext>
            </div>
          </div>

          {/* Right: Quote editor */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Offer meta fields */}
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-3 shrink-0">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gültig bis</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={e => setValidUntil(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">MwSt. (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={e => setTaxRate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rabatt (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountEur}
                    onChange={e => setDiscountEur(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Anmerkungen</label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Interne Notiz…"
                  />
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-lg flex flex-col min-h-0">
              <table className="w-full text-sm table-fixed">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="w-6 pl-2" />
                    <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500">Bezeichnung</th>
                    <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-20">Menge</th>
                    <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500 w-20">Einheit</th>
                    <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-28">Preis/Einheit</th>
                    <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-28">Gesamt</th>
                    <th className="w-6 pr-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <SortableContext
                    items={[...items.map(i => i.id), 'drop-zone']}
                    strategy={verticalListSortingStrategy}
                  >
                    {items.map(item => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                      />
                    ))}

                    {/* Drop zone when list is empty or for appending */}
                    <DropZoneRow isEmpty={items.length === 0} id="drop-zone" />
                  </SortableContext>
                </tbody>
              </table>

              {/* Add blank line button */}
              <div className="px-4 py-2 border-t border-gray-100">
                <button
                  onClick={addBlankLine}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  + Zeile hinzufügen
                </button>
              </div>
            </div>

            {/* Pricing summary */}
            <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 mt-3 shrink-0">
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Zwischensumme</span>
                    <span className="tabular-nums">{eur(subtotalCents)} €</span>
                  </div>
                  {discountCents > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Rabatt</span>
                      <span className="tabular-nums">− {eur(discountCents)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600 border-t border-gray-100 pt-1">
                    <span>Netto</span>
                    <span className="tabular-nums">{eur(netCents)} €</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>zzgl. {taxRate}% MwSt.</span>
                    <span className="tabular-nums">{eur(taxCents)} €</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 text-base">
                    <span>Brutto</span>
                    <span className="tabular-nums">{eur(grossCents)} €</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragItem ? (
          <div className="w-56 shadow-lg rotate-1">
            <CatalogCard item={activeDragItem} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Drop zone row ────────────────────────────────────────────────────────────

function DropZoneRow({ isEmpty, id }: { isEmpty: boolean; id: string }) {
  const { setNodeRef, isOver } = useSortable({ id })
  return (
    <tr ref={setNodeRef}>
      <td
        colSpan={7}
        className={`px-4 py-6 text-center text-sm transition-colors ${
          isOver
            ? 'bg-red-50 border-2 border-dashed border-red-400 text-red-500'
            : isEmpty
            ? 'text-gray-400 border-2 border-dashed border-gray-200 rounded'
            : 'text-transparent py-2'
        }`}
      >
        {isEmpty ? 'Katalogposition hierher ziehen oder Zeile manuell hinzufügen' : ''}
      </td>
    </tr>
  )
}
