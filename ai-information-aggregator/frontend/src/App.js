import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import ProfileForm from './components/auth/ProfileForm';
import Dashboard from './components/Dashboard';
import SourceManagement from './components/sources/SourceManagement';
import Settings from './components/settings/Settings';
import Layout from './components/Layout';
import styled from 'styled-components';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #f5f5f5;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  flex-direction: column;
  gap: 20px;
`;

const Spinner = styled.div`
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: #666;
  font-size: 16px;
`;

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <AppContainer>
        <LoadingContainer>
          <Spinner />
          <LoadingText>Loading application...</LoadingText>
        </LoadingContainer>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginForm />
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterForm />
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordForm />
          } 
        />

        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Layout>
                <ProfileForm />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sources" 
          element={
            <ProtectedRoute>
              <Layout>
                <SourceManagement />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/library" 
          element={
            <ProtectedRoute>
              <Layout>
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <h2>Content Library</h2>
                  <p>Your saved articles and content will appear here.</p>
                  <p style={{ color: '#666', fontStyle: 'italic' }}>This feature is coming soon!</p>
                </div>
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/collections" 
          element={
            <ProtectedRoute>
              <Layout>
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <h2>Collections</h2>
                  <p>Organize your content into custom collections.</p>
                  <p style={{ color: '#666', fontStyle: 'italic' }}>This feature is coming soon!</p>
                </div>
              </Layout>
            </ProtectedRoute>
          } 
        />

        {/* Default redirect */}
        <Route 
          path="/" 
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          } 
        />

        {/* Catch all route */}
        <Route 
          path="*" 
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          } 
        />
      </Routes>
    </AppContainer>
  );
}

export default App;