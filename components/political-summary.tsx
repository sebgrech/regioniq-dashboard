"use client"

import { getElectionSummary, type ElectionSummary } from "@/lib/elections"
import { cn } from "@/lib/utils"

// Get marginality label and color
function getMarginalityLabel(marginality: number): {
  label: string
  color: string
} {
  const percentage = (marginality * 100).toFixed(1)
  
  if (marginality < 0.05) {
    return {
      label: `${percentage} points (Ultra Marginal)`,
      color: "text-red-600 dark:text-red-400",
    }
  } else if (marginality < 0.10) {
    return {
      label: `${percentage} points (Marginal)`,
      color: "text-amber-600 dark:text-amber-400",
    }
  } else {
    return {
      label: `${percentage} points (Safe)`,
      color: "text-green-600 dark:text-green-400",
    }
  }
}

interface PoliticalSummaryProps {
  ladCode: string
  year: number
  className?: string
}

// Party colors
const partyColors: Record<string, string> = {
  Labour: "#d50000",
  Conservative: "#0047ab",
  "Liberal Democrats": "#ffcc00",
  Green: "#009e3b",
  "Reform UK": "#00bcd4", // Cyan
  Independent: "#888888",
  Other: "#aaaaaa",
}

// Party display names
const partyDisplayNames: Record<string, string> = {
  Labour: "Labour",
  Conservative: "Conservative",
  "Liberal Democrats": "Lib Dem",
  Green: "Green",
  "Reform UK": "Reform UK",
  Independent: "Independent",
  Other: "Other",
}

// Get control badge color and label
function getControlBadge(dominantParty: string, seats: Record<string, number>): {
  label: string
  color: string
  bgColor: string
} {
  const totalSeats = Object.values(seats).reduce((sum, s) => sum + s, 0)
  const dominantSeats = seats[dominantParty] || 0
  const hasMajority = totalSeats > 0 && dominantSeats / totalSeats > 0.5
  
  if (!hasMajority) {
    return {
      label: "No Overall Control",
      color: "#888888",
      bgColor: "bg-neutral-200 dark:bg-neutral-800",
    }
  }
  
  const color = partyColors[dominantParty] || "#888888"
  
  return {
    label: `${dominantParty}-Controlled`,
    color,
    bgColor: "", // Will use inline style instead
  }
}

// Render vote share bar
function VoteShareBar({ party, votes, totalVotes }: { party: string; votes: number; totalVotes: number }) {
  const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0
  const color = partyColors[party] || "#888888"
  const displayName = partyDisplayNames[party] || party
  
  // Truncate long party names
  const shortName = displayName.length > 12 ? displayName.substring(0, 10) + ".." : displayName
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{shortName}</span>
        <span className="text-foreground font-semibold">{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

export function PoliticalSummary({ ladCode, year, className }: PoliticalSummaryProps) {
  const summary = getElectionSummary(ladCode, year)
  
  if (!summary) {
    return null
  }
  
  const { dominant_party, turnout, marginality, votes, seats } = summary
  const controlBadge = getControlBadge(dominant_party, seats)
  const marginalityInfo = getMarginalityLabel(marginality)
  
  // Sort parties by votes (descending)
  const sortedParties = Object.entries(votes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) // Top 5 parties
  
  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0)
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Local Political Control
        </div>
        
        {/* Control Badge */}
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border"
          )}
          style={{
            borderColor: controlBadge.color,
            color: controlBadge.color,
            backgroundColor: controlBadge.color + "15", // 15 = ~8% opacity in hex
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: controlBadge.color }}
          />
          {controlBadge.label}
        </div>
      </div>
      
      {/* Vote Share Bars */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Vote Share
        </div>
        <div className="space-y-2">
          {sortedParties.map(([party, voteCount]) => (
            <VoteShareBar
              key={party}
              party={party}
              votes={voteCount}
              totalVotes={totalVotes}
            />
          ))}
        </div>
      </div>
      
      {/* Turnout & Majority */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Turnout:</span>
          <span className="font-semibold text-foreground">{(turnout * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Majority:</span>
          <span className={cn("font-semibold", marginalityInfo.color)}>
            {marginalityInfo.label}
          </span>
        </div>
      </div>
    </div>
  )
}


