import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  isObject,
  validateObject,
  ValidationSchema,
} from '@ai-assistant/utils';

/**
 * Formatted error interface
 */
interface FormattedError {
  property: string;
  value: unknown;
  constraints: Record<string, string>;
}

/**
 * Enhanced Validation Pipe với type safety
 * Supports both class-validator DTOs và ValidationSchema từ utils
 */
@Injectable()
export class ValidationPipe implements PipeTransform<unknown> {
  async transform(
    value: unknown,
    { metatype }: ArgumentMetadata,
  ): Promise<unknown> {
    // Type guard để check input
    if (!isObject(value)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: ['Input must be a valid object'],
        timestamp: new Date().toISOString(),
      });
    }

    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value) as Record<string, unknown>;
    const errors = await validate(object);

    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: this.formatErrors(errors),
        timestamp: new Date().toISOString(),
      });
    }

    return value;
  }

  private toValidate(metatype: new (...args: unknown[]) => unknown): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.find((type) => type === metatype);
  }

  private formatErrors(errors: ValidationError[]): FormattedError[] {
    return errors.map((error) => ({
      property: error.property,
      value: error.value as unknown,
      constraints: error.constraints || {},
    }));
  }
}

/**
 * Schema-based validation pipe using utils package
 * For lightweight validation without class-validator
 */
@Injectable()
export class SchemaValidationPipe implements PipeTransform {
  constructor(private schema: ValidationSchema) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: unknown, _metadata: ArgumentMetadata) {
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
