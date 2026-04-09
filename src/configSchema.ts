import * as Joi from 'joi';

export const configSchema = Joi.object({
  ADMIN_USERNAME: Joi.string().allow('').default(''),
  ADMIN_PASSWORD: Joi.string().allow('').default(''),
  POINT_FACTORY_ADDRESS: Joi.string(),
  PRIVATE_KEY: Joi.string(),
  RPC_URL: Joi.string(),
  JWT_SECRET: Joi.string(),
  SALT: Joi.string(),
  THB_ADDRESS: Joi.string(),
  COUPON_ADDRESS: Joi.string(),
  VAULT_ADDRESS: Joi.string(),
  MARKETPLACE_ADDRESS: Joi.string(),
  OTP_API_URL: Joi.string(),
  OTP_API_USERNAME: Joi.string(),
  OTP_API_PASSWORD: Joi.string(),
  FRONT_URL: Joi.string().allow('').default(''),
  CALLBACK_URL: Joi.string().allow('').default(''),
  CORS_ORIGINS: Joi.string().allow('').default(''),

  // ADMD OAuth Config
  ADMD_TOKEN_URL: Joi.string().default(''),
  ADMD_CLIENT_ID: Joi.string().allow('').default(''),
  ADMD_CLIENT_SECRET: Joi.string().allow('').default(''),

  // AIS Transfer Config
  AIS_TRANSFER_BASE_URL: Joi.string().default(''),
  AIS_TRANSFER_USERNAME: Joi.string().allow('').default(''),
  AIS_TRANSFER_PASSWORD: Joi.string().allow('').default(''),
  AIS_TRANSFER_REFERENCE_CODE: Joi.string().allow('').default(''),
});
