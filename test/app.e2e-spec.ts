import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/bootstrap';

describe('Bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    await configureApp(app as NestExpressApplication);
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('applies x-content-type-options security header via helmet', async () => {
    const res = await request(app.getHttpServer()).get('/merchant');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
