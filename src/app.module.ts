import { Module, ValidationPipe } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { configSchema } from './configSchema';
import { TokenModule } from './providers/token/token.module';
import { AdmdModule } from './providers/admd/admd.module';
import { CustomAuthGuard } from './modules/internal/auth/custom-auth.guard';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { InternalModule } from './modules/internal/internal.module';
import { ExternalModule } from './modules/external/external.module';
import { SharedModule } from './modules/shared/shared.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configSchema,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TokenModule,
    AdmdModule, // ADMD OAuth provider (global)
    SharedModule,
    InternalModule, // Internal-facing APIs for backoffice
    ExternalModule, // External-facing APIs for integration
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: CustomAuthGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
