// src/lib/recommendations.ts
import { supabase } from './supabase';
import type { CropType, Recommendation } from './supabase';
import { getCachedWeather, formatWeatherMessage } from './weather';

// 1) getCropTypes debe devolver CropType[] (con created_at, etc.)
export async function getCropTypes(): Promise<CropType[]> {
  const { data, error } = await supabase
    .from('crop_types')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CropType[];
}

// 2) Simulación: tipos explícitos
type SatelliteData = {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  precipitation?: number | null;
};

export async function simulateSatelliteData(lat: number, lon: number): Promise<SatelliteData> {
  const seed = Math.abs(Math.sin(lat * 37.7 + lon * 17.3));
  const rand = (min: number, max: number, k: number) => min + (max - min) * ((seed + k) % 1);

  return {
    temperature: Number(rand(14, 30, 0.13).toFixed(1)),
    humidity: Number(rand(40, 85, 0.29).toFixed(1)),
    soilMoisture: Number(rand(25, 75, 0.47).toFixed(1)),
    precipitation: Number(rand(0, 15, 0.61).toFixed(1)),
  };
}

// 3) Factibilidad: recibe CropType real
export function calculateFeasibility(crop: CropType, sat: SatelliteData) {
  const minT = crop.optimal_conditions?.min_temp ?? 15;
  const maxT = crop.optimal_conditions?.max_temp ?? 30;
  const idealSoil = crop.optimal_conditions?.ideal_moisture ?? 50;

  let score = 100;
  if (sat.temperature < minT || sat.temperature > maxT) score -= 30;
  if (Math.abs(sat.soilMoisture - idealSoil) > 20) score -= 20;
  if (sat.humidity < 35 || sat.humidity > 90) score -= 15;
  if ((sat.precipitation ?? 0) > 20) score -= 10;
  if (score < 0) score = 0;

  let level: 'green' | 'yellow' | 'red' = 'green';
  if (score < 70) level = 'yellow';
  if (score < 40) level = 'red';

  const text =
    `Condiciones actuales: ${sat.temperature}°C, ` +
    `humedad ${sat.humidity}%, suelo ${sat.soilMoisture}%. ` +
    `Rango óptimo para ${crop.name}: ${minT}–${maxT}°C.`;

  return { score: Math.round(score), level, text };
}

// 4) Insert en recommendations: tipa el retorno
export async function createRecommendation(row: {
  userId: string | null;
  anonymousId: string | null;
  cropTypeId: string;
  latitude: number;
  longitude: number;
  locationName: string;
  feasibilityScore: number;
  feasibilityLevel: 'green' | 'yellow' | 'red';
  recommendationText: string;
  satelliteData: SatelliteData;
  deviceInfo: string;
}): Promise<Recommendation> {
  const insertRow = {
    user_id: row.userId,
    anonymous_id: row.anonymousId,
    crop_type_id: row.cropTypeId,
    latitude: row.latitude,
    longitude: row.longitude,
    location_name: row.locationName,
    feasibility_score: row.feasibilityScore,
    feasibility_level: row.feasibilityLevel,
    recommendation_text: row.recommendationText,
    temperature: row.satelliteData.temperature,
    soil_moisture: row.satelliteData.soilMoisture,
    precipitation: row.satelliteData.precipitation ?? null,
    device_info: row.deviceInfo,
  };

  const { data, error } = await supabase
    .from('recommendations')
    .insert(insertRow)
    .select('*')
    .single();

  if (error) throw error;
  return data as Recommendation;
}

// 5) Clima para el mensajito "tipo Google"
export async function getRecommendationWithWeather(city: string, region: string, country: string) {
  const weather = await getCachedWeather(city, region, country);
  const weatherMsg = formatWeatherMessage(city, region, weather);
  return { weather, weatherMsg };
}


export async function getRecommendations(userId: string | null, anonymousId: string | null) {
  try {
    const query = supabase
      .from('recommendations')
      .select(`
        *,
        crop_types ( id, name )
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query.eq('user_id', userId);
    } else if (anonymousId) {
      query.eq('anonymous_id', anonymousId);
    } else {
      // No hay identificador, devuelve vacío
      return [];
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}