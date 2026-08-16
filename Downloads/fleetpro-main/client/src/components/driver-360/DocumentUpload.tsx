import React, { useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DocumentUploadProps {
  stepIndex: number;
  documentType: 'aadhar' | 'pan' | 'license' | 'medical' | 'certificate';
  onUpload: (url: string) => void;
  disabled?: boolean;
  previewUrl?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  stepIndex,
  documentType,
  onUpload,
  disabled = false,
  previewUrl
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(previewUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentLabels: Record<string, string> = {
    aadhar: 'Aadhar Document',
    pan: 'PAN Document',
    license: 'Driver License',
    medical: 'Medical Certificate',
    certificate: 'Certificate'
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    if (selectedFile.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only PDF, JPG, PNG, and WebP files are allowed');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const response = await fetch(`/api/driver-onboarding/upload-document`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      const { url } = await response.json();
      onUpload(url);
      setFile(null);
      setPreview(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {preview ? (
        <div className="relative bg-gray-50 border-2 border-dashed border-green-300 rounded-lg p-4">
          {preview.endsWith('.pdf') ? (
            <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded">
              <FileText className="w-8 h-8 text-red-600" />
              <div>
                <p className="font-medium text-sm">{file?.name || 'Document'}</p>
                <p className="text-xs text-gray-600">{((file?.size || 0) / 1024).toFixed(0)} KB</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-600 ml-auto" />
            </div>
          ) : (
            <div className="relative">
              <img
                src={preview}
                alt="Document preview"
                className="max-h-48 mx-auto rounded"
              />
              <CheckCircle className="w-6 h-6 text-green-600 absolute top-2 right-2 bg-white rounded-full" />
            </div>
          )}

          {!uploading && (
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Upload {documentLabels[documentType]}</p>
            <p className="text-xs text-gray-500">PDF or Image (JPG, PNG, WebP)</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="mt-2"
            >
              Choose File
            </Button>
          </div>
        </div>
      )}

      {file && !preview?.startsWith('data:') && (
        <Button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      )}
    </div>
  );
};

export default DocumentUpload;
