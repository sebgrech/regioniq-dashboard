import type { Scenario } from "@/lib/metrics.config"

export type RegionIndexEntry = {
  name: string
  level: "ITL1" | "ITL2" | "ITL3" | "LAD"
  bbox?: [number, number, number, number]
}

export type ApiSelection =
  | { filter: "item"; values: string[] }
  | { filter: "all" }
  | { filter: "range"; from: string; to: string }

export type ApiQuery = {
  query: Array<{
    code: "metric" | "region" | "level" | "year" | "scenario" | "data_type" | "time_period"
    selection: ApiSelection
  }>
  response?: { format: "records" }
  limit?: number
}

export interface DataExplorerState {
  metrics: string[]
  regions: string[]
  selectedYears: number[]
  scenario: Scenario
}

export interface FilterPillProps {
  label: string
  value: string
  onClear?: () => void
  onClick: () => void
  isActive?: boolean
}

export const LEVEL_LABEL: Record<string, string> = {
  ITL1: "ITL1",
  ITL2: "ITL2",
  ITL3: "ITL3",
  LAD: "LAD",
}

export const TL_TO_UK: Record<string, string> = {
  TLC: "UKC",
  TLD: "UKD",
  TLE: "UKE",
  TLF: "UKF",
  TLG: "UKG",
  TLH: "UKH",
  TLI: "UKI",
  TLJ: "UKJ",
  TLK: "UKK",
  TLL: "UKL",
  TLM: "UKM",
  TLN: "UKN",
}
