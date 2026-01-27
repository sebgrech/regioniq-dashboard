"use client"

import { Building2, MapPin, Banknote, User, Calendar, Ruler, ChevronDown } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export interface AssetHeaderProps {
  address: string
  postcode?: string | null
  regionName: string
  assetType?: string | null
  assetClass?: string | null
  broker?: string | null
  brokerContact?: {
    name?: string
    email?: string
    phone?: string
  } | null
  headline?: string | null
  priceGuidance?: string | null
  yieldInfo?: string | null
  sqFt?: number | null
  tenant?: string | null
  leaseExpiry?: string | null
  keyStats?: string[] | null
}

export function AssetHeader({
  address,
  postcode,
  regionName,
  assetType,
  assetClass,
  broker,
  brokerContact,
  headline,
  priceGuidance,
  yieldInfo,
  sqFt,
  tenant,
  leaseExpiry,
  keyStats,
}: AssetHeaderProps) {
  const [showStats, setShowStats] = useState(false)

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
      {/* Gradient accent */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(34,211,238,0.1) 50%, transparent 100%)",
        }}
      />
      
      <div className="relative p-6 md:p-8">
        {/* Top row: Asset type badge + Broker */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {assetClass && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-medium">
                <Building2 className="h-3 w-3" />
                {assetClass}
              </span>
            )}
            {assetType && assetType !== assetClass && (
              <span className="text-xs text-muted-foreground">{assetType}</span>
            )}
          </div>
          
          {broker && (
            <div className="text-right text-xs text-muted-foreground">
              <span className="opacity-60">via</span>{" "}
              <span className="font-medium text-foreground/80">{broker}</span>
            </div>
          )}
        </div>

        {/* Address as hero */}
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-2">
          {address}
        </h1>
        
        {/* Location line */}
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <MapPin className="h-4 w-4 text-cyan-400" />
          <span>{regionName}</span>
          {postcode && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono text-sm">{postcode}</span>
            </>
          )}
        </div>

        {/* Headline */}
        {headline && (
          <p className="text-sm text-muted-foreground/80 mb-6 max-w-2xl">
            {headline}
          </p>
        )}

        {/* Key metrics row */}
        <div className="flex flex-wrap gap-4 md:gap-6 mb-4">
          {priceGuidance && (
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Banknote className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Guide Price</div>
                <div className="text-sm font-semibold text-foreground">{priceGuidance}</div>
              </div>
            </div>
          )}
          
          {yieldInfo && (
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <span className="text-amber-400 font-bold text-sm">%</span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Yield</div>
                <div className="text-sm font-semibold text-foreground">{yieldInfo}</div>
              </div>
            </div>
          )}
          
          {sqFt && (
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Ruler className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Size</div>
                <div className="text-sm font-semibold text-foreground">{sqFt.toLocaleString()} sq ft</div>
              </div>
            </div>
          )}
          
          {tenant && (
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <User className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tenant</div>
                <div className="text-sm font-semibold text-foreground">{tenant}</div>
              </div>
            </div>
          )}
          
          {leaseExpiry && (
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-slate-500/10">
                <Calendar className="h-4 w-4 text-slate-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lease Expiry</div>
                <div className="text-sm font-semibold text-foreground">{leaseExpiry}</div>
              </div>
            </div>
          )}
        </div>

        {/* Key stats expandable */}
        {keyStats && keyStats.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform duration-200",
                showStats && "rotate-180"
              )} />
              <span>Key statistics from offering memorandum</span>
            </button>
            
            {showStats && (
              <ul className="mt-3 space-y-1.5 pl-6">
                {keyStats.map((stat, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground/80 list-disc">
                    {stat}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
