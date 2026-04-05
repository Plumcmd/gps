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
import { LocateFixed } from "lucide-react"

import { supabase } from '@/lib/supabase'
import { Battery } from 'lucide-react'
import { Device } from "@/types/device"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Фикс иконок Leaflet
delete (L as any).Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' })

const defaultCenter: [number, number] = [53.42894, 14.55302]

interface TrackerMapRef {
  flyTo: (pos: [number, number], zoom?: number) => void
  drawRoute: (points: any[]) => void
}

// ====================== ДИНАМИЧЕСКАЯ ИКОНКА МАРКЕРА ======================
const getMarkerIcon = (device: Device) => {
  const speed = Number(device.speed || 0)
  const isMoving = speed > 3

  return L.divIcon({
    className: '',
    html: `
      <div class="relative flex items-center justify-center">
        <!-- Основной круг — всегда зелёный -->
        <div class="w-4 h-4 bg-emerald-400 rounded-full 
                    shadow-[0_0_30px_8px_rgba(16,185,129,0.8)] 
                    ${isMoving ? 'animate-pulse' : ''}">
        </div>
        
        <!-- Стрелка только когда едет -->
        ${isMoving ? `
          <div class="absolute text-white text-[11px] font-black rotate-45">→</div>
        ` : ''}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

const TrackerMap = forwardRef<TrackerMapRef>((props, ref) => {
  const [devices, setDevices] = useState<Device[]>([])
  const [route, setRoute] = useState<[number, number][]>([])
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Device | null>(null)

  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})

  // === Моё местоположение ===
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)

  const [showDev, setShowDev] = useState(false)

  const handleDevClick = () => {
    setShowDev(true)
    setTimeout(() => setShowDev(false), 3000)
  }

  const fetchAddress = async (lat: number, lng: number, imei: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      )
      const data = await res.json()
      const address = data.display_name || 'Адрес не найден'
      setAddresses(prev => ({ ...prev, [imei]: address }))
    } catch (err) {
      console.error('Ошибка геокодирования:', err)
    }
  }

  // ====================== ЗАГРУЗКА УСТРОЙСТВ ======================
  const loadDevices = async () => {
    const { data } = await supabase.from('devices').select('*')
    const valid = data?.filter(d =>
      d.lat && d.lng && !isNaN(Number(d.lat)) && !isNaN(Number(d.lng))
    ) || []
    setDevices(valid)
  }

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // ====================== ПЛАВНОЕ ДВИЖЕНИЕ МАРКЕРОВ ======================
  useEffect(() => {
    devices.forEach(device => {
      const marker = markersRef.current[device.imei]
      if (!marker) return

      const lat = Number(device.lat)
      const lng = Number(device.lng)

      if (!isNaN(lat) && !isNaN(lng)) {
        marker.setLatLng([lat, lng])   // ← ПЛАВНОЕ ПЕРЕМЕЩЕНИЕ
      }
    })
  }, [devices])

  // ====================== REALTIME ======================
  useEffect(() => {
    loadDevices()

    const channel = supabase
      .channel('devices-live-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        loadDevices()
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

// ====================== ДИНАМИЧЕСКИЙ ТУЛТИП (компактный + скорость всегда) ======================
useEffect(() => {
  devices.forEach((device) => {
    const marker = markersRef.current[device.imei]
    if (!marker) return

    const info = getDeviceInfo(device)
    const name = device.name || device.imei.slice(-6)

    const tooltipHTML = `
      <div style="text-align:center; line-height:1.15; min-width:105px; padding:2px 0;">
        <strong style="font-size:13px; color:#fff;">${name}</strong><br>
        
        <span style="font-size:11.5px; font-weight:700; color:${info.tooltipStatusColor};">
          ${info.statusText}
        </span>
        
        <span style="font-size:11.5px; margin-left:7px; color:#4ade80; font-weight:600;">
          ${info.speed} км/ч
        </span>
        
        ${info.batteryText !== '—' ? 
          `<div style="margin-top:3px; font-size:10.5px; color:${info.tooltipBatteryColor};">
            ${info.batteryText}
          </div>` : ''}
      </div>
    `

    const existingTooltip = marker.getTooltip()
    if (existingTooltip) {
      existingTooltip.setContent(tooltipHTML)
    } else {
      marker.bindTooltip(tooltipHTML, {
        permanent: true,
        direction: 'top',
        offset: [0, -15],
        className: '!bg-zinc-950/95 !text-white !px-3 !py-1 !rounded-3xl !text-sm !border !border-white/20 shadow-2xl backdrop-blur-md'
      }).openTooltip()
    }
  })
}, [devices])

function getDeviceInfo(device: Device) {
  const speed = Number(device.speed || 0)
  const voltage = Number(device.voltage || device.battery || 0)

  // Для модалки (старые Tailwind-классы)
  let statusText = 'НЕИЗВЕСТНО'
  let statusColor = 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

  if (speed > 0) {
    statusText = 'В ДВИЖЕНИИ'
    statusColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  } else {
    statusText = 'СТОИТ'
    statusColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  }

  let batteryText = '—'
  let batteryColor = 'text-zinc-400'

  if (voltage) {
    batteryText = `${voltage.toFixed(1)}V`

    if (voltage >= 12.8) batteryColor = 'text-emerald-400'
    else if (voltage >= 12.2) batteryColor = 'text-yellow-400'
    else batteryColor = 'text-red-400'
  }

  // Для тултипа (hex-цвета)
  const tooltipStatusColor = speed > 0 ? '#4ade80' : '#eab308'
  const tooltipBatteryColor = voltage
    ? voltage >= 12.8
      ? '#4ade80'
      : voltage >= 12.2
        ? '#eab308'
        : '#f43f5e'
    : '#a1a1aa'

  return {
    speed,
    voltage,           // нужно для модалки (batteryWear)
    statusText,
    statusColor,       // Tailwind для модалки
    batteryText,
    batteryColor,      // Tailwind для модалки
    tooltipStatusColor,
    tooltipBatteryColor
  }
}

  // ====================== МОЁ МЕСТОПОЛОЖЕНИЕ ======================
  const locateUser = (follow = false) => {
    if (!mapRef.current) return

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }

    const onLocationFound = (e: L.LocationEvent) => {
      const pos: [number, number] = [e.latlng.lat, e.latlng.lng]
      setUserPosition(pos)
      mapRef.current?.flyTo(pos, 16, { duration: 1.5 })

      if (!userMarkerRef.current) {
        const userIcon = L.divIcon({
          className: '',
          html: `<div class="relative flex items-center justify-center"><div class="w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_20px_8px_rgba(59,130,246,0.7)] animate-pulse"></div></div>`,
          iconSize: [32, 32],
          iconAnchor: [12, 12],
        })
        userMarkerRef.current = L.marker(pos, { icon: userIcon }).addTo(mapRef.current!)
        userMarkerRef.current.bindTooltip("Вы здесь", {
          permanent: true,
          direction: 'top',
          offset: [0, -20],
          className: '!bg-blue-500 !text-white !px-3 !py-1 !rounded-xl !text-xs shadow-xl'
        })
      } else {
        userMarkerRef.current.setLatLng(pos)
      }

      if (follow) setIsFollowing(true)
    }

    const onLocationError = (e: L.ErrorEvent) => {
      alert(`Не удалось определить местоположение: ${e.message}`)
    }

    if (follow) {
      mapRef.current.locate({ ...options, watch: true, setView: false })
    } else {
      mapRef.current.locate({ ...options, watch: false, setView: true })
    }

    mapRef.current.on('locationfound', onLocationFound)
    mapRef.current.on('locationerror', onLocationError)
  }

  const stopFollowing = () => {
    if (mapRef.current) mapRef.current.stopLocate()
    setIsFollowing(false)
  }

  // ====================== IMPERATIVE HANDLE ======================
  useImperativeHandle(ref, () => ({
    flyTo: (pos, zoom = 15) => mapRef.current?.flyTo(pos, zoom, { duration: 1.2 }),
    drawRoute: (points) => {
      const latlngs = points
        .filter(p => p.lat && p.lng)
        .map(p => [Number(p.lat), Number(p.lng)] as [number, number])
      setRoute(latlngs)
      if (mapRef.current && latlngs.length > 0) {
        mapRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60] })
      }
    }
  }))

  // Адрес при открытии модалки
  useEffect(() => {
    if (!selected) return
    const lat = Number(selected.lat)
    const lng = Number(selected.lng)
    if (!addresses[selected.imei]) {
      fetchAddress(lat, lng, selected.imei)
    }
  }, [selected])

  // Тема
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  }, [])

  return (
    <div className="h-screen w-full relative">

      {/* Кнопка "Моё местоположение" */}
      <div className="absolute bottom-37 right-6 z-[1000] flex flex-col gap-2">
        <Button
          onClick={() => locateUser(false)}
          className="w-8 h-8 bg-zinc-800 border border-white/10 text-white rounded-3xl"
          title="Моё местоположение"
        >
          <LocateFixed className="w-6 h-6" />
        </Button>

        {isFollowing && (
          <Button
            onClick={stopFollowing}
            variant="outline"
            className="w-12 h-12 border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-3xl"
            title="Остановить слежение"
          >
            ✕
          </Button>
        )}
      </div>
{/* Переключатель темы */}
      <div className="absolute bottom-12 right-14 z-[1150] rotate-270">
        <button
          onClick={() => {
            const newTheme = theme === 'dark' ? 'light' : 'dark'
            setTheme(newTheme)
            localStorage.setItem('theme', newTheme)
            document.documentElement.classList.toggle('dark', newTheme === 'dark')
          }}
          className={`ios-switch ${theme === 'light' ? 'active' : ''}`}
          title="Переключить тему"
        >
          <span className="icon moon">☽</span>
          <span className="icon sun">☼</span>
          <span className="thumb" />
        </button>
      </div>


      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-[1000] flex items-center group">
  {/* ОСНОВНОЙ КОРПУС ЧЕЛКИ (БЕЗ СЛОЖНЫХ УГЛОВ) */}
  <div 
    className="
      relative 
      h-48 w-8 
      bg-zinc-950 dark:bg-zinc-100 
      rounded-r-2xl 
      flex items-center justify-center 
      transition-all duration-500 
      hover:w-10
      cursor-pointer
      shadow-lg
    "
    onClick={handleDevClick}
  >
    
    {/* ТЕКСТ */}
    <div className="rotate-180 [writing-mode:vertical-lr]">
      <span className="
        font-black tracking-[0.25em] text-[10px] select-none
        text-green-400 dark:text-green-600
        drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]
        transition-all duration-300
        group-hover:drop-shadow-[0_0_12px_rgba(34,197,94,0.9)]
      ">
        GPS HORIZON
      </span>
    </div>

{showDev && (
  <a
    href="https://ТВОЯ_ССЫЛКА_ЗДЕСЬ.com" // <--- Вставь свою ссылку сюда
    target="_blank"
    rel="noopener noreferrer"
    className="
      absolute left-12 top-1/2 -translate-y-1/2
      min-w-[130px] px-4 py-2 rounded-2xl
      bg-zinc-950/95 dark:bg-white/95 backdrop-blur-md
      border border-zinc-800/50 dark:border-zinc-200/50
      shadow-2xl
      animate-in fade-in zoom-in slide-in-from-left-4 duration-300
      
      /* Добавили интерактив */
      pointer-events-auto cursor-pointer 
      transition-transform active:scale-95
      hover:bg-zinc-900 dark:hover:bg-zinc-50
      no-underline
    "
  >
    <div className="flex items-center gap-3">
      {/* Индикатор статуса */}
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </div>
      
      <div>
        <div className="text-[10px] font-black tracking-widest text-white dark:text-zinc-950 uppercase leading-none">
          VO Studio
        </div>
        <div className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400 mt-1 tracking-tight">
          Developer
        </div>
      </div>
    </div>
  </a>
)}
  </div>
</div>

      {/* Модальное окно */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[92vw] md:max-w-md rounded-3xl z-[1300] p-0 overflow-hidden">
          {selected && (() => {
            const info = getDeviceInfo(selected)
            const address = addresses[selected.imei] || 'Определяем адрес...'

            const batteryWear = info.voltage
              ? Math.max(0, Math.min(100, Math.round((12.8 - info.voltage) * 50)))
              : 0

            return (
              <>
                <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 px-5 py-5 border-b border-white/10">
                  Подробная информация:
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-lg font-semibold leading-tight truncate">
                        {selected.name || 'Автомобиль'}
                      </DialogTitle>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{selected.imei}</p>
                    </div>
                  </div>
                  <div className={`text-[8px] px-3 py-1 rounded-full font-medium border ${info.statusColor} mb-1 inline-block mt-[10px]`}>
                    {info.statusText}
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1.5">Местоположение:</div>
                    <div className="text-sm leading-snug bg-zinc-950 border border-white/10 p-3.5 rounded-2xl">
                      {address}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
                      <div className="text-xs text-zinc-500 mb-1">Скорость:</div>
                      <div className="text-3xl font-semibold tabular-nums">
                        {info.speed > 0 ? info.speed : '—'}
                        <span className="text-base text-zinc-500 ml-1">км/ч</span>
                      </div>
                      {info.speed === 0 && <div className="text-xs text-emerald-400 mt-1">НЕ В ДВИЖЕНИИ</div>}
                    </div>

                    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 space-y-2">
                      <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                        <Battery className="w-4 h-4" /> Аккумулятор:
                      </div>
                      <div className={`text-3xl font-semibold tabular-nums ${info.batteryColor}`}>
                        {info.batteryText}
                      </div>

                      {info.voltage && (
                        <div className="space-y-1">
                          <div className="text-xs text-zinc-400 flex justify-between">
                            <span>
                              {info.voltage >= 12.8 ? 'Отличное' : info.voltage >= 12.2 ? 'Хорошее' : 'Низкое'}
                            </span>
                            <span className="font-mono">{batteryWear}%</span>
                          </div>
                          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                info.voltage >= 12.8 ? 'bg-emerald-400' : info.voltage >= 12.2 ? 'bg-yellow-400' : 'bg-red-500'
                              }`}
                              style={{ width: `${batteryWear}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`, '_blank')}
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
              icon={getMarkerIcon(device)}
            >
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