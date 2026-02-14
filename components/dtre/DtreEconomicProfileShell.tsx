"use client"

import { EconomicProfileShell } from "@/components/economic-profile-shell"

interface DtreEconomicProfileShellProps {
  slug: string
}

export function DtreEconomicProfileShell({ slug }: DtreEconomicProfileShellProps) {
  return <EconomicProfileShell slug={slug} />
}
