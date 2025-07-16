import { Injectable, Logger } from '@nestjs/common';
import { Queue, Job, JobOptions } from 'bull';

export interface QueueJobData {
  [key: string]: unknown;
}

export type QueueJob = Job<QueueJobData>;

export type ProcessorFunction = (job: QueueJob) => Promise<unknown>;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly processors = new Map<string, ProcessorFunction>();

  constructor() {}

  // Register a queue
  registerQueue(name: string, queue: Queue): void {
    this.queues.set(name, queue);
    this.logger.log(`Queue registered: ${name}`);
  }

  // Get a queue by name
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  // Add a job to a queue
  async addJob(
    queueName: string,
    jobName: string,
    data: QueueJobData,
    options?: JobOptions,
  ): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return null;
    }

    try {
      const job = await queue.add(jobName, data, {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...options,
      });

      this.logger.debug(
        `Job added to queue ${queueName}: ${jobName} (ID: ${job.id})`,
      );
      return job;
    } catch (error) {
      this.logger.error(`Failed to add job to queue ${queueName}:`, error);
      return null;
    }
  }

  // Register a processor for a queue
  registerProcessor(queueName: string, processor: ProcessorFunction): void {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(
        `Cannot register processor: Queue not found: ${queueName}`,
      );
      return;
    }

    this.processors.set(queueName, processor);

    // Set up the processor
    void queue.process(async (job: QueueJob) => {
      try {
        this.logger.debug(`Processing job ${job.id} from queue ${queueName}`);
        const result: unknown = await processor(job);
        this.logger.debug(`Job ${job.id} completed successfully`);
        return result;
      } catch (error) {
        this.logger.error(`Job ${job.id} failed:`, error);
        throw error;
      }
    });

    this.logger.log(`Processor registered for queue: ${queueName}`);
  }

  // Get job by ID
  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return null;
    }

    try {
      return await queue.getJob(jobId);
    } catch (error) {
      this.logger.error(
        `Failed to get job ${jobId} from queue ${queueName}:`,
        error,
      );
      return null;
    }
  }

  // Get queue statistics
  async getQueueStats(queueName: string): Promise<any> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return null;
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for queue ${queueName}:`, error);
      return null;
    }
  }

  // Remove job by ID
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return false;
    }

    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.debug(`Job ${jobId} removed from queue ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to remove job ${jobId} from queue ${queueName}:`,
        error,
      );
      return false;
    }
  }

  // Pause a queue
  async pauseQueue(queueName: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return false;
    }

    try {
      await queue.pause();
      this.logger.log(`Queue paused: ${queueName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to pause queue ${queueName}:`, error);
      return false;
    }
  }

  // Resume a queue
  async resumeQueue(queueName: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return false;
    }

    try {
      await queue.resume();
      this.logger.log(`Queue resumed: ${queueName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to resume queue ${queueName}:`, error);
      return false;
    }
  }

  // Clean completed jobs
  async cleanQueue(queueName: string, grace: number = 0): Promise<boolean> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return false;
    }

    try {
      await queue.clean(grace, 'completed');
      await queue.clean(grace, 'failed');
      this.logger.log(`Queue cleaned: ${queueName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to clean queue ${queueName}:`, error);
      return false;
    }
  }
}
