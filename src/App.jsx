import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ClientApp from './ClientApp';
import AdminApp from './AdminApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The public storefront for your customers */}
        <Route path="/" element={<ClientApp />} />
        
        {/* The secure dashboard for you to manage inventory and debts */}
        <Route path="/admin" element={<AdminApp />} />

        {/* Catch-all: Redirects any unknown URLs back to the storefront */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}