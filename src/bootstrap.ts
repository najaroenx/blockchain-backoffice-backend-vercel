import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { ResponseInterceptor } from './common/response.interceptor';

/**
 * Applies all app-level middleware and configuration.
 * Called from both main.ts (production) and e2e tests so both
 * run against the same bootstrap behaviour.
 *
 * Security: CORS restricts origins to the CORS_ORIGINS allow-list;
 * wildcard with credentials is explicitly forbidden.
 */
export async function configureApp(app: NestExpressApplication): Promise<void> {
  const configService = app.get(ConfigService);

  const originsRaw = configService.get<string>('CORS_ORIGINS') ?? '';
  const allowedOrigins = new Set(
    originsRaw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );

  // Security: origin callback — echoes back only the exact allowed origin so
  // browsers can verify; 'credentials: true' must never pair with '*'.
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        // Same-origin / non-browser request — no CORS header needed.
        return callback(null, false);
      }
      if (allowedOrigins.has(requestOrigin)) {
        return callback(null, requestOrigin);
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.use(helmet());
}
