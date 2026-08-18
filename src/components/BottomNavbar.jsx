import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, History, User } from 'lucide-react';

/**
 * Bottom Navigation Bar Component
 * 3 Tabs: Home, Riwayat, Profile
 */
export default function BottomNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide bottom navbar on login page
  if (location.pathname === '/login') {
    return null;
  }

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/',
      icon: Home
    },
    {
      id: 'riwayat',
      label: 'Riwayat',
      path: '/riwayat',
      icon: History
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profil',
      icon: User
    }
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 px-4 pb-4 pt-2 pointer-events-none">
      <nav className="w-full bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1.5 flex items-center justify-around pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-[20px] transition-all duration-200 ${
                isActive 
                  ? 'bg-navy-950 text-white shadow-md shadow-navy-950/20 scale-[1.02]' 
                  : 'text-slate-500 hover:text-navy-900 active:scale-95'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className={`text-[11px] font-bold mt-1 tracking-tight ${isActive ? 'text-white' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
