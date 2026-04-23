import type { EventStatus } from '../../types/database'

const STEPS: { status: EventStatus; label: string }[] = [
  { status: 'anfrage',       label: 'Anfrage' },
  { status: 'angebot',       label: 'Angebot' },
  { status: 'bestaetigt',    label: 'Bestätigt' },
  { status: 'durchfuehrung', label: 'Durchführung' },
  { status: 'abrechnung',    label: 'Abrechnung' },
  { status: 'abgeschlossen', label: 'Abgeschlossen' },
]

const STATUS_ORDER = STEPS.map(s => s.status)

export function WorkflowStepper({ status }: { status: EventStatus }) {
  if (status === 'storniert') {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm">✕</span>
        <span className="text-red-600 font-medium text-sm">Auftrag storniert</span>
      </div>
    )
  }

  const currentIndex = STATUS_ORDER.indexOf(status)

  return (
    <nav className="flex items-start">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIndex
        const isCurrent = idx === currentIndex

        return (
          <div key={step.status} className="flex items-center">
            {idx > 0 && (
              <div className={`w-8 h-0.5 mt-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center min-w-[64px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isCurrent ? 'bg-red-600 text-white ring-2 ring-red-200' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-gray-100 text-gray-400' : ''}
                `}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span
                className={`mt-1.5 text-xs text-center leading-tight
                  ${isCurrent ? 'text-red-700 font-semibold' : ''}
                  ${isCompleted ? 'text-green-600' : ''}
                  ${!isCompleted && !isCurrent ? 'text-gray-400' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
