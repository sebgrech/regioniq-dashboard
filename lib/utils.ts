// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { METRICS, SCENARIOS, YEARS } from "@/lib/metrics.config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ---------------- URL State Management ---------------- */

// Merge current search params with updates
export function updateSearchParams(
  searchParams: URLSearchParams,
  updates: Record<string, string | number | null | undefined>,
): string {
  const newParams = new URLSearchParams(searchParams)

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      newParams.delete(key)
    } else {
      newParams.set(key, String(value))
    }
  })

  return newParams.toString()
}

// Raw string param with default
export function getSearchParam(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: string,
): string {
  return searchParams.get(key) ?? defaultValue
}

// Numeric param with default + clamp
export function getSearchParamNumber(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: number,
  { min = YEARS.min, max = YEARS.max }: { min?: number; max?: number } = {},
): number {
  const value = searchParams.get(key)
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN
  if (isNaN(parsed)) return defaultValue
  return Math.min(Math.max(parsed, min), max)
}

/* ---------------- Domain-Specific Guards ---------------- */

// Ensure metric param maps to a known metric
export function getSearchParamMetric(
  searchParams: URLSearchParams,
  key = "metric",
  defaultMetric = "population",
): string {
  const metric = searchParams.get(key)
  return METRICS.find((m) => m.id === metric)?.id ?? defaultMetric
}

// Ensure scenario param maps to a known scenario
export function getSearchParamScenario(
  searchParams: URLSearchParams,
  key = "scenario",
  defaultScenario: typeof SCENARIOS[number] = "baseline",
): typeof SCENARIOS[number] {
  const scenario = searchParams.get(key)
  return SCENARIOS.includes(scenario as any) ? (scenario as typeof SCENARIOS[number]) : defaultScenario
}

/* ---------------- UI Animation Helpers ---------------- */

export function staggerChildren(index: number, delay = 0.1): string {
  // Tailwind can't parse dynamic strings well, so stick to a few discrete steps
  const ms = Math.round(index * delay * 1000)
  return `animate-fade-in-up [animation-delay:${ms}ms]`
}

/* ---------------- General Utilities ---------------- */

// Debounce utility for inputs / sliders
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
