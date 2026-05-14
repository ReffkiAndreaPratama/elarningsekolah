import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Search, X, CheckCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';

const typeColors = {
  info:    'bg-blue-100 text-blue-600',
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  error:   'bg-red-100 text-red-600',
};

export default function Header({ onMenuClick }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/dashboard/notifications').then(r => r.data.data),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id) => api.put(`/dashboard/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const markAllRead = useMutation({
    mutationFn: () => Promise.all(
      notifications.filter(n => !n.is_read).map(n => api.put(`/dashboard/notifications/${n.id}/read`))
    ),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const unread = notifications.filter(n => !n.is_read).length;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="glass border-b border-slate-100 px-4 md:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <p className="text-xs text-slate-400 font-medium">{greeting()},</p>
          <p className="font-semibold text-slate-800 text-sm leading-tight">{user?.name}</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-100 shadow-modal z-50 overflow-hidden animate-scale-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                  {unread > 0 && <p className="text-xs text-slate-400">{unread} unread</p>}
                </div>
                <div className="flex items-center gap-1">
                  {unread > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Mark all read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setShowNotif(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => { markRead.mutate(n.id); setShowNotif(false); }}
                      className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${typeColors[n.type] || typeColors.info}`}>
                          <Bell className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 leading-tight">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.is_read && <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-blue-400 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xs">{user?.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-700 leading-tight">{user?.name?.split(' ')[0]}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
        </button>
      </div>
    </header>
  );
}
