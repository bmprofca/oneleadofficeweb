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
import LeadDetail from './pages/LeadDetail';
import Pipeline from './pages/Pipeline';
import MyDay from './pages/MyDay';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import Duplicates from './pages/Duplicates';
import './App.css';
import './styles/crm.css';

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
                fontFamily: 'var(--font)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--ink)',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                padding: '10px 14px',
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="tasks" element={<MyDay />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/:id" element={<LeadDetail />} />
                <Route path="pipeline" element={<Pipeline />} />
                <Route path="reports" element={<Reports />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="profile" element={<Profile />} />
                <Route element={<ProtectedRoute roles={['admin']} />}>
                  <Route path="users" element={<Users />} />
                  <Route path="duplicates" element={<Duplicates />} />
                  <Route path="audit" element={<AuditLog />} />
                  <Route path="settings" element={<Settings />} />
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
