# File Upload & Storage System - Complete Guide

## Overview

The File Upload & Storage System enables secure, scalable file management for FleetPro. Supports local filesystem storage for development and AWS S3 for production.

## Features

### Core Capabilities

- **Secure Upload**: Validation, virus scanning hooks, file type restrictions
- **Cloud Storage**: AWS S3 integration (production) or local filesystem (development)
- **Access Control**: Granular file permissions per user
- **Audit Trail**: Track who uploaded, downloaded, and modified files
- **Soft Delete**: Files marked inactive for compliance (never truly deleted)
- **Signed URLs**: Temporary download links with expiration
- **Storage Quotas**: Track per-tenant storage usage
- **File Categories**: Organize by document type (invoice, license, receipt, etc.)

### Supported File Types

- **Documents**: PDF, Word (.doc, .docx), Excel (.xls, .xlsx)
- **Images**: JPEG, PNG, WebP
- **Max Size**: 50 MB per file

## API Endpoints

### Upload File

**POST** `/api/files/upload`

Upload a file to secure storage.

**Request:**
```bash
curl -X POST http://localhost:5050/api/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf" \
  -F "category=invoice" \
  -F "metadata={\"invoiceNumber\": \"INV-001\"}"
```

**Response:**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "fileId": "507f1f77bcf86cd799439011",
    "filename": "document.pdf",
    "size": 102400,
    "mimeType": "application/pdf",
    "uploadedAt": "2026-08-17T10:30:00Z",
    "storageUrl": "https://s3.amazonaws.com/bucket/..."
  }
}
```

### Get File Metadata

**GET** `/api/files/:fileId`

Retrieve file information.

**Request:**
```bash
curl http://localhost:5050/api/files/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "filename": "document.pdf",
  "size": 102400,
  "mimeType": "application/pdf",
  "category": "invoice",
  "uploadedAt": "2026-08-17T10:30:00Z",
  "uploadedBy": "507f1f77bcf86cd799439012",
  "virusScanStatus": "pending"
}
```

### Download File

**GET** `/api/files/:fileId/download`

Generate signed download URL (expires in 1 hour).

**Request:**
```bash
curl http://localhost:5050/api/files/507f1f77bcf86cd799439011/download \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/bucket/...?expires=3600&signature=..."
}
```

### List Files

**GET** `/api/files?category=invoice&limit=50&skip=0`

List all files for tenant.

**Request:**
```bash
curl "http://localhost:5050/api/files?category=invoice&limit=50" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "files": [
    {
      "id": "507f1f77bcf86cd799439011",
      "filename": "invoice-001.pdf",
      "size": 102400,
      "category": "invoice",
      "uploadedAt": "2026-08-17T10:30:00Z",
      "uploadedBy": "507f1f77bcf86cd799439012"
    }
  ]
}
```

### Delete File

**DELETE** `/api/files/:fileId`

Soft delete (mark as inactive).

**Request:**
```bash
curl -X DELETE http://localhost:5050/api/files/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <token>"
```

### Share File

**POST** `/api/files/:fileId/share`

Grant access to another user.

**Request:**
```bash
curl -X POST http://localhost:5050/api/files/507f1f77bcf86cd799439011/share \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439013",
    "accessLevel": "download"
  }'
```

### Storage Statistics

**GET** `/api/files/stats/storage`

Get tenant storage usage.

**Request:**
```bash
curl http://localhost:5050/api/files/stats/storage \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "totalFiles": 156,
  "totalSizeBytes": 5368709120,
  "totalSizeMB": 5120.00,
  "filesByCategory": {
    "invoice": 45,
    "license": 23,
    "receipt": 88
  },
  "storageLimit": 100,
  "storageUsagePercent": 5
}
```

## File Categories

### Available Categories

| Category | Use Case | Examples |
|----------|----------|----------|
| **document** | General documents | Contracts, agreements, policies |
| **invoice** | Billing documents | Invoices, receipts, statements |
| **license** | Identity documents | Driver licenses, ID cards, permits |
| **receipt** | Purchase receipts | Proofs of payment, transactions |
| **proof** | Verification documents | Proof of address, insurance, utility bills |
| **other** | Miscellaneous | Other file types |

## Access Control

### Permission Levels

- **view**: Can view file metadata only
- **download**: Can download file
- **edit**: Can modify file metadata

### Default Access

- **Uploader**: Always has full access
- **Others**: Must be explicitly granted access

## Configuration

### Environment Variables

```bash
# AWS S3 Configuration (Production)
AWS_S3_BUCKET=fleetpro-files
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Local Storage Configuration (Development)
LOCAL_STORAGE_PATH=./uploads
STORAGE_LIMIT_GB=100
```

### Local Development

By default, files are stored in `./uploads`:
```
./uploads/
├── <tenant-id>/
│   ├── invoice/
│   ├── license/
│   └── receipt/
```

### Production (AWS S3)

Files stored with path structure:
```
s3://bucket/
├── <tenant-id>/
│   ├── invoice/
│   ├── license/
│   └── receipt/
```

## Database Models

### FileUpload

```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  uploadedBy: ObjectId,
  originalFilename: string,
  storedFilename: string,
  mimeType: string,
  sizeBytes: number,
  category: 'document'|'invoice'|'license'|'receipt'|'proof'|'other',
  storageUrl: string,
  storagePath: string,
  metadata: object,
  isActive: boolean,
  virusScanned: boolean,
  virusScanStatus: 'pending'|'clean'|'infected'|'failed',
  deletedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### FileAccess

