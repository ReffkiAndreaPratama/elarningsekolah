import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, BookOpen, Calendar, Plus, Trash2, ArrowLeft, UserPlus } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export default function ClassDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showEnroll, setShowEnroll] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);

  const { data: cls, isLoading } = useQuery({
    queryKey: ['class', id],
    queryFn: () => api.get(`/classes/${id}`).then(r => r.data.data),
  });

  const { data: availableStudents } = useQuery({
    queryKey: ['available-students', id, studentSearch],
    queryFn: () => api.get(`/users/students?class_id=${id}&search=${studentSearch}`).then(r => r.data.data),
    enabled: showEnroll,
  });

  const enrollStudents = useMutation({
    mutationFn: () => api.post(`/classes/${id}/enroll`, { student_ids: selectedStudents }),
    onSuccess: () => {
      toast.success('Students enrolled');
      queryClient.invalidateQueries(['class', id]);
      setShowEnroll(false);
      setSelectedStudents([]);
    },
  });

  const removeStudent = useMutation({
    mutationFn: (studentId) => api.delete(`/classes/${id}/enroll/${studentId}`),
    onSuccess: () => { toast.success('Student removed'); queryClient.invalidateQueries(['class', id]); },
  });

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!cls) return <div className="text-center py-12 text-slate-400">Class not found</div>;

  const tabs = ['overview', 'students', 'schedule'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/classes" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title mb-0">{cls.name}</h1>
          <p className="page-subtitle">{cls.subject} • {cls.teacher_name}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{cls.student_count}</p>
          <p className="text-sm text-slate-500">Students</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{cls.schedules?.length || 0}</p>
          <p className="text-sm text-slate-500">Schedules</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm font-medium text-slate-800">{cls.room || '—'}</p>
          <p className="text-sm text-slate-500">Room</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Description</p>
            <p className="text-slate-800 mt-1">{cls.description || 'No description provided'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Grade Level</p>
              <p className="text-slate-800">{cls.grade_level || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">School Year</p>
              <p className="text-slate-800">{cls.school_year || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Teacher</p>
              <p className="text-slate-800">{cls.teacher_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Room</p>
              <p className="text-slate-800">{cls.room || '—'}</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Link to={`/materials`} className="btn-secondary text-sm">
              <BookOpen className="w-4 h-4" />
              View Materials
            </Link>
            <Link to={`/attendance`} className="btn-secondary text-sm">
              <Calendar className="w-4 h-4" />
              Attendance
            </Link>
          </div>
        </div>
      )}

      {/* Students */}
      {activeTab === 'students' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Enrolled Students ({cls.students?.length})</h3>
            {(user?.role === 'admin' || user?.role === 'teacher') && (
              <button onClick={() => setShowEnroll(true)} className="btn-primary text-sm">
                <UserPlus className="w-4 h-4" />
                Enroll Students
              </button>
            )}
          </div>

          {showEnroll && (
            <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                className="input mb-3"
                placeholder="Search students..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                {availableStudents?.map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(s.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedStudents([...selectedStudents, s.id]);
                        else setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                      }}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </div>
                  </label>
                ))}
                {availableStudents?.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">No students available</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => enrollStudents.mutate()}
                  disabled={!selectedStudents.length || enrollStudents.isPending}
                  className="btn-primary text-sm"
                >
                  Enroll {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}
                </button>
                <button onClick={() => { setShowEnroll(false); setSelectedStudents([]); }} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {cls.students?.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 text-xs font-semibold">{s.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.email}</p>
                  </div>
                </div>
                {(user?.role === 'admin' || user?.role === 'teacher') && (
                  <button
                    onClick={() => { if (confirm('Remove student?')) removeStudent.mutate(s.id); }}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {!cls.students?.length && (
              <p className="text-sm text-slate-400 text-center py-8">No students enrolled</p>
            )}
          </div>
        </div>
      )}

      {/* Schedule */}
      {activeTab === 'schedule' && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Class Schedule</h3>
          <div className="space-y-2">
            {cls.schedules?.map(s => (
              <div key={s.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="w-24 text-sm font-medium text-primary-600">{s.day_of_week}</div>
                <div className="text-sm text-slate-700">{s.start_time} – {s.end_time}</div>
                {s.room && <div className="text-sm text-slate-400">📍 {s.room}</div>}
              </div>
            ))}
            {!cls.schedules?.length && (
              <p className="text-sm text-slate-400 text-center py-8">No schedule set</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
