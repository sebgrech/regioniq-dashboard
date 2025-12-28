"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react"

interface LogsViewerProps {
  runId: string
}

export function LogsViewer({ runId }: LogsViewerProps) {
  const [logs, setLogs] = useState<Record<string, string> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [isOpen, setIsOpen] = useState(false)

  const fetchLogs = async () => {
    if (logs) {
      // Already loaded, just toggle visibility
      setIsOpen(!isOpen)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/pipeline-runs/${runId}/logs`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch logs")
      }

      setLogs(data.logs)
      setIsOpen(true)

      // Auto-expand first file
      const files = Object.keys(data.logs)
      if (files.length > 0) {
        setExpanded({ [files[0]]: true })
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch logs")
    } finally {
      setLoading(false)
    }
  }

  const toggleFile = (filename: string) => {
    setExpanded((prev) => ({ ...prev, [filename]: !prev[filename] }))
  }

  const fileCount = logs ? Object.keys(logs).length : 0

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header - clickable to load/toggle */}
      <button
        onClick={fetchLogs}
        disabled={loading}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">
            Log Files
            {logs && (
              <span className="text-muted-foreground ml-1">
                ({fileCount} file{fileCount !== 1 ? "s" : ""})
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {logs ? (isOpen ? "Hide" : "Show") : "Click to load"}
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Error state */}
      {error && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      {/* Logs content */}
      {isOpen && logs && (
        <div className="border-t border-border">
          {Object.keys(logs).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No log files found in bundle
            </div>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(logs).map(([filename, content]) => (
                <div key={filename}>
                  {/* File header */}
                  <button
                    onClick={() => toggleFile(filename)}
                    className="w-full px-4 py-2 flex items-center gap-2 hover:bg-muted/20 transition-colors text-left"
                  >
                    {expanded[filename] ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-mono text-xs text-foreground truncate">
                      {filename}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                      {content.split("\n").length} lines
                    </span>
                  </button>

                  {/* File content */}
                  {expanded[filename] && (
                    <div className="bg-muted/30">
                      <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
                        {content}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

