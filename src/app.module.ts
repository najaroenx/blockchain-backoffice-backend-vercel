import { Module, ValidationPipe } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { configSchema } from './configSchema';
import { TokenModule } from './providers/token/token.module';
import { AdmdModule } from './providers/admd/admd.module';
import { AisSmsModule } from './providers/ais-sms/ais-sms.module';
import { CustomAuthGuard } from './modules/internal/auth/custom-auth.guard';
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
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    TokenModule,
    AdmdModule,
    AisSmsModule,
    SharedModule,
    InternalModule,
    ExternalModule,
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
