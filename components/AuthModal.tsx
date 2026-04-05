'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { 
  LocateFixed, 
  Mail, 
  KeyRound, 
  Loader2, 
  Target, 
  Plus, 
  LogIn, 
  Battery 
} from "lucide-react"
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Device } from "@/types/device"

// Фикс иконок Leaflet
if (typeof window !== 'undefined') {
  delete (L as any).Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' })
}

const defaultCenter: [number, number] = [53.42894, 14.55302]

export default function TrackerWithAuth() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Проверка сессии при загрузке
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="h-screen w-full bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
    </div>
  )

  return (
    <div className="h-screen w-full relative bg-black overflow-hidden">
      {/* КАРТА ВСЕГДА ТУТ */}
      <div className={`absolute inset-0 transition-all duration-1000 ${!session ? 'blur-lg scale-105 opacity-60' : 'blur-0 scale-100 opacity-100'}`}>
        <TrackerMap />
      </div>

      {/* ФОРМА АВТОРИЗАЦИИ ПОВЕРХ КАРТЫ */}
      <AnimatePresence>
        {!session && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <AuthForm />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ====================== КОМПОНЕНТ ФОРМЫ ======================
function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAuth = async () => {
    if (!email || !password) return toast.error('Заполните все поля')
    setLoading(true)
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Аккаунт создан')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('Связь установлена')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ y: 20 }}
      animate={{ y: 0 }}
      className="max-w-[800px] w-full grid grid-cols-1 md:grid-cols-[0.8fr,1.2fr] min-h-[500px] rounded-[32px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
    >
      {/* ЛЕВАЯ ПАНЕЛЬ (DARK) */}
      <div className="bg-zinc-950/90 backdrop-blur-md text-white p-8 flex flex-col justify-between border-r border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <Target className="w-6 h-6 text-green-500 animate-pulse" />
            <span className="text-xl font-black tracking-tighter italic">GPS<span className="text-zinc-600">HORIZON</span></span>
          </div>
          <h1 className="text-4xl font-black leading-none uppercase italic">
            {isRegister ? 'Новый\nТерминал' : 'Вход в\nСистему'}
          </h1>
          <div className="h-1 w-12 bg-green-500 mt-4" />
        </div>
        <div className="font-mono text-[10px] text-zinc-500 space-y-1 uppercase">
          <p className="flex justify-between"><span>Статус:</span> <span className="text-green-500">Ожидание</span></p>
          <p className="flex justify-between"><span>Шифрование:</span> <span>AES-256</span></p>
        </div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ (LIGHT) */}
      <div className="bg-white/95 backdrop-blur-md p-10 md:p-12 flex flex-col justify-center">
        <div className="w-full max-w-sm mx-auto space-y-6">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-black uppercase">{isRegister ? 'Регистрация' : 'Авторизация'}</h2>
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-1">SATELLITE ACCESS PROTOCOL</p>
          </div>

          <div className="space-y-3">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black z-10" />
              <Input
                placeholder="Email терминала"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 pl-12 bg-zinc-100 border-none rounded-2xl text-black font-bold focus:ring-2 focus:ring-black/5"
              />
            </div>
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black z-10" />
              <Input
                type="password"
                placeholder="Код доступа"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 pl-12 bg-zinc-100 border-none rounded-2xl text-black font-bold focus:ring-2 focus:ring-black/5"
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <Button
              onClick={handleAuth}
              disabled={loading}
              className="w-full h-14 bg-black text-white rounded-2xl font-bold tracking-widest hover:bg-zinc-800 shadow-xl transition-all flex gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  {isRegister ? <Plus size={18} /> : <LogIn size={18} />}
                  <span className="mt-0.5 uppercase">{isRegister ? 'Создать' : 'Установить связь'}</span>
                </>
              )}
            </Button>
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-black transition-colors"
            >
              {isRegister ? 'Уже есть доступ?' : 'Запросить новый терминал'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ====================== КОМПОНЕНТ КАРТЫ ======================
const TrackerMap = () => {
  const [devices, setDevices] = useState<Device[]>([])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('devices').select('*')
      setDevices(data || [])
    }
    load()
    const sub = supabase.channel('map-live').on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, load).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={false}
      ref={mapRef}
    >
      <TileLayer
        url={theme === 'dark' 
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
      />
      {/* Рендер маркеров аналогично твоему коду... */}
    </MapContainer>
  )
}