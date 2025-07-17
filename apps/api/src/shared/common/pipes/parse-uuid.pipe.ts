import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { isUUID, isString } from '@ai-assistant/utils';

/**
 * Enhanced UUID validation pipe với type safety
 * Uses type guards từ utils package thay vì uuid library
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<unknown, string> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: unknown, metadata: ArgumentMetadata): string {
    // Type guard để check value là string
    if (!isString(value) || value.trim().length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'UUID validation failed',
        errors: ['UUID is required and must be a non-empty string'],
        timestamp: new Date().toISOString(),
      });
    }

    // At this point, value is definitely a string
    const trimmedValue = value.trim();

    // Type guard để check UUID format
    if (!isUUID(trimmedValue)) {
      const errorMessage = 'Invalid UUID format: ' + String(trimmedValue);
      throw new BadRequestException({
        statusCode: 400,
        message: 'UUID validation failed',
        errors: [errorMessage],
        timestamp: new Date().toISOString(),
      });
    }

    return trimmedValue;
  }
}
