import React, { useState, useEffect } from 'react';
import ClientApp from './ClientApp';
import AdminApp from './AdminApp';

export default function App() {
  // Check initial hash on load (e.g., if user visits /#admin directly)
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash === '#admin');

  useEffect(() => {
    // Listen for hash changes in the URL (triggered by the lock icon or manual typing)
    const handleHashChange = () => {
      setIsAdminRoute(window.location.hash === '#admin');
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Cleanup listener on component unmount
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Render Admin Dashboard if hash is #admin, otherwise render the Customer Storefront
  return isAdminRoute ? <AdminApp /> : <ClientApp />;
}