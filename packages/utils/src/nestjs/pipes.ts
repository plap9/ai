// Validation pipes sẽ được implement ở đây
// Waiting for user to provide the implementation

import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import {
  isObject,
  ValidationSchema,
  validateObject,
  isUUID,
  isEmail,
  SafeParser,
} from '../type-guards';

/**
 * Type-safe validation pipe
 */
@Injectable()
export class SafeValidationPipe implements PipeTransform {
  constructor(private schema: ValidationSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!isObject(value)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: ['Input must be an object'],
        timestamp: new Date().toISOString(),
      });
    }

    const { valid, errors } = validateObject(value, this.schema);

    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    return value;
  }
}

/**
 * UUID validation pipe
 */
@Injectable()
export class UUIDPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isUUID(value)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid UUID format',
        errors: [`${metadata.data} must be a valid UUID`],
        timestamp: new Date().toISOString(),
      });
    }
    return value;
  }
}

/**
 * Email validation pipe
 */
@Injectable()
export class EmailPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isEmail(value)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid email format',
        errors: [`${metadata.data} must be a valid email`],
        timestamp: new Date().toISOString(),
      });
    }
    return value;
  }
}

/**
 * Safe parsing pipe - converts unknown to SafeParser
 */
@Injectable()
export class SafeParsingPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): SafeParser {
    return new SafeParser(value);
  }
}

/**
 * Pagination pipe với default values
 */
@Injectable()
export class PaginationPipe implements PipeTransform {
  constructor(
    private defaultPage = 1,
    private defaultLimit = 10,
    private maxLimit = 100,
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const parser = new SafeParser(value);

    const page = Math.max(1, parser.getPositiveNumber('page', this.defaultPage));
    const limit = Math.min(
      this.maxLimit,
      Math.max(1, parser.getPositiveNumber('limit', this.defaultLimit)),
    );

    return { page, limit, offset: (page - 1) * limit };
  }
}

/**
 * File upload validation pipe
 */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private allowedTypes: string[] = [],
    private maxSize: number = 5 * 1024 * 1024, // 5MB default
  ) {}

  transform(file: Express.Multer.File, metadata: ArgumentMetadata): Express.Multer.File {
    if (!file) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'File validation failed',
        errors: ['File is required'],
        timestamp: new Date().toISOString(),
      });
    }

    // Check file size
    if (file.size > this.maxSize) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'File validation failed',
        errors: [`File size must be less than ${this.maxSize / 1024 / 1024}MB`],
        timestamp: new Date().toISOString(),
      });
    }

    // Check file type
    if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'File validation failed',
        errors: [`File type must be one of: ${this.allowedTypes.join(', ')}`],
        timestamp: new Date().toISOString(),
      });
    }

    return file;
  }
}

/**
 * Optional validation pipe - không throw error nếu value undefined
 */
@Injectable()
export class OptionalValidationPipe implements PipeTransform {
  constructor(private innerPipe: PipeTransform) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return this.innerPipe.transform(value, metadata);
  }
}
