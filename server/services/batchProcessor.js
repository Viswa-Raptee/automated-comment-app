// Batch Processor Service - Handles async reply generation with progress tracking

const jobs = new Map(); // In-memory job storage

const BATCH_SIZE = 100;
const DELAY_BETWEEN_BATCHES_MS = 0;

// Create a new job
function createJob(accountId, totalComments) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    jobs.set(jobId, {
        accountId,
        total: totalComments,
        processed: 0,
        status: 'pending', // pending, running, complete, failed
        error: null,
        startedAt: null,
        completedAt: null
    });
    return jobId;
}

// Get job status
function getJobStatus(jobId) {
    return jobs.get(jobId) || null;
}

// Update job progress
function updateJob(jobId, updates) {
    const job = jobs.get(jobId);
    if (job) {
        Object.assign(job, updates);
    }
}

// Process comments in batches (called async, doesn't block request)
async function processBatch(jobId, comments, generateReplyFn) {
    const job = jobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    job.startedAt = new Date();

    try {
        for (let i = 0; i < comments.length; i += BATCH_SIZE) {
            const batch = comments.slice(i, Math.min(i + BATCH_SIZE, comments.length));

            // Process each comment in the batch sequentially
            for (const comment of batch) {
                try {
                    await generateReplyFn(comment);
                    job.processed++;
                } catch (err) {
                    console.error(`Error processing comment ${comment.id}:`, err.message);
                    // Continue with next comment even if one fails
                    job.processed++;
                }
            }

            // Delay before next batch to avoid rate limits
            if (i + BATCH_SIZE < comments.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
            }
        }

        job.status = 'complete';
        job.completedAt = new Date();
    } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        job.completedAt = new Date();
    }
}

// Clean up old jobs (call periodically)
function cleanupOldJobs(maxAgeMs = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [jobId, job] of jobs.entries()) {
        if (job.completedAt && (now - new Date(job.completedAt).getTime() > maxAgeMs)) {
            jobs.delete(jobId);
        }
    }
}

module.exports = {
    createJob,
    getJobStatus,
    updateJob,
    processBatch,
    cleanupOldJobs
};
