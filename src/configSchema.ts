import * as Joi from 'joi';

export const configSchema = Joi.object({
  POINT_FACTORY_ADDRESS: Joi.string(),
  PRIVATE_KEY: Joi.string(),
  RPC_URL: Joi.string(),
  JWT_SECRET: Joi.string(),
  SALT: Joi.string(),
  THB_ADDRESS: Joi.string(),
  Coupon_ADDRESS: Joi.string(),
  Vault_ADDRESS: Joi.string(),
  Marketplace_ADDRESS: Joi.string(),
});
