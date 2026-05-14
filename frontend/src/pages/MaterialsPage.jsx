import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, Download, Plus, BookOpen, Link as LinkIcon, Video } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const typeIcons = {
  pdf: FileText,
  video: Video,
  text: BookOpen,
  link: LinkIcon,
  image: FileText,
};

const typeColors = {
  pdf: 'bg-red-100 text-red-600',
  video: 'bg-purple-100 text-purple-600',
  text: 'bg-blue-100 text-blue-600',
  link: 'bg-green-100 text-green-600',
  image: 'bg-orange-100 text-orange-600',
};

export default function MaterialsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'text', content: '', url: '' });
  const [file, setFile] = useState(null);
  const [viewMaterial, setViewMaterial] = useState(null);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data.data),
  });

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials', selectedClass],
    queryFn: () => api.get(`/materials/${selectedClass}`).then(r => r.data.data),
    enabled: !!selectedClass,
  });

  const uploadMaterial = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append('class_id', selectedClass);
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('type', form.type);
      if (form.content) formData.append('content', form.content);
      if (form.url) formData.append('url', form.url);
      if (file) formData.append('file', file);
      return api.post('/materials', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success('Material uploaded');
      queryClient.invalidateQueries(['materials', selectedClass]);
      setShowUpload(false);
      setForm({ title: '', description: '', type: 'text', content: '', url: '' });
      setFile(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed'),
  });

  const deleteMaterial = useMutation({
    mutationFn: (id) => api.delete(`/materials/${id}`),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries(['materials', selectedClass]); },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Learning Materials</h1>
          <p className="page-subtitle">Access course materials and resources</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'teacher') && selectedClass && (
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Upload className="w-4 h-4" />
            Upload Material
          </button>
        )}
      </div>

      {/* Class selector */}
      <select className="input max-w-xs" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
        <option value="">Select a class...</option>
        {classesData?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {/* Upload form */}
      {showUpload && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Upload Material</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Title *</label>
              <input className="input" placeholder="Material title" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="text">Text Content</option>
                <option value="pdf">PDF Document</option>
                <option value="video">Video</option>
                <option value="link">External Link</option>
                <option value="image">Image</option>
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" placeholder="Brief description" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            {(form.type === 'pdf' || form.type === 'video' || form.type === 'image') && (
              <div className="col-span-2">
                <label className="label">Upload File</label>
                <input type="file" className="input" onChange={e => setFile(e.target.files[0])}
                  accept={form.type === 'pdf' ? '.pdf' : form.type === 'video' ? 'video/*' : 'image/*'} />
              </div>
            )}

            {form.type === 'link' && (
              <div className="col-span-2">
                <label className="label">URL</label>
                <input className="input" placeholder="https://..." value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })} />
              </div>
            )}

            {form.type === 'text' && (
              <div className="col-span-2">
                <label className="label">Content</label>
                <textarea className="input" rows={6} placeholder="Write your content here..."
                  value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => uploadMaterial.mutate()} className="btn-primary" disabled={uploadMaterial.isPending || !form.title}>
              {uploadMaterial.isPending ? 'Uploading...' : 'Upload'}
            </button>
            <button onClick={() => setShowUpload(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Materials grid */}
      {!selectedClass ? (
        <div className="text-center py-16 text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Select a class to view materials</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials?.map(m => {
            const Icon = typeIcons[m.type] || FileText;
            const colorClass = typeColors[m.type] || 'bg-slate-100 text-slate-600';
            return (
              <div key={m.id} className="card p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.file_path && (
                      <a href={`/api/materials/file/${m.id}`} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    {(user?.role === 'admin' || user?.role === 'teacher') && (
                      <button onClick={() => { if (confirm('Delete?')) deleteMaterial.mutate(m.id); }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-slate-800 mb-1 line-clamp-2">{m.title}</h3>
                {m.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{m.description}</p>}

                <div className="flex items-center justify-between mt-auto">
                  <span className={`badge ${colorClass} capitalize`}>{m.type}</span>
                  <span className="text-xs text-slate-400">{format(new Date(m.created_at), 'MMM d')}</span>
                </div>

                {m.type === 'text' && m.content && (
                  <button
                    onClick={() => setViewMaterial(m)}
                    className="mt-3 text-xs text-primary-500 hover:text-primary-600 font-medium"
                  >
                    Read content →
                  </button>
                )}

                {m.type === 'link' && m.url && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer"
                    className="mt-3 text-xs text-primary-500 hover:text-primary-600 font-medium block">
                    Open link →
                  </a>
                )}
              </div>
            );
          })}

          {materials?.length === 0 && (
            <div className="col-span-3 text-center py-16 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No materials uploaded yet</p>
            </div>
          )}
        </div>
      )}

      {/* View text content modal */}
      {viewMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewMaterial(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{viewMaterial.title}</h2>
            {viewMaterial.description && <p className="text-sm text-slate-500 mb-4">{viewMaterial.description}</p>}
            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{viewMaterial.content}</div>
            <button onClick={() => setViewMaterial(null)} className="btn-secondary mt-6">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
