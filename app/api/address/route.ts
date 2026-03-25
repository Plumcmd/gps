// app/api/address/route.ts
import { NextRequest } from 'next/server';

const cache = new Map<string, { address: string; timestamp: number }>();
const CACHE_TTL = 60000; // 60 секунд

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return Response.json({ address: 'Координаты не переданы' }, { status: 400 });
  }

  const cacheKey = `${parseFloat(lat).toFixed(5)},${parseFloat(lon).toFixed(5)}`;
  const now = Date.now();

  // Возвращаем из кэша
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return Response.json({ address: cached.address });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'GPS-Tracker-App/1.0[](https://github.com/Plumcmd/gps)',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    });

    if (res.status === 429) {
      return Response.json({ 
        address: cached ? cached.address : 'Слишком много запросов. Подождите минуту...' 
      });
    }

    if (!res.ok) {
      return Response.json({ address: 'Адрес не определён' });
    }

    const data = await res.json();

    if (!data?.display_name) {
      return Response.json({ address: 'Адрес не найден' });
    }

    const shortAddress = data.display_name.split(', ').slice(0, 4).join(', ');

    cache.set(cacheKey, { address: shortAddress, timestamp: now });

    return Response.json({ address: shortAddress });

  } catch (err) {
    console.error('Nominatim proxy error:', err);
    return Response.json({ 
      address: cached ? cached.address : 'Не удалось определить адрес' 
    });
  }
}