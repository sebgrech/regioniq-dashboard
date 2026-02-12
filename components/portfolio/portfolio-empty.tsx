"use client"

import { ArrowLeft, MapPin, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface PortfolioEmptyProps {
  onAddSite: () => void
  userEmail?: string | null
}

export function PortfolioEmpty({ onAddSite, userEmail }: PortfolioEmptyProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header (matches portfolio-view-v2 pattern) ─────────── */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="https://regioniq.io" className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 flex-shrink-0">
                <Image
                  src="/x.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight">RegionIQ</span>
            </Link>

            <div className="h-6 w-px bg-border/60" />

            <span className="text-lg font-semibold text-foreground">Portfolio</span>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* ── Centered empty state ─────────────────────────────────────── */}
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="relative max-w-md mx-auto px-6 text-center">
          {/* Background glow */}
          <div
            className="absolute inset-[-80px] opacity-40 pointer-events-none"
            style={{
              background:
                "radial-gradient(closest-side at 50% 45%, rgba(99,102,241,0.15), rgba(99,102,241,0.04) 60%, transparent 85%)",
              filter: "blur(40px)",
            }}
          />

          <div className="relative z-10 space-y-6">
            {/* Icon */}
            <div className="flex items-center justify-center mx-auto h-16 w-16 rounded-2xl bg-muted/40 border border-border/40">
              <MapPin className="h-7 w-7 text-muted-foreground/50" />
            </div>

            {/* Copy */}
            <div className="space-y-2.5">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Build your portfolio
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed">
                Add your first site to see forecasts, metrics and regional signals
                for any UK location. All you need is a postcode.
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={onAddSite}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Add your first site
            </button>

            {/* Subtle hint */}
            <p className="text-xs text-muted-foreground/40">
              Takes about 30 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
