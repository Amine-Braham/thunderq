import { RedisClient } from "./RedisClient";
import { sleep } from "../utils";

/**
 * Singleton scheduler class that handles moving delayed jobs to active queues
 */
export class Scheduler {
  private static instance: Scheduler;
  private redis = RedisClient.getInstance();
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_CHECK_INTERVAL = 60000; // 1 minute in milliseconds

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of the Scheduler
   */
  public static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  /**
   * Start the scheduler to periodically check for delayed jobs
   * @param checkInterval How often to check for delayed jobs (defaults to 1 minute)
   * @returns A promise that resolves when the scheduler stops
   */
  public async start(
    checkInterval: number = this.DEFAULT_CHECK_INTERVAL
  ): Promise<void> {
    if (this.isRunning) {
      console.log("Scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log(`Starting scheduler with check interval of ${checkInterval}ms`);

    while (this.isRunning) {
      await this.checkAllDelayedJobs();
      await sleep(checkInterval);
    }
  }

  /**
   * Start the scheduler as a background process (non-blocking)
   * @param checkInterval How often to check for delayed jobs (defaults to 1 minute)
   */
  public startBackground(
    checkInterval: number = this.DEFAULT_CHECK_INTERVAL
  ): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkAllDelayedJobs().catch((error) => {
        console.error("Error checking delayed jobs:", error);
      });
    }, checkInterval);

    console.log(
      `Scheduler started in background mode with interval of ${checkInterval}ms`
    );
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("Scheduler stopped");
  }

  /**
   * Discover all queues in Redis
   * This method scans Redis for all keys matching the pattern 'delayed:*'
   */
  private async discoverQueues(): Promise<string[]> {
    const queueNames = new Set<string>();

    // Use scan to find all delayed queues
    let cursor = "0";
    do {
      // Find all delayed:* keys to discover queues
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        "delayed:*",
        "COUNT",
        "100"
      );

      cursor = newCursor;

      // Extract queue names from the delayed:queueName format
      for (const key of keys) {
        const queueName = key.replace("delayed:", "");
        queueNames.add(queueName);
      }
    } while (cursor !== "0");

    return Array.from(queueNames);
  }

  /**
   * Check for and move delayed jobs for all queues
   */
  public async checkAllDelayedJobs(
    minInterval: number = 30000
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const queueNames = await this.discoverQueues();

    if (queueNames.length === 0) {
      console.log("No queues with delayed jobs found");
      return results;
    }

    const now = Date.now();

    console.log(
      `Found ${queueNames.length} queues to check: ${queueNames.join(", ")}`
    );

    for (const queueName of queueNames) {
      try {
        const delayedKey = `delayed:${queueName}`;
        const queueKey = `queue:${queueName}`;
        const lastCheckKey = `lastCheck:${queueName}:moveDelayed`;

        // Use the existing Lua script to atomically move jobs
        const result = await this.redis.moveDelayedJobs(
          delayedKey,
          queueKey,
          lastCheckKey,
          now,
          minInterval
        );

        results[queueName] = result;

        if (!result.skipped && result.moved > 0) {
          console.log(
            `[Scheduler] Moved ${result.moved} delayed jobs to queue "${queueName}"`
          );
        }
      } catch (error) {
        console.error(
          `[Scheduler] Error checking delayed jobs for queue "${queueName}":`,
          error
        );
        results[queueName] = { error: String(error) };
      }
    }

    return results;
  }
}
