// components/SettingsButton.tsx
'use client'

import { useState, useEffect } from 'react'
import { Settings, Globe, ChevronRight } from 'lucide-react'
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

  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage') || 'ru'
    setCurrentLang(savedLang)
  }, [])

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

      {/* === МОДАЛЬНОЕ ОКНО НАСТРОЕК === */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white max-w-[92vw] md:max-w-md rounded-3xl z-[1300]">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-3">
              <Settings className="w-6 h-6" />
              Настройки
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Управление приложением
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-3">
            {/* Пункт выбора языка */}
            <button
              onClick={() => {
                setSettingsOpen(false)
                setTimeout(() => setLanguageOpen(true), 300)
              }}
              className="w-full flex items-center justify-between px-6 py-5 bg-zinc-950 hover:bg-zinc-800 border border-white/10 rounded-3xl transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <Globe className="w-6 h-6 text-green-400" />
                <div className="text-left">
                  <p className="font-medium text-lg">Язык интерфейса</p>
                  <p className="text-sm text-zinc-500">Текущий: {languages.find(l => l.code === currentLang)?.name}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          <Button 
            variant="outline" 
            className="w-full border-white/20"
            onClick={() => setSettingsOpen(false)}
          >
            Закрыть
          </Button>
        </DialogContent>
      </Dialog>

      {/* === МОДАЛЬНОЕ ОКНО ВЫБОРА ЯЗЫКА (меньшее) === */}
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