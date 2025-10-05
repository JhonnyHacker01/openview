import { useState, useEffect } from 'react';
import { Satellite, User, LogOut, BookOpen } from 'lucide-react';
import { supabase } from './lib/supabase';
import { getCurrentUser, signOut, getOrCreateAnonymousId } from './lib/auth';
import AuthModal from './components/AuthModal';
import RecommendationForm from './components/RecommendationForm';
import HistoryView from './components/HistoryView';

type View = 'new' | 'history';

function App() {
  const [user, setUser] = useState<any>(null);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentView, setCurrentView] = useState<View>('new');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
        setAnonymousId(null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAnonymousId(getOrCreateAnonymousId());
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setAnonymousId(null);
      } else {
        setAnonymousId(getOrCreateAnonymousId());
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setAnonymousId(getOrCreateAnonymousId());
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setAnonymousId(getOrCreateAnonymousId());
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleRecommendationCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <Satellite className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">OpenView</h1>
                <p className="text-sm text-gray-600">Análisis Satelital para Agricultura</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-gray-900">Usuario Registrado</div>
                    <div className="text-xs text-gray-600">{user.email}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Cerrar Sesión</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-gray-900">Modo Anónimo</div>
                    <div className="text-xs text-gray-600">{anonymousId}</div>
                  </div>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <User size={18} />
                    <span className="hidden sm:inline">Iniciar Sesión</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentView('new')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                currentView === 'new'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Satellite size={18} />
              Nueva Consulta
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                currentView === 'history'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BookOpen size={18} />
              Historial
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {currentView === 'new' ? (
          <RecommendationForm
            userId={user?.id || null}
            anonymousId={anonymousId}
            onRecommendationCreated={handleRecommendationCreated}
          />
        ) : (
          <HistoryView
            key={refreshTrigger}
            userId={user?.id || null}
            anonymousId={anonymousId}
          />
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-1">
              <span className="font-semibold">OpenView</span> - Plataforma de Análisis Satelital
              para Agricultores
            </p>
            <p className="text-xs text-gray-500">
              Utilizando datos satelitales para mejorar la agricultura en Huánuco, Perú
            </p>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={initializeAuth}
      />
    </div>
  );
}

export default App;
