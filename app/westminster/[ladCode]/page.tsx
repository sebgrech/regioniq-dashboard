"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { REGIONS } from "@/lib/metrics.config"
import { partyColor, type ConstituencyResult } from "@/lib/politics"
import { getPoliticalContext, type PoliticalContext } from "@/lib/political-context"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportableChartCard } from "@/components/exportable-chart-card"

export default function WestminsterPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ladCode = params.ladCode as string

  const [constituencies, setConstituencies] = useState<ConstituencyResult[] | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [politicalContext, setPoliticalContext] = useState<PoliticalContext | null>(null)

  const region = REGIONS.find((r) => r.code === ladCode)
  const regionName = region?.name || ladCode

  useEffect(() => {
    if (!ladCode) return

    setLoading(true)
    getPoliticalContext(ladCode)
      .then((context) => {
        if (context) {
          setConstituencies(context.westminsterSeats)
          setPoliticalContext(context)
          if (context.westminsterSeats.length > 0) {
            setSelectedCode(context.westminsterSeats[0].code)
          }
        } else {
          setConstituencies([])
          setPoliticalContext(null)
        }
      })
      .catch((error) => {
        console.error("Failed to load Westminster data:", error)
        setConstituencies([])
        setPoliticalContext(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [ladCode])

  const selected = constituencies?.find((c) => c.code === selectedCode) || constituencies?.[0]

  // Prepare pie chart data for selected constituency
  const pieData = selected
    ? Object.entries(selected.partyVotes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8) // Top 8 parties
        .map(([name, value]) => ({
          name,
          value,
          color: partyColor(name),
        }))
    : []

  const exportRows = useMemo(() => {
    if (!selected) return []
    return pieData.map((p) => ({
      ladCode,
      regionName,
      constituencyCode: selected.code,
      constituencyName: selected.name,
      party: p.name,
      votes: p.value,
      pct: selected.totalVotes ? Number(((p.value / selected.totalVotes) * 100).toFixed(2)) : null,
      source: "Democracy Club (GE2024)",
    }))
  }, [ladCode, pieData, regionName, selected])

  // Get return URL from search params or default to dashboard
  const returnUrl = searchParams.get("return") || `/?region=${ladCode}`

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/95 backdrop-blur sticky top-0 z-10">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 min-w-0 flex-shrink-0">
              {/* Logo - matching dashboard size and position */}
              <div className="relative h-20 w-20 flex-shrink-0">
                {/* Light mode logo */}
                <Image
                  src="/x.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                {/* Dark mode logo */}
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={returnUrl}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold">UK General Election 2024</h1>
                <p className="text-muted-foreground">
                  Westminster constituencies for {regionName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : !constituencies || constituencies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No Westminster election data available for this area.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Constituency List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Constituencies</CardTitle>
                  <CardDescription>
                    {constituencies.length} {constituencies.length === 1 ? "seat" : "seats"} overlapping {politicalContext?.type === "lad" ? "this local authority" : politicalContext?.type === "city" ? "this city" : "this region"}
                    {politicalContext && politicalContext.ladCount > 1 && (
                      <span className="block mt-1 text-xs">
                        ({politicalContext.ladCount} LAD{politicalContext.ladCount !== 1 ? "s" : ""})
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {constituencies.map((constituency) => {
                      const isSelected = constituency.code === selectedCode
                      return (
                        <button
                          key={constituency.code}
                          onClick={() => setSelectedCode(constituency.code)}
                          className={cn(
                            "w-full flex items-center justify-between rounded-lg px-4 py-3 text-sm text-left transition-colors border",
                            isSelected
                              ? "bg-primary/10 border-primary/20 shadow-sm"
                              : "hover:bg-muted/50 border-border"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{constituency.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {constituency.mpName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: partyColor(constituency.winnerShort) }}
                            />
                            <span className="text-xs font-medium">{constituency.winnerShort}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Selected Constituency Details */}
            <div className="lg:col-span-2">
              {selected ? (
                <div className="space-y-6">
                  {/* Key Facts Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{selected.name}</CardTitle>
                      <CardDescription>Constituency details</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">MP</div>
                          <div className="font-semibold">{selected.mpName}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Winning Party</div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: partyColor(selected.winnerShort) }}
                            />
                            <span className="font-semibold">{selected.winnerShort}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Majority</div>
                          <div className="font-semibold">
                            {selected.majority.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ({selected.majorityPct.toFixed(1)}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Turnout</div>
                          <div className="font-semibold">{selected.turnoutPct.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">
                            {selected.totalVotes.toLocaleString()} votes
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Vote Share Chart */}
                  <ExportableChartCard
                    rows={exportRows}
                    filenameBase={`regioniq_westminster_${ladCode}_${selected.code}_vote-share`}
                  >
                  <Card>
                    <CardHeader>
                      <CardTitle>Vote Share</CardTitle>
                      <CardDescription>Party vote breakdown for {selected.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={120}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [
                                `${value.toLocaleString()} votes`,
                                "Votes",
                              ]}
                            />
                            <Legend
                              formatter={(value) => {
                                const data = pieData.find((d) => d.name === value)
                                if (!data) return value
                                const percent = ((data.value / selected.totalVotes) * 100).toFixed(1)
                                return `${value} (${percent}%)`
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  </ExportableChartCard>

                  {/* Party Votes Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>All Parties</CardTitle>
                      <CardDescription>Complete vote breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(selected.partyVotes)
                          .sort(([, a], [, b]) => b - a)
                          .map(([party, votes]) => {
                            const percentage = ((votes / selected.totalVotes) * 100).toFixed(1)
                            return (
                              <div
                                key={party}
                                className="flex items-center justify-between p-3 rounded-lg border border-border"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: partyColor(party) }}
                                  />
                                  <span className="font-medium">{party}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold">{votes.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">{percentage}%</div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Select a constituency to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border/40">
          <p className="text-xs text-muted-foreground text-center">
            Source: Democracy Club, 2024 general election
          </p>
        </div>
      </div>
    </div>
  )
}

