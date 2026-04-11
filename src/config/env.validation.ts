import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, validateSync } from 'class-validator';

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
