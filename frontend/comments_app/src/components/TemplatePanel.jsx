import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, FileText, Trash2, Edit2 } from 'lucide-react';
import api from '../api/api';

const TemplatePanel = ({ onTemplatesChange }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [form, setForm] = useState({ title: '', key: '', content: '' });

    // Fetch templates
    const fetchTemplates = async () => {
        try {
            const { data } = await api.get('/templates');
            setTemplates(data);
            if (onTemplatesChange) onTemplatesChange(data);
        } catch (e) {
            console.error('Failed to fetch templates:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    // Save template (create or update)
    const handleSave = async () => {
        if (!form.title || !form.key || !form.content) {
            toast.error('All fields are required');
            return;
        }

        try {
            if (editingTemplate) {
                await api.put(`/templates/${editingTemplate.id}`, form);
                toast.success('Template updated');
            } else {
                await api.post('/templates', form);
                toast.success('Template created');
            }
            setShowForm(false);
            setEditingTemplate(null);
            setForm({ title: '', key: '', content: '' });
            fetchTemplates();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to save template');
        }
    };

    // Delete template
    const handleDelete = async (id) => {
        if (!confirm('Delete this template?')) return;
        try {
            await api.delete(`/templates/${id}`);
            toast.success('Template deleted');
            fetchTemplates();
        } catch (e) {
            toast.error('Failed to delete template');
        }
    };

    return (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600" />
                        Templates
                    </h3>
                    <button
                        onClick={() => {
                            setShowForm(true);
                            setEditingTemplate(null);
                            setForm({ title: '', key: '', content: '' });
                        }}
                        className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Type "/" in reply box to use</p>
            </div>

            {/* Form */}
            {showForm && (
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Title (e.g., Greeting)"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2"
                    />
                    <div className="flex items-center gap-1 mb-2">
                        <span className="text-gray-500">/</span>
                        <input
                            type="text"
                            value={form.key}
                            onChange={(e) => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                            placeholder="key"
                            className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg"
                        />
                    </div>
                    <textarea
                        value={form.content}
                        onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                        placeholder="Template content..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2 h-24 resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowForm(false)}
                            className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            {editingTemplate ? 'Update' : 'Save'}
                        </button>
                    </div>
                </div>
            )}

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                    <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
                ) : templates.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No templates yet</p>
                ) : (
                    templates.map(template => (
                        <div
                            key={template.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 text-sm">{template.title}</span>
                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                            /{template.key}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                        {template.content}
                                    </p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingTemplate(template);
                                            setForm({ title: template.title, key: template.key, content: template.content });
                                            setShowForm(true);
                                        }}
                                        className="p-1 text-gray-400 hover:text-indigo-600"
                                        title="Edit"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TemplatePanel;
