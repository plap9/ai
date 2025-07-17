import {
  isObject,
  isString,
  isUUID,
  isNumber,
  isArray,
  createSchema,
  validateOrThrow,
  ValidationSchema,
} from '@ai-assistant/utils';

/**
 * Base job data interface
 */
interface BaseJobData {
  jobId: string;
  userId: string;
  workspaceId?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor?: Date;
}

/**
 * Job validation result
 */
interface JobValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: unknown;
}

/**
 * Type guards cho job validation
 */
export class JobValidation {
  /**
   * Validate base job data
   */
  static validateBaseJobData(data: unknown): data is BaseJobData {
    if (!isObject(data)) {
      return false;
    }

    const obj = data;

    return (
      isUUID(obj.jobId) &&
      isUUID(obj.userId) &&
      (obj.workspaceId === undefined || isUUID(obj.workspaceId)) &&
      isString(obj.priority) &&
      ['low', 'normal', 'high', 'critical'].includes(obj.priority) &&
      isNumber(obj.attempts) &&
      isNumber(obj.maxAttempts) &&
      obj.createdAt instanceof Date &&
      (obj.scheduledFor === undefined || obj.scheduledFor instanceof Date)
    );
  }

  /**
   * Validate email job data
   */
  static validateEmailJobData(data: unknown): JobValidationResult {
    const schema: ValidationSchema = createSchema({
      to: {
        required: true,
        type: 'array' as const,
        message: 'Email recipients must be an array',
      },
      subject: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        maxLength: 200,
        message: 'Email subject must be 1-200 characters',
      },
      template: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        message: 'Email template is required',
      },
      variables: {
        type: 'object' as const,
        message: 'Email variables must be an object',
      },
      attachments: {
        type: 'array' as const,
        message: 'Email attachments must be an array',
      },
    });

    try {
      const sanitizedData = validateOrThrow(data, schema);

      // Additional validation cho email addresses
      if (isObject(sanitizedData) && 'to' in sanitizedData) {
        const emailTo = sanitizedData.to;
        if (isArray(emailTo)) {
          for (const email of emailTo) {
            if (!isString(email) || !this.isValidEmail(email)) {
              return {
                valid: false,
                errors: [`Invalid email address: ${String(email)}`],
              };
            }
          }
        }
      }

      return {
        valid: true,
        errors: [],
        sanitizedData,
      };
    } catch (error) {
      return {
        valid: false,
        errors:
          error instanceof Error
            ? [error.message]
            : ['Email job validation failed'],
      };
    }
  }

  /**
   * Validate AI processing job data
   */
  static validateAIJobData(data: unknown): JobValidationResult {
    const schema: ValidationSchema = createSchema({
      conversationId: {
        required: true,
        type: 'uuid' as const,
        message: 'Conversation ID must be a valid UUID',
      },
      messageId: {
        required: true,
        type: 'uuid' as const,
        message: 'Message ID must be a valid UUID',
      },
      aiModel: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        message: 'AI model is required',
      },
      prompt: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        maxLength: 50000,
        message: 'Prompt must be 1-50000 characters',
      },
      temperature: {
        type: 'number' as const,
        min: 0,
        max: 2,
        message: 'Temperature must be between 0 and 2',
      },
      maxTokens: {
        type: 'number' as const,
        min: 1,
        max: 4000,
        message: 'Max tokens must be between 1 and 4000',
      },
      context: {
        type: 'object' as const,
        message: 'Context must be an object',
      },
    });

    try {
      const sanitizedData = validateOrThrow(data, schema);
      return {
        valid: true,
        errors: [],
        sanitizedData,
      };
    } catch (error) {
      return {
        valid: false,
        errors:
          error instanceof Error
            ? [error.message]
            : ['AI job validation failed'],
      };
    }
  }

  /**
   * Validate knowledge indexing job data
   */
  static validateKnowledgeIndexingJobData(data: unknown): JobValidationResult {
    const schema: ValidationSchema = createSchema({
      entryId: {
        required: true,
        type: 'uuid' as const,
        message: 'Knowledge entry ID must be a valid UUID',
      },
      content: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        maxLength: 100000,
        message: 'Content must be 1-100000 characters',
      },
      contentType: {
        required: true,
        type: 'string' as const,
        validator: (value: unknown) =>
          value === 'document' ||
          value === 'note' ||
          value === 'link' ||
          value === 'file',
        message: 'Content type must be document, note, link, or file',
      },
      metadata: {
        type: 'object' as const,
        message: 'Metadata must be an object',
      },
      embeddingModel: {
        type: 'string' as const,
        minLength: 1,
        message: 'Embedding model must be specified',
      },
    });

    try {
      const sanitizedData = validateOrThrow(data, schema);
      return {
        valid: true,
        errors: [],
        sanitizedData,
      };
    } catch (error) {
      return {
        valid: false,
        errors:
          error instanceof Error
            ? [error.message]
            : ['Knowledge indexing job validation failed'],
      };
    }
  }

  /**
   * Validate file processing job data
   */
  static validateFileProcessingJobData(data: unknown): JobValidationResult {
    const schema: ValidationSchema = createSchema({
      fileId: {
        required: true,
        type: 'uuid' as const,
        message: 'File ID must be a valid UUID',
      },
      filePath: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        message: 'File path is required',
      },
      fileType: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        message: 'File type is required',
      },
      processingType: {
        required: true,
        type: 'string' as const,
        validator: (value: unknown) =>
          value === 'image_resize' ||
          value === 'document_extract' ||
          value === 'virus_scan' ||
          value === 'thumbnail_generate',
        message:
          'Processing type must be image_resize, document_extract, virus_scan, or thumbnail_generate',
      },
      options: {
        type: 'object' as const,
        message: 'Processing options must be an object',
      },
    });

    try {
      const sanitizedData = validateOrThrow(data, schema);
      return {
        valid: true,
        errors: [],
        sanitizedData,
      };
    } catch (error) {
      return {
        valid: false,
        errors:
          error instanceof Error
            ? [error.message]
            : ['File processing job validation failed'],
      };
    }
  }

  /**
   * Validate analytics job data
   */
  static validateAnalyticsJobData(data: unknown): JobValidationResult {
    const schema: ValidationSchema = createSchema({
      eventType: {
        required: true,
        type: 'string' as const,
        minLength: 1,
        message: 'Event type is required',
      },
      eventData: {
        required: true,
        type: 'object' as const,
        message: 'Event data must be an object',
      },
      timestamp: {
        required: true,
        type: 'date' as const,
        message: 'Timestamp must be a valid date',
      },
      sessionId: {
        type: 'uuid' as const,
        message: 'Session ID must be a valid UUID',
      },
      aggregationWindow: {
        type: 'string' as const,
        validator: (value: unknown) =>
          value === 'minute' ||
          value === 'hour' ||
          value === 'day' ||
          value === 'week',
        message: 'Aggregation window must be minute, hour, day, or week',
      },
    });

    try {
      const sanitizedData = validateOrThrow(data, schema);
      return {
        valid: true,
        errors: [],
        sanitizedData,
      };
    } catch (error) {
      return {
        valid: false,
        errors:
          error instanceof Error
            ? [error.message]
            : ['Analytics job validation failed'],
      };
    }
  }

  /**
   * Validate cleanup job data
   */
  static validateCleanupJobData(data: unknown): JobValidationResult {
    const schema: ValidationSchema = createSchema({
      cleanupType: {
        required: true,
        type: 'string' as const,
        validator: (value: unknown) =>
          value === 'expired_sessions' ||
          value === 'old_logs' ||
          value === 'temp_files' ||
          value === 'cache_cleanup',
        message:
          'Cleanup type must be expired_sessions, old_logs, temp_files, or cache_cleanup',
      },
      olderThan: {
        required: true,
        type: 'date' as const,
        message: 'Older than date must be a valid date',
      },
      dryRun: {
        type: 'boolean' as const,
        message: 'Dry run must be a boolean',
      },
      batchSize: {
        type: 'number' as const,
        min: 1,
        max: 1000,
        message: 'Batch size must be between 1 and 1000',
      },
    });

    try {
      const sanitizedData = validateOrThrow(data, schema);
      return {
        valid: true,
        errors: [],
        sanitizedData,
      };
    } catch (error) {
      return {
        valid: false,
        errors:
          error instanceof Error
            ? [error.message]
            : ['Cleanup job validation failed'],
      };
    }
  }

  /**
   * Helper để validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Job type enum
 */
