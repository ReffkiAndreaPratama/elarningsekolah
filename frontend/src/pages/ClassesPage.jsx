import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, BookOpen, Trash2, ChevronRight, GraduationCap, MapPin } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const subjectColors = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-emerald-400 to-emerald-600',
  'from-orange-400 to-orange-600',
  'from-pink-400 to-pink-600',
  'from-teal-400 to-teal-600',
];

export default function ClassesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', description: '', room: '', grade_level: '', school_year: '', teacher_id: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['classes', search],
    queryFn: () => api.get(`/classes?search=${search}`).then(r => r.data.data),
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get('/users/teachers').then(r => r.data.data),
    enabled: user?.role === 'admin',
  });

  const createClass = useMutation({
    mutationFn: (d) => api.post('/classes', d),
    onSuccess: () => {
      toast.success('Class created successfully');
      queryClient.invalidateQueries(['classes']);
      setShowCreate(false);
      setForm({ name: '', subject: '', description: '', room: '', grade_level: '', school_year: '', teacher_id: '' });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create class'),
  });

  const deleteClass = useMutation({
    mutationFn: (id) => api.delete(`/classes/${id}`),
    onSuccess: () => { toast.success('Class deleted'); queryClient.invalidateQueries(['classes']); },
  });

  const classes = data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">{user?.role === 'student' ? 'My Classes' : 'Classes'}</h1>
          <p className="page-subtitle">
            {user?.role === 'student' ? 'Your enrolled classes' : `${classes.length} classes total`}
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Class
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input className="input pl-10 max-w-sm" placeholder="Search classes..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-6 animate-fade-in-up">
          <h3 className="font-semibold text-slate-800 mb-5">Create New Class</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Class Name *</label>
              <input className="input" placeholder="e.g., Grade 10 - Mathematics" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Subject *</label>
              <input className="input" placeholder="e.g., Mathematics" value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <label className="label">Room</label>
              <input className="input" placeholder="e.g., Room 101" value={form.room}
                onChange={e => setForm({ ...form, room: e.target.value })} />
            </div>
            <div>
              <label className="label">Grade Level</label>
              <input className="input" placeholder="e.g., Grade 10" value={form.grade_level}
                onChange={e => setForm({ ...form, grade_level: e.target.value })} />
            </div>
            <div>
              <label className="label">School Year</label>
              <input className="input" placeholder="e.g., 2025-2026" value={form.school_year}
                onChange={e => setForm({ ...form, school_year: e.target.value })} />
            </div>
            {user?.role === 'admin' && (
              <div>
                <label className="label">Assign Teacher</label>
                <select className="input" value={form.teacher_id}
                  onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                  <option value="">Select teacher...</option>
                  {teachers?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} placeholder="Brief class description..."
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => createClass.mutate(form)} className="btn-primary"
              disabled={createClass.isPending || !form.name || !form.subject}>
              {createClass.isPending ? 'Creating...' : 'Create Class'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Classes grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="card empty-state py-20">
          <div className="empty-state-icon">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-600">No classes found</p>
          <p className="text-sm text-slate-400 mt-1">
            {user?.role === 'student' ? 'You are not enrolled in any classes yet' : 'Create your first class to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, idx) => (
            <div key={cls.id} className="card-hover group overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              {/* Color header */}
              <div className={`h-2 bg-gradient-to-r ${subjectColors[idx % subjectColors.length]}`} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${subjectColors[idx % subjectColors.length]} rounded-2xl flex items-center justify-center shadow-sm`}>
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  {user?.role === 'admin' && (
                    <button
                      onClick={(e) => { e.preventDefault(); if (confirm('Delete this class?')) deleteClass.mutate(cls.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <h3 className="font-bold text-slate-800 mb-0.5 line-clamp-1">{cls.name}</h3>
                <p className="text-sm text-slate-500 mb-3">{cls.subject}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                    <Users className="w-3 h-3" /> {cls.student_count} students
                  </span>
                  {cls.room && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                      <MapPin className="w-3 h-3" /> {cls.room}
                    </span>
                  )}
                  {cls.grade_level && (
                    <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">{cls.grade_level}</span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 truncate">By {cls.teacher_name}</p>
                  <Link to={`/classes/${cls.id}`}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold">
                    Open <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
