/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProgressIndicator from '../components/ProgressIndicator'

interface ColumnRow {
  column_name: string
  detected_type: string
  total_rows: number
  null_count: number
  null_pct: number
  unique_count: number
  min_value: string | number | null
  max_value: string | number | null
  is_likely_key: boolean
  sample_values: string
  data_quality?: string
  ambiguity?: string
  risk_areas?: string
  recommendations?: string
}

interface SynthesisResult {
  overall_maturity_score: number
  maturity_level: string
  executive_summary: string
  ai_context_block: string
  top_risks: string[]
  quick_wins: string[]
  column_count?: number
}

const PASS1_PROMPTS = [
  {
    prompt_number: '1',
    columns: '*',
    output_heading: 'data_quality',
    prompt:
      'You are a data quality analyst reviewing a single column from a dataset that will be used with an AI analytics tool. The column statistics are provided as structured fields in the row data. Assess the data quality and return a JSON object with exactly these fields: {consistency_score: 0-10, issues: one sentence describing the main quality issue or None detected, quality_score: 0-10}. Scoring: 10=perfectly consistent no nulls correct type, 7-9=minor issues mostly clean, 4-6=noticeable problems that could confuse AI, 1-3=significant issues AI will likely misinterpret, 0=unusable. Return only valid JSON no explanation no markdown.',
  },
  {
    prompt_number: '2',
    columns: '*',
    output_heading: 'ambiguity',
    prompt:
      'You are a data governance analyst reviewing a single column from a dataset that will be used with an AI analytics tool. The column name and sample values are provided in the row data. Assess how well this column is named and whether values match what the name implies. Return a JSON object with exactly these fields: {name_clarity: 0-10, values_match_name: true or false, suggested_name: a clearer column name or null if already clear, ambiguity_note: one sentence explaining the ambiguity or None detected, ambiguity_score: 0-10}. name_clarity scoring: 10=self-explanatory, 7-9=mostly clear minor ambiguity, 4-6=unclear without context AI may misinterpret, 1-3=cryptic or misleading, 0=completely meaningless like col1 or x. ambiguity_score is inverse of clarity. Return only valid JSON no explanation no markdown.',
  },
]

const PASS2_PROMPTS = [
  {
    prompt_number: '1',
    columns: '*',
    output_heading: 'risk_areas',
    prompt:
      'You are an AI system honestly assessing where you would produce unreliable results when querying a dataset containing this column. The row data contains column statistics, data type, and ambiguity notes from a prior analysis pass. Identify specific ways AI could misinterpret this column. Return a JSON object with exactly these fields: {risk_level: low or medium or high or critical, risk_factors: array of up to 3 risk strings, ai_misinterpretation: one sentence describing the most likely way AI gets this wrong, safe_to_query: true or false, risk_score: 0-10}. risk_score: 0-2=low reliable, 3-5=medium occasional errors, 6-8=high frequent wrong answers, 9-10=critical do not use without fixing. safe_to_query=false if risk_score>=7. Return only valid JSON no explanation no markdown.',
  },
  {
    prompt_number: '2',
    columns: '*',
    output_heading: 'recommendations',
    prompt:
      'You are a data governance consultant giving actionable recommendations to improve a dataset column for use with AI analytics tools. The row data contains column statistics, quality scores, ambiguity notes, risk level and AI misinterpretation from prior analysis. Return a JSON object with exactly these fields: {priority: low or medium or high or critical, actions: array of up to 3 action strings, rename_to: suggested column name or null if no rename needed, context_note: one sentence of context AI needs to interpret this column correctly written as a fragment that could be prepended to an AI prompt for example amt_paid is the net claim payment in USD after adjustments excluding reversals, effort: low or medium or high}. priority: critical=fix before any AI use, high=fix soon AI results unreliable, medium=fix when possible AI results degraded, low=AI can work with this as-is. Return only valid JSON no explanation no markdown.',
  },
]

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function pollProgress(runId: string): Promise<any[]> {
  for (let i = 0; i < 300; i++) {
    await sleep(2000)
    const fd = new FormData()
    fd.append('run_id', runId)
    const res = await fetch('/api/progress', { method: 'POST', body: fd })
    if (!res.ok) continue
    const data = await res.json()
    if (data.status === 'completed') return data.results || []
  }
  throw new Error('Analysis timed out after 10 minutes')
}

function safeParseJSON(str: string | undefined): Record<string, any> {
  if (!str) return {}
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}

const MATURITY_COLORS: Record<string, string> = {
  Initial: 'bg-red-100 text-red-700',
  Developing: 'bg-orange-100 text-orange-700',
  Defined: 'bg-yellow-100 text-yellow-800',
  Managed: 'bg-blue-100 text-blue-700',
  Optimized: 'bg-green-100 text-green-700',
}

const RISK_CLASSES: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

