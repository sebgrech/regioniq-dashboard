"use client"

import React, { useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { Sparkles, MessageSquare, Send, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Scenario } from "@/lib/metrics.config"

export type CompareScopeUniverse = "selected" | "itl1_lad" | "parent_auto"

export type CompareScope = {
  universe: CompareScopeUniverse
  /** Optional parent comparator, e.g. UKI (London) or UKJ (South East). */
  parentComparator?: string
}

export type CompareSuggestedAction =
  | { type: "addRegions"; regionCodes: string[]; reason: string }
  | { type: "removeRegions"; regionCodes: string[]; reason: string }
  | { type: "replaceRegions"; regionCodes: string[]; reason: string }

type ChatMessage = { role: "user" | "assistant"; content: string }

export function CompareCopilot(props: {
  metricId: string
  metricTitle: string
  scenario: Scenario
  year: number
  selectedRegions: { code: string; name: string; level?: string }[]
  maxRegions: number
  onApplyAction: (action: CompareSuggestedAction) => void
}) {
  const { metricId, metricTitle, scenario, year, selectedRegions, maxRegions, onApplyAction } = props

  const [scope, setScope] = useState<CompareScope>({ universe: "selected" })
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me to optimize the selection (e.g. **replace with top 5**, **add underperformers**, **who outperforms London?**) and I’ll propose actions you can apply to the chart.",
    },
  ])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastActions, setLastActions] = useState<CompareSuggestedAction[]>([])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<CompareSuggestedAction | null>(null)

  const selectionSummary = useMemo(() => {
    const names = selectedRegions.map((r) => r.name).slice(0, 12)
    const more = selectedRegions.length > 12 ? ` +${selectedRegions.length - 12} more` : ""
    return `Metric: ${metricTitle} (${metricId}) • Year: ${year} • Scenario: ${scenario}\nRegions shown (${selectedRegions.length}/${maxRegions}): ${names.join(", ")}${more}`
  }, [metricId, metricTitle, scenario, selectedRegions, year, maxRegions])

  function track(event: string, payload: Record<string, any>) {
    // Placeholder analytics hook (wire to your analytics later).
    // eslint-disable-next-line no-console
    console.info(`[compare_copilot] ${event}`, payload)
  }

  async function send(userText: string) {
    const trimmed = userText.trim()
    if (!trimmed) return

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }]
    setMessages(nextMessages)
    setInput("")
    setIsGenerating(true)
    setLastActions([])

    track("question", {
      metricId,
      scenario,
      year,
      scope,
      selectionSize: selectedRegions.length,
      text: trimmed,
    })

    try {
      const res = await fetch("/api/compare-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricId,
          metricTitle,
          scenario,
          year,
          selectedRegions: selectedRegions.map((r) => r.code),
          scope,
          selectionSummary,
          messages: nextMessages,
          maxRegions,
        }),
      })

      const data = await res.json()
      const answer = (data?.answerMarkdown as string) || "No response."
      const actions = (data?.suggestedActions as CompareSuggestedAction[]) || []

      setMessages([...nextMessages, { role: "assistant", content: answer }])
      setLastActions(actions)

      track("response", {
        suggestedActionTypes: actions.map((a) => a.type),
        suggestedActionCounts: actions.map((a) => a.regionCodes?.length ?? 0),
      })
    } catch (err) {
      setMessages([...nextMessages, { role: "assistant", content: "Something went wrong. Try again." }])
    } finally {
      setIsGenerating(false)
    }
  }

  function openConfirm(action: CompareSuggestedAction) {
    setPendingAction(action)
    setConfirmOpen(true)
  }

  function confirm() {
    if (!pendingAction) return
    track("action_confirmed", {
      type: pendingAction.type,
      count: pendingAction.regionCodes.length,
      selectionSizeBefore: selectedRegions.length,
    })
    onApplyAction(pendingAction)
    setConfirmOpen(false)
    setPendingAction(null)
  }

  const scopeLabel = useMemo(() => {
    if (scope.universe === "selected") return "Selected regions"
    if (scope.universe === "itl1_lad") return `All LADs in ${scope.parentComparator ?? "ITL1"}`
    return "Auto (parent → LADs)"
  }, [scope])

  const pendingLabel = useMemo(() => {
    if (!pendingAction) return ""
    const verb =
      pendingAction.type === "addRegions"
        ? "Add"
        : pendingAction.type === "removeRegions"
        ? "Remove"
        : "Replace with"
    return `${verb} ${pendingAction.regionCodes.length} region(s)`
  }, [pendingAction])

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Compare Copilot
        </CardTitle>
        <CardDescription>Selection optimizer • {scopeLabel}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground whitespace-pre-wrap rounded-lg border bg-muted/30 p-3">
          {selectionSummary}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Scope
          </Badge>
          <Button
            variant={scope.universe === "selected" ? "default" : "outline"}
            size="sm"
            onClick={() => setScope({ universe: "selected" })}
          >
            Selected
          </Button>
          <Button
            variant={scope.universe === "itl1_lad" ? "default" : "outline"}
            size="sm"
            onClick={() => setScope({ universe: "itl1_lad", parentComparator: scope.parentComparator ?? "UKI" })}
          >
            ITL1→LAD
          </Button>
          <Button
            variant={scope.universe === "parent_auto" ? "default" : "outline"}
            size="sm"
            onClick={() => setScope({ universe: "parent_auto" })}
          >
            Auto
          </Button>

          {scope.universe === "itl1_lad" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Parent</span>
              <Button
                variant={scope.parentComparator === "UKI" ? "default" : "outline"}
                size="sm"
                onClick={() => setScope({ universe: "itl1_lad", parentComparator: "UKI" })}
              >
                London
              </Button>
              <Button
                variant={scope.parentComparator === "UKJ" ? "default" : "outline"}
                size="sm"
                onClick={() => setScope({ universe: "itl1_lad", parentComparator: "UKJ" })}
              >
                South East
              </Button>
            </div>
          )}
        </div>

        <div className="h-[420px] overflow-y-auto space-y-3 text-sm pr-1">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="border rounded-lg p-3 bg-background/50">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Question
                </div>
                <div>{m.content}</div>
              </div>
            ) : (
              <div key={i} className="border rounded-xl p-4 bg-muted/40">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  Answer
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            )
          )}
        </div>

        {lastActions.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggested actions</div>
            <div className="flex flex-col gap-2">
              {lastActions.map((a, idx) => (
                <Button key={idx} variant="secondary" className="justify-between" onClick={() => openConfirm(a)}>
                  <span className="text-left">
                    {a.type === "addRegions" && "Add"}
                    {a.type === "removeRegions" && "Remove"}
                    {a.type === "replaceRegions" && "Replace with"}{" "}
                    {a.regionCodes.length} region(s)
                    <span className="block text-xs text-muted-foreground">{a.reason}</span>
                  </span>
                  <span className="text-xs">Review</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try: "Replace with top 5 GDHI in South East"'
            onKeyDown={(e) => {
              if (e.key === "Enter") send(input)
            }}
            disabled={isGenerating}
          />
          <Button onClick={() => send(input)} disabled={isGenerating || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm change</DialogTitle>
              <DialogDescription>
                {pendingLabel}. This will update the regions shown on the chart.
              </DialogDescription>
            </DialogHeader>
            {pendingAction && (
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-2">Reason</div>
                <div className="rounded-md border bg-muted/30 p-3">{pendingAction.reason}</div>
                <div className="text-xs text-muted-foreground mt-3 mb-2">Region codes</div>
                <div className="rounded-md border bg-background p-3 font-mono text-xs max-h-40 overflow-auto">
                  {pendingAction.regionCodes.join(", ")}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirm}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}




