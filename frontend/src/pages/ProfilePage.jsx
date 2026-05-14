import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Lock, Save, Camera, Shield, Bell, Palette } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const roleConfig = {
  admin:   { badge: 'badge-admin',   label: 'System Administrator', color: 'from-purple-500 to-purple-700' },
  teacher: { badge: 'badge-teacher', label: 'Teacher',              color: 'from-blue-500 to-blue-700' },
  student: { badge: 'badge-student', label: 'Student',              color: 'from-emerald-500 to-emerald-700' },
};

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [activeTab, setActiveTab] = useState('profile');

  const rc = roleConfig[user?.role] || roleConfig.student;

  const updateProfile = useMutation({
    mutationFn: (d) => api.put('/auth/profile', d),
    onSuccess: (res) => { updateUser(res.data.data); toast.success('Profile updated'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const changePassword = useMutation({
    mutationFn: (d) => api.put('/auth/change-password', d),
    onSuccess: () => { toast.success('Password changed successfully'); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    changePassword.mutate(passwordForm);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Profile & Settings</h1>
        <p className="page-subtitle">Manage your account information and preferences</p>
      </div>

      {/* Profile hero */}
      <div className={`card overflow-hidden`}>
        <div className={`h-24 bg-gradient-to-r ${rc.color}`} />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
                <span className={`text-3xl font-bold bg-gradient-to-br ${rc.color} bg-clip-text text-transparent`}>
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
              <p className="text-slate-500 text-sm">{user?.email}</p>
            </div>
            <div className="ml-auto pb-1">
              <span className={`badge ${rc.badge}`}>{rc.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">#{user?.id}</p>
              <p className="text-xs text-slate-400">User ID</p>
            </div>
            <div className="text-center border-x border-slate-100">
              <p className="text-lg font-bold text-slate-900 capitalize">{user?.role}</p>
              <p className="text-xs text-slate-400">Role</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
              </p>
              <p className="text-xs text-slate-400">Member Since</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs w-fit">
        {[
          { id: 'profile',  icon: User, label: 'Profile' },
          { id: 'security', icon: Lock, label: 'Security' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`tab flex items-center gap-2 ${activeTab === t.id ? 'tab-active' : 'tab-inactive'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="card p-6 animate-fade-in">
          <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <User className="w-4 h-4 text-primary-500" />
            Personal Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={profileForm.name}
                onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" placeholder="+63 9XX XXX XXXX" value={profileForm.phone}
                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input bg-slate-50 text-slate-400 cursor-not-allowed" value={user?.email} disabled />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="label">Account Role</label>
              <input className="input bg-slate-50 text-slate-400 cursor-not-allowed capitalize" value={user?.role} disabled />
            </div>
          </div>
          <div className="flex justify-end mt-5">
            <button onClick={() => updateProfile.mutate(profileForm)} disabled={updateProfile.isPending} className="btn-primary">
              <Save className="w-4 h-4" />
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Security tab */}
      {activeTab === 'security' && (
        <div className="card p-6 animate-fade-in">
          <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary-500" />
            Change Password
          </h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input" placeholder="Enter current password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input" placeholder="Min 6 characters"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" className="input" placeholder="Repeat new password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required />
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={changePassword.isPending} className="btn-primary">
                <Lock className="w-4 h-4" />
                {changePassword.isPending ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              Security Tips
            </h4>
            <ul className="space-y-2">
              {[
                'Use at least 8 characters with a mix of letters and numbers',
                'Never share your password with anyone',
                'Log out when using shared devices',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mt-1.5 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
