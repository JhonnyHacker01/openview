import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Droplets, Thermometer, Cloud } from 'lucide-react';
import { Recommendation } from '../lib/supabase';

interface RecommendationResultProps {
  recommendation: Recommendation;
  onNewRecommendation: () => void;
}

export default function RecommendationResult({
  recommendation,
  onNewRecommendation,
}: RecommendationResultProps) {
  // Local state to store the AI-generated suggestion and its loading status.
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // When the recommendation changes (i.e. a new query is made), call the AI API
  // to generate tailored agricultural advice.  The backend Flask service should
  // expose an endpoint at /api/ai-recommendation that accepts the relevant
  // recommendation metrics as JSON and returns a message.  If the call fails,
  // an error message will be displayed.
  useEffect(() => {
    async function fetchAI() {
      // Reset state before fetching
      setAiLoading(true);
      setAiMessage(null);
      try {
        const response = await fetch('http://localhost:8000/api/ai-recommendation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            crop_name: recommendation.crop_types?.name,
            feasibility_level: recommendation.feasibility_level,
            feasibility_score: recommendation.feasibility_score,
            temperature: recommendation.temperature,
            soil_moisture: recommendation.soil_moisture,
            precipitation: recommendation.precipitation,
            location_name: recommendation.location_name,
          }),
        });
        const data = await response.json();
        if (data.message) {
          setAiMessage(data.message);
        } else if (data.error) {
          setAiMessage(`Error: ${data.error}`);
        }
      } catch (error: any) {
        setAiMessage(`Error al consultar las recomendaciones de IA`);
      } finally {
        setAiLoading(false);
      }
    }

    // Only fetch when a recommendation exists
    if (recommendation) {
      fetchAI();
    }
  }, [recommendation]);
  const getStatusIcon = () => {
    switch (recommendation.feasibility_level) {
      case 'green':
        return <CheckCircle size={48} className="text-green-600" />;
      case 'yellow':
        return <AlertTriangle size={48} className="text-yellow-600" />;
      case 'red':
        return <XCircle size={48} className="text-red-600" />;
    }
  };

  const getStatusColor = () => {
    switch (recommendation.feasibility_level) {
      case 'green':
        return 'bg-green-50 border-green-200';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200';
      case 'red':
        return 'bg-red-50 border-red-200';
    }
  };

  const getStatusTitle = () => {
    switch (recommendation.feasibility_level) {
      case 'green':
        return 'Condiciones Óptimas';
      case 'yellow':
        return 'Condiciones Moderadas';
      case 'red':
        return 'Condiciones Desfavorables';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
      <div className={`border-2 rounded-lg p-6 mb-6 ${getStatusColor()}`}>
        <div className="flex items-start gap-4">
          {getStatusIcon()}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {getStatusTitle()}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <span className="font-medium">{recommendation.crop_types?.name}</span>
              <span>•</span>
              <span>{recommendation.location_name}</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              {recommendation.recommendation_text}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">
                {recommendation.feasibility_score}
              </div>
              <div className="text-sm text-gray-600">Puntuación de Viabilidad</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <Droplets className="text-blue-600 mx-auto mb-2" size={32} />
          <div className="text-2xl font-bold text-gray-800">
            {recommendation.soil_moisture?.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-600">Humedad del Suelo</div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <Thermometer className="text-orange-600 mx-auto mb-2" size={32} />
          <div className="text-2xl font-bold text-gray-800">
            {recommendation.temperature?.toFixed(1)}°C
          </div>
          <div className="text-sm text-gray-600">Temperatura</div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <Cloud className="text-slate-600 mx-auto mb-2" size={32} />
          <div className="text-2xl font-bold text-gray-800">
            {recommendation.precipitation?.toFixed(0)} mm
          </div>
          <div className="text-sm text-gray-600">Precipitación</div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-gray-700 mb-2">Datos del Registro</h4>
        <div className="space-y-1 text-sm text-gray-600">
          <div>
            <span className="font-medium">Fecha:</span>{' '}
            {new Date(recommendation.created_at).toLocaleDateString('es-PE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div>
            <span className="font-medium">Coordenadas:</span>{' '}
            {recommendation.latitude.toFixed(6)}, {recommendation.longitude.toFixed(6)}
          </div>
          <div>
            <span className="font-medium">Dispositivo:</span> {recommendation.device_info}
          </div>
        </div>
      </div>

      <button
        onClick={onNewRecommendation}
        className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
      >
        Nueva Consulta
      </button>

      {/* Section to display AI-driven agricultural advice. */}
      <div className="mt-6">
        {aiLoading && (
          <p className="text-sm text-gray-500">Cargando sugerencias de cultivo...</p>
        )}
        {aiMessage && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mt-2">
            <h4 className="font-semibold text-gray-700 mb-2">
              Sugerencias de la IA
            </h4>
            <p className="text-gray-700 whitespace-pre-line">{aiMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
