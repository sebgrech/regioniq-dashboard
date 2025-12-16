"use client"

import { partyColor } from "@/lib/politics"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface WestminsterHeadlineProps {
  seats: Array<{
    party: string
    count: number
    color: string
  }>
  turnout: number // average turnout across seats
  majority: number // average majority in points
  leadingParty: string
  electionYear?: number
  viewResultsUrl?: string
  regionType?: "lad" | "city" | "itl1" | "itl2" | "itl3"
}

// Party color map (matching user's specification)
const PARTY_COLORS: Record<string, string> = {
  Labour: "#CC0000",
  Conservative: "#0057B8",
  "Liberal Democrats": "#FDBB30",
  "Lib Dem": "#FDBB30",
  "Reform UK": "#00AEEF",
  Green: "#228B22",
  SNP: "#FCDC04",
  "Plaid Cymru": "#008142",
  Plaid: "#008142",
}

// Get party color with fallback
function getPartyColor(party: string): string {
  return PARTY_COLORS[party] || partyColor(party)
}

// Get majority label and color
function getMajorityLabel(majority: number): {
  label: string
  color: string
} {
  if (majority > 15) {
    return {
      label: `${majority.toFixed(1)} pts (Safe)`,
      color: "text-green-600 dark:text-green-400",
    }
  } else if (majority >= 5) {
    return {
      label: `${majority.toFixed(1)} pts (Competitive)`,
      color: "text-amber-600 dark:text-amber-400",
    }
  } else {
    return {
      label: `${majority.toFixed(1)} pts (Marginal)`,
      color: "text-red-600 dark:text-red-400",
    }
  }
}

export function WestminsterHeadline({
  seats,
  turnout,
  majority,
  leadingParty,
  electionYear = 2024,
  viewResultsUrl,
  regionType = "lad",
}: WestminsterHeadlineProps) {
  // Filter to only parties with at least 1 seat
  const partiesWithSeats = seats.filter((s) => s.count > 0).sort((a, b) => b.count - a.count)

  // Determine headline text
  const totalSeats = seats.reduce((sum, s) => sum + s.count, 0)
  const leadingPartySeats = partiesWithSeats[0]?.count || 0
  const hasMajority = leadingPartySeats > totalSeats / 2
  
  // Check if there's a tie for first place
  const isTied = partiesWithSeats.length > 1 && partiesWithSeats[0].count === partiesWithSeats[1].count
  
  let headlineText: string
  if (isTied) {
    headlineText = "Mixed representation"
  } else if (hasMajority) {
    headlineText = `${leadingParty} dominates Westminster representation`
  } else {
    // Leading party doesn't have majority, show actual seat count
    headlineText = `${leadingParty} leads Westminster representation`
  }

  const majorityInfo = getMajorityLabel(majority)

  // Get region type label
  const getRegionTypeLabel = () => {
    switch (regionType) {
      case "lad":
        return "this local authority"
      case "city":
        return "this city"
      case "itl1":
        return "this ITL1 region"
      case "itl2":
        return "this ITL2 region"
      case "itl3":
        return "this ITL3 region"
      default:
        return "this area"
    }
  }

  return (
    <div className="space-y-4">
      {/* Party Control Bar */}
      <div className="flex flex-wrap gap-2">
        {partiesWithSeats.map(({ party, count, color }) => (
          <div
            key={party}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
              "bg-background/50 backdrop-blur-sm"
            )}
            style={{
              borderColor: color,
              color: color,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {party} {count}
          </div>
        ))}
      </div>

      {/* Large Headline */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">
          {headlineText} • {leadingPartySeats}/{totalSeats} seats • {electionYear} General Election
        </h3>
        <p className="text-sm text-neutral-400 dark:text-neutral-300">
          {totalSeats} Westminster {totalSeats === 1 ? "seat" : "seats"} overlap {getRegionTypeLabel()}
        </p>
      </div>

      {/* Micro-metrics Row */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="text-neutral-400 dark:text-neutral-300">
          <span className="font-medium text-foreground">Average Turnout:</span> {turnout.toFixed(1)}%
        </div>
      </div>

      {/* View Full Results Button */}
      {viewResultsUrl && (
        <div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            asChild
          >
            <Link href={viewResultsUrl}>View full Westminster results →</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

