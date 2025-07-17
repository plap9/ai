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

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    // Provide timeout value
    {
      provide: TIMEOUT_TOKEN,
      useValue: 30000, // 30 giây
    },
    // Thêm các provider để có thể export
    ValidationPipe,
    ParseUUIDPipe,
    HttpExceptionFilter,
    AllExceptionsFilter,
    LoggingInterceptor,
    TransformInterceptor,
    TimeoutInterceptor,
  ],
  exports: [
    ValidationPipe,
    ParseUUIDPipe,
    HttpExceptionFilter,
    AllExceptionsFilter,
    LoggingInterceptor,
    TransformInterceptor,
    TimeoutInterceptor,
    TIMEOUT_TOKEN,
  ],
})
export class CommonModule {}
