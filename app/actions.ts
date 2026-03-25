'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// ====================== ЛОГИН ======================
async function loginWithDeviceCredentials(baseUrl: string, imei: string, password: string): Promise<string> {
  const url = `${baseUrl}/user/login.do?name=${encodeURIComponent(imei)}&password=${encodeURIComponent(password.trim())}`
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.ret !== 1) throw new Error(json.msg || `ret = ${json.ret}`)

  const token = json.data?.token || json.data?.[0]?.token
  if (!token) throw new Error('Токен не получен')
  return token
}

// ====================== ДОБАВЛЕНИЕ ======================
export async function addDevice(imei: string, name: string, password: string) {
  const cleanImei = imei.trim()
  if (!cleanImei || cleanImei.length < 10) throw new Error('Некорректный IMEI')

  const cleanName = name.trim() || 'Без названия'
  const finalPassword = password.trim() || cleanImei.slice(-6)

  await supabase.from('devices').upsert({
    imei: cleanImei,
    name: cleanName,
    password: finalPassword,
    base_url: 'https://www.whatsgps.com',
  }, { onConflict: 'imei' })

  await fetchDevicePosition(cleanImei)
  revalidatePath('/')
}

// ====================== ОБНОВЛЕНИЕ ВСЕХ ======================
export async function updateAllDevices() {
  const { data: devices } = await supabase.from('devices').select('imei, password, base_url')
  if (!devices?.length) return

  for (const dev of devices) {
    if (dev.password) {
      await fetchDevicePosition(dev.imei).catch(() => {})
    }
  }
  revalidatePath('/')
}

// ====================== ТЕКУЩАЯ ПОЗИЦИЯ ======================
export async function fetchDevicePosition(imei: string) {
  try {
    const { data: device } = await supabase.from('devices').select('password, base_url').eq('imei', imei).single()
    if (!device?.password) return

    const baseUrl = device.base_url || 'https://www.whatsgps.com'
    const token = await loginWithDeviceCredentials(baseUrl, imei, device.password)

    const res = await fetch(`${baseUrl}/car/getByImei.do?token=${encodeURIComponent(token)}&imei=${encodeURIComponent(imei)}`, { cache: 'no-store' })
    const json = await res.json()
    const car = json.data?.[0] || json.data?.carStatus || json.data

    if (!car?.lat || !car?.lon) return

    await supabase.from('devices').update({
      lat: parseFloat(car.lat),
      lng: parseFloat(car.lon),
      speed: car.speed ? parseFloat(car.speed) : null,
      last_updated: new Date().toISOString(),
    }).eq('imei', imei)
  } catch (err) {
    console.error(`[POSITION] ${imei}:`, err)
  }
}

// ====================== ИСТОРИЯ ТРЕКА ЗА СЕГОДНЯ ======================
export async function fetchTodayHistory(imei: string) {
  try {
    const { data: device } = await supabase.from('devices').select('password, base_url').eq('imei', imei).single()
    if (!device?.password) throw new Error('Пароль устройства не найден')

    const baseUrl = device.base_url || 'https://www.whatsgps.com'
    const token = await loginWithDeviceCredentials(baseUrl, imei, device.password)

    const now = new Date()
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)

    const endTime = now.toISOString().replace('T', ' ').slice(0, 19)

    const url = `${baseUrl}/position/queryHistory.do?token=${encodeURIComponent(token)}&imei=${encodeURIComponent(imei)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&mapType=2`

    const res = await fetch(url, { cache: 'no-store' })
    const json = await res.json()

    if (json.ret !== 1) throw new Error(json.msg || 'Ошибка запроса истории')

    const points = (json.data || [])
      .map((p: any) => ({
        lat: parseFloat(p.lat || p.latitude || '0'),
        lng: parseFloat(p.lng || p.longitude || '0'),
      }))
      .filter((p): p is { lat: number; lng: number } => 
        !isNaN(p.lat) && !isNaN(p.lng)
      )

    return points
  } catch (err: any) {
    console.error('[HISTORY]', err.message)
    throw new Error('Не удалось загрузить историю трека')
  }
}