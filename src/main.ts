import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/response.interceptor';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const config = new DocumentBuilder()
    .setTitle('DLT Loyalty API')
    .setDescription('The cats API')
    .setVersion('1.0')
    .addTag('DLT')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.use(helmet());

  const allowedOrigins = configService.get<string>('CORS_ORIGINS');
  app.enableCors({
    origin: allowedOrigins ? allowedOrigins.split(',') : [],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  await app.listen(4000);
}
bootstrap();
