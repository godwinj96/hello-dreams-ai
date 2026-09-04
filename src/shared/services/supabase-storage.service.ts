import { Injectable, Logger, BadRequestException } from '@nestjs/common';

const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabase: SupabaseClient | undefined;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    // Prefer service role key for server-side operations (bypasses RLS).
    // Fall back to anon key if service role key is not configured.
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'Supabase credentials not configured. File storage will not work.',
      );
      this.logger.debug(`SUPABASE_URL: ${supabaseUrl ? 'set' : 'missing'}`);
      this.logger.debug(
        `SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY: ${supabaseKey ? 'set' : 'missing'}`,
      );
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      this.bucketName = this.configService.get<string>(
        'SUPABASE_ORIGINAL_HEADSHOT_BUCKET',
        'headshot-originals',
      );
      this.logger.log(
        `Supabase storage initialized with bucket: ${this.bucketName}`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    userId: string,
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage not configured');
    }

    const rawExt = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_IMAGE_EXTENSIONS.has(rawExt)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(', ')}`,
      );
    }
    const fileExt = rawExt;
    const fileName = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        this.logger.error('Error uploading file to Supabase', error);
        throw new BadRequestException(
          `Failed to upload file: ${error.message}`,
        );
      }

      // Bucket is private — return a signed URL valid for 1 week so the frontend
      // can display the image and the generation service can download it.
      const { data: signedData, error: signedError } =
        await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(fileName, 7 * 24 * 3600);

      if (signedError || !signedData?.signedUrl) {
        this.logger.error(
          'Error creating signed URL after upload',
          signedError,
        );
        throw new BadRequestException(
          `Failed to create signed URL: ${signedError?.message}`,
        );
      }

      return signedData.signedUrl;
    } catch (error) {
      this.logger.error('Error in uploadFile', error);
      throw error;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
    userId: string,
    retries: number = 3,
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage not configured');
    }

    const filePath = `${folder}/${userId}/${Date.now()}-${fileName}`;
    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    this.logger.log(
      `Uploading file: ${fileName} (${fileSizeMB} MB) to ${filePath}`,
    );

    let lastError: any;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug(
          `Upload attempt ${attempt}/${retries} for ${fileName}`,
        );

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: false,
            // Add timeout and retry options
            cacheControl: '3600',
          });

        if (error) {
          // Check if it's a network/connection error that we should retry
          // StorageApiError has 'status' property, StorageUnknownError wraps originalError
          const errorStatus = (error as any).status;
          const originalError = (error as any).originalError;

          const isRetryableError =
            error.message?.includes('fetch failed') ||
            error.message?.includes('network') ||
            error.message?.includes('timeout') ||
            error.message?.includes('ECONNRESET') ||
            error.message?.includes('socket') ||
            (originalError &&
              (originalError?.code === 'UND_ERR_SOCKET' ||
                originalError?.message?.includes('fetch failed') ||
                originalError?.message?.includes('socket'))) ||
            errorStatus === 408 || // Request Timeout
            errorStatus === 429 || // Too Many Requests
            errorStatus === 500 || // Internal Server Error
            errorStatus === 502 || // Bad Gateway
            errorStatus === 503 || // Service Unavailable
            errorStatus === 504; // Gateway Timeout

          if (isRetryableError && attempt < retries) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
            this.logger.warn(
              `Upload attempt ${attempt} failed (retryable error), retrying in ${waitTime}ms: ${error.message}`,
            );
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          this.logger.error('Error uploading buffer to Supabase', error);
          throw new BadRequestException(
            `Failed to upload file: ${error.message}`,
          );
        }

        // Success!
        this.logger.log(
          `Successfully uploaded ${fileName} (${fileSizeMB} MB) on attempt ${attempt}`,
        );

        // Bucket is private — return a signed URL valid for 1 week.
        const { data: signedData, error: signedError } =
          await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(filePath, 7 * 24 * 3600);

        if (signedError || !signedData?.signedUrl) {
          this.logger.error(
            'Error creating signed URL after buffer upload',
            signedError,
          );
          throw new BadRequestException(
            `Failed to create signed URL: ${signedError?.message}`,
          );
        }

        return signedData.signedUrl;
      } catch (error: any) {
        lastError = error;

        // Check if it's a network error that we should retry
        const isNetworkError =
          error?.message?.includes('fetch failed') ||
          error?.message?.includes('ECONNRESET') ||
          error?.message?.includes('socket') ||
          error?.code === 'UND_ERR_SOCKET' ||
          error?.cause?.code === 'UND_ERR_SOCKET';

        if (isNetworkError && attempt < retries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          this.logger.warn(
            `Upload attempt ${attempt} failed (network error), retrying in ${waitTime}ms: ${error.message || error}`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        // If it's the last attempt or not retryable, throw
        if (attempt === retries) {
          this.logger.error(
            `Error in uploadBuffer after ${retries} attempts`,
            error,
          );
          throw new BadRequestException(
            `Failed to upload file after ${retries} attempts: ${error.message || error}`,
          );
        }
      }
    }

    // Should never reach here, but just in case
    throw new BadRequestException(
      `Failed to upload file after ${retries} attempts: ${lastError?.message || 'Unknown error'}`,
    );
  }

  /**
   * Uploads to a public bucket and returns a permanent public URL.
   *
   * uploadBuffer targets the private headshot bucket and returns a signed URL
   * that expires after a week — fine for a one-off download, wrong for
   * something like an avatar that must keep resolving indefinitely.
   */
  async uploadPublic(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
    userId: string,
    bucket: string,
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage not configured');
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${folder}/${userId}/${Date.now()}-${safeName}`;

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      this.logger.error(`Error uploading to public bucket ${bucket}`, error);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new BadRequestException('Failed to resolve public URL');
    }

    return data.publicUrl;
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage not configured');
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        this.logger.error('Error creating signed URL', error);
        throw new BadRequestException(
          `Failed to create signed URL: ${error.message}`,
        );
      }

      return data.signedUrl;
    } catch (error) {
      this.logger.error('Error in getSignedUrl', error);
      throw error;
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage not configured');
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        this.logger.error('Error downloading file from Supabase', error);
        throw new BadRequestException(
          `Failed to download file: ${error.message}`,
        );
      }

      // supabase-js returns a Blob in Node runtimes as well; normalize to Buffer.
      const ab = await data.arrayBuffer();
      return Buffer.from(new Uint8Array(ab));
    } catch (error) {
      this.logger.error('Error in downloadFile', error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage not configured');
    }

    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        this.logger.error('Error deleting file from Supabase', error);
        throw new BadRequestException(
          `Failed to delete file: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error('Error in deleteFile', error);
      throw error;
    }
  }
}
