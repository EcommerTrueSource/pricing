import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AUTENTIQUE_WEBHOOK_RATE_LIMIT } from '../decorators/rate-limit.decorator';

@Injectable()
export class AutentiqueWebhookRateLimitInterceptor implements NestInterceptor {
    constructor(private reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const isWebhook = this.reflector.get<boolean>(
            AUTENTIQUE_WEBHOOK_RATE_LIMIT,
            context.getHandler(),
        );

        if (!isWebhook) {
            return next.handle();
        }

        return next.handle().pipe(
            catchError((error) => {
                if (
                    error instanceof HttpException &&
                    error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
                ) {
                    return throwError(
                        () =>
                            new HttpException(
                                {
                                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                                    message:
                                        'Muitas requisições para o webhook da Autentique. Por favor, tente novamente mais tarde.',
                                    error: 'Too Many Requests',
                                },
                                HttpStatus.TOO_MANY_REQUESTS,
                            ),
                    );
                }
                return throwError(() => error);
            }),
        );
    }
}