export const JobTypes = {
  EMAIL: 'email',
  AI_PROCESSING: 'ai_processing',
  KNOWLEDGE_INDEXING: 'knowledge_indexing',
  FILE_PROCESSING: 'file_processing',
  ANALYTICS: 'analytics',
  CLEANUP: 'cleanup',
} as const;

export type JobType = (typeof JobTypes)[keyof typeof JobTypes];

/**
 * Job priority enum
 */
export const JobPriorities = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type JobPriority = (typeof JobPriorities)[keyof typeof JobPriorities];

/**
 * Main job validator function
 */
export function validateJobData(
  jobType: JobType,
  data: unknown,
): JobValidationResult {
  // Validate base structure first
  if (!isObject(data)) {
    return {
      valid: false,
      errors: ['Job data must be an object'],
    };
  }

  // Validate specific job type
  switch (jobType) {
    case JobTypes.EMAIL:
      return JobValidation.validateEmailJobData(data);

    case JobTypes.AI_PROCESSING:
      return JobValidation.validateAIJobData(data);

    case JobTypes.KNOWLEDGE_INDEXING:
      return JobValidation.validateKnowledgeIndexingJobData(data);

    case JobTypes.FILE_PROCESSING:
      return JobValidation.validateFileProcessingJobData(data);

    case JobTypes.ANALYTICS:
      return JobValidation.validateAnalyticsJobData(data);

    case JobTypes.CLEANUP:
      return JobValidation.validateCleanupJobData(data);

    default:
      return {
        valid: false,
        errors: [`Unknown job type: ${String(jobType)}`],
      };
  }
}

/**
 * Job retry configuration
 */
export const JobRetryConfig = {
  [JobTypes.EMAIL]: {
    maxAttempts: 3,
    backoffStrategy: 'exponential' as const,
    baseDelay: 1000,
  },
  [JobTypes.AI_PROCESSING]: {
    maxAttempts: 2,
    backoffStrategy: 'linear' as const,
    baseDelay: 2000,
  },
  [JobTypes.KNOWLEDGE_INDEXING]: {
    maxAttempts: 3,
    backoffStrategy: 'exponential' as const,
    baseDelay: 5000,
  },
  [JobTypes.FILE_PROCESSING]: {
    maxAttempts: 2,
    backoffStrategy: 'linear' as const,
    baseDelay: 3000,
  },
  [JobTypes.ANALYTICS]: {
    maxAttempts: 5,
    backoffStrategy: 'exponential' as const,
    baseDelay: 500,
  },
  [JobTypes.CLEANUP]: {
    maxAttempts: 2,
    backoffStrategy: 'linear' as const,
    baseDelay: 10000,
  },
} as const;
