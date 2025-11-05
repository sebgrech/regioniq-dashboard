"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Sparkles, Clock, MessageSquare, ArrowLeft } from "lucide-react"
import { REGIONS, METRICS, type Scenario } from "@/lib/metrics.config"
import { formatValue } from "@/lib/data-service"

interface NarrativeAnalysisProps {
  region: string
  year: number
  scenario: Scenario
  allMetricsData: {
    metricId: string
    value: number
  }[]
  isLoading?: boolean
}

type ChatMessage = { role: "user" | "assistant"; content: string }

export function NarrativeAnalysis({
  region,
  year,
  scenario,
  allMetricsData,
  isLoading = false,
}: NarrativeAnalysisProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [narrative, setNarrative] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)
  const [usingPlaceholder, setUsingPlaceholder] = useState(false)
  const [chatMode, setChatMode] = useState(false)

  const regionData = REGIONS.find((r) => r.code === region)

  const generateFallbackNarrative = () => {
    if (!regionData || !allMetricsData.length) return "No data available"

    const populationData = allMetricsData.find((d) => d.metricId === "population")
    const gvaData = allMetricsData.find((d) => d.metricId === "gva")
    const incomeData = allMetricsData.find((d) => d.metricId === "income")
    const employmentData = allMetricsData.find((d) => d.metricId === "employment")

    const populationMetric = METRICS.find((m) => m.id === "population")
    const gvaMetric = METRICS.find((m) => m.id === "gva")
    const incomeMetric = METRICS.find((m) => m.id === "income")
    const employmentMetric = METRICS.find((m) => m.id === "employment")

    const popValue = formatValue(populationData?.value || 0, populationMetric?.unit || "")
    const gvaValue = formatValue(gvaData?.value || 0, gvaMetric?.unit || "")
    const incomeValue = formatValue(incomeData?.value || 0, incomeMetric?.unit || "")
    const employmentValue = formatValue(employmentData?.value || 0, employmentMetric?.unit || "")

    const scenarioText =
      scenario === "upside"
        ? "optimistic growth trajectory"
        : scenario === "downside"
        ? "conservative projections"
        : "baseline forecasts"

    return `${regionData.name} in ${year}: population ${popValue}, GVA ${gvaValue}, income ${incomeValue}, employment ${employmentValue}. Outlook follows ${scenarioText}.`
  }

  useEffect(() => {
    if (!isLoading && allMetricsData.length > 0) {
      const initialNarrative = generateFallbackNarrative()
      setNarrative(initialNarrative)
      setMessages([{ role: "assistant", content: initialNarrative }])
      setLastGenerated(new Date())
    }
  }, [region, year, scenario, allMetricsData, isLoading])

  const handleRefresh = async () => {
    setIsGenerating(true)
    setUsingPlaceholder(false)

    try {
      const response = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          year,
          scenario,
          metrics: {
            population: allMetricsData.find((d) => d.metricId === "population")?.value,
            gva: allMetricsData.find((d) => d.metricId === "gva")?.value,
            income: allMetricsData.find((d) => d.metricId === "income")?.value,
            employment: allMetricsData.find((d) => d.metricId === "employment")?.value,
          },
        }),
      })

      const data = await response.json()
      const newNarrative = data.error || data.fallback ? generateFallbackNarrative() : data.narrative

      setNarrative(newNarrative)
      setMessages([{ role: "assistant", content: newNarrative }])
      setUsingPlaceholder(!!data.fallback)
      setLastGenerated(new Date(data.timestamp || new Date()))
    } catch (error) {
      console.error("Narrative fetch error:", error)
      setNarrative(generateFallbackNarrative())
      setUsingPlaceholder(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const newMessages = [...messages, { role: "user", content: input }]
    setMessages(newMessages)
    setInput("")
    setIsGenerating(true)

    try {
      const response = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          year,
          scenario,
          metrics: {
            population: allMetricsData.find((d) => d.metricId === "population")?.value,
            gva: allMetricsData.find((d) => d.metricId === "gva")?.value,
            income: allMetricsData.find((d) => d.metricId === "income")?.value,
            employment: allMetricsData.find((d) => d.metricId === "employment")?.value,
          },
          messages: newMessages,
        }),
      })

      const data = await response.json()
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.error || data.fallback ? generateFallbackNarrative() : data.narrative },
      ])
      setUsingPlaceholder(!!data.fallback)
      setLastGenerated(new Date(data.timestamp || new Date()))
    } catch (error) {
      console.error("Narrative fetch error:", error)
      setMessages([...newMessages, { role: "assistant", content: generateFallbackNarrative() }])
      setUsingPlaceholder(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds} seconds ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    return `${hours} hours ago`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Analysis
        </CardTitle>
        <CardDescription>
          Regional insights for {regionData?.name} • {year}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/5" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/5" />
          </div>
        ) : !chatMode ? (
          // Default: single narrative block
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{narrative}</p>
            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {usingPlaceholder ? "Fallback (No OpenAI key)" : "Powered by OpenAI"}
                </Badge>
                {lastGenerated && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Generated {formatTimeAgo(lastGenerated)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isGenerating}>
                  <RefreshCw className={`h-3 w-3 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={() => setChatMode(true)}>
                  <MessageSquare className="h-3 w-3 mr-2" />
                  Ask a Question
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Chat mode
          <div className="flex flex-col h-[400px]">
            <div className="flex-1 overflow-y-auto space-y-4 text-sm pr-1">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="font-medium text-gray-800">
                    Q: {m.content}
                  </div>
                ) : (
                  <div key={i} className="bg-gray-50 border rounded p-3 text-gray-900">
                    A: {m.content}
                  </div>
                )
              )}
              {isGenerating && (
                <div className="bg-gray-50 border rounded p-3 text-gray-500 flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Generating answer…
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about this region..."
                className="flex-1 border rounded px-3 py-2 text-sm"
                disabled={isGenerating}
              />
              <Button onClick={handleSend} disabled={isGenerating || !input.trim()}>
                {isGenerating ? "..." : "Send"}
              </Button>
              <Button variant="ghost" onClick={() => setChatMode(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Summary
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
