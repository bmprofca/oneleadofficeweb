import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Leads from './pages/Leads';
import Reminders from './pages/Reminders';
import Appointments from './pages/Appointments';
import Users from './pages/Users';
import Profile from './pages/Profile';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3200,
              style: {
                fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
                fontSize: '0.875rem',
                borderRadius: '10px',
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="leads" element={<Leads />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="profile" element={<Profile />} />
                <Route element={<ProtectedRoute roles={['admin']} />}>
                  <Route path="users" element={<Users />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
