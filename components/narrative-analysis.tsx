"use client"

import React, { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Sparkles, Clock, MessageSquare, ArrowLeft, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react"
import { REGIONS, type Scenario } from "@/lib/metrics.config"
import { CompanyLogo } from "@/components/company-logo"

interface NarrativeAnalysisProps {
  region: string
  year: number
  scenario: Scenario
  allMetricsData: {
    metricId: string
    value: number
  }[]
  allMetricsSeriesData?: {
    metricId: string
    data: Array<{ year: number; value: number; type: "historical" | "forecast" }>
  }[]
  isLoading?: boolean
}

type ChatMessage = { role: "user" | "assistant"; content: string }

/** Helper to extract text content from React children */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children
  }
  if (typeof children === 'number') {
    return String(children)
  }
  if (typeof children === 'boolean' || children === null || children === undefined) {
    return ''
  }
  if (Array.isArray(children)) {
    return children.map(extractText).join('')
  }
  if (children && typeof children === 'object') {
    // Handle React elements
    if ('props' in children && children.props) {
      return extractText((children.props as { children?: React.ReactNode }).children)
    }
    // Handle other object types
    if ('toString' in children) {
      return children.toString()
    }
  }
  return ''
}

/** Helper to extract and highlight key metrics from text */
function highlightNumbers(text: string | React.ReactNode): React.ReactNode {
  // Extract text if it's a React node
  const textContent = typeof text === 'string' ? text : extractText(text)
  
  if (!textContent) return text
  
  // Match: £ amounts, percentages, large numbers
  const numberPattern = /(£[\d,]+(?:K|M|B)?|\d+\.\d+%|\d+%)/g
  
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match
  let key = 0
  
  while ((match = numberPattern.exec(textContent)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{textContent.substring(lastIndex, match.index)}</span>)
    }
    // Add highlighted number
    parts.push(
      <span
        key={key++}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/15 text-primary font-bold text-sm border border-primary/20 shadow-sm"
      >
        {match[0]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < textContent.length) {
    parts.push(<span key={key++}>{textContent.substring(lastIndex)}</span>)
  }
  
  return parts.length > 0 ? <>{parts}</> : text
}

export function NarrativeAnalysis({
  region,
  year,
  scenario,
  allMetricsData,
  allMetricsSeriesData,
  isLoading = false,
}: NarrativeAnalysisProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [narrative, setNarrative] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)
  const [usingPlaceholder, setUsingPlaceholder] = useState(false)
  const [chatMode, setChatMode] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  // Track whether the user has actively interacted (AI refresh or chat send)
  const hasUserContent = useRef(false)

  const regionData = REGIONS.find((r) => r.code === region)

  const generateFallbackNarrative = () => {
    if (!regionData || !allMetricsData.length) return "No data available for analysis."

    // Generate a more insight-oriented fallback
    const scenarioText =
      scenario === "upside"
        ? "Under the upside scenario, monitor for accelerated productivity gains that could compound over the forecast horizon."
        : scenario === "downside"
        ? "Under the downside scenario, consider sector concentration risks and exposure to cyclical volatility."
        : "No material divergences detected at this time. Click **Refresh** for AI-powered insights."

    return scenarioText
  }

  // Only reset narrative on actual region/year/scenario changes — NOT on array ref changes.
  // Skip reset entirely when user is mid-conversation or has generated content.
  useEffect(() => {
    if (isLoading || allMetricsData.length === 0) return
    // If the user is in chat mode or has already generated AI content, don't blow away their state
    if (chatMode || hasUserContent.current) return
    const initialNarrative = generateFallbackNarrative()
    setNarrative(initialNarrative)
    setMessages([{ role: "assistant", content: initialNarrative }])
    setLastGenerated(new Date())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, year, scenario, isLoading])

  // Reset user content flag when region/year/scenario changes (so next effect can set initial state)
  useEffect(() => {
    hasUserContent.current = false
  }, [region, year, scenario])

  // Auto-scroll chat to bottom when new messages arrive or generating indicator shows
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages, isGenerating])

  const handleRefresh = async () => {
    setIsGenerating(true)
    setUsingPlaceholder(false)
    hasUserContent.current = true

    try {
      const response = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          regionName: regionData?.name || region,
          year,
          scenario,
          currentValues: {
            population_total: allMetricsData.find((d) => d.metricId === "population_total")?.value,
            nominal_gva_mn_gbp: allMetricsData.find((d) => d.metricId === "nominal_gva_mn_gbp")?.value,
            gdhi_per_head_gbp: allMetricsData.find((d) => d.metricId === "gdhi_per_head_gbp")?.value,
            emp_total_jobs: allMetricsData.find((d) => d.metricId === "emp_total_jobs")?.value,
          },
          allMetricsSeriesData: allMetricsSeriesData || [],
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
    const newMessages: ChatMessage[] = [...messages, { role: "user" as const, content: input }]
    setMessages(newMessages)
    setInput("")
    setIsGenerating(true)
    hasUserContent.current = true

    try {
      const response = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          regionName: regionData?.name || region,
          year,
          scenario,
          currentValues: {
            population_total: allMetricsData.find((d) => d.metricId === "population_total")?.value,
            nominal_gva_mn_gbp: allMetricsData.find((d) => d.metricId === "nominal_gva_mn_gbp")?.value,
            gdhi_per_head_gbp: allMetricsData.find((d) => d.metricId === "gdhi_per_head_gbp")?.value,
            emp_total_jobs: allMetricsData.find((d) => d.metricId === "emp_total_jobs")?.value,
          },
          allMetricsSeriesData: allMetricsSeriesData || [],
          messages: newMessages,
          isChatMode: true,
        }),
      })

      const data = await response.json()
      setMessages([
        ...newMessages,
        { role: "assistant" as const, content: data.error || data.fallback ? generateFallbackNarrative() : data.narrative },
      ])
      setUsingPlaceholder(!!data.fallback)
      setLastGenerated(new Date(data.timestamp || new Date()))
    } catch (error) {
      console.error("Narrative fetch error:", error)
      setMessages([...newMessages, { role: "assistant" as const, content: generateFallbackNarrative() }])
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
    <Card className="border-l-4 border-l-primary/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Insight
          <CompanyLogo
            domain="openai.com"
            size={18}
            showFallback={true}
            className="ml-1 rounded-sm opacity-60"
            alt="Powered by OpenAI"
            fallback={
              <span className="ml-1 text-[10px] font-medium text-muted-foreground/60 border border-border/40 rounded px-1.5 py-0.5">
                OpenAI
              </span>
            }
          />
        </CardTitle>
        <CardDescription>
          What matters in {regionData?.name} • {year}
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
            <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert bg-gradient-to-br from-muted/30 via-muted/20 to-transparent rounded-xl p-5 border border-border/50 shadow-sm">
              <ReactMarkdown
                components={{
                  p: ({ children }) => {
                    // ReactMarkdown passes children as an array of React nodes
                    // We need to extract the text and then highlight numbers
                    let textContent = ''
                    if (Array.isArray(children)) {
                      textContent = children
                        .map((child) => {
                          if (typeof child === 'string') return child
                          if (typeof child === 'number') return String(child)
                          if (child && typeof child === 'object' && 'props' in child) {
                            // Handle nested elements like <strong>
                            return extractText(child.props.children)
                          }
                          return ''
                        })
                        .join('')
                    } else {
                      textContent = extractText(children)
                    }
                    
                    if (!textContent) {
                      // Fallback: render children as-is if we can't extract text
                      return (
                        <p className="mb-4 last:mb-0 leading-relaxed text-foreground">
                          {children}
                        </p>
                      )
                    }
                    
                    const highlighted = highlightNumbers(textContent)
                    return (
                      <p className="mb-4 last:mb-0 leading-relaxed text-foreground">
                        {highlighted}
                      </p>
                    )
                  },
                  strong: ({ children }) => (
                    <strong className="font-bold text-foreground bg-accent/30 px-1 rounded">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                  ul: ({ children }) => (
                    <ul className="list-none mb-3 space-y-2 ml-0">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-3 space-y-2 ml-2">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2 before:content-['▸'] before:text-primary before:font-bold before:mt-0.5">
                      <span className="flex-1">{children}</span>
                    </li>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-bold mt-4 mb-3 first:mt-0 flex items-center gap-2 pb-2 border-b border-border/50">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-sm font-semibold mt-3 mb-2 first:mt-0 text-primary">
                      {children}
                    </h4>
                  ),
                }}
              >
                {narrative}
              </ReactMarkdown>
            </div>
            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                  Ask
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Chat mode
          <div className="flex flex-col h-[400px]">
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-4 text-sm pr-1">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="font-medium text-foreground bg-background/50 border border-border/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question</div>
                    </div>
                    <div className="text-sm">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="bg-gradient-to-br from-muted/60 via-muted/40 to-muted/30 border rounded-xl p-5 text-foreground shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analysis</div>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => {
                            // ReactMarkdown passes children as an array of React nodes
                            // We need to extract the text and then highlight numbers
                            let textContent = ''
                            if (Array.isArray(children)) {
                              textContent = children
                                .map((child) => {
                                  if (typeof child === 'string') return child
                                  if (typeof child === 'number') return String(child)
                                  if (child && typeof child === 'object' && 'props' in child) {
                                    // Handle nested elements like <strong>
                                    return extractText(child.props.children)
                                  }
                                  return ''
                                })
                                .join('')
                            } else {
                              textContent = extractText(children)
                            }
                            
                            if (!textContent) {
                              // Fallback: render children as-is if we can't extract text
                              return (
                                <p className="mb-4 last:mb-0 leading-relaxed text-foreground">
                                  {children}
                                </p>
                              )
                            }
                            
                            const highlighted = highlightNumbers(textContent)
                            return (
                              <p className="mb-4 last:mb-0 leading-relaxed text-foreground">
                                {highlighted}
                              </p>
                            )
                          },
                          strong: ({ children }) => (
                            <strong className="font-bold text-foreground bg-accent/30 px-1 rounded">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                          ul: ({ children }) => (
                            <ul className="list-none mb-3 space-y-2 ml-0">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal list-inside mb-3 space-y-2 ml-2">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="flex items-start gap-2 before:content-['▸'] before:text-primary before:font-bold before:mt-0.5">
                              <span className="flex-1">{children}</span>
                            </li>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-base font-bold mt-4 mb-3 first:mt-0 flex items-center gap-2 pb-2 border-b border-border/50">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              {children}
                            </h3>
                          ),
                          h4: ({ children }) => (
                            <h4 className="text-sm font-semibold mt-3 mb-2 first:mt-0 text-primary">
                              {children}
                            </h4>
                          ),
                          code: ({ children }) => (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono border border-border">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )
              )}
              {isGenerating && (
                <div className="bg-muted/50 border rounded-lg p-4 text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm">Generating analysis...</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask about this region..."
                className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
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
