// app/actions.ts
'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// ====================== ЛОГИН ======================
async function loginWithDeviceCredentials(baseUrl: string, imei: string, password: string): Promise<string> {
  const url = `${baseUrl}/user/login.do?name=${encodeURIComponent(imei)}&password=${encodeURIComponent(password.trim())}`
  
  const res = await fetch(url, { 
    method: 'GET', 
    headers: { Accept: 'application/json' }, 
    cache: 'no-store' 
  })

  if (!res.ok) throw new Error(`Login HTTP ${res.status}`)

  const json = await res.json()
  
  if (json.ret !== 1) {
    throw new Error(json.msg || `Login error: ret = ${json.ret}`)
  }

  const token = json.data?.token || json.data?.[0]?.token
  if (!token) throw new Error('Token not received')

  return token
}

// ====================== ДОБАВЛЕНИЕ УСТРОЙСТВА ======================
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

  await fetchDevicePosition(cleanImei).catch(() => {})
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

    const res = await fetch(`${baseUrl}/car/getByImei.do?token=${encodeURIComponent(token)}&imei=${encodeURIComponent(imei)}`, { 
      cache: 'no-store' 
    })

    if (!res.ok) {
      console.error(`[FETCH ERROR] HTTP ${res.status} for IMEI ${imei}`)
      return
    }

    const json = await res.json()
    const car = json.data?.[0] || json.data?.carStatus || json.data || json

    if (!car?.lat || !car?.lon) {
      console.log(`[NO POSITION] for IMEI ${imei}`)
      return
    }

    // === ПАРСИНГ НАПРЯЖЕНИЯ ИЗ exData ===
    let voltage: number | null = null
    if (car.exData) {
      const match = car.exData.match(/v=(\d+)/)
      if (match && match[1]) {
        const mv = parseInt(match[1], 10)
        voltage = mv / 1000 // переводим из mV в V (например 13000 → 13.0)
        console.log(`[VOLTAGE PARSED] ${imei} → ${voltage}V (raw: ${mv}mV from exData)`)
      }
    }

    const speed = car.speed !== undefined ? parseFloat(car.speed) : null
    const gpsTime = car.gpstime || car.time || car.updatetime || car.lasttime || null

    const updateData = {
      lat: parseFloat(car.lat),
      lng: parseFloat(car.lon),
      speed: speed,
      voltage: voltage,
      last_updated: new Date().toISOString(),
      gps_time: gpsTime,
    }

    console.log(`[UPDATING DB] ${imei} → voltage=${voltage}V, speed=${speed}`)

    const { error } = await supabase
      .from('devices')
      .update(updateData)
      .eq('imei', imei)

    if (error) {
      console.error(`[DB UPDATE ERROR] ${imei}:`, error)
    } else {
      console.log(`[SUCCESS] Position updated for ${imei}`)
    }

  } catch (err) {
    console.error(`[POSITION ERROR] ${imei}:`, err)
  }
}

// ====================== ИСТОРИЯ ТРЕКА ЗА СЕГОДНЯ ======================
export async function fetchTodayHistory(imei: string) {
  try {
    console.log(`[HISTORY START] IMEI: ${imei}`)

    const { data: device } = await supabase.from('devices').select('password, base_url').eq('imei', imei).single()
    if (!device?.password) {
      throw new Error('Пароль устройства не найден')
    }

    const baseUrl = device.base_url || 'https://www.whatsgps.com'
    const token = await loginWithDeviceCredentials(baseUrl, imei, device.password)

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const formatTime = (date: Date) => date.toISOString().replace('T', ' ').slice(0, 19)

    const startTime = formatTime(yesterday)
    const endTime = formatTime(now)

    const url = `${baseUrl}/position/queryHistory.do?token=${encodeURIComponent(token)}&imei=${encodeURIComponent(imei)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&mapType=2`

    const res = await fetch(url, { 
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const json = await res.json()
    console.log(`[HISTORY RESPONSE] ret=${json.ret}, data items=${json.data?.length || 0}`)

    if (json.ret !== 1) {
      const msg = json.msg || '';
      
      if (msg.includes('车辆不存在') || msg.includes('vehicle not exist') || msg.includes('not exist')) {
        throw new Error('На данный момент нельзя отследить трек, функция находится в разработке.');
      }
      
      throw new Error(msg || `API error ret=${json.ret}`)
    }

    const points = (json.data || [])
      .map((p: any) => ({
        lat: parseFloat(p.lat || p.latitude || '0'),
        lng: parseFloat(p.lng || p.longitude || '0'),
      }))
      .filter((p: { lat: number; lng: number }) =>
        !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0
      )

    console.log(`[HISTORY SUCCESS] ${points.length} точек`)
    return points

  } catch (err: any) {
    console.error(`[HISTORY ERROR] ${imei}:`, err.message)
    throw new Error(err.message || 'Не удалось загрузить историю трека')
  }
}