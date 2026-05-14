import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit2, UserX, Search, Shield, UserCheck, GraduationCap, BookOpen, X, Check } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const roleConfig = {
  admin:   { badge: 'badge-admin',   icon: Shield,         label: 'Admin' },
  teacher: { badge: 'badge-teacher', icon: GraduationCap,  label: 'Teacher' },
  student: { badge: 'badge-student', icon: BookOpen,       label: 'Student' },
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', phone: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () => api.get(`/users?search=${search}&role=${roleFilter}`).then(r => r.data),
  });

  const createUser = useMutation({
    mutationFn: (d) => api.post('/users', d),
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries(['users']);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'student', phone: '' });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...d }) => api.put(`/users/${id}`, d),
    onSuccess: () => { toast.success('User updated'); queryClient.invalidateQueries(['users']); setEditUser(null); },
  });

  const deactivateUser = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('User deactivated'); queryClient.invalidateQueries(['users']); },
  });

  const users = data?.data || [];
  const pagination = data?.pagination;

  const roleCounts = {
    admin:   users.filter(u => u.role === 'admin').length,
    teacher: users.filter(u => u.role === 'teacher').length,
    student: users.filter(u => u.role === 'student').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" /> Admin Panel
          </h1>
          <p className="page-subtitle">Manage users, roles, and system settings</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { role: 'student', icon: BookOpen,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { role: 'teacher', icon: GraduationCap, color: 'text-blue-600',    bg: 'bg-blue-50' },
          { role: 'admin',   icon: Shield,        color: 'text-purple-600',  bg: 'bg-purple-50' },
        ].map(({ role, icon: Icon, color, bg }) => (
          <div key={role} className="card p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-2xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{roleCounts[role]}</p>
                <p className="text-sm text-slate-500 capitalize">{role}s</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-10" placeholder="Search by name or email..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['', 'student', 'teacher', 'admin'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border
                ${roleFilter === r ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              {r === '' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-800">Create New User</h3>
            <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" placeholder="John Doe" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" placeholder="user@school.edu" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Password *</label>
              <input type="password" className="input" placeholder="Min 6 characters" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+63 9XX XXX XXXX" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => createUser.mutate(form)} className="btn-primary"
              disabled={createUser.isPending || !form.name || !form.email || !form.password}>
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j}><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : users.map(u => {
                const rc = roleConfig[u.role];
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary-100 to-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-600 text-sm font-bold">{u.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${rc.badge}`}>{rc.label}</span></td>
                    <td>
                      <span className={`badge ${u.is_active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-600 ring-1 ring-red-200'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-slate-500 text-sm">{u.phone || '—'}</td>
                    <td className="text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => setEditUser({ ...u })}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.is_active && (
                          <button onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateUser.mutate(u.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && users.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
            Showing {users.length} of {pagination.total} users
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="modal-overlay animate-fade-in" onClick={() => setEditUser(null)}>
          <div className="modal max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="font-bold text-slate-800">Edit User</h2>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={editUser.name}
                  onChange={e => setEditUser({ ...editUser, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={editUser.email}
                  onChange={e => setEditUser({ ...editUser, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={editUser.role}
                    onChange={e => setEditUser({ ...editUser, role: e.target.value })}>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={editUser.is_active ? '1' : '0'}
                    onChange={e => setEditUser({ ...editUser, is_active: e.target.value === '1' })}>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditUser(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => updateUser.mutate(editUser)} className="btn-primary">
                <Check className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
