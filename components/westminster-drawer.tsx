"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ExportableChartCard } from "@/components/exportable-chart-card"
import { cn } from "@/lib/utils"
import { ConstituencyResult, partyColor } from "@/lib/politics"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface WestminsterDrawerProps {
  ladCode: string
  ladName: string
  constituencies: ConstituencyResult[]
  isOpen: boolean
  onClose: () => void
}

export function WestminsterDrawer({
  ladCode,
  ladName,
  constituencies,
  isOpen,
  onClose,
}: WestminsterDrawerProps) {
  const [selectedCode, setSelectedCode] = useState<string | null>(
    constituencies.length > 0 ? constituencies[0].code : null
  )

  const selected = constituencies.find((c) => c.code === selectedCode) || (constituencies.length > 0 ? constituencies[0] : null)

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
      ladName,
      constituencyCode: selected.code,
      constituencyName: selected.name,
      party: p.name,
      votes: p.value,
      pct: selected.totalVotes ? Number(((p.value / selected.totalVotes) * 100).toFixed(2)) : null,
      source: "Democracy Club (GE2024)",
    }))
  }, [ladCode, ladName, pieData, selected])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>UK General Election 2024 — {ladName}</DialogTitle>
          <DialogDescription>
            Westminster constituencies intersecting this local authority
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden min-h-0">
          {/* Left: Constituency List */}
          <div className="flex flex-col overflow-hidden">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Constituencies ({constituencies.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {constituencies.map((constituency) => {
                const isSelected = constituency.code === selectedCode
                return (
                  <button
                    key={constituency.code}
                    onClick={() => setSelectedCode(constituency.code)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{constituency.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {constituency.mpName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: partyColor(constituency.winnerShort) }}
                      />
                      <span className="text-xs font-medium">{constituency.winnerShort}</span>
                      <span className="text-xs text-muted-foreground">
                        {constituency.majority.toLocaleString()} maj
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Selected Constituency Details */}
          <div className="flex flex-col overflow-hidden">
            {selected && constituencies.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  {selected.name}
                </h3>

                {/* Key Facts */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">MP</div>
                      <div className="font-medium">{selected.mpName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Winning Party</div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: partyColor(selected.winnerShort) }}
                        />
                        <span className="font-medium">{selected.winnerShort}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Majority</div>
                      <div className="font-medium">
                        {selected.majority.toLocaleString()} ({selected.majorityPct.toFixed(1)}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Turnout</div>
                      <div className="font-medium">{selected.turnoutPct.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                {/* Pie Chart */}
                <ExportableChartCard
                  rows={exportRows}
                  filenameBase={`regioniq_westminster_${ladCode}_${selected.code}_vote-share`}
                >
                <div className="flex-1 min-h-0 flex flex-col">
                  <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                    Vote Share
                  </h4>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          labelLine={false}
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
                </div>
                </ExportableChartCard>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No constituency selected
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <p className="text-xs text-muted-foreground text-center">
            Source: Democracy Club, 2024 general election
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

