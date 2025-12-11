import { useState, useEffect } from 'react';
import {
    Database, Plus, Trash2, Edit3, Save, X, ChevronDown,
    Check, Loader2, RefreshCw, AlertCircle, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:8000/api';

const ManageDatabasePage = () => {
    const { user } = useAuth();
    const token = localStorage.getItem('token');

    // State
    const [configs, setConfigs] = useState([]);
    const [selectedConfig, setSelectedConfig] = useState(null);
    const [collections, setCollections] = useState([]);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [activeConfig, setActiveConfig] = useState(null);
    const [loading, setLoading] = useState({ configs: false, collections: false, documents: false });

    // Modal states
    const [showAddDbModal, setShowAddDbModal] = useState(false);
    const [showAddCollectionModal, setShowAddCollectionModal] = useState(false);
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [editingDocument, setEditingDocument] = useState(null);

    // Form states
    const [dbForm, setDbForm] = useState({ name: '', apiKey: '', tenant: '', database: '' });
    const [collectionName, setCollectionName] = useState('');
    const [documentForm, setDocumentForm] = useState({
        title: '',
        tags: '',
        sample_questions: '',
        content: ''
    });

    // Fetch configs on mount
    useEffect(() => {
        fetchConfigs();
        fetchActiveConfig();
    }, []);

    // Fetch collections when config changes
    useEffect(() => {
        if (selectedConfig) {
            fetchCollections(selectedConfig.id);
        } else {
            setCollections([]);
            setSelectedCollection(null);
        }
    }, [selectedConfig]);

    // Fetch documents when collection changes
    useEffect(() => {
        if (selectedConfig && selectedCollection) {
            fetchDocuments(selectedConfig.id, selectedCollection);
        } else {
            setDocuments([]);
        }
    }, [selectedCollection]);

    const fetchConfigs = async () => {
        setLoading(prev => ({ ...prev, configs: true }));
        try {
            const res = await fetch(`${API_BASE}/admin/chroma/configs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setConfigs(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error('Failed to load database configs');
        } finally {
            setLoading(prev => ({ ...prev, configs: false }));
        }
    };

    const fetchActiveConfig = async () => {
        try {
            const res = await fetch(`${API_BASE}/admin/chroma/active`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.active) {
                setActiveConfig(data.config);
            }
        } catch (e) {
            console.error('Failed to fetch active config');
        }
    };

    const fetchCollections = async (configId) => {
        setLoading(prev => ({ ...prev, collections: true }));
        try {
            const res = await fetch(`${API_BASE}/admin/chroma/collections/${configId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setCollections(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error('Failed to load collections');
            setCollections([]);
        } finally {
            setLoading(prev => ({ ...prev, collections: false }));
        }
    };

    const fetchDocuments = async (configId, collectionName) => {
        setLoading(prev => ({ ...prev, documents: true }));
        try {
            const res = await fetch(`${API_BASE}/admin/chroma/documents/${configId}/${collectionName}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setDocuments(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error('Failed to load documents');
            setDocuments([]);
        } finally {
            setLoading(prev => ({ ...prev, documents: false }));
        }
    };

    // Add database config
    const handleAddDatabase = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/admin/chroma/configs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(dbForm)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Database added successfully');
            setShowAddDbModal(false);
            setDbForm({ name: '', apiKey: '', tenant: '', database: '' });
            fetchConfigs();
        } catch (e) {
            toast.error(e.message || 'Failed to add database');
        }
    };

    // Delete database config
    const handleDeleteConfig = async (configId) => {
        if (!confirm('Delete this database configuration?')) return;
        try {
            await fetch(`${API_BASE}/admin/chroma/configs/${configId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Database config deleted');
            if (selectedConfig?.id === configId) {
                setSelectedConfig(null);
            }
            fetchConfigs();
        } catch (e) {
            toast.error('Failed to delete config');
        }
    };

    // Add collection
    const handleAddCollection = async (e) => {
        e.preventDefault();
        if (!selectedConfig) return;
        try {
            const res = await fetch(`${API_BASE}/admin/chroma/collections/${selectedConfig.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: collectionName })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Collection created');
            setShowAddCollectionModal(false);
            setCollectionName('');
            fetchCollections(selectedConfig.id);
        } catch (e) {
            toast.error(e.message || 'Failed to create collection');
        }
    };

    // Delete collection
    const handleDeleteCollection = async (name) => {
        if (!confirm(`Delete collection "${name}"? This will remove all documents!`)) return;
        try {
            await fetch(`${API_BASE}/admin/chroma/collections/${selectedConfig.id}/${name}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Collection deleted');
            if (selectedCollection === name) {
                setSelectedCollection(null);
            }
            fetchCollections(selectedConfig.id);
        } catch (e) {
            toast.error('Failed to delete collection');
        }
    };

    // Open document modal for add/edit
    const openDocumentModal = (doc = null) => {
        if (doc) {
            setEditingDocument(doc);
            setDocumentForm({
                title: doc.title || '',
                tags: (doc.tags || []).join(', '),
                sample_questions: (doc.sample_questions || []).join('\n'),
                content: doc.content || ''
            });
        } else {
            setEditingDocument(null);
            setDocumentForm({ title: '', tags: '', sample_questions: '', content: '' });
        }
        setShowDocumentModal(true);
    };

    // Save document (add or update)
    const handleSaveDocument = async (e) => {
        e.preventDefault();
        const doc = {
            title: documentForm.title,
            tags: documentForm.tags.split(',').map(t => t.trim()).filter(Boolean),
            sample_questions: documentForm.sample_questions.split('\n').map(q => q.trim()).filter(Boolean),
            content: documentForm.content
        };

        try {
            const url = editingDocument
                ? `${API_BASE}/admin/chroma/documents/${selectedConfig.id}/${selectedCollection}/${editingDocument.id}`
                : `${API_BASE}/admin/chroma/documents/${selectedConfig.id}/${selectedCollection}`;

            const res = await fetch(url, {
                method: editingDocument ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(doc)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success(editingDocument ? 'Document updated' : 'Document added');
            setShowDocumentModal(false);
            fetchDocuments(selectedConfig.id, selectedCollection);
        } catch (e) {
            toast.error(e.message || 'Failed to save document');
        }
    };

    // Delete document
    const handleDeleteDocument = async (docId) => {
        if (!confirm('Delete this document?')) return;
        try {
            await fetch(`${API_BASE}/admin/chroma/documents/${selectedConfig.id}/${selectedCollection}/${docId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Document deleted');
            fetchDocuments(selectedConfig.id, selectedCollection);
        } catch (e) {
            toast.error('Failed to delete document');
        }
    };

    // Activate config and collection
    const handleActivate = async () => {
        if (!selectedConfig || !selectedCollection) {
            toast.error('Please select a database and collection first');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/admin/chroma/activate/${selectedConfig.id}/${selectedCollection}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Database activated! RAG system now uses this configuration.');
            fetchActiveConfig();
            fetchConfigs();
        } catch (e) {
            toast.error(e.message || 'Failed to activate');
        }
    };

    const isCurrentlyActive = selectedConfig && selectedCollection &&
        activeConfig?.id === selectedConfig.id &&
        activeConfig?.activeCollection === selectedCollection;

    return (
        <div className="flex-1 h-full overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <Database className="text-indigo-600" size={28} />
                    Manage Database
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    Connect to ChromaDB instances and manage knowledge base documents
                </p>
            </div>

            {/* Active Config Indicator */}
            {activeConfig && (
                <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                            <Zap size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-emerald-800">Currently Active</p>
                            <p className="text-emerald-600">
                                <span className="font-semibold">{activeConfig.name}</span>
                                <span className="mx-2">→</span>
                                <span className="font-mono bg-emerald-100 px-2 py-0.5 rounded">
                                    {activeConfig.activeCollection}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Selectors Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Database Selector */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">Database</label>
                        <button
                            onClick={() => setShowAddDbModal(true)}
                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1"
                        >
                            <Plus size={14} /> Add Database
                        </button>
                    </div>

                    <div className="relative">
                        <select
                            value={selectedConfig?.id || ''}
                            onChange={(e) => {
                                const config = configs.find(c => c.id === parseInt(e.target.value));
                                setSelectedConfig(config || null);
                                setSelectedCollection(null);
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Select a database...</option>
                            {configs.map(config => (
                                <option key={config.id} value={config.id}>
                                    {config.name} ({config.database})
                                    {config.isActive ? ' ✓ Active' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                    </div>

                    {selectedConfig && (
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span>Tenant: {selectedConfig.tenant}</span>
                            <button
                                onClick={() => handleDeleteConfig(selectedConfig.id)}
                                className="text-red-500 hover:text-red-700 flex items-center gap-1"
                            >
                                <Trash2 size={12} /> Remove
                            </button>
                        </div>
                    )}
                </div>

                {/* Collection Selector */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">Collection</label>
                        <button
                            onClick={() => setShowAddCollectionModal(true)}
                            disabled={!selectedConfig}
                            className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-100 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={14} /> Add Collection
                        </button>
                    </div>

                    <div className="relative">
                        <select
                            value={selectedCollection || ''}
                            onChange={(e) => setSelectedCollection(e.target.value || null)}
                            disabled={!selectedConfig}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                        >
                            <option value="">
                                {loading.collections ? 'Loading...' : 'Select a collection...'}
                            </option>
                            {collections.map(col => (
                                <option key={col.name} value={col.name}>
                                    {col.name}
                                    {activeConfig?.activeCollection === col.name && selectedConfig?.id === activeConfig?.id ? ' ✓ Active' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                    </div>

                    {selectedCollection && (
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span>{documents.length} documents</span>
                            <button
                                onClick={() => handleDeleteCollection(selectedCollection)}
                                className="text-red-500 hover:text-red-700 flex items-center gap-1"
                            >
                                <Trash2 size={12} /> Delete Collection
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Activate Button */}
            {selectedConfig && selectedCollection && (
                <div className="mb-6">
                    <button
                        onClick={handleActivate}
                        disabled={isCurrentlyActive}
                        className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${isCurrentlyActive
                            ? 'bg-emerald-100 text-emerald-700 cursor-default'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30'
                            }`}
                    >
                        {isCurrentlyActive ? (
                            <>
                                <Check size={18} />
                                Currently Active
                            </>
                        ) : (
                            <>
                                <Zap size={18} />
                                Use This Database & Collection
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Documents Section */}
            {selectedCollection && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-800">
                            Documents in "{selectedCollection}"
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => fetchDocuments(selectedConfig.id, selectedCollection)}
                                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <RefreshCw size={16} />
                            </button>
                            <button
                                onClick={() => openDocumentModal()}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
                            >
                                <Plus size={16} /> Add Document
                            </button>
                        </div>
                    </div>

                    {loading.documents ? (
                        <div className="p-8 text-center text-gray-500">
                            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                            Loading documents...
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                            No documents in this collection
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {documents.map((doc, index) => (
                                <div key={doc.id || index} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">#{index + 1}</span>
                                                <h3 className="font-semibold text-gray-800">{doc.title}</h3>
                                            </div>

                                            {/* Tags */}
                                            {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                                                <div className="mb-2">
                                                    <span className="text-xs text-gray-500 mr-2">Tags:</span>
                                                    <div className="inline-flex flex-wrap gap-1">
                                                        {doc.tags.map((tag, i) => (
                                                            <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Sample Questions */}
                                            {Array.isArray(doc.sample_questions) && doc.sample_questions.length > 0 && (
                                                <div className="mb-2 bg-blue-50 rounded-lg p-2">
                                                    <span className="text-xs text-blue-600 font-medium block mb-1">Sample Questions ({doc.sample_questions.length}):</span>
                                                    <ul className="text-sm text-blue-700 space-y-0.5">
                                                        {doc.sample_questions.slice(0, 3).map((q, i) => (
                                                            <li key={i} className="flex items-start gap-1">
                                                                <span className="text-blue-400">•</span>
                                                                <span>{q}</span>
                                                            </li>
                                                        ))}
                                                        {doc.sample_questions.length > 3 && (
                                                            <li className="text-blue-400 text-xs">... +{doc.sample_questions.length - 3} more</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Content Preview */}
                                            <p className="text-sm text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded">{doc.content}</p>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => openDocumentModal(doc)}
                                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDocument(doc.id)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add Database Modal */}
            {showAddDbModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add Database Connection</h3>
                            <button onClick={() => setShowAddDbModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddDatabase} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={dbForm.name}
                                    onChange={(e) => setDbForm({ ...dbForm, name: e.target.value })}
                                    placeholder="e.g. Production DB"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={dbForm.apiKey}
                                    onChange={(e) => setDbForm({ ...dbForm, apiKey: e.target.value })}
                                    placeholder="chr-xxxxx..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
                                <input
                                    type="text"
                                    value={dbForm.tenant}
                                    onChange={(e) => setDbForm({ ...dbForm, tenant: e.target.value })}
                                    placeholder="e.g. default_tenant"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
                                <input
                                    type="text"
                                    value={dbForm.database}
                                    onChange={(e) => setDbForm({ ...dbForm, database: e.target.value })}
                                    placeholder="e.g. my-database"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddDbModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Add Database
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Collection Modal */}
            {showAddCollectionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Create Collection</h3>
                            <button onClick={() => setShowAddCollectionModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddCollection} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Collection Name</label>
                                <input
                                    type="text"
                                    value={collectionName}
                                    onChange={(e) => setCollectionName(e.target.value)}
                                    placeholder="e.g. product_faqs"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Use lowercase with underscores</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCollectionModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                    Create Collection
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Document Editor Modal */}
            {showDocumentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto p-6 m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">
                                {editingDocument ? 'Edit Document' : 'Add Document'}
                            </h3>
                            <button onClick={() => setShowDocumentModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDocument} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={documentForm.title}
                                    onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                                    placeholder="e.g. Product Overview"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                                <input
                                    type="text"
                                    value={documentForm.tags}
                                    onChange={(e) => setDocumentForm({ ...documentForm, tags: e.target.value })}
                                    placeholder="e.g. overview, features, pricing"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sample Questions (one per line)
                                </label>
                                <textarea
                                    value={documentForm.sample_questions}
                                    onChange={(e) => setDocumentForm({ ...documentForm, sample_questions: e.target.value })}
                                    placeholder="What is the product about?
How does it work?
What are the features?"
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    These questions help the AI match user queries to this document
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                <textarea
                                    value={documentForm.content}
                                    onChange={(e) => setDocumentForm({ ...documentForm, content: e.target.value })}
                                    placeholder="Enter the knowledge base content here..."
                                    rows={8}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDocumentModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                                >
                                    <Save size={16} />
                                    {editingDocument ? 'Update Document' : 'Add Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageDatabasePage;
