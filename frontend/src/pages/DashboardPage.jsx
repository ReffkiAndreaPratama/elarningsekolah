import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, ClipboardCheck, TrendingUp, Calendar,
  AlertCircle, CheckCircle, Clock, QrCode, ArrowRight,
  Activity, Award, Target, Zap
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { format } from 'date-fns';

const StatCard = ({ icon: Icon, label, value, color, bgColor, trend, sub }) => (
  <div className="card p-5 animate-fade-in-up">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-11 h-11 ${bgColor} rounded-2xl flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      {trend && (
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{value ?? '—'}</p>
    <p className="text-sm text-slate-500">{label}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data.data),
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
      </div>
    </div>
  );

  /* ─── ADMIN ─── */
  if (user?.role === 'admin') {
    const { userStats, classStats, attendanceStats, recentSessions, attendanceTrend } = data || {};
    const total = (attendanceStats?.present || 0) + (attendanceStats?.late || 0) + (attendanceStats?.absent || 0);
    const rate = total > 0 ? Math.round(((attendanceStats?.present + attendanceStats?.late) / total) * 100) : 0;
    const pieData = [
      { name: 'Present', value: attendanceStats?.present || 0, color: '#10b981' },
      { name: 'Late',    value: attendanceStats?.late    || 0, color: '#f59e0b' },
      { name: 'Absent',  value: attendanceStats?.absent  || 0, color: '#ef4444' },
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">System overview and analytics</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}         label="Total Users"    value={userStats?.total_users}    color="text-blue-600"    bgColor="bg-blue-50"    stagger="stagger-1" />
          <StatCard icon={Users}         label="Students"       value={userStats?.total_students}  color="text-emerald-600" bgColor="bg-emerald-50" stagger="stagger-2" />
          <StatCard icon={Users}         label="Teachers"       value={userStats?.total_teachers}  color="text-purple-600"  bgColor="bg-purple-50"  stagger="stagger-3" />
          <StatCard icon={BookOpen}      label="Active Classes" value={classStats?.total_classes}  color="text-orange-600"  bgColor="bg-orange-50"  stagger="stagger-4" />
        </div>

        {/* Attendance rate banner */}
        <div className="card p-6 bg-gradient-to-r from-primary-600 to-blue-500 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Overall Attendance Rate (30 days)</p>
              <p className="text-4xl font-bold">{rate}%</p>
              <p className="text-blue-200 text-sm mt-1">{total} total records</p>
            </div>
            <div className="w-20 h-20 relative">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3"
                  strokeDasharray={`${rate} ${100 - rate}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{rate}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend chart */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-500" />
              Attendance Trend (7 days)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={attendanceTrend || []} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => format(new Date(d), 'MM/dd')} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} fill="url(#gPresent)" name="Present" />
                <Area type="monotone" dataKey="late"    stroke="#f59e0b" strokeWidth={2} fill="url(#gLate)"    name="Late" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary-500" />
              Distribution
            </h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent sessions */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Sessions</h3>
            <Link to="/attendance" className="text-xs text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentSessions?.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.class_name}</p>
                    <p className="text-xs text-slate-400">{s.teacher_name} · {s.session_date}</p>
                  </div>
                </div>
                <span className={`badge ${s.status === 'active' ? 'badge-active' : 'badge-completed'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── TEACHER ─── */
  if (user?.role === 'teacher') {
    const { myClasses, myStudents, todayAttendance, activeSessions, recentClasses, pendingSubmissions } = data || {};
    const totalToday = (todayAttendance?.present || 0) + (todayAttendance?.late || 0) + (todayAttendance?.absent || 0);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Teacher Dashboard</h1>
          <p className="page-subtitle">Manage your classes and track student progress</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BookOpen}      label="My Classes"      value={myClasses}          color="text-blue-600"    bgColor="bg-blue-50" />
          <StatCard icon={Users}         label="My Students"     value={myStudents}         color="text-emerald-600" bgColor="bg-emerald-50" />
          <StatCard icon={CheckCircle}   label="Today Present"   value={todayAttendance?.present || 0} color="text-emerald-600" bgColor="bg-emerald-50" />
          <StatCard icon={AlertCircle}   label="Pending Grades"  value={pendingSubmissions} color="text-orange-600"  bgColor="bg-orange-50" />
        </div>

        {/* Active sessions alert */}
        {activeSessions?.length > 0 && (
          <div className="card p-5 border-l-4 border-l-emerald-500 bg-emerald-50/30 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <h3 className="font-semibold text-slate-800 text-sm">Live Sessions</h3>
              <span className="badge badge-active">{activeSessions.length} active</span>
            </div>
            <div className="space-y-2">
              {activeSessions.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-emerald-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.class_name}</p>
                    <p className="text-xs text-slate-500">{s.title}</p>
                  </div>
                  <Link to="/attendance" className="btn-success text-xs py-1.5 px-3">
                    <Zap className="w-3 h-3" /> Manage
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today attendance breakdown */}
        {totalToday > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-500" />
              Today's Attendance
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Present', value: todayAttendance?.present || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Late',    value: todayAttendance?.late    || 0, color: 'text-amber-600',   bg: 'bg-amber-50' },
                { label: 'Absent',  value: todayAttendance?.absent  || 0, color: 'text-red-500',     bg: 'bg-red-50' },
              ].map(item => (
                <div key={item.label} className={`${item.bg} rounded-2xl p-4 text-center`}>
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
              {totalToday > 0 && <>
                <div className="bg-emerald-400 rounded-full transition-all" style={{ width: `${(todayAttendance?.present / totalToday) * 100}%` }} />
                <div className="bg-amber-400 rounded-full transition-all"   style={{ width: `${(todayAttendance?.late    / totalToday) * 100}%` }} />
                <div className="bg-red-400 rounded-full transition-all"     style={{ width: `${(todayAttendance?.absent  / totalToday) * 100}%` }} />
              </>}
            </div>
          </div>
        )}

        {/* Classes */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">My Classes</h3>
            <Link to="/classes" className="text-xs text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentClasses?.map(cls => (
              <Link key={cls.id} to={`/classes/${cls.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-primary-100 to-blue-100 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{cls.name}</p>
                    <p className="text-xs text-slate-400">{cls.subject} · {cls.student_count} students</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cls.room && <span className="text-xs text-slate-400">{cls.room}</span>}
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── STUDENT ─── */
  const { enrolledClasses, attendanceStats, upcomingAssignments, todaySchedule, activeSessions, recentAttendance } = data || {};
  const rate = attendanceStats?.rate || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Dashboard</h1>
        <p className="page-subtitle">Track your learning progress</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen}    label="Enrolled Classes" value={enrolledClasses}         color="text-blue-600"    bgColor="bg-blue-50" />
        <StatCard icon={TrendingUp}  label="Attendance Rate"  value={`${rate}%`}              color={rate >= 75 ? 'text-emerald-600' : 'text-red-500'} bgColor={rate >= 75 ? 'bg-emerald-50' : 'bg-red-50'} />
        <StatCard icon={CheckCircle} label="Present"          value={attendanceStats?.present} color="text-emerald-600" bgColor="bg-emerald-50" />
        <StatCard icon={AlertCircle} label="Absent"           value={attendanceStats?.absent}  color="text-red-500"     bgColor="bg-red-50" />
      </div>

      {/* Attendance rate bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-semibold text-slate-700">Attendance Rate</span>
          </div>
          <span className={`text-lg font-bold ${rate >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>{rate}%</span>
        </div>
        <div className="progress-bar h-3">
          <div className={`progress-fill h-3 ${rate >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
            style={{ width: `${rate}%` }} />
        </div>
        {rate < 75 && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Below 75% minimum requirement. Need {75 - rate}% more.
          </p>
        )}
      </div>

      {/* Active sessions */}
      {activeSessions?.length > 0 && (
        <div className="card p-5 border-l-4 border-l-primary-500 bg-primary-50/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <h3 className="font-semibold text-slate-800 text-sm">Class in Progress</h3>
          </div>
          <div className="space-y-2">
            {activeSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-primary-100">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.class_name}</p>
                  <p className="text-xs text-slate-500">{s.subject}</p>
                </div>
                <Link to="/attendance/scan" className="btn-primary text-xs py-1.5 px-3">
                  <QrCode className="w-3 h-3" /> Scan QR
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today schedule */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-500" />
              Today's Schedule
            </h3>
            <Link to="/schedule" className="text-xs text-primary-600 font-medium flex items-center gap-1">
              Full <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {todaySchedule?.length === 0 ? (
              <div className="empty-state py-8">
                <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No classes today</p>
              </div>
            ) : (
              todaySchedule?.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="w-1 h-10 bg-primary-400 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.class_name}</p>
                    <p className="text-xs text-slate-500">{s.teacher_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-slate-700">{s.start_time?.slice(0,5)}</p>
                    <p className="text-xs text-slate-400">{s.end_time?.slice(0,5)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming assignments */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary-500" />
              Upcoming Assignments
            </h3>
            <Link to="/assignments" className="text-xs text-primary-600 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {upcomingAssignments?.length === 0 ? (
              <div className="empty-state py-8">
                <ClipboardCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No upcoming assignments</p>
              </div>
            ) : (
              upcomingAssignments?.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.class_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">{format(new Date(a.due_date), 'MMM d')}</p>
                    {a.submitted
                      ? <span className="badge badge-present text-xs">Done</span>
                      : <span className="badge badge-late text-xs">Pending</span>
                    }
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent attendance */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Recent Attendance</h3>
          <Link to="/attendance" className="text-xs text-primary-600 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {recentAttendance?.map(a => (
            <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
              <div>
                <p className="text-sm font-medium text-slate-800">{a.class_name}</p>
                <p className="text-xs text-slate-400">{a.session_date} · {a.session_title}</p>
              </div>
              <div className="flex items-center gap-2">
                {a.method && <span className="text-xs text-slate-400 uppercase font-medium">{a.method}</span>}
                <span className={`badge badge-${a.status}`}>{a.status}</span>
              </div>
            </div>
          ))}
          {!recentAttendance?.length && (
            <div className="empty-state py-8">
              <p className="text-sm text-slate-400">No attendance records yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
