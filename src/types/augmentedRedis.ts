import Redis from "ioredis";

export interface augmentedRedis extends Redis {
  claimJob: (
    queueKey: string,
    processingKey: string,
    workerId: string
  ) => Promise<string | null>;
  enforceQuota: (
    key: string,
    maxQuota: number,
    jobId: string,
    ttl: number
  ) => Promise<number>;
  markJobFailed: (
    jobKey: string,
    processingKey: string,
    jobId: string,
    errorMessage: string,
    stackTrace: string
  ) => Promise<number>;
  markJobCompleted: (
    jobKey: string,
    processingKey: string,
    jobId: string
  ) => Promise<number>;
  requeueJob: (
    queueKey: string,
    processingKey: string,
    jobId: string
  ) => Promise<number>;
  moveDelayedJobs: (
    source: string,
    destination: string,
    lastCheckKey: string,
    now: number,
    minInterval?: number
  ) => Promise<{
    moved: number;
    skipped: boolean;
    nextAllowedRun?: number;
    jobIds?: string[];
  }>;
  scheduleRetry: (
    jobKey: string,
    delayedKey: string,
    processingKey: string,
    jobId: string,
    attempts: string,
    lastError: string,
    retryAt: string,
    status: string
  ) => Promise<number>;
}
