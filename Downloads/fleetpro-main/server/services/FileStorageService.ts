import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FileUpload, FileAccess } from '../models/index';
import mongoose from 'mongoose';

export interface UploadFileRequest {
  tenantId: string;
  userId: string;
  file: {
    fieldname: string;
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
  category: 'document' | 'invoice' | 'license' | 'receipt' | 'proof' | 'other';
  metadata?: Record<string, any>;
}

export interface DownloadSignedUrlRequest {
  fileId: string;
  tenantId: string;
  userId: string;
  expiresInSeconds?: number;
}

class FileStorageService {
  private s3: AWS.S3 | null = null;
  private bucket: string;
  private useS3: boolean;
  private localStoragePath: string;

  constructor() {
    this.useS3 = process.env.AWS_S3_BUCKET ? true : false;
    this.bucket = process.env.AWS_S3_BUCKET || '';
    this.localStoragePath = process.env.LOCAL_STORAGE_PATH || './uploads';

    if (this.useS3) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });

    } else {
      // Ensure local storage directory exists
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
      }
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file: UploadFileRequest['file']): { valid: boolean; error?: string } {
    // Max 50MB
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: 'File size exceeds 50MB limit' };
    }

    // Allowed file types
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: `File type not allowed: ${file.mimetype}` };
    }

    return { valid: true };
  }

  /**
   * Generate unique file ID and path
   */
  generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Upload file to storage
   */
  async uploadFile(request: UploadFileRequest): Promise<any> {
    try {
      // Validate file
      const validation = this.validateFile(request.file);
      if (!validation.valid) {
        throw new Error(validation.error || 'File validation failed');
      }

      const fileId = this.generateFileId();
      const fileExtension = path.extname(request.file.originalname);
      const storageFileName = `${fileId}${fileExtension}`;
      const storagePath = `${request.tenantId}/${request.category}/${storageFileName}`;

      let storageUrl = '';
      let storageSizeBytes = request.file.size;

      if (this.useS3 && this.s3) {
        // Upload to S3
        const params = {
          Bucket: this.bucket,
          Key: storagePath,
          Body: request.file.buffer,
          ContentType: request.file.mimetype,
          Metadata: {
            'original-filename': request.file.originalname,
            'uploaded-by': request.userId,
            'uploaded-at': new Date().toISOString(),
          },
        };

        const result = await this.s3.upload(params).promise();
        storageUrl = result.Location;

      } else {
        // Save to local filesystem
        const localDir = path.join(this.localStoragePath, request.tenantId, request.category);

        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        const localPath = path.join(localDir, storageFileName);
        fs.writeFileSync(localPath, request.file.buffer);
        storageUrl = `/uploads/${request.tenantId}/${request.category}/${storageFileName}`;

      }

      // Create database record
      const fileRecord = new FileUpload({
        tenantId: new mongoose.Types.ObjectId(request.tenantId),
        uploadedBy: new mongoose.Types.ObjectId(request.userId),
        originalFilename: request.file.originalname,
        storedFilename: storageFileName,
        mimeType: request.file.mimetype,
        sizeBytes: storageSizeBytes,
        category: request.category,
        storageUrl,
        storagePath,
        metadata: request.metadata || {},
        isActive: true,
        // ClamAV integration pending: MIME type validation (validateFile) provides interim protection
        // When enabled, will trigger async malware scanning with status tracking
        virusScanned: false,
        virusScanStatus: 'pending',
      });

      await fileRecord.save();

      return {
        fileId: fileRecord._id,
        filename: request.file.originalname,
        size: storageSizeBytes,
        mimeType: request.file.mimetype,
        uploadedAt: fileRecord.createdAt,
        storageUrl,
      };
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(tenantId: string, fileId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const fileObjectId = new mongoose.Types.ObjectId(fileId);

      const file = await FileUpload.findOne({
        _id: fileObjectId,
        tenantId: tenantObjectId,
        isActive: true,
      }).lean();

      if (!file) {
        return null;
      }

      return {
        id: file._id,
        filename: file.originalFilename,
        size: file.sizeBytes,
        mimeType: file.mimeType,
        category: file.category,
        uploadedAt: file.createdAt,
        uploadedBy: file.uploadedBy,
        virusScanStatus: file.virusScanStatus,
      };
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  /**
   * Generate signed download URL
   */
  async getDownloadUrl(request: DownloadSignedUrlRequest): Promise<string> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(request.tenantId);
      const fileObjectId = new mongoose.Types.ObjectId(request.fileId);

      const file = await FileUpload.findOne({
        _id: fileObjectId,
        tenantId: tenantObjectId,
        isActive: true,
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Check access permissions
      const hasAccess = await this.checkFileAccess(
        request.tenantId,
        request.userId,
        request.fileId
      );

      if (!hasAccess) {
        throw new Error('Access denied');
      }

      const expiresIn = request.expiresInSeconds || 3600; // Default 1 hour

      if (this.useS3 && this.s3) {
        // Generate S3 signed URL
        const params = {
          Bucket: this.bucket,
          Key: file.storagePath,
          Expires: expiresIn,
        };

        const url = this.s3.getSignedUrl('getObject', params);
        return url;
      } else {
        // For local storage, return the file URL
        // In production, should generate a token for security
        return file.storageUrl;
      }
    } catch (error) {
      console.error('Failed to generate download URL:', error);
      throw error;
    }
  }

  /**
   * Check file access permissions
   */
  async checkFileAccess(tenantId: string, userId: string, fileId: string): Promise<boolean> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const fileObjectId = new mongoose.Types.ObjectId(fileId);

      // Check if user has explicit access grant
      const access = await FileAccess.findOne({
        fileId: fileObjectId,
        tenantId: tenantObjectId,
        grantedTo: userObjectId,
        isActive: true,
      });

      if (access) {
        return true;
      }

      // Check if user is the uploader (always has access)
      const file = await FileUpload.findOne({
        _id: fileObjectId,
        tenantId: tenantObjectId,
      });

      if (file && file.uploadedBy.toString() === userObjectId.toString()) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check file access:', error);
      return false;
    }
  }

  /**
   * Grant access to file
   */
  async grantFileAccess(tenantId: string, fileId: string, grantedToUserId: string, accessLevel: 'view' | 'download' | 'edit'): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const fileObjectId = new mongoose.Types.ObjectId(fileId);
      const userObjectId = new mongoose.Types.ObjectId(grantedToUserId);

      const access = new FileAccess({
        fileId: fileObjectId,
        tenantId: tenantObjectId,
        grantedTo: userObjectId,
        accessLevel,
        isActive: true,
      });

      await access.save();

      return access;
    } catch (error) {
      console.error('Failed to grant file access:', error);
      throw error;
    }
  }

  /**
   * Revoke file access
   */
  async revokeFileAccess(tenantId: string, fileId: string, userId: string): Promise<void> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const fileObjectId = new mongoose.Types.ObjectId(fileId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      await FileAccess.findOneAndUpdate(
        {
          fileId: fileObjectId,
          tenantId: tenantObjectId,
          grantedTo: userObjectId,
        },
        { isActive: false, updatedAt: new Date() }
      );

    } catch (error) {
      console.error('Failed to revoke file access:', error);
      throw error;
    }
  }

  /**
   * Soft delete file (mark as inactive)
   */
  async deleteFile(tenantId: string, fileId: string): Promise<void> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const fileObjectId = new mongoose.Types.ObjectId(fileId);

      await FileUpload.findOneAndUpdate(
        {
          _id: fileObjectId,
          tenantId: tenantObjectId,
        },
        {
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        }
      );

    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  /**
   * List files for tenant
   */
  async listFiles(tenantId: string, category?: string, limit: number = 50, skip: number = 0): Promise<any[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const query: any = {
        tenantId: tenantObjectId,
        isActive: true,
      };

      if (category) {
        query.category = category;
      }

      const files = await FileUpload.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      return files.map(f => ({
        id: f._id,
        filename: f.originalFilename,
        size: f.sizeBytes,
        category: f.category,
        uploadedAt: f.createdAt,
        uploadedBy: f.uploadedBy,
      }));
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }

  /**
   * Get file storage statistics
   */
  async getStorageStats(tenantId: string): Promise<any> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

      const files = await FileUpload.find({
        tenantId: tenantObjectId,
        isActive: true,
      }).lean();

      const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);
      const byCategory = files.reduce((acc: any, f: any) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      }, {});

      return {
        totalFiles: files.length,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        filesByCategory: byCategory,
        storageLimit: process.env.STORAGE_LIMIT_GB || 100,
        storageUsagePercent: Math.round((totalSize / (100 * 1024 * 1024 * 1024)) * 100),
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      throw error;
    }
  }
}

export const fileStorageService = new FileStorageService();