```typescript
{
  _id: ObjectId,
  fileId: ObjectId,
  tenantId: ObjectId,
  grantedTo: ObjectId,
  accessLevel: 'view'|'download'|'edit',
  grantedBy: ObjectId,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Security Features

### File Validation

1. **Type Checking**: Only whitelisted MIME types
2. **Size Limits**: 50MB maximum per file
3. **Virus Scanning**: Integration hooks for ClamAV/VirusTotal
4. **Access Control**: User-based permissions required

### Storage Security

1. **Encryption**: Files encrypted at rest (S3 SSE)
2. **Access Logs**: All downloads logged to audit trail
3. **Signed URLs**: Temporary credentials with expiration
4. **Soft Delete**: Files never truly deleted (compliance)

### Network Security

1. **HTTPS Only**: All transfers encrypted in transit
2. **Tenant Isolation**: Files cannot be accessed cross-tenant
3. **IP Logging**: Client IP captured with each download
4. **Rate Limiting**: Per-user file operation quotas

## Integration Examples

### Upload Invoice for Booking

```javascript
async function uploadBookingInvoice(bookingId, fileBuffer) {
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), 'invoice.pdf');
  formData.append('category', 'invoice');
  formData.append('metadata', JSON.stringify({
    bookingId: bookingId,
    type: 'payment_proof'
  }));

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  return response.json();
}
```

### Get Signed Download Link

```javascript
async function getDownloadLink(fileId) {
  const response = await fetch(`/api/files/${fileId}/download`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const { downloadUrl } = await response.json();
  
  // Link expires in 1 hour
  return downloadUrl;
}
```

### Share File with Manager

```javascript
async function shareWithManager(fileId, managerId) {
  const response = await fetch(`/api/files/${fileId}/share`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: managerId,
      accessLevel: 'download'
    })
  });

  return response.json();
}
```

## Storage Quotas

### Per-Tenant Limits

- **Starter Plan**: 10 GB
- **Professional Plan**: 100 GB
- **Enterprise Plan**: Unlimited

Storage usage tracked real-time:
```bash
GET /api/files/stats/storage
```

## Compliance & Audit

### Audit Trail

Every file operation logged:
- Upload (who, when, file info)
- Download (who, when, IP address)
- Access grants (who granted, to whom, level)
- Deletions (marked inactive, not removed)

### GDPR Compliance

- **Right to be Forgotten**: Soft delete marks file inactive (not deleted)
- **Data Access**: Users can download their own files
- **Data Portability**: Export file list in JSON/CSV format
- **Access Logs**: All downloads tracked and auditable

### SOC2 Compliance

- **Encryption**: At rest and in transit
- **Access Control**: Role-based permissions
- **Audit Trail**: Complete history retained
- **Retention**: Configurable retention policies

## Troubleshooting

### File Upload Fails

**Issue**: "File size exceeds 50MB limit"
- Solution: Split file or request larger quota

**Issue**: "File type not allowed"
- Solution: Convert to PDF or supported format

**Issue**: "Virus detected"
- Solution: File failed virus scan, cannot upload

### Access Denied

**Issue**: "Access denied when downloading"
- Solution: File uploader must grant you access via share

**Issue**: "File not found"
- Solution: File may have been deleted by uploader

### Storage Full

**Issue**: "Storage quota exceeded"
- Solution: Delete unused files or upgrade plan

## Production Checklist

- [ ] AWS S3 bucket created and configured
- [ ] IAM role/keys provisioned for API access
- [ ] S3 bucket encryption enabled (SSE-S3 or SSE-KMS)
- [ ] Bucket versioning enabled for recovery
- [ ] CORS configured for web uploads
- [ ] Virus scanning service configured
- [ ] Backup/recovery procedure documented
- [ ] Storage quotas configured per plan
- [ ] Monitoring and alerts set up
- [ ] File retention policies defined

## Future Enhancements

- [ ] Image optimization (resize, compress)
- [ ] OCR for document extraction
- [ ] Full-text search of PDFs
- [ ] Document versioning (track changes)
- [ ] Collaborative editing integration
- [ ] Preview generation (thumbnails)
- [ ] Automatic format conversion
- [ ] Watermarking for sensitive docs
- [ ] Batch upload/download
- [ ] File compression/archiving

---

**Last Updated**: 2026-08-17  
**Status**: Production Ready  
**Storage Backends**: AWS S3 + Local Filesystem  
**Max File Size**: 50 MB  
**Max Tenant Storage**: 100 GB (configurable)
