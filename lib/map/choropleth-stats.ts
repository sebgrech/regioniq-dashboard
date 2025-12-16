export type ChoroplethStats = {
  level: "ITL1" | "ITL2" | "ITL3" | "LAD"
  n: number // regions with a valid numeric value
  total: number // total regions in the GeoJSON for this level
  median: number | null
  // Keys are the raw GeoJSON codes for the current level (the same codes Mapbox hit-testing returns)
  rankByCode: Record<string, number> // 1..n (1 = highest value)
  valueByCode: Record<string, number>
}


