export function scenarioLabel(s: string | null | undefined) {
  const v = String(s ?? "").toLowerCase()
  if (v === "baseline") return "Baseline"
  if (v === "upside") return "Upside"
  if (v === "downside") return "Downside"
  if (!v) return ""
  return v.charAt(0).toUpperCase() + v.slice(1)
}

export function dataTypeLabel(t: string | null | undefined) {
  const v = String(t ?? "").toLowerCase()
  if (v === "historical") return "Historical"
  if (v === "forecast") return "Forecast"
  return ""
}

export function sourceLabel(params: {
  dataType?: string | null
  dataQuality?: string | null
}) {
  const dt = String(params.dataType ?? "").toLowerCase()
  const dq = String(params.dataQuality ?? "").toLowerCase()

  // Keep the Source column clean (no qualifiers); provenance text belongs in Info sheet.
  if (dt === "forecast") return "RegionIQ"
  if (dq === "nisra") return "NISRA"
  if (dq === "interpolated") return "Estimated"
  // Default historical provenance to ONS if we don't have a stronger signal.
  if (dt === "historical") return "ONS"
  if (dq === "ons") return "ONS"
  return "ONS"
}


