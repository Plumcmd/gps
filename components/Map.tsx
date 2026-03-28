// components/Map.tsx
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
import { Navigation, Battery } from 'lucide-react'
import { Device } from "@/types/device"
import {
  Dialog,
  DialogContent,
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

const [showDev, setShowDev] = useState(false);

const handleDevClick = () => {
  setShowDev(true);
  setTimeout(() => setShowDev(false), 3000);
};

  
  const loadDevices = async () => {
    const { data } = await supabase.from('devices').select('*')
    const valid = data?.filter(d =>
      d.lat && d.lng && !isNaN(Number(d.lat)) && !isNaN(Number(d.lng))
    ) || []
    setDevices(valid)
  }

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

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

  // ====================== АДРЕС ======================
  const getAddress = async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (addresses[cacheKey]) return addresses[cacheKey]

    try {
      const res = await fetch(`/api/address?lat=${lat}&lon=${lng}`, { cache: 'no-store' })
      if (!res.ok) return 'Адрес не определён'
      const data = await res.json()
      const address = data.address || 'Адрес не найден'
      setAddresses(prev => ({ ...prev, [cacheKey]: address }))
      return address
    } catch {
      return 'Не удалось определить адрес'
    }
  }

  const loadAddress = async (imei: string, lat: number, lng: number) => {
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

  // ====================== СТАТУС И НАПРЯЖЕНИЕ ======================
  const getDeviceInfo = (device: Device) => {
    const minutesAgo = device.last_updated
      ? (Date.now() - new Date(device.last_updated).getTime()) / 1000 / 60
      : 9999

    let statusText = 'Оффлайн'
    let statusColor = 'bg-red-500/20 text-red-400 border-red-500/30'

    if (minutesAgo < 10) {
      statusText = 'Онлайн'
      statusColor = 'bg-green-500/20 text-green-400 border-green-500/30'
    } else if (minutesAgo < 60) {
      statusText = `Был ${Math.floor(minutesAgo)} мин назад`
      statusColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }

    const voltage = device.voltage ? Number(device.voltage) : null
    let batteryColor = 'text-zinc-500'
    let batteryText = '-- V'

    if (voltage) {
      batteryText = voltage.toFixed(1) + ' V'
      if (voltage >= 12.8) batteryColor = 'text-emerald-400'
      else if (voltage >= 12.4) batteryColor = 'text-green-400'
      else if (voltage >= 12.0) batteryColor = 'text-yellow-400'
      else batteryColor = 'text-red-400'
    }

    const speed = device.speed ? Number(device.speed) : 0

    return { statusText, statusColor, voltage, batteryColor, batteryText, speed, minutesAgo }
  }

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
      {/* Переключатель темы */}
      <div className="absolute bottom-40 right-4 z-[1000]">
        <button
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          className={`ios-switch ${theme === 'light' ? 'active' : ''}`}
        >
          <span className="icon moon">☽</span>
          <span className="icon sun">☼</span>
          <span className="thumb" />
        </button>
      </div>

<div 
  className="absolute left-4 top-1/2 -translate-y-1/2 z-[1000]"
  onClick={handleDevClick}
>
  <div className="
    gps-text cursor-pointer select-none
    text-cyan-300 font-semibold tracking-wider
    drop-shadow-[0_0_6px_rgba(0,255,255,0.7)]
    hover:drop-shadow-[0_0_12px_rgba(0,255,255,1)]
    transition-all duration-300
  ">
    GPS Polska Flora
  </div>

  {showDev && (
    <div className="
      absolute left-0 top-full mt-3
      px-4 py-2
      rounded-lg
      text-sm font-bold
      text-cyan-300
      bg-black/70
      backdrop-blur-xl
      border border-cyan-400/40
      shadow-[0_0_20px_rgba(0,255,255,0.6)]
      animate-cyberPopup
      pointer-events-none
      tracking-widest
      glitch
    ">
      Разработчик: Vladyslav Oliinyk
    </div>
  )}
</div>


      {/* Модальное окно */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[92vw] md:max-w-md rounded-3xl z-[1300] p-0 overflow-hidden">
          {selected && (() => {
            const info = getDeviceInfo(selected)
            const address = addresses[selected.imei] || 'Определяем адрес...'

            // Вычисляем износ АКБ в %
            const batteryWear = info.voltage
              ? Math.max(0, Math.min(100, Math.round((12.8 - info.voltage) * 50)))
              : 0

            return (
              <>
                {/* Шапка */}
                <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 px-5 py-5 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                     
                      <DialogTitle className="text-lg font-semibold leading-tight truncate">
                        {selected.name || 'Автомобиль'} 
                      </DialogTitle>
                      
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{selected.imei}</p>
                    </div>
                                             {/* Статус над именем */}

                  </div>
                                            <div className={`text-[8px] px-3 py-1 rounded-full font-medium border ${info.statusColor} mb-1 inline-block mt-[10px]`}>
  {info.statusText}
</div> 
                </div>

                <div className="p-5 space-y-5">
                  
                  {/* Адрес */}
                  <div>
                    
                    <div className="text-xs text-zinc-500 mb-1.5">Местоположение:</div>
                    <div className="text-sm leading-snug bg-zinc-950 border border-white/10 p-3.5 rounded-2xl">
                      {address}
                    </div>
                  </div>

                  {/* Скорость + Напряжение */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
                      <div className="text-xs text-zinc-500 mb-1">Скорость:</div>
                      <div className="text-3xl font-semibold tabular-nums">
                        {info.speed > 0 ? info.speed : '—'}
                        <span className="text-base text-zinc-500 ml-1">км/ч</span>
                      </div>
                      {info.speed === 0 && <div className="text-xs text-emerald-400 mt-1">Не в движении</div>}
                    </div>

                    {/* Аккумулятор с технологичным дизайном */}
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 space-y-2">
                      <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                        <Battery className="w-4 h-4" /> Аккумулятор:
                      </div>
                      <div className={`text-3xl font-semibold tabular-nums ${info.batteryColor}`}>
                        {info.batteryText}
                      </div>

                      {/* Состояние и примечание */}
                      {info.voltage && (
                        <div className="space-y-1">
                          <div className="text-xs text-zinc-400 flex justify-between">
                            <span>
                              {info.voltage >= 12.8 ? 'Отличное' :
                               info.voltage >= 12.2 ? 'Хорошее' :
                               'Низкое'}
                            </span>
                            <span className="font-mono">{batteryWear}%</span>
                          </div>

                          {/* Прогресс-бар */}
                          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                info.voltage >= 12.8 ? 'bg-emerald-400' :
                                info.voltage >= 12.2 ? 'bg-yellow-400' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${batteryWear}%` }}
                            />
                          </div>

                          {/* Примечание */}
                          {info.voltage >= 12.8 ? null :
                            info.voltage >= 12.2 ? (
                              <div className="text-yellow-400 text-[10px] font-mono">
                                ⚠️ Напряжение чуть ниже идеала — проверьте контакты и кабели.
                              </div>
                            ) : (
                              <div className="text-red-400 text-[10px] font-mono">
                                ❌ Напряжение низкое — возможно разряд или износ АКБ. Требуется обслуживание.
                              </div>
                            )
                          }
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Кнопки */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => 
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`, '_blank')
                      }
                      className="flex-1 h-11 bg-white hover:bg-white/90 text-black rounded-2xl text-sm font-medium"
                    >
                      Маршрут в Google
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setSelected(null)}
                      className="flex-1 h-11 border-white/20 hover:bg-white/5 rounded-2xl text-sm"
                    >
                      Закрыть
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      <MapContainer
        center={defaultCenter}
        zoom={10}
        className="h-full w-full"
        ref={mapRef}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={
            theme === 'dark'
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          }
        />

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
                    <div class="w-5 h-5 bg-green-500 rounded-full shadow-[0_0_15px_6px_rgba(34,197,94,0.8)] animate-pulse"></div>
                  </div>
                `,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            >
              <Tooltip
                direction="top"
                offset={[0, -12]}
                permanent
                className="!bg-black/90 !text-white !px-3 !py-1 !rounded-xl !text-sm !border !border-white/20 shadow-2xl"
              >
                {device.name || device.imei.slice(-6)}
              </Tooltip>
            </Marker>
          )
        })}

        {route.length > 0 && (
          <Polyline positions={route} color="#22c55e" weight={6} opacity={0.85} />
        )}
      </MapContainer>
    </div>
  )
})

export default TrackerMap