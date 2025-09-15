import React, { Suspense, use } from "react"
import { Loader2 } from "lucide-react"
import MetricDetailContent from "./metric-detail-content"

// ✅ Server Component
export default function MetricDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params) // unwrap params once, on the server

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading metric details...</span>
          </div>
        </div>
      }
    >
      {/* ✅ Pass plain id down to client component */}
      <MetricDetailContent id={id} />
    </Suspense>
  )
}
