export interface Device {
  imei: string
  name?: string
  lat?: number | string
  lng?: number | string
  speed?: number | null
  voltage?: number | null
  course?: number | null      // ← НОВОЕ ПОЛЕ
  last_updated?: string
  gps_time?: string
  [key: string]: any
}