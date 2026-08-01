import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { KyselyModule } from 'nestjs-kysely';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { loadEnv } from './config/env.js';
import { controllers } from './controllers/index.js';
import { AuthGuard } from './middleware/auth.guard.js';
import { CsrfGuard } from './middleware/csrf.guard.js';
import { GlobalExceptionFilter } from './middleware/global-exception.filter.js';
import { LoggingInterceptor } from './middleware/logging.interceptor.js';
import { PermissionGuard } from './middleware/permission.guard.js';
import { RateLimitGuard } from './middleware/rate-limit.guard.js';
import { repositories } from './repositories/index.js';
import { services } from './services/index.js';
import { getKyselyConfig } from './utils/database.js';

const env = loadEnv();

@Module({
  imports: [KyselyModule.forRoot(getKyselyConfig(env.database.url))],
  controllers,
  providers: [
    ...repositories,
    ...services,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
