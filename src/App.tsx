import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Settings from './pages/Settings';
import AppLayout from './layouts/AppLayout';
import NewRequest from './pages/NewRequest';
import Templates from './pages/Templates';
import Tables from './pages/Tables';
import Operators from './pages/Operators';
import Cid10Settings from './pages/Cid10Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const init = useAuthStore(state => state.init);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="nova-solicitacao" element={<NewRequest />} />
          <Route path="pacientes" element={<Patients />} />
          <Route path="templates" element={<Templates />} />
          <Route path="configuracoes" element={<Settings />} />
          <Route path="configuracoes/cid10" element={<Cid10Settings />} />
          <Route path="configuracoes/operadoras" element={<Operators />} />
          <Route path="configuracoes/tabelas" element={<Tables />} />
        </Route>
      </Routes>
    </Router>
  );
}
