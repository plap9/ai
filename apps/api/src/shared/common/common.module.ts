import { Module } from '@nestjs/common';
import { APP_PIPE, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ValidationPipe, ParseUUIDPipe } from './pipes';
import { HttpExceptionFilter, AllExceptionsFilter } from './filters';
import {
  LoggingInterceptor,
  TransformInterceptor,
  TimeoutInterceptor,
  TIMEOUT_TOKEN,
} from './interceptors';
import {
  SafeParserInterceptor,
  ValidationLoggingInterceptor,
  PerformanceInterceptor,
} from '@ai-assistant/utils';

@Module({
  providers: [
    // Enhanced Validation Pipes
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },

    // Exception Filters
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // Enhanced Interceptors với type safety
    {
      provide: APP_INTERCEPTOR,
      useClass: SafeParserInterceptor, // Add SafeParser to requests
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor, // Enhanced logging
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ValidationLoggingInterceptor, // Additional validation logging
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor, // Enhanced response formatting
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor, // Performance monitoring
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },

    // Timeout configuration
    {
      provide: TIMEOUT_TOKEN,
      useValue: 30000, // 30 seconds
    },

    // Export individual components for manual usage
    ValidationPipe,
    ParseUUIDPipe,
    HttpExceptionFilter,
    AllExceptionsFilter,
    LoggingInterceptor,
    TransformInterceptor,
    TimeoutInterceptor,
    SafeParserInterceptor,
    ValidationLoggingInterceptor,
    PerformanceInterceptor,
  ],
  exports: [
    // Pipes
    ValidationPipe,
    ParseUUIDPipe,

    // Filters
    HttpExceptionFilter,
    AllExceptionsFilter,

    // Interceptors
    LoggingInterceptor,
    TransformInterceptor,
    TimeoutInterceptor,
    SafeParserInterceptor,
    ValidationLoggingInterceptor,
    PerformanceInterceptor,

    // Tokens
    TIMEOUT_TOKEN,
  ],
})
export class CommonModule {}
