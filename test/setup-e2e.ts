// Runs before any test-file import (jest setupFiles), so these values win over
// .env: ConfigModule validates env at AppModule import time, and dotenv never
// overrides keys already present in process.env.
process.env.CORS_ORIGINS = 'http://allowed.test';
