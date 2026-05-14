import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, ClipboardCheck, FileText,
  Calendar, Settings, LogOut, GraduationCap, QrCode,
  Shield, Users, ChevronRight, X, Bell, TrendingUp
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const navConfig = {
  admin: [
    { section: 'Main', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/classes',   icon: BookOpen,        label: 'Classes' },
      { to: '/schedule',  icon: Calendar,        label: 'Schedule' },
    ]},
    { section: 'Academic', items: [
      { to: '/materials',   icon: FileText,       label: 'Materials' },
      { to: '/assignments', icon: ClipboardCheck, label: 'Assignments' },
      { to: '/attendance',  icon: TrendingUp,     label: 'Attendance' },
    ]},
    { section: 'System', items: [
      { to: '/admin', icon: Shield, label: 'Admin Panel', badge: 'Admin' },
    ]},
  ],
  teacher: [
    { section: 'Main', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/classes',   icon: BookOpen,        label: 'My Classes' },
      { to: '/schedule',  icon: Calendar,        label: 'Schedule' },
    ]},
    { section: 'Academic', items: [
      { to: '/materials',   icon: FileText,       label: 'Materials' },
      { to: '/assignments', icon: ClipboardCheck, label: 'Assignments' },
      { to: '/attendance',  icon: TrendingUp,     label: 'Attendance' },
    ]},
  ],
  student: [
    { section: 'Main', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/classes',   icon: BookOpen,        label: 'My Classes' },
      { to: '/schedule',  icon: Calendar,        label: 'Schedule' },
    ]},
    { section: 'Academic', items: [
      { to: '/materials',   icon: FileText,       label: 'Materials' },
      { to: '/assignments', icon: ClipboardCheck, label: 'Assignments' },
    ]},
    { section: 'Attendance', items: [
      { to: '/attendance',      icon: TrendingUp, label: 'My Attendance' },
      { to: '/attendance/scan', icon: QrCode,     label: 'Scan QR Code', highlight: true },
    ]},
  ],
};

const roleConfig = {
  admin:   { color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  teacher: { color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  student: { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const sections = navConfig[user?.role] || navConfig.student;
  const rc = roleConfig[user?.role] || roleConfig.student;

  return (
    <aside className={`
      fixed lg:static inset-y-0 left-0 z-30
      w-64 bg-white border-r border-slate-100 flex flex-col
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `} style={{ boxShadow: '4px 0 24px -4px rgba(0,0,0,0.06)' }}>

      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-blue-500 rounded-xl flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-none">EduTrack</p>
            <p className="text-xs text-slate-400 mt-0.5">Learning Platform</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* User profile */}
      <div className="px-4 py-3 mx-3 mt-3 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-blue-400 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">{user?.name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${rc.dot} rounded-full border-2 border-white`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{user?.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${rc.color}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {sections.map(({ section, items }) => (
          <div key={section}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">{section}</p>
            <div className="space-y-0.5">
              {items.map(({ to, icon: Icon, label, highlight, badge }) => {
                const isActive = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                      ${isActive
                        ? 'bg-primary-50 text-primary-700 shadow-sm'
                        : highlight
                          ? 'bg-gradient-to-r from-primary-50 to-blue-50 text-primary-600 border border-primary-100 hover:from-primary-100 hover:to-blue-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                      ${isActive ? 'bg-primary-100' : highlight ? 'bg-primary-100' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                      <Icon className={`w-3.5 h-3.5 ${isActive || highlight ? 'text-primary-600' : 'text-slate-500'}`} />
                    </div>
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md font-medium">{badge}</span>
                    )}
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary-400" />}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-slate-100 space-y-0.5">
        <NavLink
          to="/profile"
          onClick={onClose}
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
            ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
          `}
        >
          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-slate-500" />
          </div>
          Settings
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
        >
          <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
            <LogOut className="w-3.5 h-3.5 text-red-400" />
          </div>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
