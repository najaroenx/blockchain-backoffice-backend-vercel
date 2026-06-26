import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

// Must match the value assigned in setup-e2e.ts (jest setupFiles) — env has to
// be set before AppModule is imported, which is earlier than beforeAll can run.
const ALLOWED_ORIGIN = 'http://allowed.test';

describe('CORS policy (e2e)', () => {
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

  it('returns Access-Control-Allow-Origin for a whitelisted origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/coupon')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('omits Access-Control-Allow-Origin for an unlisted origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/coupon')
      .set('Origin', 'http://evil.test')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not echo a wildcard when credentials are enabled', async () => {
    const res = await request(app.getHttpServer())
      .options('/coupon')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});
