'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

const FILE_TYPES = [
  { value: '', label: 'File type' },
  { value: 'Master/reference data', label: 'Master/reference data' },
  { value: 'Transaction data', label: 'Transaction data' },
  { value: 'Reporting/aggregated', label: 'Reporting/aggregated' },
  { value: 'Staging/intermediate', label: 'Staging/intermediate' },
  { value: 'Other', label: 'Other' },
]

const UPDATE_FREQUENCIES = [
  { value: '', label: 'Update frequency' },
  { value: 'Real-time', label: 'Real-time' },
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Static/one-time', label: 'Static/one-time' },
]

const TARGET_TOOLS = [
  { value: '', label: 'Target AI tool' },
  { value: 'Databricks Genie', label: 'Databricks Genie' },
  { value: 'Microsoft Copilot', label: 'Microsoft Copilot' },
  { value: 'Power BI Q&A', label: 'Power BI Q&A' },
  { value: 'Tableau Pulse', label: 'Tableau Pulse' },
  { value: 'Other/General', label: 'Other/General' },
]

const DOMAINS = [
  { value: '', label: 'Business domain' },
  { value: 'Healthcare/Clinical', label: 'Healthcare/Clinical' },
  { value: 'Finance/Accounting', label: 'Finance/Accounting' },
  { value: 'Sales/CRM', label: 'Sales/CRM' },
  { value: 'HR/Workforce', label: 'HR/Workforce' },
  { value: 'Supply Chain', label: 'Supply Chain' },
  { value: 'Other', label: 'Other' },
]

const ACCEPTED = ['.csv', '.xlsx', '.xls']

export default function HomePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileType, setFileType] = useState('')
  const [updateFrequency, setUpdateFrequency] = useState('')
  const [targetTool, setTargetTool] = useState('')
  const [domain, setDomain] = useState('')
  const [purpose, setPurpose] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  function handleFile(f: File | null) {
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB')
      return
    }
    setError('')
    setFile(f)
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0] ?? null)
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null)
  }

  async function handleSubmit() {
    if (!file) {
      setError('Please select a file to assess.')
      return
    }

    const parts: string[] = []
    if (fileType) parts.push(`File type: ${fileType}`)
    if (updateFrequency) parts.push(`Update frequency: ${updateFrequency}`)
    if (targetTool) parts.push(`Target AI tool: ${targetTool}`)
    if (domain) parts.push(`Domain: ${domain}`)
    if (purpose.trim()) parts.push(`Purpose: ${purpose.trim()}`)
    const fileContext = parts.join('. ')

    setIsLoading(true)
    setError('')

    try {
      const fd = new FormData()
      fd.append('data_file', file)
      fd.append('file_context', fileContext)

      const res = await fetch('/api/prepare', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()

      localStorage.setItem('adm_prepare_result', JSON.stringify(data))
      localStorage.setItem('adm_file_context', fileContext)
      localStorage.setItem('adm_file_name', file.name)

      router.push('/results')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="text-center pt-4 pb-2">
        <h1 className="text-[28px] font-bold text-gray-900 leading-tight">AI Data Maturity</h1>
        <p className="mt-2 text-base text-gray-700 font-medium">
          Upload your dataset. Find out if it&apos;s ready for AI.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Column-by-column analysis · Overall maturity score · Ready-to-use AI context block
        </p>
        <span className="inline-block mt-3 px-3 py-1 rounded-full bg-[#185FA5] text-white text-xs font-medium">
          Free Assessment
        </span>
      </header>

      {/* Intake form card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-4">
          Dataset context{' '}
          <span className="text-gray-400 font-normal">(optional — helps the assessment)</span>
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { value: fileType, setter: setFileType, options: FILE_TYPES },
            { value: updateFrequency, setter: setUpdateFrequency, options: UPDATE_FREQUENCIES },
            { value: targetTool, setter: setTargetTool, options: TARGET_TOOLS },
            { value: domain, setter: setDomain, options: DOMAINS },
          ].map(({ value, setter, options }) => (
            <select
              key={options[0].label}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/40 focus:border-[#185FA5]"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.value === ''}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Dataset purpose (one sentence)
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Monthly claims payments by provider for cost analysis"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/40 focus:border-[#185FA5]"
          />
        </div>
      </div>

      {/* Upload card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-4">
          Upload your dataset
        </label>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-[#185FA5] bg-blue-50'
              : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-[#185FA5] hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onFileChange}
          />

          {file ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-800">{file.name}</span>
              <span className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(0)} KB · Click to change
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                Drag and drop your CSV or Excel file
              </span>
              <span className="text-xs text-gray-400">
                First 100 rows used for analysis · Max 10MB
              </span>
              <span className="mt-1 text-xs text-[#185FA5] font-medium">
                Browse files
              </span>
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-gray-400 text-center">
          Accepted: {ACCEPTED.join(', ')}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full py-3 rounded-xl bg-[#185FA5] text-white font-semibold text-base hover:bg-[#145089] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </>
        ) : (
          'Assess my data →'
        )}
      </button>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 pb-4 flex flex-col gap-1">
        <span>Free · No account needed · Results in under a minute</span>
        <span>Powered by EnhancifAI</span>
      </footer>
    </div>
  )
}
