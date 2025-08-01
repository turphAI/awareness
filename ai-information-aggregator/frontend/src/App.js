import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import styled from 'styled-components';

// Lazy load components for code splitting
const LoginForm = React.lazy(() => import('./components/auth/LoginForm'));
const RegisterForm = React.lazy(() => import('./components/auth/RegisterForm'));
const ForgotPasswordForm = React.lazy(() => import('./components/auth/ForgotPasswordForm'));
const ProfileForm = React.lazy(() => import('./components/auth/ProfileForm'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const SourceManagement = React.lazy(() => import('./components/sources/SourceManagement'));
const Settings = React.lazy(() => import('./components/settings/Settings'));
const ContentLibrary = React.lazy(() => import('./components/library/ContentLibrary'));
const CollectionManagement = React.lazy(() => import('./components/library/CollectionManagement'));

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

// Component loading fallback
const ComponentLoader = () => (
  <LoadingContainer>
    <Spinner />
    <LoadingText>Loading...</LoadingText>
  </LoadingContainer>
);

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
    <ErrorBoundary fallbackComponent="Application">
      <AppContainer>
        <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : (
              <Suspense fallback={<ComponentLoader />}>
                <LoginForm />
              </Suspense>
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : (
              <Suspense fallback={<ComponentLoader />}>
                <RegisterForm />
              </Suspense>
            )
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : (
              <Suspense fallback={<ComponentLoader />}>
                <ForgotPasswordForm />
              </Suspense>
            )
          } 
        />

        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ComponentLoader />}>
                  <Dashboard />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ComponentLoader />}>
                  <ProfileForm />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sources" 
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ComponentLoader />}>
                  <SourceManagement />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ComponentLoader />}>
                  <Settings />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/library" 
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ComponentLoader />}>
                  <ContentLibrary />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/collections" 
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<ComponentLoader />}>
                  <CollectionManagement />
                </Suspense>
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
    </ErrorBoundary>
  );
}

export default App;