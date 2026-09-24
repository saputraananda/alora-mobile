import { lazy, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from '../components/SplashScreen.jsx';
import MobileContainer from '../components/MobileContainer.jsx';
import BottomNavbar from '../components/BottomNavbar.jsx';
import PageLoader from '../components/PageLoader.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { readStoredSessionUser } from '../utils/authSession.js';

import Login from '../features/auth/pages/Login.jsx';
import Home from '../features/home/pages/Home.jsx';

const Riwayat = lazy(() => import('../features/riwayat/pages/Riwayat.jsx'));
const LemburRo = lazy(() => import('../features/lembur-ro/pages/LemburRo.jsx'));
const Absensi = lazy(() => import('../features/absensi/pages/Absensi.jsx'));
const Profil = lazy(() => import('../features/profil/pages/Profil.jsx'));
const EditProfile = lazy(() => import('../features/profil/pages/EditProfile.jsx'));
const Perizinan = lazy(() => import('../features/perizinan/pages/Perizinan.jsx'));
const ManagementAbsensi = lazy(() => import('../features/management-absensi/pages/ManagementAbsensi.jsx'));
const Approvals = lazy(() => import('../features/approvals/pages/Approvals.jsx'));

function readSplashVisible() {
  try {
    return sessionStorage.getItem('alora_splash_seen') !== '1';
  } catch {
    return true;
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
                path="/absensi"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <Absensi />
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
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <LemburRo />
                  </ProtectedRoute>
                )}
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
                path="/approval"
                element={(
                  <ProtectedRoute user={user} showSplash={showSplash}>
                    <Approvals />
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
