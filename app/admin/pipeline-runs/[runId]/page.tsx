import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api/require-admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { LogsViewer } from "@/components/admin/logs-viewer"

export const dynamic = "force-dynamic"

interface Stage {
  name: string
  type?: string
  status?: string
  exit_code?: number
  duration_seconds?: number
  error_message?: string
}

interface ExternalError {
  source?: string
  message?: string
  timestamp?: string
}

interface QAArtifact {
  name?: string
  path?: string
  type?: string
}

export default async function PipelineRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { user } = await requireAdmin()
  if (!user) redirect("/login")

  const { runId } = await params
  const supabase = createSupabaseAdminClient()

  const { data: run, error } = await supabase
    .from("pipeline_runs")
    .select("*")
    .eq("run_id", runId)
    .single()

  if (error || !run) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/admin/pipeline-runs"
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
          >
            ← Back to runs
          </Link>
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            Run not found: {error?.message ?? "Unknown error"}
          </div>
        </div>
      </div>
    )
  }

  const stages: Stage[] = run.stages ?? []
  const externalErrors: ExternalError[] = run.external_errors ?? []
  const qaArtifacts: QAArtifact[] = run.qa_artifacts ?? []

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/admin/pipeline-runs"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Back to runs
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground font-mono">
              {run.run_id}
            </h1>
            {run.success ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Success
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-red-500/10 text-red-600 dark:text-red-400 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                Failed
              </span>
            )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Run Metadata
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created:</span>
              <p className="font-medium">
                {new Date(run.created_at).toLocaleString("en-GB")}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Duration:</span>
              <p className="font-medium font-mono">
                {run.total_duration_seconds?.toFixed(2)}s
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Mode:</span>
              <p className="font-medium">{run.mode ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Host:</span>
              <p className="font-medium font-mono">{run.host ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Git SHA:</span>
              <p className="font-medium font-mono">
                {run.git_sha?.slice(0, 7) ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Issues:</span>
              <p className="font-medium">
                {run.total_warnings > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400 mr-2">
                    ⚠ {run.total_warnings} warnings
                  </span>
                )}
                {run.total_critical > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    🔴 {run.total_critical} critical
                  </span>
                )}
                {run.total_warnings === 0 && run.total_critical === 0 && "None"}
              </p>
            </div>
          </div>
        </div>

        {/* Stages Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground">
              Stages ({stages.length})
            </h2>
          </div>
          {stages.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Stage
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Exit
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Duration
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="p-3 text-sm font-medium">{stage.name}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {stage.type ?? "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-sm ${
                          stage.status === "success"
                            ? "text-green-600 dark:text-green-400"
                            : stage.status === "failed"
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {stage.status ?? "—"}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-mono text-muted-foreground">
                      {stage.exit_code ?? "—"}
                    </td>
                    <td className="p-3 text-sm font-mono text-muted-foreground">
                      {stage.duration_seconds?.toFixed(2)}s
                    </td>
                    <td className="p-3 text-sm text-red-600 dark:text-red-400 max-w-xs truncate">
                      {stage.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No stages recorded
            </div>
          )}
        </div>

        {/* External Errors */}
        {externalErrors.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-medium text-muted-foreground">
                External Errors ({externalErrors.length})
              </h2>
            </div>
            <div className="p-4 space-y-2">
              {externalErrors.map((err, i) => (
                <div
                  key={i}
                  className="p-3 bg-red-500/5 border border-red-500/20 rounded text-sm"
                >
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    {err.source ?? "Unknown source"}
                  </p>
                  <p className="text-muted-foreground mt-1">{err.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QA Artifacts */}
        {qaArtifacts.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-medium text-muted-foreground">
                QA Artifacts ({qaArtifacts.length})
              </h2>
            </div>
            <div className="p-4">
              <ul className="space-y-1 text-sm">
                {qaArtifacts.map((artifact, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="font-mono">{artifact.name ?? artifact.path}</span>
                    {artifact.type && (
                      <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                        {artifact.type}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Log Files Viewer */}
        <LogsViewer runId={runId} />

        {/* Download Bundle */}
        <div className="flex justify-end">
          <a
            href={`/api/admin/pipeline-runs/${runId}/download`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download Bundle
          </a>
        </div>
      </div>
    </div>
  )
}

