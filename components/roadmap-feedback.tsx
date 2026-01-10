"use client"

import { useState } from "react"
import Image from "next/image"
import { Send, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

const FEATURE_OPTIONS = [
  { id: "sector", label: "Sector breakdown (GVA/Employment by industry)" },
  { id: "demographics", label: "Demographics (age bands, household types)" },
  { id: "retail", label: "Retail & consumer spending" },
  { id: "property", label: "Commercial property data (rents, yields)" },
  { id: "competition", label: "Competition & store density" },
  { id: "housing", label: "Housing market data" },
] as const

type FeatureId = typeof FEATURE_OPTIONS[number]["id"]

interface RoadmapFeedbackProps {
  currentRegion?: string
}

export function RoadmapFeedback({ currentRegion }: RoadmapFeedbackProps) {
  const { toast } = useToast()
  const [selectedFeatures, setSelectedFeatures] = useState<Set<FeatureId>>(new Set())
  const [otherMetrics, setOtherMetrics] = useState("")
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleFeatureToggle = (featureId: FeatureId) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev)
      if (next.has(featureId)) {
        next.delete(featureId)
      } else {
        next.add(featureId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedFeatures.size === 0 && !otherMetrics.trim()) {
      toast({
        title: "Please select at least one option",
        description: "Or tell us what metrics you'd find useful.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features: Array.from(selectedFeatures),
          otherMetrics: otherMetrics.trim() || null,
          email: email.trim() || null,
          currentRegion: currentRegion ?? null,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || "Failed to submit feedback")
      }

      setIsSubmitted(true)
      toast({
        title: "Thanks for your feedback!",
        description: "Your input helps us prioritize what to build next.",
      })
    } catch (e: any) {
      toast({
        title: "Couldn't submit feedback",
        description: e?.message ?? "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
            Thank you for your feedback!
          </h3>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            Your input helps us build what matters most.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 flex-shrink-0">
            <Image
              src="/x.png"
              alt="RegionIQ"
              fill
              className="object-contain dark:hidden"
            />
            <Image
              src="/Frame 11.png"
              alt="RegionIQ"
              fill
              className="object-contain hidden dark:block"
            />
          </div>
          <div>
            <CardTitle className="text-lg">Help Shape RegionIQ</CardTitle>
            <p className="text-sm text-muted-foreground">
              What would make this more useful for your work?
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Feature checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURE_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${
                  selectedFeatures.has(option.id)
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:border-border hover:bg-accent/5"
                }
              `}
            >
              <Checkbox
                checked={selectedFeatures.has(option.id)}
                onCheckedChange={() => handleFeatureToggle(option.id)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>

        {/* Other metrics */}
        <div className="space-y-2">
          <Label htmlFor="other-metrics" className="text-sm text-muted-foreground">
            Other metrics you'd find useful:
          </Label>
          <Textarea
            id="other-metrics"
            placeholder="e.g., footfall data, EV charging points, broadband speeds..."
            value={otherMetrics}
            onChange={(e) => setOtherMetrics(e.target.value)}
            className="resize-none h-20"
          />
        </div>

        {/* Email + Submit */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="Email (optional, for updates)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 px-6"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                Submit
                <Send className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

