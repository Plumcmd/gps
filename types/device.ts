export interface Device {
  imei: string
  name?: string
  lat?: number | string
  lng?: number | string
  speed?: number | null
  voltage?: number | null
  course?: number | null      // ← добавлено для поворота
  last_updated?: string
  gps_time?: string
  [key: string]: any
  encrypted_password?: string   // или password, если не переименовывал
  user_id?: string
}