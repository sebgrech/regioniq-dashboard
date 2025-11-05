export interface DataMetadata {
  version: string // "2024-Q3"
  lastUpdated: string // ISO timestamp
  modelRun: string // "September 2024 baseline"
  source: string // "ONS Regional Accounts"
  dataQuality: number // 0-100 score
  coverage: {
    historical: string // "2010-2023"
    forecast: string // "2024-2035"
  }
}

export interface DataResponse<T = any> {
  data: T
  metadata: DataMetadata
}

export interface ApiError {
  message: string
  code?: string
  details?: any
}
