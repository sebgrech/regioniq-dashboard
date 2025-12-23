"use client"

import { partyColor } from "@/lib/politics"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Vote } from "lucide-react"

interface WestminsterHeadlineProps {
  seats: Array<{
    party: string
    count: number
    color: string
  }>
  turnout: number // average turnout across seats
  majority?: number // not used in V1 - blurs constituency lines
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

export function WestminsterHeadline({
  seats,
  turnout,
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
  const hasAllSeats = leadingPartySeats === totalSeats
  
  // Check if there's a tie for first place
  const isTied = partiesWithSeats.length > 1 && partiesWithSeats[0].count === partiesWithSeats[1].count
  
  // Cleaner headline - focus on the outcome
  let headlineText: string
  if (totalSeats === 0) {
    headlineText = "No constituencies overlap"
  } else if (isTied) {
    headlineText = "Split representation"
  } else if (hasAllSeats) {
    headlineText = `${leadingParty} holds all ${totalSeats} seat${totalSeats !== 1 ? "s" : ""}`
  } else if (hasMajority) {
    headlineText = `${leadingParty} holds ${leadingPartySeats} of ${totalSeats} seats`
  } else {
    headlineText = `${leadingParty} leads with ${leadingPartySeats} of ${totalSeats} seats`
  }

  // Get region type label for overlap text
  const getRegionTypeLabel = () => {
    switch (regionType) {
      case "lad":
        return "this LAD"
      case "city":
        return "this city region"
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
    <div className="space-y-2">
      {/* Election Year Header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide -mt-1">
        <Vote className="h-4 w-4" />
        {electionYear} General Election
      </div>

      {/* Constituency overlap text */}
      <p className="text-sm text-foreground">
        {totalSeats} {totalSeats === 1 ? "constituency overlaps" : "constituencies overlap"} with {getRegionTypeLabel()}
      </p>

      {/* Party Seat Pills */}
      {partiesWithSeats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {partiesWithSeats.map(({ party, count, color }) => (
            <div
              key={party}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
                "bg-background/50 backdrop-blur-sm"
              )}
              style={{
                borderColor: color,
                color: color,
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {party} {count}
            </div>
          ))}
        </div>
      )}

      {/* Main Headline */}
      {totalSeats > 0 && (
        <h3 className="text-lg font-semibold text-foreground">
          {headlineText}
        </h3>
      )}

      {/* Turnout - simple inline stat */}
      {totalSeats > 0 && (
        <div className="text-sm text-muted-foreground">
          Average turnout {turnout.toFixed(1)}%
        </div>
      )}

      {/* View Breakdown CTA */}
      {viewResultsUrl && totalSeats > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="border-2"
          asChild
        >
          <Link href={viewResultsUrl}>View breakdown →</Link>
        </Button>
      )}
    </div>
  )
}

