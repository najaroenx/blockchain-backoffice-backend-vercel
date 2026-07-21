import * as Joi from 'joi';

export const configSchema = Joi.object({
  // ─── Database ───────────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string().required(),

  // ─── Server ─────────────────────────────────────────────────────────────────
  PORT: Joi.number().integer().positive().default(4000),
  // Security: CORS allow-list (comma-separated origins). Empty = block all.
  CORS_ORIGINS: Joi.string().allow('').default(''),

  // ─── Blockchain — required for app to function ──────────────────────────────
  PRIVATE_KEY: Joi.string().required(),
  RPC_URL: Joi.string().required(),
  POINT_FACTORY_ADDRESS: Joi.string().required(),
  MARKETPLACE_ADDRESS: Joi.string().required(),
  THB_ADDRESS: Joi.string().required(),
  COUPON_ADDRESS: Joi.string().required(),
  VAULT_ADDRESS: Joi.string().required(),

  // ─── Auth ───────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().required(),
  SALT: Joi.string().required(),
  ENABLE_AUTH: Joi.boolean().default(false),
  ADMIN_USERNAME: Joi.string().allow('').default(''),
  ADMIN_PASSWORD: Joi.string().allow('').default(''),

  // ─── Frontend & callback ─────────────────────────────────────────────────────
  FRONT_URL: Joi.string().allow('').default(''),
  CALLBACK_URL: Joi.string().allow('').default(''),

  // ─── OTP service ─────────────────────────────────────────────────────────────
  OTP_API_URL: Joi.string().allow('').default(''),
  OTP_API_USERNAME: Joi.string().allow('').default(''),
  OTP_API_PASSWORD: Joi.string().allow('').default(''),

  // ─── ADMD OAuth ──────────────────────────────────────────────────────────────
  ADMD_TOKEN_URL: Joi.string().allow('').default(''),
  ADMD_CLIENT_ID: Joi.string().allow('').default(''),
  ADMD_CLIENT_SECRET: Joi.string().allow('').default(''),

  // ─── AIS Transfer ────────────────────────────────────────────────────────────
  AIS_TRANSFER_BASE_URL: Joi.string().allow('').default(''),
  AIS_TRANSFER_USERNAME: Joi.string().allow('').default(''),
  AIS_TRANSFER_PASSWORD: Joi.string().allow('').default(''),
  AIS_TRANSFER_REFERENCE_CODE: Joi.string().allow('').default(''),

  // ─── AIS SMS Gateway (MT/DR) ─────────────────────────────────────────────────
  AIS_SMS_API_URL: Joi.string().allow('').default(''),
  AIS_SMS_FROM: Joi.string().allow('').default('AIS'),
  AIS_SMS_CHARGE: Joi.string().allow('').default(''),
  AIS_SMS_CODE: Joi.string().allow('').default(''),
  // Comma-separated hostname allowlist for the /ais-sms/telnet-check
  // diagnostic endpoint (SSRF guard - hostnames not in this list are refused).
  AIS_SMS_TELNET_ALLOWED_HOSTS: Joi.string().allow('').default(''),
});
