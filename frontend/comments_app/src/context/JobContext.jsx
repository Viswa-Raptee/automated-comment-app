import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/api';

const JobContext = createContext();

export const useJob = () => useContext(JobContext);

export const JobProvider = ({ children }) => {
    const [activeJob, setActiveJob] = useState(null);
    // { jobId, accountName, total, processed, status }

    // Start tracking a job
    const startJob = (jobId, accountName, total) => {
        setActiveJob({ jobId, accountName, total, processed: 0, status: 'running' });
    };

    // Stop tracking
    const clearJob = () => {
        setActiveJob(null);
    };

    // Poll for job status
    useEffect(() => {
        if (!activeJob || activeJob.status !== 'running') return;

        const interval = setInterval(async () => {
            try {
                const { data } = await api.get(`/jobs/${activeJob.jobId}/status`);
                setActiveJob(prev => ({
                    ...prev,
                    processed: data.processed,
                    status: data.status
                }));

                if (data.status === 'complete' || data.status === 'failed') {
                    clearInterval(interval);
                }
            } catch (e) {
                console.error('Job poll error:', e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [activeJob?.jobId, activeJob?.status]);

    return (
        <JobContext.Provider value={{ activeJob, startJob, clearJob }}>
            {children}

            {/* Floating Progress Indicator */}
            {activeJob && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-72">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">
                                {activeJob.status === 'complete' ? 'Complete!' : 'Generating Replies'}
                            </span>
                            {activeJob.status === 'complete' && (
                                <button
                                    onClick={clearJob}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                    Dismiss
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{activeJob.accountName}</p>
                        <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-1.5 transition-all duration-300 ${activeJob.status === 'complete'
                                        ? 'bg-green-500'
                                        : activeJob.status === 'failed'
                                            ? 'bg-red-500'
                                            : 'bg-indigo-600'
                                    }`}
                                style={{ width: `${activeJob.total ? (activeJob.processed / activeJob.total) * 100 : 0}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5 text-right">
                            {activeJob.processed} / {activeJob.total}
                        </p>
                    </div>
                </div>
            )}
        </JobContext.Provider>
    );
};
