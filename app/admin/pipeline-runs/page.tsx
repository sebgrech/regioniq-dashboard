import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api/require-admin"
import { redirect } from "next/navigation"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function PipelineRunsPage() {
  const { user, response } = await requireAdmin()
  if (!user) redirect("/login")

  const supabase = createSupabaseAdminClient()

  const { data: runs, error } = await supabase
    .from("pipeline_runs")
    .select(
      "run_id, created_at, success, total_duration_seconds, mode, host, git_sha, total_warnings, total_critical"
    )
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-4">Pipeline Runs</h1>
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            Error loading runs: {error.message}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Pipeline Runs</h1>
            <span className="text-sm text-muted-foreground">
              Showing last {runs?.length ?? 0} runs
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Run ID
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Created
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Mode
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Host
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Issues
                </th>
              </tr>
            </thead>
            <tbody>
              {runs?.map((run) => (
                <tr
                  key={run.run_id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-3">
                    <Link
                      href={`/admin/pipeline-runs/${run.run_id}`}
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {run.run_id}
                    </Link>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(run.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-3">
                    {run.success ? (
                      <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground font-mono">
                    {run.total_duration_seconds?.toFixed(1)}s
                  </td>
                  <td className="p-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-muted rounded">
                      {run.mode ?? "—"}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground font-mono">
                    {run.host ?? "—"}
                  </td>
                  <td className="p-3 text-sm">
                    {(run.total_warnings > 0 || run.total_critical > 0) ? (
                      <span className="space-x-2">
                        {run.total_warnings > 0 && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            ⚠ {run.total_warnings}
                          </span>
                        )}
                        {run.total_critical > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            🔴 {run.total_critical}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!runs || runs.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No pipeline runs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

