import { useEffect, useState } from 'react';
import { History, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { getRecommendations } from '../lib/recommendations';
import { Recommendation } from '../lib/supabase';

interface HistoryViewProps {
  userId: string | null;
  anonymousId: string | null;
}

export default function HistoryView({ userId, anonymousId }: HistoryViewProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [userId, anonymousId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getRecommendations(userId, anonymousId);
      setRecommendations(data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (level: string) => {
    switch (level) {
      case 'green':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'yellow':
        return <AlertTriangle size={20} className="text-yellow-600" />;
      case 'red':
        return <XCircle size={20} className="text-red-600" />;
    }
  };

  const getStatusBadge = (level: string) => {
    const classes = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
    };

    const labels = {
      green: 'Óptimo',
      yellow: 'Moderado',
      red: 'Desfavorable',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes[level as keyof typeof classes]}`}>
        {labels[level as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto">
        <div className="text-center text-gray-600">Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <History className="text-green-600" />
        Historial de Consultas
      </h2>

      {recommendations.length === 0 ? (
        <div className="text-center py-12">
          <History className="mx-auto text-gray-300 mb-4" size={64} />
          <p className="text-gray-600 text-lg">No hay consultas registradas</p>
          <p className="text-gray-500 text-sm mt-2">
            Realiza tu primera consulta para comenzar a registrar tu historial
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                className="w-full p-4 flex items-center gap-4 text-left"
              >
                {getStatusIcon(rec.feasibility_level)}

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-gray-800">
                      {rec.crop_types?.name}
                    </span>
                    {getStatusBadge(rec.feasibility_level)}
                    <span className="text-gray-600 text-sm">
                      {rec.feasibility_score}/100
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(rec.created_at).toLocaleDateString('es-PE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' • '}
                    {rec.location_name}
                  </div>
                </div>

                {expandedId === rec.id ? (
                  <ChevronUp className="text-gray-400" />
                ) : (
                  <ChevronDown className="text-gray-400" />
                )}
              </button>

              {expandedId === rec.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                  <p className="text-gray-700 mb-4 leading-relaxed">
                    {rec.recommendation_text}
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-blue-50 rounded p-3 text-center">
                      <div className="text-sm text-gray-600 mb-1">Humedad</div>
                      <div className="font-bold text-gray-800">
                        {rec.soil_moisture?.toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded p-3 text-center">
                      <div className="text-sm text-gray-600 mb-1">Temperatura</div>
                      <div className="font-bold text-gray-800">
                        {rec.temperature?.toFixed(1)}°C
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded p-3 text-center">
                      <div className="text-sm text-gray-600 mb-1">Precipitación</div>
                      <div className="font-bold text-gray-800">
                        {rec.precipitation?.toFixed(0)} mm
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      <span className="font-medium">Coordenadas:</span>{' '}
                      {rec.latitude.toFixed(6)}, {rec.longitude.toFixed(6)}
                    </div>
                    <div>
                      <span className="font-medium">Dispositivo:</span> {rec.device_info}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
