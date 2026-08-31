import React, { useState, useEffect } from 'react';
import ClientApp from './ClientApp';
import AdminApp from './AdminApp';
import { supabase } from './utils/supabaseClient';
import { Lock, LogOut } from 'lucide-react';

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash === '#admin');
  const [currentUser, setCurrentUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminRoute(window.location.hash === '#admin');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('pin_code', pinInput)
        .single();

      if (error || !data) {
        setLoginError('Code PIN incorrect.');
      } else if (!data.is_active) {
        setLoginError('Ce compte a été désactivé. Veuillez contacter un administrateur.');
      } else {
        setCurrentUser(data);
        setPinInput('');
      }
    } catch (err) {
      setLoginError('Erreur de connexion au serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPinInput('');
  };

  if (!isAdminRoute) {
    return <ClientApp />;
  }

  if (isAdminRoute && !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full border border-gray-100 text-center space-y-6">
          <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-orange-600" />
          </div>
          
          <div>
            <h2 className="text-xl font-black text-gray-800">Accès Restreint</h2>
            <p className="text-xs text-gray-500 mt-1">Veuillez entrer votre code PIN</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="****"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-[0.5em] font-bold text-2xl p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                maxLength={10}
              />
              {loginError && (
                <p className="text-red-500 text-xs font-bold mt-2">{loginError}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !pinInput}
              className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl uppercase text-xs tracking-wider transition-colors"
            >
              {isLoading ? 'Vérification...' : 'Se Connecter'}
            </button>
          </form>
          
          <button 
            onClick={() => window.location.hash = ''} 
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Retour à la boutique publique
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="bg-black text-white text-xs px-4 py-2.5 flex justify-between items-center z-50">
        <div className="flex items-center space-x-3">
          <span className="font-bold">{currentUser.full_name}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
            currentUser.role === 'admin' ? 'bg-orange-600' : 'bg-gray-600'
          }`}>
            {currentUser.role}
          </span>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-1.5 hover:text-orange-400 transition-colors font-bold"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Déconnexion</span>
        </button>
      </div>
      
      <div className="flex-grow">
        <AdminApp currentUser={currentUser} supabase={supabase} />
      </div>
    </div>
  );
}