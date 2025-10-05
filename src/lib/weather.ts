// src/lib/weather.ts
import { supabase } from './supabase';

// ── Tipos mínimos para evitar "any" molestos ─────────────────────────────────
type GeoHit = {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  population?: number;
};

type WeatherResponse = {
  current: {
    temperature_2m: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    relative_humidity_2m?: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    wind_speed_10m_max?: number[];
  };
};

// ── Geocodificación determinista ────────────────────────────────────────────
export async function geocodeCity(city: string, region: string, countryCode: string) {
  const q = encodeURIComponent(`${city} ${region}`.trim());
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=5&language=es&format=json&country=${countryCode}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding error: ${res.status} ${res.statusText}`);

  const json = await res.json();
  if (!json?.results?.length) throw new Error('No se encontró la ubicación');

  const hits: GeoHit[] = json.results;
  const best =
    hits
      .filter(h => (h.country_code || '').toUpperCase() === countryCode.toUpperCase())
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0] || hits[0];

  const lat = Number(best.latitude.toFixed(3));   // ~1 km
  const lon = Number(best.longitude.toFixed(3));

  return { lat, lon, name: best.name, admin1: best.admin1, admin2: best.admin2, country_code: best.country_code };
}

// ── Llamada a Open-Meteo (CORS ok, sin API key) ─────────────────────────────
export async function getWeather(lat: number, lon: number): Promise<WeatherResponse> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    language: 'es',
    current: [
      'temperature_2m','apparent_temperature','precipitation',
      'weather_code','wind_speed_10m','relative_humidity_2m'
    ].join(','),
    daily: [
      'weather_code','temperature_2m_max','temperature_2m_min',
      'precipitation_sum','wind_speed_10m_max'
    ].join(','),
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo obtener el clima: ${res.status} ${res.statusText}`);

  const data = await res.json();
  return data as WeatherResponse;
}

// ── Cache por 15 min en Supabase ────────────────────────────────────────────
export async function getCachedWeather(city: string, region: string, country: string): Promise<WeatherResponse> {
  const key = `${country}|${city}|${region}`;

  const { data: cached, error: cacheErr } = await supabase
    .from('weather_cache')
    .select('payload, created_at')
    .eq('key', key)
    .maybeSingle();

  if (cacheErr) {
    console.warn('weather_cache SELECT error:', cacheErr);
  }

  const fresh = cached && (Date.now() - new Date(cached.created_at as string).getTime()) < 15 * 60 * 1000;
  if (fresh && cached?.payload) {
    return cached.payload as WeatherResponse;
  }

  const geo = await geocodeCity(city, region, country);
  const payload = await getWeather(geo.lat, geo.lon);

  const { error: upsertErr } = await supabase
    .from('weather_cache')
    .upsert({ key, payload });
  if (upsertErr) {
    console.warn('weather_cache UPSERT error:', upsertErr);
  }

  return payload;
}

// ── Texto corto estilo “Google” ─────────────────────────────────────────────
export function formatWeatherMessage(city: string, region: string, w: WeatherResponse) {
  const now = w.current;
  const d = w.daily;
  return `Clima en ${city}, ${region} (aprox): ` +
    `${Math.round(now.temperature_2m)}°C, ` +
    `máx ${Math.round(d.temperature_2m_max[0])}°C / ` +
    `mín ${Math.round(d.temperature_2m_min[0])}°C, ` +
    `precipitación hoy ${Math.round(d.precipitation_sum[0])} mm.`;
}
