/**
 * Northern Ireland jobs in Supabase/Data API are stored under a different metric id:
 * - GB: `emp_total_jobs`
 * - NI: `emp_total_jobs_ni`
 *
 * Additionally, NI ITL1 (`UKN`) jobs are not present in the ITL1 table in this dataset;
 * they exist at ITL2 as `TLN0`. For exports that request `UKN` + jobs, we query `TLN0`
 * and remap the region code back to `UKN` in the exported output.
 */

export function isNIRegionCode(code: string): boolean {
  if (!code) return false
  // UI codes
  if (code === "UKN") return true
  // ITL2/3 NI
  if (code.startsWith("TLN")) return true
  // NI LADs
  if (code.startsWith("N09")) return true
  // DB ITL1 code (sometimes appears in downstream tooling)
  if (code === "N92000002") return true
  return false
}

export function jobsMetricIdForRegion(metricId: string, regionCode: string): string {
  if (metricId !== "emp_total_jobs") return metricId
  return isNIRegionCode(regionCode) ? "emp_total_jobs_ni" : "emp_total_jobs"
}

export function jobsRegionCodeForQuery(metricId: string, regionCode: string): string {
  if (metricId !== "emp_total_jobs") return regionCode
  // NI ITL1 jobs are stored at ITL2 TLN0 in this dataset
  if (regionCode === "UKN") return "TLN0"
  return regionCode
}

export function remapJobsRegionCodeForOutput(metricId: string, regionCodeFromApi: string): string {
  if (metricId !== "emp_total_jobs") return regionCodeFromApi
  // If we queried TLN0 on behalf of UKN, map it back for display/export
  if (regionCodeFromApi === "TLN0") return "UKN"
  return regionCodeFromApi
}


