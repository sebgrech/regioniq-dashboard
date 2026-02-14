"use client"

import { MapOverlaysDynamic } from "@/components/map-overlays-dynamic"
import type { ComponentProps } from "react"

type SharedMapOverlaysProps = ComponentProps<typeof MapOverlaysDynamic>

export function DtreMapOverlaysDynamic(props: Omit<SharedMapOverlaysProps, "showViewDetailsCta">) {
  return <MapOverlaysDynamic {...props} showViewDetailsCta={false} />
}
