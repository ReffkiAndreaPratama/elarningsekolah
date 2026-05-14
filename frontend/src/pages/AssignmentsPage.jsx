import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Clock, CheckCircle, AlertCircle, Upload, Star } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';

export default function AssignmentsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showSubmit, setShowSubmit] = useState(null);
  const [showSubmissions, setShowSubmissions] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', max_score: 100 });
  const [submitForm, setSubmitForm] = useState({ content: '' });
  const [submitFile, setSubmitFile] = useState(null);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data.data),
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments', selectedClass],
    queryFn: () => api.get(`/assignments/${selectedClass}`).then(r => r.data.data),
    enabled: !!selectedClass,
  });

  const { data: submissions } = useQuery({
    queryKey: ['submissions', showSubmissions],
    queryFn: () => api.get(`/assignments/${showSubmissions}/submissions`).then(r => r.data.data),
    enabled: !!showSubmissions,
  });

  const createAssignment = useMutation({
    mutationFn: (data) => api.post('/assignments', { ...data, class_id: selectedClass }),
    onSuccess: () => {
      toast.success('Assignment created');
      queryClient.invalidateQueries(['assignments', selectedClass]);
      setShowCreate(false);
      setForm({ title: '', description: '', due_date: '', max_score: 100 });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const submitAssignment = useMutation({
    mutationFn: (assignmentId) => {
      const formData = new FormData();
      if (submitForm.content) formData.append('content', submitForm.content);
      if (submitFile) formData.append('file', submitFile);
      return api.post(`/assignments/${assignmentId}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries(['assignments', selectedClass]);
      setShowSubmit(null);
      setSubmitForm({ content: '' });
      setSubmitFile(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const gradeSubmission = useMutation({
    mutationFn: ({ id, score, feedback }) => api.put(`/assignments/submissions/${id}/grade`, { score, feedback }),
    onSuccess: () => { toast.success('Graded'); queryClient.invalidateQueries(['submissions', showSubmissions]); },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">{user?.role === 'student' ? 'View and submit assignments' : 'Create and manage assignments'}</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'teacher') && selectedClass && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Assignment
          </button>
        )}
      </div>

      <select className="input max-w-xs" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
        <option value="">Select a class...</option>
        {classesData?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {/* Create form */}
      {showCreate && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Create Assignment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Title *</label>
              <input className="input" placeholder="Assignment title" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Description *</label>
              <textarea className="input" rows={4} placeholder="Assignment instructions..."
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input type="datetime-local" className="input" value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Max Score</label>
              <input type="number" className="input" value={form.max_score}
                onChange={e => setForm({ ...form, max_score: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createAssignment.mutate(form)} className="btn-primary"
              disabled={createAssignment.isPending || !form.title || !form.description || !form.due_date}>
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Assignments list */}
      {!selectedClass ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Select a class to view assignments</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {assignments?.map(a => {
            const isOverdue = isPast(new Date(a.due_date));
            const submitted = a.my_submission;
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800">{a.title}</h3>
                      {submitted && <span className="badge bg-green-100 text-green-700">Submitted</span>}
                      {isOverdue && !submitted && <span className="badge bg-red-100 text-red-700">Overdue</span>}
                    </div>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{a.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {format(new Date(a.due_date), 'MMM d, yyyy HH:mm')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {a.max_score} pts
                      </span>
                      {user?.role !== 'student' && (
                        <span>{a.submission_count} submissions</span>
                      )}
                    </div>
                    {submitted?.score !== null && submitted?.score !== undefined && (
                      <div className="mt-2 p-2 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">
                          Score: {submitted.score}/{a.max_score}
                        </p>
                        {submitted.feedback && <p className="text-xs text-green-600 mt-1">{submitted.feedback}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {user?.role === 'student' && !submitted && (
                      <button onClick={() => setShowSubmit(a)} className="btn-primary text-sm">
                        <Upload className="w-4 h-4" />
                        Submit
                      </button>
                    )}
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      <button onClick={() => setShowSubmissions(a.id)} className="btn-secondary text-sm">
                        View Submissions
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {assignments?.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No assignments yet</p>
            </div>
          )}
        </div>
      )}

      {/* Submit modal */}
      {showSubmit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1">{showSubmit.title}</h2>
            <p className="text-sm text-slate-500 mb-4">Due: {format(new Date(showSubmit.due_date), 'MMM d, yyyy HH:mm')}</p>
            <div className="space-y-4">
              <div>
                <label className="label">Your Answer</label>
                <textarea className="input" rows={5} placeholder="Write your answer here..."
                  value={submitForm.content} onChange={e => setSubmitForm({ ...submitForm, content: e.target.value })} />
              </div>
              <div>
                <label className="label">Attachment (optional)</label>
                <input type="file" className="input" onChange={e => setSubmitFile(e.target.files[0])} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => submitAssignment.mutate(showSubmit.id)} className="btn-primary"
                disabled={submitAssignment.isPending || (!submitForm.content && !submitFile)}>
                {submitAssignment.isPending ? 'Submitting...' : 'Submit Assignment'}
              </button>
              <button onClick={() => setShowSubmit(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Submissions modal */}
      {showSubmissions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Submissions</h2>
            <div className="space-y-3">
              {submissions?.map(s => (
                <div key={s.id} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-slate-800">{s.student_name}</p>
                    <span className={`badge ${s.status === 'graded' ? 'bg-green-100 text-green-700' : s.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.status}
                    </span>
                  </div>
                  {s.content && <p className="text-sm text-slate-600 mb-3 line-clamp-3">{s.content}</p>}
                  <p className="text-xs text-slate-400 mb-3">Submitted: {format(new Date(s.submitted_at), 'MMM d, HH:mm')}</p>
                  {s.status !== 'graded' && (
                    <div className="flex gap-2">
                      <input type="number" className="input w-24 text-sm" placeholder="Score"
                        id={`score-${s.id}`} />
                      <input className="input flex-1 text-sm" placeholder="Feedback..."
                        id={`feedback-${s.id}`} />
                      <button
                        onClick={() => gradeSubmission.mutate({
                          id: s.id,
                          score: document.getElementById(`score-${s.id}`).value,
                          feedback: document.getElementById(`feedback-${s.id}`).value,
                        })}
                        className="btn-primary text-sm"
                      >
                        Grade
                      </button>
                    </div>
                  )}
                  {s.status === 'graded' && (
                    <p className="text-sm text-green-600 font-medium">Score: {s.score} • {s.feedback}</p>
                  )}
                </div>
              ))}
              {!submissions?.length && <p className="text-center text-slate-400 py-8">No submissions yet</p>}
            </div>
            <button onClick={() => setShowSubmissions(null)} className="btn-secondary mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
