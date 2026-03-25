'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  Polyline
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { supabase } from '@/lib/supabase'
import { Navigation } from 'lucide-react'
import { Device } from "@/types/device"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Фикс иконок Leaflet
delete (L as any).Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '',
  iconUrl: '',
  shadowUrl: ''
})

const defaultCenter: [number, number] = [53.42894, 14.55302]

interface TrackerMapRef {
  flyTo: (pos: [number, number], zoom?: number) => void
  drawRoute: (points: any[]) => void
}

const TrackerMap = forwardRef<TrackerMapRef>((props, ref) => {
  const [devices, setDevices] = useState<Device[]>([])
  const [route, setRoute] = useState<[number, number][]>([])
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Device | null>(null)

  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})

  // Загрузка устройств
  const loadDevices = async () => {
    const { data } = await supabase.from('devices').select('*')
    const valid = data?.filter(d =>
      d.lat && d.lng && !isNaN(Number(d.lat)) && !isNaN(Number(d.lng))
    ) || []
    setDevices(valid)
  }

  // Подписка на обновления
  useEffect(() => {
    loadDevices()

    const channel = supabase
      .channel('devices-live-map')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        (payload) => {
          const d = payload.new as Device
          const lat = Number(d.lat)
          const lng = Number(d.lng)
          if (isNaN(lat) || isNaN(lng)) return

          setDevices(prev => {
            const index = prev.findIndex(p => p.imei === d.imei)
            if (index !== -1) {
              const copy = [...prev]
              copy[index] = d
              return copy
            }
            return [d, ...prev]
          })

          if (markersRef.current[d.imei]) {
            markersRef.current[d.imei].setLatLng([lat, lng])
          }

          loadAddress(d.imei, lat, lng)
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  // Получение адреса
  const getAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      if (!res.ok) return 'Адрес не определён'
      const data = await res.json()
      return data.display_name?.split(', ').slice(0, 3).join(', ') || 'Адрес не определён'
    } catch {
      return 'Не удалось определить адрес'
    }
  }

  const loadAddress = async (imei: string, lat: number, lng: number) => {
    if (addresses[imei]) return
    const addr = await getAddress(lat, lng)
    setAddresses(prev => ({ ...prev, [imei]: addr }))
  }

  useEffect(() => {
    devices.forEach(d => {
      const lat = Number(d.lat)
      const lng = Number(d.lng)
      if (!isNaN(lat) && !isNaN(lng)) loadAddress(d.imei, lat, lng)
    })
  }, [devices])

  // Умный статус (одинаковый везде)
  const getDeviceStatus = (device: Device) => {
    const minutesAgo = device.last_updated
      ? (Date.now() - new Date(device.last_updated).getTime()) / 1000 / 60
      : 9999

    let statusText = 'Оффлайн'
    let statusColor = 'bg-red-500/20 text-red-400'
    let trackerOnline = false

    if (minutesAgo < 10) {
      statusText = 'Онлайн'
      statusColor = 'bg-green-500/20 text-green-400'
      trackerOnline = true
    } else if (minutesAgo < 60) {
      statusText = `Был ${Math.floor(minutesAgo)} мин назад`
      statusColor = 'bg-yellow-500/20 text-yellow-400'
      trackerOnline = true
    }

    return { statusText, statusColor, trackerOnline, minutesAgo }
  }

  // Методы для родителя
  useImperativeHandle(ref, () => ({
    flyTo: (pos, zoom = 15) => {
      mapRef.current?.flyTo(pos, zoom, { duration: 1.2 })
    },

    drawRoute: (points) => {
      const latlngs = points
        .filter(p => p.lat && p.lng)
        .map(p => [Number(p.lat), Number(p.lng)] as [number, number])

      setRoute(latlngs)

      if (mapRef.current && latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs)
        mapRef.current.fitBounds(bounds, { padding: [60, 60] })
      }
    }
  }))

  return (
    <div className="h-screen w-full relative">

      {/* МОДАЛЬНОЕ ОКНО */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-[92vw] md:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10">
            <DialogTitle className="text-2xl">Информация об устройстве</DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {selected && (() => {
              const { statusText, statusColor, trackerOnline } = getDeviceStatus(selected)
              const speed = selected.speed ? Number(selected.speed) : 0

              return (
                <>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-2xl font-bold text-white">
                        {selected.name || 'Автомобиль'}
                      </div>
                      <div className="text-sm text-zinc-400 mt-1">
                        {selected.imei}
                      </div>
                    </div>
                    <div className={`px-4 h-7 rounded-3xl flex items-center text-sm font-medium ${statusColor}`}>
                      {statusText}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-400 mb-1">📍 Текущее местоположение</div>
                    <div className="text-base text-zinc-200 leading-tight">
                      {addresses[selected.imei] || 'Определяем адрес...'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-400 mb-1">🚗 Скорость</div>
                    <div className="text-4xl font-semibold text-white">
                      {speed > 0 ? `${speed} км/ч` : '0 км/ч'}
                    </div>
                  </div>

                  <div className={`px-4 py-2 rounded-2xl text-sm flex items-center gap-2 ${trackerOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {trackerOnline ? '📡 Трекер в сети' : '📴 Трекер не в сети'}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                      onClick={() => {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`)
                      }}
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      Маршрут в Google
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-white/20 text-white hover:bg-white/10"
                      onClick={() => setSelected(null)}
                    >
                      Закрыть
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* КАРТА */}
      <MapContainer
        center={defaultCenter}
        zoom={10}
        className="h-full w-full"
        ref={mapRef}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {devices.map(device => {
          const lat = Number(device.lat)
          const lng = Number(device.lng)
          if (isNaN(lat) || isNaN(lng)) return null

          return (
            <Marker
              key={device.imei}
              position={[lat, lng]}
              eventHandlers={{ click: () => setSelected(device) }}
              ref={el => { if (el) markersRef.current[device.imei] = el }}
              icon={L.divIcon({
                className: '',
                html: `
                  <div class="relative">
                    <div class="w-4 h-4 bg-green-500 rounded-full shadow-[0_0_12px_4px_rgba(34,197,94,0.9)] animate-pulse"></div>
                  </div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            >
              <Tooltip
                direction="top"
                offset={[0, -10]}
                permanent
                className="!bg-black/90 !text-white !px-3 !py-1 !rounded-xl !text-xs !border !border-white/20 shadow-2xl"
              >
                {device.name || device.imei.slice(-6)}
              </Tooltip>
            </Marker>
          )
        })}

        {route.length > 0 && (
          <Polyline positions={route} color="#22c55e" weight={5} opacity={0.9} />
        )}
      </MapContainer>
    </div>
  )
})

export default TrackerMap