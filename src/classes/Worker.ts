import { EventEmitter } from "events";
import { RedisClient } from "./RedisClient";
import { Job } from "./Job";
import { sleep } from "../utils";

interface WorkerOptions {
  maxRetries?: number;
  retryBackoff?: number;
  retryDelay?: number;
  gracefulShutdownTimeout?: number;
  logErrors?: boolean;
}

type ProcessFunction = (payload: any) => Promise<void>;

export class Worker extends EventEmitter {
  private redis = RedisClient.getInstance();
  private queueName: string;
  private maxQuota: number;
  private workerId: string;
  public stopProcessing: boolean = false;
  private activeJob: boolean = false;
  private options: Required<WorkerOptions>;

  constructor(
    queueName: string,
    maxQuota: number = 4,
    options: WorkerOptions = {}
  ) {
    super();
    this.queueName = queueName;
    this.maxQuota = maxQuota;
    this.workerId = `worker:${Math.random().toString(36).substring(2, 6)}`;

    // Default options with sensible values
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryBackoff: options.retryBackoff ?? 2,
      retryDelay: options.retryDelay ?? 30000,
      gracefulShutdownTimeout: options.gracefulShutdownTimeout ?? 10000,
      logErrors: options.logErrors ?? true,
    };

    // Setup graceful shutdown handlers
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    // Handle termination signals
    const signals = ["SIGINT", "SIGTERM", "SIGQUIT"];
    signals.forEach((signal) => {
      process.once(signal, () => {
        this.shutdown().catch((error) =>
          console.error("Error during shutdown:", error)
        );
      });
    });
  }

  /**
   * Gracefully shut down the worker
   */
  public async shutdown(): Promise<void> {
    console.log(`Worker ${this.workerId} shutting down...`);
    this.stopProcessing = true;

    // Wait for active job to complete with timeout
    const timeout = setTimeout(() => {
      console.warn(
        `Shutdown timeout reached with active job still running. Forcing exit.`
      );
      process.exit(0);
    }, this.options.gracefulShutdownTimeout);

    // Wait for job to finish
    while (this.activeJob) {
      console.log(`Waiting for active job to complete...`);
      await sleep(500);
    }

    clearTimeout(timeout);
    console.log(`Worker ${this.workerId} shut down successfully`);
  }

  /**
   * Main method to process jobs from the queue
   */
  async processJob(processFn: ProcessFunction): Promise<void> {
    this.stopProcessing = false;

    console.log(`Worker ${this.workerId} started`);
    console.log(`Max quota per key: ${this.maxQuota}`);

    // Single worker loop
    await this.runWorkerLoop(processFn);

    console.log(`Worker processing completed.`);
  }

  private async runWorkerLoop(processFn: ProcessFunction): Promise<void> {
    console.log(`Worker started processing`);

    while (!this.stopProcessing) {
      try {
        // Try to claim a job
        const jobId = await this.claimJob();

        if (jobId) {
          this.activeJob = true;
          console.log(`Processing job ${jobId}`);

          try {
            const job = await this.getJob(jobId);
            if (job) {
              await this.processJobWithRetry(job, processFn);
            }
          } catch (error) {
            this.handleError(error, jobId);

            // Make sure the job is properly marked as failed if an unexpected error occurs
            try {
              await this.markJobFailed(
                jobId,
                error instanceof Error ? error : new Error(String(error)),
                error instanceof Error ? error.stack || "" : ""
              );
            } catch (markFailedError) {
              this.handleError(markFailedError, jobId);
            }
          } finally {
            this.activeJob = false;
          }
        } else {
          // No jobs available, wait before polling again
          await sleep(1000);
        }
      } catch (error) {
        this.handleError(error);
        await sleep(2000); // Longer wait on error
      }
    }

    console.log(`Worker stopped`);
  }

  /**
   * Process a job with retry logic
   */
  private async processJobWithRetry(
    job: Job,
    processFn: ProcessFunction
  ): Promise<void> {
    try {
      // Check if we already exceeded retry attempts before even trying
      if (job.attempts >= this.options.maxRetries) {
        console.log(
          `Job ${job.id} has already reached max retry attempts (${job.attempts}/${this.options.maxRetries}). Marking as failed.`
        );
        await this.markJobFailed(
          job.id,
          new Error(
            `Exceeded maximum retry attempts (${this.options.maxRetries})`
          ),
          new Error().stack || ""
        );
        return;
      }

      // Increment attempt counter before processing
      job.attempts++;

      // Update job in database with new attempt count
      await this.redis.hset(
        `jobs:${job.id}`,
        "attempts",
        job.attempts.toString()
      );

      console.log(
        `Worker ${this.workerId} processing job ${job.id} (attempt ${job.attempts}/${this.options.maxRetries})`
      );

      await this.processJobWithQuota(job, processFn);

      // If we get here, the job succeeded - mark it as completed
      await this.markJobCompleted(job.id);
    } catch (error) {
      // Store the error message on the job
      job.lastError = error instanceof Error ? error.message : String(error);

      // If we haven't exceeded max retries, schedule a retry
      if (job.attempts < this.options.maxRetries) {
        try {
          const delay = this.calculateRetryDelay(job.attempts);
          const retryAt = Date.now() + delay;
          job.retryAt = retryAt;

          console.log(
            `Worker ${this.workerId} scheduling retry for job ${
              job.id
            } (attempt ${job.attempts}/${
              this.options.maxRetries
            }) at ${new Date(retryAt).toISOString()}`
          );

          // Use atomic Lua script to schedule the retry
          const jobKey = `jobs:${job.id}`;
          const delayedKey = `delayed:${this.queueName}`;
          const processingKey = `processing:${this.queueName}`;

          await this.redis.scheduleRetry(
            jobKey,
            delayedKey,
            processingKey,
            job.id,
            job.attempts.toString(),
            job.lastError || "",
            retryAt.toString(),
            "delayed"
          );
        } catch (retryError) {
          // If there's an error scheduling the retry, mark the job as failed
          console.error(
            `Error scheduling retry for job ${job.id}:`,
            retryError
          );
          await this.markJobFailed(
            job.id,
            error instanceof Error ? error : new Error(String(error)),
            error instanceof Error ? error.stack || "" : ""
          );
        }
      } else {
        // Log that we've exhausted retries
        console.error(`Job ${job.id} failed after ${job.attempts} attempts`);

        // Mark job as permanently failed
        await this.markJobFailed(
          job.id,
          error instanceof Error ? error : new Error(String(error)),
          error instanceof Error ? error.stack || "" : ""
        );
      }
    }
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  private calculateRetryDelay(attempt: number): number {
    return (
      this.options.retryDelay * Math.pow(this.options.retryBackoff, attempt - 1)
    );
  }

  /**
   * Handle and log errors
   */
  private handleError(error: unknown, jobId?: string): void {
    if (this.options.logErrors) {
      if (jobId) {
        console.error(`Error processing job ${jobId}:`, error);
      } else {
        console.error(`Worker error:`, error);
      }
    }

    this.emit("error", error, jobId);
  }

  private async claimJob(): Promise<string | null> {
    const queueKey = `queue:${this.queueName}`;
    const processingKey = `processing:${this.queueName}`;

    // The Lua script already handles all the retry logic
    return this.redis.claimJob(queueKey, processingKey, this.workerId);
  }

  private async getJob(jobId: string): Promise<Job | null> {
    const jobData = await this.redis.hgetall(`jobs:${jobId}`);
    if (!jobData || Object.keys(jobData).length === 0) {
      return null;
    }

    const job = new Job(
      JSON.parse(jobData.payload),
      jobData.quotaKey || undefined
    );
    job.id = jobId;
    job.status = jobData.status as any;
    job.createdAt = parseInt(jobData.createdAt, 10);

    // Parse retry-related fields
    job.attempts = parseInt(jobData.attempts || "0", 10);
    job.lastError = jobData.lastError;
    if (jobData.retryAt) {
      job.retryAt = parseInt(jobData.retryAt, 10);
    }

    return job;
  }

  private async processJobWithQuota(
    job: Job,
    processFn: ProcessFunction
  ): Promise<void> {
    try {
      // Set job status to active
      await this.redis.hset(`jobs:${job.id}`, "status", "active");

      // Check quota limit if job has a quota key
      let quotaApplied = false;
      if (job.quotaKey) {
        const quotaSetKey = `quota:${this.queueName}:${job.quotaKey}`;
        const ttl = 3600; // 1 hour TTL

        // Try to enforce quota using atomic Lua script
        const result = await this.redis.enforceQuota(
          quotaSetKey,
          this.maxQuota,
          job.id,
          ttl
        );

        if (result === 0) {
          // Quota exceeded
          // Re-queue job if quota is exceeded
          const queueKey = `queue:${this.queueName}`;
          const processingKey = `processing:${this.queueName}`;
          await this.redis.requeueJob(queueKey, processingKey, job.id);
          return;
        }

        quotaApplied = true;
      }

      try {
        // Process the job
        await processFn(job.payload);
      } finally {
        // Always remove from quota if quota was applied, regardless of success/failure
        if (quotaApplied && job.quotaKey) {
          const quotaSetKey = `quota:${this.queueName}:${job.quotaKey}`;
          await this.redis.srem(quotaSetKey, job.id);
        }
      }
    } catch (error) {
      // Let the processJobWithRetry method handle the error
      throw error;
    }
  }

  private async markJobCompleted(jobId: string): Promise<void> {
    const jobKey = `jobs:${jobId}`;
    const processingKey = `processing:${this.queueName}`;

    await this.redis.markJobCompleted(jobKey, processingKey, jobId);
  }

  private async markJobFailed(
    jobId: string,
    error: Error,
    stackTrace: string
  ): Promise<void> {
    const jobKey = `jobs:${jobId}`;
    const processingKey = `processing:${this.queueName}`;
    const errorMessage = `${error.name}: ${error.message}`;

    await this.redis.markJobFailed(
      jobKey,
      processingKey,
      jobId,
      errorMessage,
      stackTrace
    );
  }
}
