import { RedisClient } from "./RedisClient";
import { Job } from "./Job";

export class Queue {
  private redis = RedisClient.getInstance();
  private queueName: string;

  constructor(queueName: string) {
    this.queueName = queueName;
  }

  async addJob(payload: any, quotaKey?: string, delay = 0): Promise<string> {
    const job = new Job(payload, quotaKey);

    // Ensure job data is correctly stored
    await this.redis.hset(`job:${job.id}`, {
      status: job.status,
      payload: JSON.stringify(job.payload), // Ensure payload is serialized
      quotaKey: job.quotaKey || "",
      createdAt: job.createdAt.toString(),
    });

    // Add job to queue or delay queue
    if (delay > 0) {
      await this.redis.zadd(
        `delayed:${this.queueName}`,
        Date.now() + delay,
        job.id
      );
    } else {
      // Just add directly to queue - quota is checked during processing
      await this.redis.lpush(`queue:${this.queueName}`, job.id);
    }

    return job.id;
  }

  /**
   * Move delayed jobs to the active queue
   * @param minInterval Minimum interval between checks in milliseconds (default: 30000 = 30 seconds)
   * @returns Information about the operation, including moved jobs
   */
  async moveDelayedJobs(minInterval: number = 30000): Promise<{
    moved: number;
    skipped: boolean;
    nextAllowedRun?: number;
    jobIds?: string[];
  }> {
    const now = Date.now();
    const delayedKey = `delayed:${this.queueName}`;
    const queueKey = `queue:${this.queueName}`;
    const lastCheckKey = `lastCheck:${this.queueName}:moveDelayed`;

    // This uses the Lua script
    const result = await this.redis.moveDelayedJobs(
      delayedKey,
      queueKey,
      lastCheckKey,
      now,
      minInterval
    );

    return result;
  }

  // Method to get job by id
  async getJob(jobId: string): Promise<Job | null> {
    const jobData = await this.redis.hgetall(`job:${jobId}`);
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

    return job;
  }
}
