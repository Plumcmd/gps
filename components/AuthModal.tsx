'use client'

import { useRef, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, Target, Mail, KeyRound, Plus, LogIn } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TrackerMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-green-500" />
    </div>
  ),
})

const translations: any = {
  ru: {
    title: 'GPS HORIZON',
    login: 'Вход в систему ',
    register: 'Новый терминал',
    email: 'Email',
    password: 'Пароль',
    submitLogin: 'Подключиться',
    submitRegister: 'Создать аккаунт',
    switchToRegister: 'Создать новый терминал',
    switchToLogin: 'Уже есть доступ?',
    error: 'Неверный email или пароль',
    remember: 'Запомнить меня'
  },
  ua: {
    title: 'GPS HORIZON',
    login: 'Вхід у систему',
    register: 'Новий термінал',
    email: 'Email',
    password: 'Пароль',
    submitLogin: 'Підключитися',
    submitRegister: 'Створити акаунт',
    switchToRegister: 'Створити новий термінал',
    switchToLogin: 'Вже є доступ?',
    error: 'Невірний email або пароль',
    remember: "Запам'ятати мене"
  },
  en: {
    title: 'GPS HORIZON',
    login: 'Sign In',
    register: 'New Terminal',
    email: 'Email',
    password: 'Password',
    submitLogin: 'Connect',
    submitRegister: 'Create Account',
    switchToRegister: 'Create new terminal',
    switchToLogin: 'Already have access?',
    error: 'Invalid email or password',
    remember: 'Remember me'
  },
  pl: {
    title: 'GPS HORIZON',
    login: 'Logowanie',
    register: 'Nowy terminal',
    email: 'Email',
    password: 'Hasło',
    submitLogin: 'Połącz',
    submitRegister: 'Utwórz konto',
    switchToRegister: 'Utwórz nowy terminal',
    switchToLogin: 'Masz już dostęp?',
    error: 'Nieprawidłowy email lub hasło',
    remember: 'Zapamiętaj mnie'
  },
  de: {
    title: 'GPS HORIZON',
    login: 'Anmelden',
    register: 'Neues Terminal',
    email: 'Email',
    password: 'Passwort',
    submitLogin: 'Verbinden',
    submitRegister: 'Konto erstellen',
    switchToRegister: 'Neues Terminal erstellen',
    switchToLogin: 'Bereits Zugang?',
    error: 'Ungültige E-Mail oder Passwort',
    remember: 'Merken'
  }
}

export default function AuthModal() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(true)
  const [lang, setLang] = useState('ru')

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') || 'ru'
    const savedEmail = localStorage.getItem('rememberEmail')
    setLang(savedLang)
    if (savedEmail) setEmail(savedEmail)
  }, [])

  const t = translations[lang]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Заполните все поля')
      return
    }

    setLoading(true)
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Аккаунт создан! Проверьте почту.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('Вход выполнен')
        if (remember) localStorage.setItem('rememberEmail', email)
      }
    } catch (err: any) {
      setError(t.error)
    } finally {
      setLoading(false)
    }
  }

  const changeLang = (l: string) => {
    setLang(l)
    localStorage.setItem('lang', l)
  }

  return (
    <div className="h-screen w-full relative bg-black overflow-hidden">
      
      {/* Фоновая карта с мощным блюром */}
      <div className="absolute inset-0 scale-110 blur-[8px] opacity-75">
        <TrackerMap />
      </div>

      {/* Основной контент */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/90 backdrop-blur-2xl flex items-center justify-center p-4">

        <div className="w-full max-w-[380px] md:max-w-[820px] grid grid-cols-1 md:grid-cols-[1fr,1.15fr] rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-3xl shadow-2xl">

          {/* Левая панель (только на больших экранах) */}
          <div className="hidden md:flex flex-col justify-between p-8 lg:p-10 bg-gradient-to-b from-zinc-900/90 to-black/90 text-white border-r border-white/10">
            <div>
              <div className="flex items-center gap-3 mb-12">
                <div className="p-3 rounded-2xl bg-green-500/10 border border-green-500/30">
                  <Target className="w-8 h-8 text-green-400" />
                </div>
                <span className="text-3xl font-black tracking-tighter">GPS HORIZON</span>
              </div>
              <h1 className="text-5xl font-black leading-none tracking-tighter">
                {isRegister ? t.register : t.login}
              </h1>
              <p className="mt-6 text-zinc-400 text-lg">
                Спутниковое слежение<br />в реальном времени
              </p>
            </div>

            <div className="text-xs font-mono uppercase tracking-widest text-green-400/80">
              AES-256 • Реал-тайм • Защищено
            </div>
          </div>

          {/* Правая панель — форма */}
          <div className="p-6 sm:p-8 md:p-10 bg-white/95 flex flex-col">

<div className="flex justify-center mb-6">
  <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/70 backdrop-blur border border-zinc-200 shadow-sm">
    
    {[
      { code: 'ru', label: 'RU', flag: '🇷🇺' },
      { code: 'ua', label: 'UA', flag: '🇺🇦' },
      { code: 'en', label: 'EN', flag: '🇬🇧' },
      { code: 'pl', label: 'PL', flag: '🇵🇱' },
      { code: 'de', label: 'DE', flag: '🇩🇪' }
    ].map(({ code, label, flag }) => (
      <button
        key={code}
        onClick={() => changeLang(code)}
        className={`
          relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
          transition-all duration-200
          ${lang === code 
            ? 'bg-black text-white shadow-md scale-105' 
            : 'text-zinc-600 hover:text-black hover:bg-white'
          }
        `}
      >
        <span className="text-sm">{flag}</span>
        <span>{label}</span>

        {/* активный индикатор */}
        {lang === code && (
          <span className="absolute inset-0 rounded-xl ring-2 ring-black/10" />
        )}
      </button>
    ))}

  </div>
</div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-5">

              <div className="text-center md:text-left">
                <h2 className="text-3xl font-black text-black">
                  {isRegister ? t.register : t.login}
                </h2>
              </div>

              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 pl-12 rounded-2xl bg-white border border-zinc-200 text-black placeholder:text-zinc-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/10"
                  required
                />
              </div>

              {/* Password */}
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder={t.password}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 pl-12 rounded-2xl bg-white border border-zinc-200 text-black placeholder:text-zinc-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/10"
                  required
                />
              </div>

              {error && <div className="text-red-500 text-sm text-center">{error}</div>}

              {/* Remember me */}
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-green-500"
                />
                {t.remember}
              </label>

              {/* Кнопка */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-black hover:bg-zinc-900 text-white font-semibold text-lg shadow-xl transition-all active:scale-95"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-6 h-6" />
                ) : (
                  <>
                    {isRegister ? <Plus size={22} /> : <LogIn size={22} />}
                    <span className="ml-3">
                      {isRegister ? t.submitRegister : t.submitLogin}
                    </span>
                  </>
                )}
              </Button>

              {/* Переключение режимов */}
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-zinc-500 hover:text-black font-medium transition-colors"
              >
                {isRegister ? t.switchToLogin : t.switchToRegister}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}