import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen.jsx';
import MobileContainer from './components/MobileContainer.jsx';
import BottomNavbar from './components/BottomNavbar.jsx';

import Login from './pages/auth/Login.jsx';
import Home from './pages/Home.jsx';
import Riwayat from './pages/Riwayat.jsx';
import Profil from './pages/Profil.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Perizinan from './pages/Perizinan.jsx';
import Bugar from './pages/Bugar.jsx';
import BugarTracking from './pages/BugarTracking.jsx';
import ManagementAbsensi from './pages/ManagementAbsensi.jsx';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const storedToken = localStorage.getItem('alora_auth_token') || localStorage.getItem('alora_token') || sessionStorage.getItem('alora_auth_token');
    const storedUser = localStorage.getItem('alora_user') || sessionStorage.getItem('alora_user');
    if (storedToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing stored user data:', e);
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  return (
    <>
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      <Router>
        <MobileContainer>
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
              element={!showSplash && !user ? <Navigate to="/login" replace /> : <Riwayat />} 
            />
            <Route 
              path="/profil" 
              element={!showSplash && !user ? <Navigate to="/login" replace /> : <Profil />} 
            />
            <Route 
              path="/edit-profile" 
              element={!showSplash && !user ? <Navigate to="/login" replace /> : <EditProfile />} 
            />
            <Route 
              path="/perizinan" 
              element={!showSplash && !user ? <Navigate to="/login" replace /> : <Perizinan />} 
            />
            <Route 
              path="/management-attendance" 
              element={!showSplash && !user ? <Navigate to="/login" replace /> : <ManagementAbsensi />} 
            />
            <Route 
              path="/bugar" 
              element={!showSplash && !user ? <Navigate to="/login" replace /> : <Bugar />} 
            />
            <Route 
              path="/bugar/tracking" 
              element={!showSplash && !user ? <Navigate to="/login" replace /> : <BugarTracking />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Render Bottom Navbar for Home, Riwayat, and Profile */}
          <BottomNavbar />
        </MobileContainer>
      </Router>
    </>
  );
}

export default App;
