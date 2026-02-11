"use client"

import { useState } from "react"
import { PortfolioViewV2 } from "@/components/portfolio/portfolio-view-v2"
import { PortfolioEmpty } from "@/components/portfolio/portfolio-empty"
import { AddSiteSheet } from "@/components/portfolio/add-site-sheet"
import type { PortfolioAssetItem } from "@/components/portfolio/portfolio-types"

interface PortfolioClientShellProps {
  assets: PortfolioAssetItem[]
  userEmail: string | null
}

export function PortfolioClientShell({ assets, userEmail }: PortfolioClientShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  if (assets.length === 0) {
    return (
      <>
        <PortfolioEmpty
          onAddSite={() => setSheetOpen(true)}
          userEmail={userEmail}
        />
        <AddSiteSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          userEmail={userEmail}
        />
      </>
    )
  }

  return (
    <>
      <PortfolioViewV2
        assets={assets}
        mode="user"
        userEmail={userEmail}
        onAddSite={() => setSheetOpen(true)}
      />
      <AddSiteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userEmail={userEmail}
      />
    </>
  )
}
