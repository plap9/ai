import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { isString, isNumber, FileUploadMetadata } from '@ai-assistant/utils';

/**
 * File upload validation configuration
 */
interface FileUploadConfig {
  maxSize: number; // bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  required: boolean;
}

/**
 * Default file upload configurations
 */
export const FileUploadConfigs = {
  // Image uploads
  image: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    required: true,
  } as FileUploadConfig,

  // Document uploads
  document: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
    required: true,
  } as FileUploadConfig,

  // General files
  general: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedMimeTypes: ['*'], // Any type
    allowedExtensions: ['*'], // Any extension
    required: false,
  } as FileUploadConfig,

  // Avatar uploads
  avatar: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    required: false,
  } as FileUploadConfig,
} as const;

/**
 * Express.Multer.File interface extension with type safety
 */
interface SafeUploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

/**
 * Type guard để check uploaded file
 */
function isValidUploadedFile(file: unknown): file is SafeUploadedFile {
  if (file === null || typeof file !== 'object') {
    return false;
  }

  const fileObj = file as Record<string, unknown>;

  return (
    'fieldname' in fileObj &&
    'originalname' in fileObj &&
    'encoding' in fileObj &&
    'mimetype' in fileObj &&
    'size' in fileObj &&
    isString(fileObj.fieldname) &&
    isString(fileObj.originalname) &&
    isString(fileObj.encoding) &&
    isString(fileObj.mimetype) &&
    isNumber(fileObj.size)
  );
}

/**
 * File Upload Validation Pipe với type safety
 */
@Injectable()
export class FileUploadValidationPipe implements PipeTransform {
  private readonly config: FileUploadConfig;

  constructor(config?: Partial<FileUploadConfig>) {
    this.config = {
      ...FileUploadConfigs.general,
      ...config,
    };
  }

  transform(files: unknown, _metadata: ArgumentMetadata): SafeUploadedFile[] {
    void _metadata; // Parameter required by interface but not used

    // Handle required validation
    if (
      this.config.required &&
      (!files || (Array.isArray(files) && files.length === 0))
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'File upload validation failed',
        errors: ['File is required'],
        timestamp: new Date().toISOString(),
      });
    }

    // Handle optional files
    if (!files) {
      return [];
    }

    // Convert to array for consistent processing
    const fileArray = Array.isArray(files) ? files : [files];

    // Validate each file
    const validatedFiles: SafeUploadedFile[] = [];

    for (const file of fileArray) {
      if (!isValidUploadedFile(file)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'File upload validation failed',
          errors: ['Invalid file object'],
          timestamp: new Date().toISOString(),
        });
      }

      // Validate file size
      if (file.size > this.config.maxSize) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'File upload validation failed',
          errors: [
            `File "${file.originalname}" exceeds maximum size of ${this.formatFileSize(this.config.maxSize)}`,
          ],
          timestamp: new Date().toISOString(),
        });
      }

      // Validate MIME type
      if (!this.isAllowedMimeType(file.mimetype)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'File upload validation failed',
          errors: [
            `File type "${file.mimetype}" is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`,
          ],
          timestamp: new Date().toISOString(),
        });
      }

      // Validate file extension
      if (!this.isAllowedExtension(file.originalname)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'File upload validation failed',
          errors: [
            `File extension is not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`,
          ],
          timestamp: new Date().toISOString(),
        });
      }

      validatedFiles.push(file);
    }

    return validatedFiles;
  }

  /**
   * Check if MIME type is allowed
   */
  private isAllowedMimeType(mimetype: string): boolean {
    if (this.config.allowedMimeTypes.includes('*')) {
      return true;
    }
    return this.config.allowedMimeTypes.includes(mimetype);
  }

  /**
   * Check if file extension is allowed
   */
  private isAllowedExtension(filename: string): boolean {
    if (this.config.allowedExtensions.includes('*')) {
      return true;
    }

    const extension = this.getFileExtension(filename);
    return this.config.allowedExtensions.includes(extension);
  }

  /**
   * Get file extension từ filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return '';
    }
    return filename.substring(lastDotIndex).toLowerCase();
  }

  /**
   * Format file size for error messages
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Pre-configured file upload pipes
 */
@Injectable()
export class ImageUploadPipe extends FileUploadValidationPipe {
  constructor() {
    super(FileUploadConfigs.image);
  }
}

@Injectable()
export class DocumentUploadPipe extends FileUploadValidationPipe {
  constructor() {
    super(FileUploadConfigs.document);
  }
}

@Injectable()
export class AvatarUploadPipe extends FileUploadValidationPipe {
  constructor() {
    super(FileUploadConfigs.avatar);
  }
}

/**
 * Helper để create file metadata
 */
export function createFileMetadata(
  file: SafeUploadedFile,
  uploadedBy: string,
): FileUploadMetadata {
  return {
    originalName: file.originalname,
    filename: file.filename || file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path || '',
    uploadedAt: new Date(),
    uploadedBy,
  };
}
