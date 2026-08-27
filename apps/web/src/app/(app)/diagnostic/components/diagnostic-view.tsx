'use client'

import { DIAGNOSTIC_AREAS, getStatusDisplay, type DiagnosticAssessment } from '@/lib/lens/diagnostic'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

interface DiagnosticViewProps {
  diagnostic: DiagnosticAssessment
}

export default function DiagnosticView({ diagnostic }: DiagnosticViewProps) {
  // Get areas sorted by severity (red first, then amber, then green)
  const sortedAreas = DIAGNOSTIC_AREAS.sort((a, b) => {
    const aStatus = diagnostic[a.id as keyof DiagnosticAssessment] as any
    const bStatus = diagnostic[b.id as keyof DiagnosticAssessment] as any
    const severityOrder = { red: 0, amber: 1, green: 2 }
    return severityOrder[aStatus.status] - severityOrder[bStatus.status]
  })

  // Count statuses
  const redCount = Object.values(diagnostic)
    .filter(v => typeof v === 'object' && v.status === 'red')
    .length
  const amberCount = Object.values(diagnostic)
    .filter(v => typeof v === 'object' && v.status === 'amber')
    .length
  const greenCount = Object.values(diagnostic)
    .filter(v => typeof v === 'object' && v.status === 'green')
    .length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Marketing Diagnostic</h1>
        <p className="text-slate-600 mt-2">
          Your 6-area business assessment showing where to focus your efforts
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6 text-center">
          <p className="text-4xl font-bold text-red-700">{redCount}</p>
          <p className="text-sm text-red-600 mt-1">Action Needed</p>
        </Card>
        <Card className="p-6 text-center">
          <p className="text-4xl font-bold text-amber-700">{amberCount}</p>
          <p className="text-sm text-amber-600 mt-1">Improvement Needed</p>
        </Card>
        <Card className="p-6 text-center">
          <p className="text-4xl font-bold text-green-700">{greenCount}</p>
          <p className="text-sm text-green-600 mt-1">Performing Well</p>
        </Card>
      </div>

      {/* Diagnostic Areas */}
      <div className="space-y-6">
        {sortedAreas.map((area) => {
          const status = diagnostic[area.id as keyof DiagnosticAssessment] as any
          const display = getStatusDisplay(status.status)

          return (
            <Card
              key={area.id}
              className={`p-6 border-l-4 ${display.borderColor} ${display.bgColor}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{display.icon}</span>
                    <h2 className="text-xl font-bold text-slate-900">{area.name}</h2>
                  </div>
                  <p className="text-sm text-slate-600">{area.description}</p>
                </div>
                <span className={`text-xs font-semibold ${display.color} uppercase`}>
                  {display.label}
                </span>
              </div>

              {/* Insight */}
              <div className="mb-4">
                <p className="text-slate-700 font-medium">{status.insight}</p>
              </div>

              {/* What's Diagnosed */}
              <div className="mb-4 pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2">What we're assessing:</p>
                <ul className="grid grid-cols-2 gap-2">
                  {area.whatsDiagnosed.map((item, idx) => (
                    <li key={idx} className="text-sm text-slate-600">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendation */}
              {status.recommendation && (
                <div className="p-3 bg-white bg-opacity-50 rounded border border-slate-200 mt-4">
                  <p className="text-sm font-medium text-slate-900 mb-2">Recommended action:</p>
                  <p className="text-sm text-slate-700">{status.recommendation}</p>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Next Steps */}
      <Card className="p-6 bg-blue-50 border border-blue-200">
        <h3 className="font-semibold text-slate-900 mb-3">Where to focus first</h3>
        {redCount > 0 && (
          <div className="mb-4">
            <p className="text-sm text-slate-700 mb-2">
              You have <span className="font-semibold">{redCount} RED areas</span> requiring immediate action.
            </p>
            <Link href="/campaigns/new" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Create a campaign to address priorities →
            </Link>
          </div>
        )}
        {amberCount > 0 && (
          <div>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{amberCount} AMBER areas</span> can be improved to accelerate growth.
            </p>
          </div>
        )}
        {greenCount > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{greenCount} GREEN areas</span> are performing well—maintain these while fixing reds and ambers.
            </p>
          </div>
        )}
      </Card>

      {/* Last Assessed */}
      {diagnostic.lastAssessed && (
        <p className="text-xs text-slate-500 text-center">
          Last assessed {new Date(diagnostic.lastAssessed).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
