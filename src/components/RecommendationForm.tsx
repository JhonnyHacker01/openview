import { useEffect, useState } from 'react';
import { MapPin, Sprout, Loader2 } from 'lucide-react';
import {
  getCropTypes,
  simulateSatelliteData,
  calculateFeasibility,
  createRecommendation,
  getRecommendationWithWeather,
} from '../lib/recommendations';
import type { CropType, Recommendation } from '../lib/supabase';
import RecommendationResult from './RecommendationResult';

// Defaults si no podemos parsear lugar
const DEFAULT_CITY = 'Amarilis';
const DEFAULT_REGION = 'Huánuco';
const DEFAULT_COUNTRY = 'PE';

interface RecommendationFormProps {
  userId: string | null;
  anonymousId: string | null;
  onRecommendationCreated: () => void;
}

// Helper: intenta extraer city / region / country desde "Huánuco, Perú"
function parseLocationName(locationName: string): { city: string; region: string; country: string } {
  if (!locationName) {
    return { city: DEFAULT_CITY, region: DEFAULT_REGION, country: DEFAULT_COUNTRY };
  }
  const parts = locationName.split(',').map(s => s.trim());
  let city = DEFAULT_CITY;
  let region = DEFAULT_REGION;
  let country = DEFAULT_COUNTRY;

  if (parts.length === 3) {
    [city, region] = parts;
    country = parts[2].length === 2 ? parts[2].toUpperCase() : (parts[2].toLowerCase().includes('per') ? 'PE' : DEFAULT_COUNTRY);
  } else if (parts.length === 2) {
    if (parts[1].length === 2) {
      country = parts[1].toUpperCase();
    } else {
      country = parts[1].toLowerCase().includes('per') ? 'PE' : DEFAULT_COUNTRY;
    }
    region = parts[0] || DEFAULT_REGION;
    city = DEFAULT_CITY;
  } else if (parts.length === 1) {
    region = parts[0] || DEFAULT_REGION;
    city = DEFAULT_CITY;
    country = DEFAULT_COUNTRY;
  }
  return { city, region, country };
}

// Tipo para el resultado mostrado (lo que devuelve createRecommendation + join local de crop)
type RecWithCrop = Recommendation & { crop_types: CropType };

export default function RecommendationForm({
  userId,
  anonymousId,
  onRecommendationCreated,
}: RecommendationFormProps) {
  const [cropTypes, setCropTypes] = useState<CropType[]>([]);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecWithCrop | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [weatherMsg, setWeatherMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const types = await getCropTypes();
        setCropTypes(types);
        if (types.length > 0) setSelectedCropId(types[0].id);
      } catch (error) {
        console.error('Error loading crop types:', error);
      }
    })();
  }, []);

  const getDeviceInfo = (): string => {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'Móvil';
    if (/tablet/i.test(ua)) return 'Tablet';
    return 'Escritorio';
  };

  const getLocationNameFromCoords = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=es`
      );
      const data = await response.json();

      if (data.address) {
        const parts: string[] = [];
        if (data.address.city) parts.push(data.address.city);
        else if (data.address.town) parts.push(data.address.town);
        else if (data.address.village) parts.push(data.address.village);
        else if (data.address.state) parts.push(data.address.state);

        if (data.address.country) parts.push(data.address.country);

        return parts.length > 0 ? parts.join(', ') : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (error) {
      console.error('Error getting location name:', error);
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  };

  const handleGetLocation = () => {
    setGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          setLatitude(lat.toFixed(7));
          setLongitude(lon.toFixed(7));

          const resolvedName = await getLocationNameFromCoords(lat, lon);
          setLocationName(resolvedName);
          setGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback Huánuco
          setLatitude('-9.9306');
          setLongitude('-76.2422');
          setLocationName('Huánuco, Perú');
          setGettingLocation(false);
        }
      );
    } else {
      setLatitude('-9.9306');
      setLongitude('-76.2422');
      setLocationName('Huánuco, Perú');
      setGettingLocation(false);
    }
  };

  // SUBMIT PRINCIPAL: clima + simulación + factibilidad + guardar
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setWeatherMsg('');

    try {
      const selectedCrop = cropTypes.find((c) => c.id === selectedCropId);
      if (!selectedCrop) throw new Error('Cultivo no encontrado');

      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);

      // 1) Clima (determinista a partir de locationName o fallback)
      const { city, region, country } = parseLocationName(locationName);
      try {
        const { weatherMsg } = await getRecommendationWithWeather(city, region, country);
        setWeatherMsg(weatherMsg);
      } catch (werr) {
        console.warn('Weather fetch warning:', werr);
        setWeatherMsg('Clima no disponible en este momento.');
      }

      // 2) Datos “satélite” simulados + factibilidad
      const satelliteData = await simulateSatelliteData(lat, lon);
      const feasibility = calculateFeasibility(selectedCrop, satelliteData);

      // 3) Guardar recommendation
      const recommendation = await createRecommendation({
        userId,
        anonymousId,
        cropTypeId: selectedCropId,
        latitude: lat,
        longitude: lon,
        locationName: locationName || 'Ubicación desconocida',
        feasibilityScore: feasibility.score,
        feasibilityLevel: feasibility.level,
        recommendationText: feasibility.text,
        satelliteData,
        deviceInfo: getDeviceInfo(),
      });

      setResult({
        ...recommendation,
        crop_types: selectedCrop,
      });

      onRecommendationCreated();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Error desconocido';
      console.error('Error creating recommendation:', error);
      alert('Error al crear la recomendación: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <RecommendationResult
        recommendation={result}
        onNewRecommendation={() => setResult(null)}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <Sprout className="text-green-600" />
        Nueva Consulta
      </h2>

      {!!weatherMsg && (
        <div className="mb-4 text-sm text-gray-800 bg-green-50 border border-green-200 rounded-md p-3">
          {weatherMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cultivo</label>
          <select
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
          >
            {cropTypes.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={gettingLocation}
            className="w-full mb-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
          >
            <MapPin size={20} />
            {gettingLocation ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
          </button>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Latitud</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
                placeholder="-9.9306"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Longitud</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
                placeholder="-76.2422"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Nombre del lugar (opcional, ej: Amarilis, Huánuco, Perú)"
            className="w-full mt-3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-semibold text-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              Analizando datos y clima...
            </>
          ) : (
            'Obtener Recomendación'
          )}
        </button>
      </form>
    </div>
  );
}
