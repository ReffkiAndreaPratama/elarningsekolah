import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  QrCode, RefreshCw, Play, Square, Plus, Clock,
  CheckCircle, XCircle, AlertCircle, Users, Download, Filter
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { getSocket, joinClassRoom } from '../lib/socket';

export default function AttendancePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    title: '', session_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '08:00', end_time: '09:30'
  });
  const [qrTimeLeft, setQrTimeLeft] = useState(null);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data.data),
  });

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions', selectedClass],
    queryFn: () => api.get(`/attendance/sessions/${selectedClass}`).then(r => r.data.data),
    enabled: !!selectedClass,
  });

  const { data: attendanceData, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance-session', selectedSession?.id],
    queryFn: () => api.get(`/attendance/session/${selectedSession?.id}`).then(r => r.data.data),
    enabled: !!selectedSession?.id,
    refetchInterval: selectedSession?.status === 'active' ? 5000 : false,
  });

  const { data: myAttendance } = useQuery({
    queryKey: ['my-attendance', user?.id],
    queryFn: () => api.get(`/attendance/student/${user?.id}`).then(r => r.data.data),
    enabled: user?.role === 'student',
  });

  // QR countdown timer
  useEffect(() => {
    if (!qrData?.expiresAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(qrData.expiresAt) - new Date()) / 1000));
      setQrTimeLeft(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [qrData?.expiresAt]);

  // Socket.IO
  useEffect(() => {
    if (!selectedClass) return;
    const socket = getSocket();
    joinClassRoom(selectedClass);
    socket.on('attendance_marked', (data) => {
      refetchAttendance();
      toast.success(`${data.studentName} marked ${data.status}`, { icon: '✅' });
    });
    socket.on('session_activated', () => refetchSessions());
    socket.on('session_closed', () => { refetchSessions(); setQrData(null); });
    return () => { socket.off('attendance_marked'); socket.off('session_activated'); socket.off('session_closed'); };
  }, [selectedClass]);

  const createSession = useMutation({
    mutationFn: (d) => api.post('/attendance/sessions', { ...d, class_id: selectedClass }),
    onSuccess: () => { toast.success('Session created'); refetchSessions(); setShowCreate(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const activateSession = useMutation({
    mutationFn: (id) => api.post(`/attendance/sessions/${id}/activate`),
    onSuccess: (res) => {
      setQrData(res.data.data);
      setSelectedSession(prev => ({ ...prev, status: 'active' }));
      refetchSessions();
      toast.success('Session activated! QR code ready.');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const regenerateQR = useMutation({
    mutationFn: (id) => api.post(`/attendance/sessions/${id}/regenerate-qr`),
    onSuccess: (res) => { setQrData(res.data.data); toast.success('QR refreshed'); },
  });

  const closeSession = useMutation({
    mutationFn: (id) => api.post(`/attendance/sessions/${id}/close`),
    onSuccess: () => { setQrData(null); refetchSessions(); toast.success('Session closed'); },
  });

  const manualOverride = useMutation({
    mutationFn: ({ id, status }) => api.put(`/attendance/${id}/manual`, { status }),
    onSuccess: () => { refetchAttendance(); toast.success('Updated'); },
  });

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ─── STUDENT VIEW ─── */
  if (user?.role === 'student') {
    const { records, stats } = myAttendance || {};
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">My Attendance</h1>
          <p className="page-subtitle">Track your attendance history and statistics</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Sessions', value: stats?.total,   color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: 'Present',        value: stats?.present, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Late',           value: stats?.late,    color: 'text-amber-600',   bg: 'bg-amber-50' },
            { label: 'Absent',         value: stats?.absent,  color: 'text-red-500',     bg: 'bg-red-50' },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value || 0}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rate */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">Overall Attendance Rate</span>
            <span className={`text-xl font-bold ${stats?.rate >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>{stats?.rate || 0}%</span>
          </div>
          <div className="progress-bar h-3">
            <div className={`progress-fill h-3 ${stats?.rate >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
              style={{ width: `${stats?.rate || 0}%` }} />
          </div>
          {stats?.rate < 75 && (
            <p className="text-xs text-red-500 mt-2">⚠️ Below minimum 75% requirement</p>
          )}
        </div>

        {/* History */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Attendance History</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {records?.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.class_name}</p>
                  <p className="text-xs text-slate-400">{r.session_date} · {r.session_title}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.method && <span className="text-xs text-slate-400 uppercase font-medium bg-slate-100 px-2 py-0.5 rounded-lg">{r.method}</span>}
                  <span className={`badge badge-${r.status}`}>{r.status}</span>
                </div>
              </div>
            ))}
            {!records?.length && (
              <div className="empty-state py-12">
                <CheckCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">No attendance records yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── TEACHER/ADMIN VIEW ─── */
  const presentCount = attendanceData?.records?.filter(r => r.status === 'present').length || 0;
  const lateCount    = attendanceData?.records?.filter(r => r.status === 'late').length    || 0;
  const absentCount  = attendanceData?.absentStudents?.length || 0;
  const totalCount   = presentCount + lateCount + absentCount;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Attendance Management</h1>
          <p className="page-subtitle">Create sessions, generate QR codes, track attendance</p>
        </div>
      </div>

      {/* Class selector */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-48">
          <label className="label">Select Class</label>
          <select className="input" value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setSelectedSession(null); setQrData(null); }}>
            <option value="">Choose a class...</option>
            {classesData?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedClass && (
          <div className="pt-5">
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Session
            </button>
          </div>
        )}
      </div>

      {/* Create session */}
      {showCreate && (
        <div className="card p-6 animate-fade-in-up">
          <h3 className="font-semibold text-slate-800 mb-4">Create New Session</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Session Title</label>
              <input className="input" placeholder="e.g., Lecture 1 - Introduction to Algebra"
                value={sessionForm.title} onChange={e => setSessionForm({ ...sessionForm, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={sessionForm.session_date}
                onChange={e => setSessionForm({ ...sessionForm, session_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={sessionForm.start_time}
                onChange={e => setSessionForm({ ...sessionForm, start_time: e.target.value })} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={sessionForm.end_time}
                onChange={e => setSessionForm({ ...sessionForm, end_time: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createSession.mutate(sessionForm)} className="btn-primary"
              disabled={createSession.isPending || !sessionForm.title}>
              {createSession.isPending ? 'Creating...' : 'Create Session'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {selectedClass && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sessions list */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Sessions</h3>
            </div>
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {sessions?.map(s => (
                <div key={s.id} onClick={() => setSelectedSession(s)}
                  className={`p-4 cursor-pointer transition-all hover:bg-slate-50 ${selectedSession?.id === s.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.session_date} · {s.start_time?.slice(0,5)}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${s.status === 'active' ? 'badge-active' : s.status === 'completed' ? 'badge-completed' : 'badge-late'}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-slate-400">
                    <span className="text-emerald-600 font-medium">✓ {s.present_count}</span>
                    <span className="text-amber-600 font-medium">⏰ {s.late_count}</span>
                  </div>
                </div>
              ))}
              {!sessions?.length && (
                <div className="empty-state py-10">
                  <p className="text-sm text-slate-400">No sessions yet</p>
                </div>
              )}
            </div>
          </div>

          {/* QR + Controls */}
          <div className="lg:col-span-3 space-y-4">
            {selectedSession ? (
              <>
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-800">{selectedSession.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{selectedSession.session_date}</p>
                    </div>
                    <span className={`badge ${selectedSession.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                      {selectedSession.status}
                    </span>
                  </div>

                  {selectedSession.status === 'scheduled' && (
                    <button onClick={() => activateSession.mutate(selectedSession.id)}
                      disabled={activateSession.isPending}
                      className="btn-success w-full justify-center py-3">
                      <Play className="w-4 h-4" />
                      {activateSession.isPending ? 'Activating...' : 'Activate Session & Generate QR'}
                    </button>
                  )}

                  {qrData && (
                    <div className="text-center">
                      {/* QR Code display */}
                      <div className="relative inline-block">
                        <div className={`p-4 rounded-2xl border-2 transition-colors ${qrTimeLeft === 0 ? 'border-red-200 bg-red-50' : 'border-primary-200 bg-white'}`}>
                          <img src={qrData.qrCode} alt="QR Code" className="w-52 h-52 mx-auto" />
                        </div>
                        {qrTimeLeft !== null && (
                          <div className={`absolute -top-3 -right-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm
                            ${qrTimeLeft > 60 ? 'bg-emerald-500 text-white' : qrTimeLeft > 0 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>
                            {qrTimeLeft > 0 ? formatTime(qrTimeLeft) : 'Expired'}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-3">
                        Expires: {format(new Date(qrData.expiresAt), 'HH:mm:ss')} · {qrData.expiryMinutes} min validity
                      </p>

                      <div className="flex gap-2 mt-4">
                        <button onClick={() => regenerateQR.mutate(selectedSession.id)}
                          className="btn-secondary flex-1 justify-center text-sm"
                          disabled={regenerateQR.isPending}>
                          <RefreshCw className={`w-4 h-4 ${regenerateQR.isPending ? 'animate-spin' : ''}`} />
                          Refresh QR
                        </button>
                        <button onClick={() => closeSession.mutate(selectedSession.id)}
                          className="btn-danger flex-1 justify-center text-sm">
                          <Square className="w-4 h-4" /> Close Session
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSession.status === 'active' && !qrData && (
                    <button onClick={() => activateSession.mutate(selectedSession.id)} className="btn-primary w-full justify-center">
                      <QrCode className="w-4 h-4" /> Show QR Code
                    </button>
                  )}
                </div>

                {/* Attendance stats */}
                {attendanceData && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Present', value: presentCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'Late',    value: lateCount,    color: 'text-amber-600',   bg: 'bg-amber-50' },
                      { label: 'Absent',  value: absentCount,  color: 'text-red-500',     bg: 'bg-red-50' },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="card empty-state py-16">
                <QrCode className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-400 font-medium">Select a session</p>
                <p className="text-sm text-slate-400 mt-1">Choose a session to manage attendance</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance table */}
      {selectedSession && attendanceData && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">
              Attendance Records
              <span className="ml-2 text-sm font-normal text-slate-400">({totalCount} students)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Time</th>
                  <th>GPS</th>
                  <th>Override</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.records?.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-600 text-xs font-bold">{r.student_name?.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-slate-800">{r.student_name}</span>
                      </div>
                    </td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td><span className="text-xs uppercase font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{r.method || '—'}</span></td>
                    <td className="text-slate-500 text-xs">{r.marked_at ? format(new Date(r.marked_at), 'HH:mm') : '—'}</td>
                    <td>
                      {r.gps_valid !== null && (
                        r.gps_valid
                          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                          : <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                    <td>
                      <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
                        value={r.status}
                        onChange={e => manualOverride.mutate({ id: r.id, status: e.target.value })}>
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {attendanceData.absentStudents?.map(s => (
                  <tr key={`absent-${s.id}`} className="opacity-50">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                          <span className="text-slate-400 text-xs font-bold">{s.name?.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-slate-600">{s.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-absent">absent</span></td>
                    <td colSpan={4} className="text-xs text-slate-400">Not marked</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
