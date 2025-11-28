import * as Joi from 'joi';

export const configSchema = Joi.object({
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
});
