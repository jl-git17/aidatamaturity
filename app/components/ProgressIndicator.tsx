'use client'

const STAGES = [
  "Preparing your dataset...",
  "Running quality analysis...",
  "Running risk assessment...",
  "Generating maturity report...",
]

interface Props {
  currentStage: number
}

export default function ProgressIndicator({ currentStage }: Props) {
  return (
    <div className="flex flex-col gap-3 py-6">
      {STAGES.map((label, i) => {
        const isDone = i < currentStage
        const isActive = i === currentStage
        return (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                isDone
                  ? "bg-green-500 text-white"
                  : isActive
                  ? "bg-[#185FA5] text-white"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {isDone ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="w-2 h-2 rounded-full bg-current" />
              )}
            </div>
            <span
              className={`text-sm ${
                isDone
                  ? "text-green-600 line-through"
                  : isActive
                  ? "text-[#185FA5] font-medium"
                  : "text-gray-400"
              }`}
            >
              {label}
            </span>
            {isActive && (
              <svg
                className="w-4 h-4 text-[#185FA5] animate-spin ml-1"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
          </div>
        )
      })}
    </div>
  )
}
