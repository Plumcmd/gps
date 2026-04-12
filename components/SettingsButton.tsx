// components/SettingsButton.tsx
'use client'

import { useState, useEffect } from 'react'
import { Settings, Globe, ChevronRight, LogOut, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const languages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
]

export default function SettingsButton() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState('ru')
  const [user, setUser] = useState<any>(null)        // ← добавили состояние

  // Получаем текущего пользователя из Supabase
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    // Подписываемся на изменения авторизации
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Загрузка сохранённого языка
  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage') || 'ru'
    setCurrentLang(savedLang)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSettingsOpen(false)
  }

  const changeLanguage = (langCode: string) => {
    localStorage.setItem('appLanguage', langCode)
    setCurrentLang(langCode)
    setLanguageOpen(false)
    setSettingsOpen(false)

    setTimeout(() => {
      window.location.reload()
    }, 200)
  }

  return (
    <>
      {/* Кнопка настроек */}
      <Button
        onClick={() => setSettingsOpen(true)}
        className="w-12 h-12 bg-zinc-900/90 hover:bg-zinc-800 border border-white/20 rounded-3xl flex items-center justify-center transition-all active:scale-95 shadow-lg"
        title="Настройки"
      >
        <Settings className="w-7 h-7" />
      </Button>

{/* === МОДАЛЬНОЕ ОКНО НАСТРОЕК (уменьшенное) === */}
<Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
  <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[340px] md:max-w-[360px] rounded-3xl z-[1300] overflow-hidden p-0">
    
    {/* Заголовок */}
    <div className="px-6 pt-6 pb-4 border-b border-white/10">
      <DialogTitle className="text-xl flex items-center gap-3">
        <Settings className="w-5 h-5 text-green-400" />
        Настройки
      </DialogTitle>
    </div>

    <div className="p-6 space-y-5">
      {/* Блок учётной записи — компактный */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          {/* Аватар */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-white" />
          </div>

          {/* Информация */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate text-base">
              {user?.user_metadata?.full_name || 
               user?.email?.split('@')[0] || 
               'Пользователь'}
            </p>
            <p className="text-zinc-400 text-sm truncate">
              {user?.email || 'Не авторизован'}
            </p>
          </div>
        </div>
      </div>

      {/* Выбор языка */}
      <button
        onClick={() => {
          setSettingsOpen(false)
          setTimeout(() => setLanguageOpen(true), 200)
        }}
        className="w-full flex items-center justify-between px-5 py-4 bg-zinc-950 hover:bg-zinc-800 border border-white/10 rounded-2xl transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-green-400" />
          <div>
            <p className="font-medium">Язык интерфейса</p>
            <p className="text-xs text-zinc-500">
              {languages.find(l => l.code === currentLang)?.name}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-500" />
      </button>

      {/* Кнопка выхода */}
      <Button 
        onClick={signOut}
        variant="destructive" 
        className="w-full h-12 text-sm font-medium rounded-2xl gap-2"
      >
        <LogOut className="w-4 h-4" />
        Выйти из аккаунта
      </Button>
    </div>

    {/* Кнопка закрытия */}
    <div className="px-6 pb-6">
      <Button 
        variant="outline" 
        className="w-full border-white/20 hover:bg-white/5 h-10 text-sm"
        onClick={() => setSettingsOpen(false)}
      >
        Закрыть
      </Button>
    </div>
  </DialogContent>
</Dialog>

      {/* === МОДАЛЬНОЕ ОКНО ВЫБОРА ЯЗЫКА === */}
      <Dialog open={languageOpen} onOpenChange={setLanguageOpen}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[90vw] md:max-w-sm rounded-3xl z-[1400]">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl flex items-center gap-3">
              <Globe className="w-5 h-5" />
              Язык интерфейса
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Выберите предпочтительный язык
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all active:scale-[0.97]
                  ${lang.code === currentLang 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{lang.flag}</span>
                  <span className="text-base font-medium">{lang.name}</span>
                </div>

                {lang.code === currentLang && (
                  <span className="text-green-500 text-2xl">✓</span>
                )}
              </button>
            ))}
          </div>

          <Button 
            variant="outline" 
            className="w-full mt-4 border-white/20 text-zinc-400"
            onClick={() => setLanguageOpen(false)}
          >
            Назад
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}