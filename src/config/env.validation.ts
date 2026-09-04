import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsOptional()
  @IsNumber()
  @Min(1)
  PORT: number = 3000;

  @IsString()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRATION: string;

  @IsString()
  DATABASE_URL: string;

  @IsOptional()
  @IsString()
  SUPABASE_URL: string;

  @IsOptional()
  @IsString()
  SUPABASE_ANON_KEY: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY: string;

  @IsOptional()
  @IsString()
  HUGGINGFACE_API_KEY: string;

  @IsOptional()
  @IsString()
  PAYSTACK_SECRET_KEY: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN: string;

  @IsOptional()
  @IsString()
  SERPAPI_API_KEY: string;

  @IsOptional()
  @IsString()
  JSEARCH_RAPIDAPI_KEY: string;

  @IsOptional()
  @IsString()
  CAREERJET_API_KEY: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  NGN_TO_USD_RATE: number;

  @IsOptional()
  @IsString()
  OPENAI_IMAGE_QUALITY: string;

  @IsOptional()
  @IsString()
  RESEND_API_KEY: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsOptional()
  @IsString()
  GOOGLE_CALLBACK_URL: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  REFRESH_TOKEN_EXPIRATION_DAYS: number;

  @IsOptional()
  @IsString()
  PAYSTACK_PUBLIC_KEY: string;

  @IsOptional()
  @IsString()
  PAYSTACK_PLAN_CODE: string;

  // Per-interval Paystack plan codes. Fall back to PAYSTACK_PLAN_CODE above.
  @IsOptional()
  @IsString()
  PAYSTACK_PLAN_CODE_MONTHLY: string;

  @IsOptional()
  @IsString()
  PAYSTACK_PLAN_CODE_ANNUAL: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  TOKENS_PER_CREDIT: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  FREE_DAILY_CREDITS: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  PRO_DAILY_CREDITS: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  MIN_CREDITS_PER_OP: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  HEADSHOT_CREDIT_COST: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  VOICE_CREDIT_COST: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  CV_UPLOAD_CREDIT_COST: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  CREDITS_PER_PAYMENT: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  CREDITS_PER_SUBSCRIPTION: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  PAYSTACK_PRO_MONTHLY_AMOUNT: number;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }

  return validatedConfig;
}
