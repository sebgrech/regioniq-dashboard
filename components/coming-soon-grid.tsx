"use client"

import { PieChart, Newspaper, Bell } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface ComingSoonGridProps {
  regionName?: string
}

// Greyed-out pie chart SVG for Sector Intelligence preview
function PlaceholderPieChart() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
    >
      {/* Pie slices - greyed out */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        strokeDasharray="75.4 176.0"
        strokeDashoffset="0"
        className="text-muted-foreground/20"
      />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        strokeDasharray="50.3 201.1"
        strokeDashoffset="-75.4"
        className="text-muted-foreground/30"
      />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        strokeDasharray="37.7 213.6"
        strokeDashoffset="-125.7"
        className="text-muted-foreground/15"
      />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        strokeDasharray="88.0 163.4"
        strokeDashoffset="-163.4"
        className="text-muted-foreground/25"
      />
      {/* Center hole for donut effect */}
      <circle cx="50" cy="50" r="25" className="fill-background" />
    </svg>
  )
}

export function ComingSoonGrid({ regionName = "this region" }: ComingSoonGridProps) {
  const { toast } = useToast()
  const [notifiedSector, setNotifiedSector] = useState(false)
  const [notifiedHeadlines, setNotifiedHeadlines] = useState(false)

  const handleNotify = (feature: "sector" | "headlines") => {
    if (feature === "sector") {
      setNotifiedSector(true)
    } else {
      setNotifiedHeadlines(true)
    }
    toast({
      title: "You'll be notified",
      description: `We'll let you know when ${feature === "sector" ? "Sector Intelligence" : "Regional Headlines"} is available.`,
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Sector Intelligence */}
      <Card className="relative overflow-hidden border border-border/40 bg-muted/5">
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Coming Soon
          </span>
        </div>
        <CardContent className="pt-5 pb-4 opacity-80">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <PieChart className="h-4 w-4 text-muted-foreground" />
            </div>
              <h3 className="text-base font-medium text-muted-foreground">Sector Intelligence</h3>
              </div>
              <p className="text-xs text-muted-foreground/80">
                Industry breakdown for {regionName}
              </p>
              <div className="pt-2">
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              onClick={() => handleNotify("sector")}
              disabled={notifiedSector}
            >
              <Bell className="h-3 w-3" />
              {notifiedSector ? "You'll be notified" : "Notify me →"}
            </button>
              </div>
            </div>
            {/* Greyed-out pie chart */}
            <div className="w-20 h-20 flex-shrink-0">
              <PlaceholderPieChart />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regional Headlines */}
      <Card className="relative overflow-hidden border border-border/40 bg-muted/5">
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Coming Soon
          </span>
        </div>
        <CardContent className="pt-5 pb-4 opacity-80">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
            </div>
              <h3 className="text-base font-medium text-muted-foreground">Regional Headlines</h3>
              </div>
              <p className="text-xs text-muted-foreground/80">
                Investment signals for {regionName}
              </p>
              <div className="pt-2">
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              onClick={() => handleNotify("headlines")}
              disabled={notifiedHeadlines}
            >
              <Bell className="h-3 w-3" />
              {notifiedHeadlines ? "You'll be notified" : "Notify me →"}
            </button>
              </div>
            </div>
            {/* Placeholder for visual balance */}
            <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-muted/30 flex items-center justify-center">
              <Newspaper className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

