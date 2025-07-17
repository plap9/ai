import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Inject,
} from '@nestjs/common';
import { Observable, timeout } from 'rxjs';

export const TIMEOUT_TOKEN = 'TIMEOUT_TOKEN';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(@Inject(TIMEOUT_TOKEN) timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout({
        each: this.timeoutMs,
        with: () => {
          throw new RequestTimeoutException(
            `Request timeout after ${this.timeoutMs}ms`,
          );
        },
      }),
    );
  }
}
