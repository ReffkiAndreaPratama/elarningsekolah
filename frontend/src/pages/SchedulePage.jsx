import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import api from '../lib/api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const dayConfig = {
  Monday:    { color: 'border-blue-200 bg-blue-50',    dot: 'bg-blue-400',    text: 'text-blue-700',    card: 'bg-blue-500' },
  Tuesday:   { color: 'border-violet-200 bg-violet-50', dot: 'bg-violet-400',  text: 'text-violet-700',  card: 'bg-violet-500' },
  Wednesday: { color: 'border-emerald-200 bg-emerald-50', dot: 'bg-emerald-400', text: 'text-emerald-700', card: 'bg-emerald-500' },
  Thursday:  { color: 'border-orange-200 bg-orange-50', dot: 'bg-orange-400',  text: 'text-orange-700',  card: 'bg-orange-500' },
  Friday:    { color: 'border-pink-200 bg-pink-50',    dot: 'bg-pink-400',    text: 'text-pink-700',    card: 'bg-pink-500' },
  Saturday:  { color: 'border-amber-200 bg-amber-50',  dot: 'bg-amber-400',   text: 'text-amber-700',   card: 'bg-amber-500' },
  Sunday:    { color: 'border-slate-200 bg-slate-50',  dot: 'bg-slate-400',   text: 'text-slate-600',   card: 'bg-slate-400' },
};

export default function SchedulePage() {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => api.get('/dashboard/schedule').then(r => r.data.data),
  });

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = schedules?.filter(s => s.day_of_week === day) || [];
    return acc;
  }, {});

  const totalClasses = schedules?.length || 0;
  const todayClasses = byDay[today]?.length || 0;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(7)].map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Weekly Schedule</h1>
        <p className="page-subtitle">Your class timetable for the week</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-3xl font-bold text-slate-900">{totalClasses}</p>
          <p className="text-sm text-slate-500 mt-1">Total Classes/Week</p>
        </div>
        <div className="card p-5">
          <p className="text-3xl font-bold text-primary-600">{todayClasses}</p>
          <p className="text-sm text-slate-500 mt-1">Classes Today</p>
        </div>
        <div className="card p-5">
          <p className="text-3xl font-bold text-slate-900">{DAYS.filter(d => byDay[d].length > 0).length}</p>
          <p className="text-sm text-slate-500 mt-1">Active Days</p>
        </div>
        <div className="card p-5">
          <p className="text-lg font-bold text-slate-900 capitalize">{today}</p>
          <p className="text-sm text-slate-500 mt-1">Today</p>
        </div>
      </div>

      {/* Today highlight */}
      {byDay[today]?.length > 0 && (
        <div className="card p-5 border-l-4 border-l-primary-500 bg-gradient-to-r from-primary-50/50 to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <h3 className="font-semibold text-slate-800">Today — {today}</h3>
            <span className="badge badge-active">{byDay[today].length} classes</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {byDay[today].map(s => (
              <div key={s.id} className="bg-white rounded-xl p-4 border border-primary-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{s.class_name}</p>
                  <p className="text-xs text-slate-500">{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</p>
                  {s.teacher_name && <p className="text-xs text-slate-400">{s.teacher_name}</p>}
                </div>
                {s.room && (
                  <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                    <MapPin className="w-3 h-3" />{s.room}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full week grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DAYS.map(day => {
          const cfg = dayConfig[day];
          const isToday = day === today;
          const items = byDay[day];
          return (
            <div key={day} className={`card border overflow-hidden ${cfg.color} ${isToday ? 'ring-2 ring-primary-400 ring-offset-2' : ''}`}>
              <div className="px-4 py-3 border-b border-inherit flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-sm font-bold ${isToday ? 'text-primary-700' : cfg.text}`}>{day}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isToday && <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full font-medium">Today</span>}
                  <span className="text-xs text-slate-400 font-medium">{items.length}</span>
                </div>
              </div>
              <div className="p-3 space-y-2 min-h-20">
                {items.length === 0 ? (
                  <div className="flex items-center justify-center h-16">
                    <p className="text-xs text-slate-400">No classes</p>
                  </div>
                ) : (
                  items.map(s => (
                    <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm border border-white/80">
                      <p className="text-xs font-bold text-slate-800 line-clamp-1 mb-1">{s.class_name}</p>
                      {s.subject && <p className="text-xs text-slate-500 line-clamp-1 mb-1">{s.subject}</p>}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <p className="text-xs text-slate-500">{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</p>
                      </div>
                      {s.room && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <p className="text-xs text-slate-400">{s.room}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalClasses === 0 && (
        <div className="card empty-state py-20">
          <div className="empty-state-icon">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-600">No schedule found</p>
          <p className="text-sm text-slate-400 mt-1">Your schedule will appear here once classes are assigned</p>
        </div>
      )}
    </div>
  );
}
