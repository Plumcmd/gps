// app/page.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

const TrackerMap = dynamic(() => import('@/components/Map'), { ssr: false })

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, RefreshCw, List, Pencil, Trash2, Route, Bell } from 'lucide-react'

import { addDevice, updateAllDevices, fetchTodayHistory } from './actions'
import { supabase } from '@/lib/supabase'
import { Device } from "@/types/device"
import { toast } from 'sonner'

import SettingsButton from '@/components/SettingsButton'

type Notification = {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'warning'
  time: Date
}

export default function Home() {
  const [showAdd, setShowAdd] = useState(false)
  const [showList, setShowList] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const [imei, setImei] = useState('')
  const [name, setName] = useState('')
  const [devicePassword, setDevicePassword] = useState('')

  const [devices, setDevices] = useState<Device[]>([])
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [newName, setNewName] = useState('')

  const [notifications, setNotifications] = useState<Notification[]>([])

  const mapRef = useRef<any>(null)
  const prevStates = useRef<Record<string, { online: boolean; moving: boolean }>>({})

  const [timeLeft, setTimeLeft] = useState(10)

  // ====================== ПОМОЩНИКИ ======================
  const calculateMinutesAgo = (lastUpdated?: string | null) => {
    if (!lastUpdated) return 9999
    return (Date.now() - new Date(lastUpdated).getTime()) / 1000 / 60
  }

  const getSpeedText = (speed?: number | null) => {
    const s = Number(speed) || 0
    return s > 0 ? `${s} км/ч` : 'стоит'
  }

  const addNotification = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
    const notif: Notification = {
      id: Date.now().toString(),
      title,
      message,
      type,
      time: new Date(),
    }
    setNotifications(prev => [notif, ...prev].slice(0, 20))

    if (type === 'success') toast.success(`${title} — ${message}`)
    else if (type === 'error') toast.error(`${title} — ${message}`)
    else toast(`${title} — ${message}`)
  }

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

  const loadDevices = async () => {
    const { data } = await supabase.from('devices').select('*')
    const devList = data || []
    setDevices(devList)

    for (const d of devList) {
      if (d.lat && d.lng) {
        getAddress(Number(d.lat), Number(d.lng))
      }
    }
  }

  // ====================== ИНТЕРВАЛ ОБНОВЛЕНИЯ ======================
  useEffect(() => {
    loadDevices()

    const interval = setInterval(async () => {
      await updateAllDevices()
      await loadDevices()
      setTimeLeft(10)
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // ====================== REALTIME УВЕДОМЛЕНИЯ ======================
  useEffect(() => {
    const channel = supabase
      .channel('devices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, (payload) => {
        loadDevices()

        if (payload.eventType !== 'UPDATE' || !payload.old || !payload.new) return

        const newDev = payload.new as Device
        const imei = newDev.imei
        const minutesAgo = calculateMinutesAgo(newDev.last_updated)
        const speed = Number(newDev.speed) || 0

        const isOnline = minutesAgo < 10
        const isMoving = speed > 5

        const prev = prevStates.current[imei] || { online: false, moving: false }
        const deviceName = newDev.name || imei.slice(-6)

        if (isOnline !== prev.online) {
          addNotification(
            `${deviceName} ${isOnline ? 'онлайн' : 'оффлайн'}`,
            isOnline ? 'Трекер подключился к сети' : 'Связь с трекером потеряна',
            isOnline ? 'success' : 'error'
          )
        }

        if (isMoving !== prev.moving) {
          addNotification(
            `${deviceName} ${isMoving ? 'поехал' : 'остановился'}`,
            isMoving ? `Скорость ${speed} км/ч` : 'Автомобиль стоит',
            isMoving ? 'success' : 'warning'
          )
        }

        prevStates.current[imei] = { online: isOnline, moving: isMoving }
      })
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [])

  // ====================== ОБРАБОТЧИКИ ======================
  const handleAdd = async () => {
    try {
      await addDevice(imei, name, devicePassword)
      toast.success('Устройство добавлено')
      setShowAdd(false)
      setImei('')
      setName('')
      setDevicePassword('')
      loadDevices()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const updateDeviceName = async () => {
    if (!editingDevice) return
    await supabase.from('devices').update({ name: newName }).eq('imei', editingDevice.imei)
    setEditingDevice(null)
    loadDevices()
  }

  const deleteDevice = async (imei: string) => {
    if (!confirm('Удалить устройство?')) return
    await supabase.from('devices').delete().eq('imei', imei)
    loadDevices()
  }

  const handleDeviceClick = (device: Device) => {
    if (device.lat && device.lng) {
      mapRef.current?.flyTo([Number(device.lat), Number(device.lng)], 16)
    }
    setShowList(false)
  }

  const loadHistory = async (imei: string) => {
    try {
      const points = await fetchTodayHistory(imei)
      if (points.length === 0) {
        toast.info('За сегодня данных трека нет')
        return
      }
      mapRef.current?.drawRoute(points)
      toast.success(`Загружено ${points.length} точек`)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // ====================== ТАЙМЕР ОБНОВЛЕНИЯ ======================
useEffect(() => {
  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) return 10
      return prev - 1
    })
  }, 1000)

  return () => clearInterval(timer)
}, [])

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative pb-safe">
      <div className="absolute inset-0">
        <TrackerMap ref={mapRef} />
      </div>

      {/* Кнопка добавления */}
      <div className="absolute bottom-6 left-4 z-[1100]">
        <Button
          onClick={() => setShowAdd(true)}
          className="w-16 h-16 bg-green-500 hover:bg-green-400 shadow-2xl shadow-green-500/50 rounded-3xl text-black text-4xl flex items-center justify-center active:scale-95 transition-all"
        >
          <Plus className="w-9 h-9" />
        </Button>
      </div>

{/* Кнопки справа снизу */}
<div className="absolute bottom-8 right-6 z-[1100] flex flex-col items-end gap-3">

  {/* === ТАЙМЕР + КНОПКА ОБНОВЛЕНИЯ (таймер слева) === */}
  <div className="flex items-center gap-3">

    {/* Круговой таймер — простой, без фона и рамок */}
    <div className="relative w-8 h-8 flex items-center justify-center">
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
        {/* Серый круг */}
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="#3f3f46"
          strokeWidth="3.2"
        />
        {/* Прогресс */}
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="hsl(142, 69%, 58%)"
          strokeWidth="3.2"
          strokeDasharray={`${(timeLeft / 10) * 100}, 100`}
          strokeLinecap="round"
        />
      </svg>

      {/* Цифра */}
      <span className="absolute text-[10px] font-mono font-semibold text-green-400">
        {timeLeft}
      </span>
    </div>

    {/* Кнопка обновления */}
    <Button
      onClick={async () => {
        await updateAllDevices()
        await loadDevices()
        setTimeLeft(10)
        toast.success('Обновлено')
      }}
      className="w-8 h-8 bg-zinc-900/90 hover:bg-zinc-800 border border-white/20 rounded-3xl flex items-center justify-center"
    >
      <RefreshCw className="w-8 h-8" />
    </Button>
  </div>

  {/* Кнопка списка устройств */}
  <Button
    onClick={() => setShowList(true)}
    className="w-8 h-15 bg-zinc-900/90 hover:bg-zinc-800 border border-white/20 rounded-3xl flex items-center justify-center"
  >
    <List className="w-7 h-7" />
  </Button>
</div>


      {/* Кнопки справа сверху */}
      <div className="absolute top-30 right-6 z-[1100] flex flex-col gap-3">
        <SettingsButton />
        <Button
          onClick={() => setShowNotifications(true)}
          className="relative w-12 h-12 bg-zinc-900/90 hover:bg-zinc-800 border border-white/20 rounded-3xl flex items-center justify-center"
        >
          <Bell className="w-7 h-7" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </Button>
      </div>

      {/* Диалог добавления устройства */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[92vw] md:max-w-md rounded-3xl z-[1200]">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-2xl">Новое устройство</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Добавьте GPS-трекер по IMEI
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 space-y-5 pb-6">
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">IMEI</label>
              <Input 
                value={imei} 
                onChange={e => setImei(e.target.value.trim())} 
                placeholder="123456789012345" 
                className="bg-zinc-950 border-white/20 h-12 text-base"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Название автомобиля</label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Например: Toyota Camry" 
                className="bg-zinc-950 border-white/20 h-12 text-base"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Пароль</label>
              <Input 
                value={devicePassword} 
                onChange={e => setDevicePassword(e.target.value)} 
                placeholder="Последние 6 цифр IMEI или свой пароль" 
                className="bg-zinc-950 border-white/20 h-12 text-base"
              />
            </div>
          </div>

          <div className="border-t border-white/10 p-6 pt-4">
            <Button 
              onClick={handleAdd} 
              disabled={!imei.trim()}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000]"
            >
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог списка устройств */}
<Dialog open={showList} onOpenChange={setShowList}>
  <DialogContent className="
    bg-zinc-900 border border-white/10 text-white 
    max-w-[92vw] md:max-w-lg 
    rounded-3xl z-[1200] 
    flex flex-col 
    max-h-[72vh] 
    overflow-hidden
  ">
    <DialogHeader>
      <DialogTitle className="text-xl md:text-2xl">Мои автомобили</DialogTitle>
      <DialogDescription className="text-zinc-400 text-sm md:text-base">
        Список всех подключённых GPS-трекеров
      </DialogDescription>
    </DialogHeader>

    <div className="flex-1 overflow-y-auto overscroll-contain mt-6 space-y-4 pr-1 md:pr-2">
      {devices.map(device => {
        const lat = Number(device.lat)
        const lng = Number(device.lng)
        const hasPos = !isNaN(lat) && !isNaN(lng)
        const address = addresses[`${lat.toFixed(5)},${lng.toFixed(5)}`] || 'Определяем адрес...'

        const minutesAgo = calculateMinutesAgo(device.last_updated)
        let statusText = 'Оффлайн'
        let statusColor = 'bg-red-500/20 text-red-400'

        if (minutesAgo < 10) {
          statusText = 'Онлайн'
          statusColor = 'bg-green-500/20 text-green-400'
        } else if (minutesAgo < 60) {
          statusText = `Был ${Math.floor(minutesAgo)} мин назад`
          statusColor = 'bg-yellow-500/20 text-yellow-400'
        }

        return (
          <div
            key={device.imei}
            onClick={() => handleDeviceClick(device)}
            className="
              bg-zinc-950 
              p-4 md:p-5 
              rounded-3xl 
              border border-white/10 
              hover:border-green-500/40 
              cursor-pointer 
              active:scale-[0.98] 
              transition-all
            "
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg md:text-xl truncate">
                  {device.name || 'Автомобиль'}
                </p>
                <p className="text-zinc-400 text-xs md:text-sm mt-0.5 break-all">
                  {device.imei}
                </p>
                {hasPos && (
                  <p className="text-zinc-500 text-xs mt-3 line-clamp-2 break-words">
                    {address}
                  </p>
                )}
              </div>

              <div className={`
                text-[10px] md:text-xs 
                px-3 md:px-4 
                h-6 md:h-7 
                rounded-3xl 
                flex items-center 
                font-medium 
                ${statusColor}
                whitespace-nowrap
              `}>
                {statusText}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[10px] md:text-xs">
              {device.voltage && (
                <div className="px-3 py-1 rounded-2xl bg-zinc-800 text-zinc-400">
                  🔋 {Number(device.voltage).toFixed(1)} V
                </div>
              )}
              <div className="px-3 py-1 rounded-2xl bg-zinc-800 text-zinc-400">
                 Состояние: {getSpeedText(device.speed)}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
  <Button 
    size="sm" 
    variant="outline" 
    className="flex-1 min-w-[120px] max-w-[45%] border-white/20 text-white hover:bg-white/10"
    onClick={e => { e.stopPropagation(); setEditingDevice(device); setNewName(device.name || '') }}
  >
    <Pencil className="w-4 h-4 mr-1.5" /> Изменить
  </Button>
  <Button 
    size="sm" 
    variant="outline" 
    className="flex-1 min-w-[120px] max-w-[45%] border-red-500/30 text-red-400 hover:bg-red-500/10"
    onClick={e => { e.stopPropagation(); deleteDevice(device.imei) }}
  >
    <Trash2 className="w-4 h-4 mr-1.5" /> Удалить
  </Button>
  {hasPos && (
    <Button 
      size="sm" 
      variant="outline" 
      className="flex-1 min-w-[120px] max-w-[45%] border-green-500/30 text-green-400 hover:bg-green-500/10"
      onClick={async (e) => { 
        e.stopPropagation(); 
        await loadHistory(device.imei); 
        setShowList(false) 
      }}
    >
      <Route className="w-4 h-4 mr-1.5" /> Трек
    </Button>
  )}
</div>
          </div>
        )
      })}

      {devices.length === 0 && (
        <div className="text-center text-zinc-500 py-12 text-sm md:text-base">
          Устройств пока нет
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>

      {/* Диалог уведомлений */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[82vw] md:max-w-lg rounded-3xl z-[1200] flex flex-col max-h-[72vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Уведомления
            </DialogTitle>
            <DialogDescription>Последние события трекеров в реальном времени</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-6 space-y-3 pr-2">
            {notifications.length === 0 ? (
              <div className="text-center text-zinc-500 py-12">Пока нет уведомлений</div>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className="bg-zinc-950 p-4 rounded-3xl flex gap-4 border border-white/10">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0
                    ${notif.type === 'success' ? 'bg-green-500/20 text-green-400' : ''}
                    ${notif.type === 'error' ? 'bg-red-500/20 text-red-400' : ''}
                    ${notif.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : ''}`}>
                    {notif.type === 'success' && '🟢'}
                    {notif.type === 'error' && '🔴'}
                    {notif.type === 'warning' && '⚠️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{notif.title}</p>
                    <p className="text-zinc-400 text-sm mt-0.5">{notif.message}</p>
                    <p className="text-xs text-zinc-500 mt-2">
                      {notif.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <Button variant="outline" className="w-full mt-4 border-white/20" onClick={() => setNotifications([])}>
              Очистить все
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования названия */}
      <Dialog open={!!editingDevice} onOpenChange={() => setEditingDevice(null)}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[92vw] md:max-w-md rounded-3xl z-[1200]">
          <DialogHeader>
            <DialogTitle>Изменить название</DialogTitle>
            <DialogDescription className="text-zinc-400">Измените отображаемое имя устройства</DialogDescription>
          </DialogHeader>
          <Input 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            className="bg-zinc-950 border-white/20 h-14 text-lg mt-4" 
          />
          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1 border-white/20" onClick={() => setEditingDevice(null)}>
              Отмена
            </Button>
            <Button className="flex-1 bg-green-500 hover:bg-green-400" onClick={updateDeviceName}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}