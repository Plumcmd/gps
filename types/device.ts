export interface Device {
  imei: string
  name?: string
  lat: number | string
  lng: number | string
  speed?: number | null
  isOnline?: boolean
  course?: number | null
  [key: string]: any
}