function ScoreBar({ score, inverse = false }: { score: number; inverse?: boolean }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100))
  const isGood = inverse ? score <= 3 : score >= 7
  const isBad = inverse ? score >= 7 : score <= 3
  const color = isGood ? '#22c55e' : isBad ? '#ef4444' : '#f59e0b'
  return (
    <div className="flex items-center gap-2 min-w-[88px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-5 text-right">{score}</span>
    </div>
  )
}

export default function ResultsPage() {
  const router = useRouter()
  const [stage, setStage] = useState(0)
  const [columnResults, setColumnResults] = useState<ColumnRow[]>([])
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function run() {
      try {
        // Step 1: Load prepare result from localStorage
        const raw = localStorage.getItem('adm_prepare_result')
        if (!raw) {
          router.replace('/')
          return
        }
        const prepareResult = JSON.parse(raw)
        const fileContext = localStorage.getItem('adm_file_context') || ''
        const storedFileName =
          localStorage.getItem('adm_file_name') || prepareResult.file_name || 'dataset'
        setFileName(storedFileName)

        // Step 2: Build Pass 1 dataframe from column stats
        const cols: any[] = prepareResult.columns || prepareResult.data || []
        const columnRows: ColumnRow[] = cols.map((col: any) => ({
          column_name: col.column_name || col.name || '',
          detected_type: col.detected_type || col.data_type || col.type || 'unknown',
          total_rows: col.total_rows ?? col.row_count ?? 0,
          null_count: col.null_count ?? col.nulls ?? 0,
          null_pct: col.null_pct ?? col.null_percent ?? 0,
          unique_count: col.unique_count ?? col.unique_values ?? 0,
          min_value: col.min_value ?? col.min ?? null,
          max_value: col.max_value ?? col.max ?? null,
          is_likely_key: col.is_likely_key ?? col.is_key ?? false,
          sample_values: JSON.stringify(col.sample_values || col.samples || []),
        }))

        // Step 3: Run Pass 1
        setStage(1)
        const p1Fd = new FormData()
        p1Fd.append('json_data', JSON.stringify({ sheet_name: 'columns', data: columnRows }))
        p1Fd.append('max_records', 'false')
        p1Fd.append('batched_processing', 'false')
        p1Fd.append('performance_optimization', 'false')
        p1Fd.append('prompts', JSON.stringify(PASS1_PROMPTS))

        const p1Res = await fetch('/api/direct', { method: 'POST', body: p1Fd })
        if (!p1Res.ok) throw new Error(`Pass 1 request failed (${p1Res.status})`)
        const p1Data = await p1Res.json()
        const pass1Results: any[] = await pollProgress(p1Data.run_id)

        // Step 4: Merge Pass 1 results into column rows
        const enrichedRows: ColumnRow[] = columnRows.map((row, idx) => {
          const r =
            pass1Results.find((x: any) => x.column_name === row.column_name) ||
            pass1Results[idx] ||
            {}
          return {
            ...row,
            data_quality: r.data_quality || '{}',
            ambiguity: r.ambiguity || '{}',
          }
        })

        // Step 5: Run Pass 2
        setStage(2)
        const p2Fd = new FormData()
        p2Fd.append('json_data', JSON.stringify({ sheet_name: 'columns', data: enrichedRows }))
        p2Fd.append('max_records', 'false')
        p2Fd.append('batched_processing', 'false')
        p2Fd.append('performance_optimization', 'false')
        p2Fd.append('prompts', JSON.stringify(PASS2_PROMPTS))

        const p2Res = await fetch('/api/direct', { method: 'POST', body: p2Fd })
        if (!p2Res.ok) throw new Error(`Pass 2 request failed (${p2Res.status})`)
        const p2Data = await p2Res.json()
        const pass2Results: any[] = await pollProgress(p2Data.run_id)

        // Merge Pass 2 results
        const finalRows: ColumnRow[] = enrichedRows.map((row, idx) => {
          const r =
            pass2Results.find((x: any) => x.column_name === row.column_name) ||
            pass2Results[idx] ||
            {}
          return {
            ...row,
            risk_areas: r.risk_areas || '{}',
            recommendations: r.recommendations || '{}',
          }
        })
        setColumnResults(finalRows)

        // Step 6: Synthesize
        setStage(3)
        const columnSummaries = finalRows.map((row) => {
          const dq = safeParseJSON(row.data_quality)
          const amb = safeParseJSON(row.ambiguity)
          const risk = safeParseJSON(row.risk_areas)
          const rec = safeParseJSON(row.recommendations)
          return {
            column_name: row.column_name,
            data_type: row.detected_type,
            quality_score: dq.quality_score ?? 0,
            ambiguity_score: amb.ambiguity_score ?? 0,
            risk_level: risk.risk_level ?? 'low',
            priority: rec.priority ?? 'low',
            context_note: rec.context_note ?? '',
          }
        })

        const synthFd = new FormData()
        synthFd.append('column_results', JSON.stringify(columnSummaries))
        synthFd.append('file_name', storedFileName)
        synthFd.append('file_context', fileContext)

        const synthRes = await fetch('/api/synthesize', { method: 'POST', body: synthFd })
        if (!synthRes.ok) throw new Error(`Synthesize request failed (${synthRes.status})`)
        const synthData = await synthRes.json()
        setSynthesis(synthData)
        setStage(4)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyToClipboard() {
    if (!synthesis?.ai_context_block) return
    await navigator.clipboard.writeText(synthesis.ai_context_block)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadReport() {
    const report = {
      generated_at: new Date().toISOString(),
      file_name: fileName,
      synthesis,
      column_results: columnResults,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().split('T')[0]
    const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_')
    a.download = `adm_report_${base}_${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 py-16 text-center">
        <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-800">Assessment failed</h2>
        <p className="text-sm text-gray-500 max-w-sm">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2 rounded-lg bg-[#185FA5] text-white text-sm font-medium hover:bg-[#145089] transition-colors"
        >
          Start over
        </button>
      </div>
    )
  }

  // Loading state
  if (stage < 4 || !synthesis) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center pt-4 pb-2">
          <h1 className="text-xl font-bold text-gray-900">Analyzing your dataset</h1>
          {fileName && <p className="text-sm text-gray-400 mt-1">{fileName}</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <ProgressIndicator currentStage={stage} />
        </div>
      </div>
    )
  }

  // Results display
  const maturityColor = MATURITY_COLORS[synthesis.maturity_level] ?? 'bg-gray-100 text-gray-700'
  const highCriticalCount = columnResults.filter((row) => {
    const risk = safeParseJSON(row.risk_areas)
    return risk.risk_level === 'high' || risk.risk_level === 'critical'
  }).length
  const columnCount = synthesis.column_count ?? columnResults.length

  return (
    <div className="flex flex-col gap-6">
      {/* Score block */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="text-7xl font-bold text-[#185FA5] leading-none tabular-nums">
          {synthesis.overall_maturity_score}
        </div>
        <div className="mt-4">
          <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${maturityColor}`}>
            {synthesis.maturity_level}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          AI Data Maturity Score · {fileName}
        </p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Columns assessed', value: columnCount },
          { label: 'High / critical risk', value: highCriticalCount },
          { label: 'Quick wins', value: (synthesis.quick_wins || []).length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center"
          >
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Executive summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Executive summary
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">{synthesis.executive_summary}</p>
      </div>

      {/* AI context block */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              AI context block
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              paste before any AI query on this dataset
            </p>
          </div>
          <button
            onClick={copyToClipboard}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to clipboard
              </>
            )}
          </button>
        </div>
        <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100 overflow-auto max-h-52">
          {synthesis.ai_context_block}
        </pre>
      </div>

      {/* Column results table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Column-by-column results
        </h2>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Column', 'Type', 'Quality', 'Ambiguity', 'Risk', 'Top issue'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 px-2 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columnResults.map((row, i) => {
                const dq = safeParseJSON(row.data_quality)
                const amb = safeParseJSON(row.ambiguity)
                const risk = safeParseJSON(row.risk_areas)
                const qualityScore: number = typeof dq.quality_score === 'number' ? dq.quality_score : 0
                const ambiguityScore: number = typeof amb.ambiguity_score === 'number' ? amb.ambiguity_score : 0
                const riskLevel: string = risk.risk_level ?? 'low'
                const issue: string = dq.issues ?? '—'
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-2 font-medium text-gray-800 max-w-[120px]">
                      <span className="block truncate" title={row.column_name}>
                        {row.column_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                      {row.detected_type}
                    </td>
                    <td className="py-2.5 px-2">
                      <ScoreBar score={qualityScore} />
                    </td>
                    <td className="py-2.5 px-2">
                      <ScoreBar score={ambiguityScore} inverse />
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_CLASSES[riskLevel] ?? RISK_CLASSES.low}`}
                      >
                        {riskLevel}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-xs text-gray-500 max-w-[180px]">
                      <span
                        className="block overflow-hidden"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}
                        title={issue}
                      >
                        {issue}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top risks + quick wins */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Top risks
          </h2>
          <ul className="flex flex-col gap-2.5">
            {(synthesis.top_risks || []).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-snug">
                <svg
                  className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Quick wins
          </h2>
          <ul className="flex flex-col gap-2.5">
            {(synthesis.quick_wins || []).map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-snug">
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Download */}
      <button
        onClick={downloadReport}
        className="w-full py-3 rounded-xl bg-[#185FA5] text-white font-semibold text-sm hover:bg-[#145089] transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Download full report
      </button>

      <footer className="text-center text-xs text-gray-400 pb-4">
        Powered by EnhancifAI
      </footer>
    </div>
  )
}
