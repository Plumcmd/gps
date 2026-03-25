'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

const TrackerMap = dynamic(() => import('@/components/Map'), { ssr: false })

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Car, Navigation, List, RefreshCw, Pencil, Trash2, Route } from 'lucide-react'

import { addDevice, updateAllDevices, fetchTodayHistory } from './actions'
import { supabase } from '@/lib/supabase'
import { Device } from "@/types/device"
import { toast } from 'sonner'

export default function Home() {
  const [showAdd, setShowAdd] = useState(false)
  const [showList, setShowList] = useState(false)

  const [imei, setImei] = useState('')
  const [name, setName] = useState('')
  const [devicePassword, setDevicePassword] = useState('')

  const [devices, setDevices] = useState<Device[]>([])
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [newName, setNewName] = useState('')

  const mapRef = useRef<any>(null)

  // Получение адреса
  const getAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      const data = await res.json()
      return data.display_name?.split(', ').slice(0, 3).join(', ') || 'Адрес не найден'
    } catch {
      return 'Не удалось определить адрес'
    }
  }

  const loadDevices = async () => {
    const { data } = await supabase.from('devices').select('*')
    const devList = data || []
    setDevices(devList)

    devList.forEach(async (d: Device) => {
      if (d.lat && d.lng) {
        const addr = await getAddress(Number(d.lat), Number(d.lng))
        setAddresses(prev => ({ ...prev, [d.imei]: addr }))
      }
    })
  }

  useEffect(() => {
    loadDevices()

    const interval = setInterval(async () => {
      await updateAllDevices()
      await loadDevices()
    }, 25000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('devices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => loadDevices())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  const handleAdd = async () => {
    try {
      await addDevice(imei, name, devicePassword)
      toast.success('✅ Устройство добавлено')
      setShowAdd(false)
      setImei(''); setName(''); setDevicePassword('')
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

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative pb-safe">
      {/* КАРТА НА ВЕСЬ ЭКРАН */}
      <div className="absolute inset-0">
        <TrackerMap ref={mapRef} />
      </div>

      {/* ТОП БАР — компактный для телефона */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-2xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-2xl flex items-center justify-center">
            <Car className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter">GPS Трекер</h1>
        </div>
      </div>

      {/* ПЛАВАЮЩИЕ КНОПКИ — не вылазят */}
      <div className="absolute bottom-6 left-4 z-[1000]">
        <Button
          onClick={() => setShowAdd(true)}
          className="w-16 h-16 bg-green-500 hover:bg-green-400 shadow-2xl shadow-green-500/50 rounded-3xl text-black text-4xl flex items-center justify-center active:scale-95 transition-all"
        >
          <Plus className="w-9 h-9" />
        </Button>
      </div>

      <div className="absolute bottom-25 right-5 z-[1000] flex flex-col gap-3">
        <Button
          onClick={async () => {
            await updateAllDevices()
            toast.success('Обновлено')
          }}
          className="w-12 h-12 bg-zinc-900/90 hover:bg-zinc-800 border border-white/20 rounded-3xl flex items-center justify-center"
        >
          <RefreshCw className="w-7 h-7" />
        </Button>

        <Button
          onClick={() => setShowList(true)}
          className="w-12 h-12 bg-zinc-900/90 hover:bg-zinc-800 border border-white/20 rounded-3xl flex items-center justify-center"
        >
          <List className="w-7 h-7" />
        </Button>
      </div>

      {/* ДИАЛОГ ДОБАВЛЕНИЯ — строго по центру */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white mx-auto max-w-[92vw] md:max-w-md rounded-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Новое устройство</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-6 px-2">
            <div>
              <label className="text-sm text-zinc-400">IMEI</label>
              <Input value={imei} onChange={e => setImei(e.target.value.trim())} placeholder="123456789012345" className="bg-zinc-950 border-white/20 h-14 text-lg" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Название автомобиля</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Toyota Camry" className="bg-zinc-950 border-white/20 h-14 text-lg" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Пароль устройства</label>
              <Input value={devicePassword} onChange={e => setDevicePassword(e.target.value)} placeholder="Последние 6 цифр IMEI" className="bg-zinc-950 border-white/20 h-14 text-lg" />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={!imei.trim()} className="w-full h-14 text-xl bg-green-500 hover:bg-green-400 rounded-3xl">
            Добавить на карту
          </Button>
        </DialogContent>
      </Dialog>

      {/* СПИСОК УСТРОЙСТВ — по центру */}
      <Dialog open={showList} onOpenChange={setShowList}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white mx-auto max-w-[92vw] md:max-w-lg rounded-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Мои автомобили</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-2">
            {devices.map(device => {
              const lat = Number(device.lat)
              const lng = Number(device.lng)
              const hasPos = !isNaN(lat) && !isNaN(lng)
              const address = addresses[device.imei] || 'Определяем адрес...'

              const minutesAgo = device.last_updated ? (Date.now() - new Date(device.last_updated).getTime()) / 1000 / 60 : 999
              const isOnline = minutesAgo < 7

              return (
                <div
                  key={device.imei}
                  onClick={() => handleDeviceClick(device)}
                  className="bg-zinc-950 p-5 rounded-3xl border border-white/10 hover:border-green-500/40 cursor-pointer active:scale-[0.98] transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-xl">{device.name || 'Автомобиль'}</p>
                      <p className="text-zinc-400 text-sm mt-0.5">{device.imei}</p>
                      {hasPos && <p className="text-zinc-500 text-xs mt-3 line-clamp-2">{address}</p>}
                    </div>
                    <div className={`text-xs px-4 h-7 rounded-3xl flex items-center font-medium ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {isOnline ? 'Онлайн' : 'Оффлайн'}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-5">
                    <Button size="sm" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={e => { e.stopPropagation(); setEditingDevice(device); setNewName(device.name || '') }}>
                      <Pencil className="w-4 h-4 mr-2" /> 
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={e => { e.stopPropagation(); deleteDevice(device.imei) }}>
                      <Trash2 className="w-4 h-4 mr-2" /> 
                    </Button>
                    {hasPos && (
                      <Button size="sm" variant="outline" className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={async (e) => { e.stopPropagation(); await loadHistory(device.imei); setShowList(false) }}>
                        <Route className="w-4 h-4 mr-2" /> 
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}

            {devices.length === 0 && <div className="text-center text-zinc-500 py-12">Устройств пока нет</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования */}
      <Dialog open={!!editingDevice} onOpenChange={() => setEditingDevice(null)}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white mx-auto max-w-[92vw] md:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Изменить название</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} className="bg-zinc-950 border-white/20 h-14 text-lg" />
          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1" onClick={() => setEditingDevice(null)}>Отмена</Button>
            <Button className="flex-1 bg-green-500 hover:bg-green-400" onClick={updateDeviceName}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}