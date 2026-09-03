import { lazy, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen.jsx';
import MobileContainer from './components/MobileContainer.jsx';
import BottomNavbar from './components/BottomNavbar.jsx';
import PageLoader from './components/PageLoader.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Login from './pages/auth/Login.jsx';
import Home from './pages/Home.jsx';

const Riwayat = lazy(() => import('./pages/Riwayat.jsx'));
const Profil = lazy(() => import('./pages/Profil.jsx'));
const EditProfile = lazy(() => import('./pages/EditProfile.jsx'));
const Perizinan = lazy(() => import('./pages/Perizinan.jsx'));
const Bugar = lazy(() => import('./pages/Bugar.jsx'));
const BugarTracking = lazy(() => import('./pages/BugarTracking.jsx'));
const ManagementAbsensi = lazy(() => import('./pages/ManagementAbsensi.jsx'));

function readSplashVisible() {
  try {
    return sessionStorage.getItem('alora_splash_seen') !== '1';
  } catch {
    return true;
  }
}

function readStoredSessionUser() {
  try {
    const token = localStorage.getItem('alora_auth_token')
      || localStorage.getItem('alora_token')
      || sessionStorage.getItem('alora_auth_token');
    const userRaw = localStorage.getItem('alora_user') || sessionStorage.getItem('alora_user');
    if (!token || !userRaw) return null;
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

function App() {
  const [showSplash, setShowSplash] = useState(readSplashVisible);
  const [user, setUser] = useState(readStoredSessionUser);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleSplashFinish = () => {
    try {
      sessionStorage.setItem('alora_splash_seen', '1');
    } catch {
      // ignore
    }
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && (
        <SplashScreen onFinish={handleSplashFinish} />
      )}

      <Router>
        <MobileContainer>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route
                path="/login"
                element={<Login onLoginSuccess={handleLoginSuccess} />}
              />
              <Route
                path="/"
                element={!showSplash && !user ? <Navigate to="/login" replace /> : <Home />}
              />
              <Route
                path="/riwayat"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <Riwayat />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/profil"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <Profil />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/edit-profile"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <EditProfile />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/perizinan"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <Perizinan />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/lembur-ro"
                element={<Navigate to="/riwayat?panel=sessions" replace />}
              />
              <Route
                path="/management-attendance"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <ManagementAbsensi />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/bugar"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <Bugar />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/bugar/tracking"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <BugarTracking />
                  </ProtectedRoute>
                )}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          <BottomNavbar />
        </MobileContainer>
      </Router>
    </>
  );
}

export default App;
