import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import imageCompression from 'browser-image-compression';
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface BusinessDetails {
  businessName: string;
  ownerName: string;
  businessAddress: string;
  gstNumber: string;
  businessEmail: string;
  businessPhone: string;
  logoUrl: string;
  signatureUrl: string;
}

interface BusinessProfileProps {
  userRole: string;
  onShowOnboarding?: () => void;
}

export default function BusinessProfile({ userRole, onShowOnboarding }: BusinessProfileProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails>({
    businessName: "",
    ownerName: "",
    businessAddress: "",
    gstNumber: "",
    businessEmail: "",
    businessPhone: "",
    logoUrl: "",
    signatureUrl: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string>("");
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Check if user has access to business profile management
  const hasAccess = userRole === 'client' || userRole === 'admin';
  const isManager = userRole === 'manager';
  
  // Debug logging
  console.log('BusinessProfile - userRole:', userRole, 'hasAccess:', hasAccess, 'isManager:', isManager);

  // Fetch business profile data (enabled for managers too to get inherited profile)
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['/api/auth/business-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/business-profile', {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) return { businessDetails: null };
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
    enabled: hasAccess || isManager
  });

  // Set initial values when data is loaded
  useEffect(() => {
    console.log('BusinessProfile - profileData:', profileData);
    if (profileData?.businessDetails !== undefined) {
      // Handle case where businessDetails is an empty object or null
      const details = profileData.businessDetails || {};
      console.log('BusinessProfile - details:', details);
      setBusinessDetails({
        businessName: details.businessName || "",
        ownerName: details.ownerName || "",
        businessAddress: details.businessAddress || "",
        gstNumber: details.gstNumber || "",
        businessEmail: details.businessEmail || "",
        businessPhone: details.businessPhone || "",
        logoUrl: details.logoUrl || "",
        signatureUrl: details.signatureUrl || ""
      });
    }
  }, [profileData]);

  // Update business profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: BusinessDetails) => {
      const response = await fetch('/api/auth/business-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/business-profile'] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Business profile updated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || 'Failed to update profile',
        variant: "destructive",
      });
    }
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(businessDetails);
  };

  // Handle logo file selection
  const handleLogoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.log('Invalid file type:', file.type);
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please select a valid image file (.jpg, .jpeg, .png, .webp)",
      });
      return;
    }

    // Check file size (20KB = 20480 bytes)
    if (file.size > 20480) {
      toast({
        variant: "destructive",
        title: "File Size Too Large",
        description: (
          <div className="space-y-2">
            <p>Image must be under 20KB for optimal loading.</p>
            <p className="text-sm text-gray-600">
              💡 <strong>Tip:</strong> Use a transparent PNG logo without background for the best appearance in invoices.
            </p>
          </div>
        ),
      });
      return;
    }

    // Check image dimensions
    const img = new Image();
    img.onload = () => {
      if (img.width !== 300 || img.height !== 300) {
        toast({
          variant: "destructive",
          title: "Invalid Image Dimensions",
          description: (
            <div className="space-y-2">
              <p>Logo must be exactly 300x300 pixels.</p>
              <p className="text-sm text-gray-600">Current size: {img.width}x{img.height}px</p>
              <p className="text-sm text-gray-600">
                💡 <strong>Tip:</strong> Use a transparent PNG logo without background for the best appearance in invoices.
              </p>
            </div>
          ),
        });
        return;
      }

      // If all validations pass, set the file
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    };

    img.onerror = () => {
      toast({
        variant: "destructive",
        title: "Invalid Image",
        description: "Unable to process the selected image file.",
      });
    };

    // Load image to check dimensions
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Upload logo to server
  const uploadLogo = async () => {
    if (!logoFile) {
      console.log('No logo file selected');
      return;
    }

    console.log('Starting logo upload...', {
      fileName: logoFile.name,
      fileSize: logoFile.size,
      fileType: logoFile.type
    });

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      console.log('Sending upload request...');
      const response = await fetch('/api/auth/upload-logo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload failed with error:', errorData);
        throw new Error(errorData.message || 'Failed to upload logo');
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      
      // Update business details with the logo URL
      setBusinessDetails(prev => ({
        ...prev,
        logoUrl: result.logoUrl
      }));

      setLogoFile(null);
      setLogoPreview("");
      
      toast({
        title: "Logo Uploaded",
        description: "Company logo has been uploaded successfully!",
      });

      // Refresh the profile data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/business-profile'] });
      
      // Automatically exit edit mode after successful logo upload
      setIsEditing(false);
      
    } catch (error) {
      console.error('Logo upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: (error as Error).message || "Failed to upload logo. Please try again.",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Handle signature file selection
  const handleSignatureSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No signature file selected');
      return;
    }

    console.log('Signature file selected:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.log('Invalid file type:', file.type);
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please select a valid image file (.jpg, .jpeg, .png, .webp)",
      });
      return;
    }

    // Check file size (20KB = 20480 bytes)
    if (file.size > 20480) {
      toast({
        variant: "destructive",
        title: "File Size Too Large",
        description: (
          <div className="space-y-2">
            <p>Signature must be under 20KB for optimal loading.</p>
            <p className="text-sm text-gray-600">
              💡 <strong>Tip:</strong> Use a transparent PNG signature without background for the best appearance.
            </p>
          </div>
        ),
      });
      return;
    }

    // Check image dimensions
    const img = new Image();
    img.onload = () => {
      if (img.width !== 300 || img.height !== 300) {
        toast({
          variant: "destructive",
          title: "Invalid Image Dimensions",
          description: (
            <div className="space-y-2">
              <p>Signature must be exactly 300x300 pixels.</p>
              <p className="text-sm text-gray-600">Current size: {img.width}x{img.height}px</p>
              <p className="text-sm text-gray-600">
                💡 <strong>Tip:</strong> Use a transparent PNG signature without background for the best appearance.
              </p>
            </div>
          ),
        });
        return;
      }

      // If all validations pass, set the file
      setSignatureFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setSignaturePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    };

    img.onerror = () => {
      toast({
        variant: "destructive",
        title: "Invalid Image",
        description: "Unable to process the selected signature file.",
      });
    };

    // Load image to check dimensions
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Upload signature to server
  const uploadSignature = async () => {
    if (!signatureFile) {
      console.log('No signature file selected');
      return;
    }

    console.log('Starting signature upload...', {
      fileName: signatureFile.name,
      fileSize: signatureFile.size,
      fileType: signatureFile.type
    });

    setIsUploadingSignature(true);
    try {
      const formData = new FormData();
      formData.append('signature', signatureFile);

      console.log('Sending signature upload request...');
      const response = await fetch('/api/auth/upload-signature', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('Signature upload response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Signature upload failed with error:', errorData);
        throw new Error(errorData.message || 'Failed to upload signature');
      }

      const result = await response.json();
      console.log('Signature upload successful:', result);
      
      // Update business details with the signature URL
      setBusinessDetails(prev => ({
        ...prev,
        signatureUrl: result.signatureUrl
      }));

      setSignatureFile(null);
      setSignaturePreview("");
      
      toast({
        title: "Signature Uploaded",
        description: "Authorized signature has been uploaded successfully!",
      });

      // Refresh the profile data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/business-profile'] });
      
      // Automatically exit edit mode after successful signature upload
      setIsEditing(false);
      
    } catch (error) {
      console.error('Signature upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: (error as Error).message || "Failed to upload signature. Please try again.",
      });
    } finally {
      setIsUploadingSignature(false);
    }
  };

  // Remove logo
  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove signature
  const removeSignature = () => {
    setSignatureFile(null);
    setSignaturePreview("");
    if (signatureInputRef.current) {
      signatureInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    if (profileData?.businessDetails) {
      setBusinessDetails(profileData.businessDetails);
    }
    setIsEditing(false);
  };

  const isProfileComplete = businessDetails.businessName && 
                           businessDetails.ownerName && 
                           businessDetails.businessAddress && 
                           businessDetails.businessEmail && 
                           businessDetails.businessPhone;

  const isFormValid = businessDetails.businessName.trim() && 
                     businessDetails.ownerName.trim() && 
                     businessDetails.businessAddress.trim() && 
                     businessDetails.businessEmail.trim() && 
                     businessDetails.businessPhone.trim();

  // Special view for managers - they inherit profile but don't see the details
  if (isManager) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span className="text-lg">🏢</span>
            <span>Business Profile</span>
            <Badge variant="default" className="ml-2">Company Profile</Badge>
          </CardTitle>
          <p className="text-sm text-blue-600 mt-2">
            As a manager, you inherit your company's business profile from your administrator.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-500 text-2xl">🏢</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Company Branding Inherited</h3>
            <div className="text-gray-600 space-y-2 max-w-md mx-auto">
              <p>
                Your invoices and reports automatically include your company's business profile, 
                logo, and branding information.
              </p>
              <p className="text-sm text-gray-500">
                Business details are managed by your administrator for security and consistency.
              </p>
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-sm text-green-800 font-medium">
                    Professional invoices with company branding enabled
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show access denied for other unauthorized roles
  if (!hasAccess) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span className="text-lg">🏢</span>
            <span>Business Profile</span>
            <Badge variant="secondary" className="ml-2">Access Restricted</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-gray-400 text-2xl">🔒</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600">
              Business profile management is only available to company administrators and clients.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span className="text-lg">🏢</span>
            <span>Business Profile</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading business profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center space-x-2">
            <span className="text-lg">🏢</span>
            <span>Business Profile</span>
            {!isProfileComplete && (
              <Badge variant="destructive" className="ml-2">Incomplete</Badge>
            )}
            {isProfileComplete && (
              <Badge variant="default" className="ml-2">Complete</Badge>
            )}
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
            {userRole === 'client' && onShowOnboarding && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShowOnboarding}
                className="text-blue-600 hover:text-blue-700 w-full sm:w-auto text-xs sm:text-sm"
              >
                Review Setup Guide
              </Button>
            )}
            {!isEditing && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Complete your business profile to generate professional invoices with your company details
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="businessName" className="text-sm font-medium">
                Business Name *
              </Label>
              <Input
                id="businessName"
                value={businessDetails.businessName}
                onChange={(e) => setBusinessDetails({...businessDetails, businessName: e.target.value})}
                placeholder="Enter your business name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ownerName" className="text-sm font-medium">
                Owner Name *
              </Label>
              <Input
                id="ownerName"
                value={businessDetails.ownerName}
                onChange={(e) => setBusinessDetails({...businessDetails, ownerName: e.target.value})}
                placeholder="Enter owner's full name"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="businessAddress" className="text-sm font-medium">
                Business Address *
              </Label>
              <Textarea
                id="businessAddress"
                value={businessDetails.businessAddress}
                onChange={(e) => setBusinessDetails({...businessDetails, businessAddress: e.target.value})}
                placeholder="Enter complete business address with city, state, and pincode"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="businessEmail" className="text-sm font-medium">
                Business Email *
              </Label>
              <Input
                id="businessEmail"
                type="email"
                value={businessDetails.businessEmail}
                onChange={(e) => setBusinessDetails({...businessDetails, businessEmail: e.target.value})}
                placeholder="business@company.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="businessPhone" className="text-sm font-medium">
                Business Phone *
              </Label>
              <Input
                id="businessPhone"
                value={businessDetails.businessPhone}
                onChange={(e) => setBusinessDetails({...businessDetails, businessPhone: e.target.value})}
                placeholder="+91 98765 43210"
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="gstNumber" className="text-sm font-medium">
                GST Number (Optional)
              </Label>
              <Input
                id="gstNumber"
                value={businessDetails.gstNumber}
                onChange={(e) => setBusinessDetails({...businessDetails, gstNumber: e.target.value})}
                placeholder="22ABCDE1234F2Z5"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank if your business is not GST registered
              </p>
            </div>

            {/* Logo Upload Section */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium">
                Upload Company Logo (Optional)
              </Label>
              
              {/* Logo Requirements Info */}
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <div className="text-blue-500 mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="font-medium text-blue-900">Logo Requirements:</p>
                    <ul className="text-blue-800 space-y-0.5">
                      <li>• Exactly 300x300 pixels</li>
                      <li>• Maximum file size: 20KB</li>
                      <li>• Formats: JPG, PNG, WebP</li>
                      <li className="font-medium">💡 Tip: Use transparent PNG without background for best invoice appearance</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 space-y-4">
                {/* Current Logo Display */}
                {businessDetails.logoUrl && (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img 
                        src={businessDetails.logoUrl} 
                        alt="Current Logo" 
                        className="w-full h-full object-contain bg-gray-50"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Logo</p>
                      <p className="text-xs text-gray-500">This logo will appear on your invoices</p>
                    </div>
                  </div>
                )}

                {/* Logo Upload Interface */}
                <div className="flex items-center space-x-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose Image</span>
                  </Button>

                  {logoFile && (
                    <>
                      <Button
                        type="button"
                        onClick={uploadLogo}
                        disabled={isUploadingLogo}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={removeLogo}
                        disabled={isUploadingLogo}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Logo Preview */}
                {logoPreview && (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-green-200 rounded-lg overflow-hidden">
                      <img 
                        src={logoPreview} 
                        alt="Logo Preview" 
                        className="w-full h-full object-contain bg-gray-50"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-green-600 font-medium">New Logo Preview</p>
                      <p className="text-xs text-gray-500">
                        Size: {logoFile ? `${(logoFile.size / 1024).toFixed(1)}KB` : ''}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Logo will appear on invoices and business documents.
                </p>
              </div>
            </div>

            {/* Signature Upload Section */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium">
                Upload Authorized Signature (Optional)
              </Label>
              
              {/* Signature Requirements Info */}
              <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <div className="text-orange-500 mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="font-medium text-orange-900">Signature Requirements:</p>
                    <ul className="text-orange-800 space-y-0.5">
                      <li>• Exactly 300x300 pixels</li>
                      <li>• Maximum file size: 20KB</li>
                      <li>• Formats: JPG, PNG, WebP</li>
                      <li className="font-medium">💡 Tip: Use transparent PNG without background for clean invoice appearance</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 space-y-4">
                {/* Current Signature Display */}
                {businessDetails.signatureUrl && (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img 
                        src={businessDetails.signatureUrl} 
                        alt="Current Signature" 
                        className="w-full h-full object-contain bg-gray-50"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Signature</p>
                      <p className="text-xs text-gray-500">This signature will appear on your invoices</p>
                    </div>
                  </div>
                )}

                {/* Signature Upload Interface */}
                <div className="flex items-center space-x-4">
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleSignatureSelect}
                    className="hidden"
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => signatureInputRef.current?.click()}
                    disabled={isUploadingSignature}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose Signature</span>
                  </Button>

                  {signatureFile && (
                    <>
                      <Button
                        type="button"
                        onClick={uploadSignature}
                        disabled={isUploadingSignature}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {isUploadingSignature ? "Uploading..." : "Upload Signature"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={removeSignature}
                        disabled={isUploadingSignature}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Signature Preview */}
                {signaturePreview && (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-orange-200 rounded-lg overflow-hidden">
                      <img 
                        src={signaturePreview} 
                        alt="Signature Preview" 
                        className="w-full h-full object-contain bg-gray-50"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-orange-600 font-medium">New Signature Preview</p>
                      <p className="text-xs text-gray-500">
                        Size: {signatureFile ? `${(signatureFile.size / 1024).toFixed(1)}KB` : ''}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Signature will appear on invoices for authorization.
                </p>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={updateProfileMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending || !isFormValid}
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Business Name</Label>
              <p className="mt-1 text-sm text-gray-900">
                {businessDetails.businessName || <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Owner Name</Label>
              <p className="mt-1 text-sm text-gray-900">
                {businessDetails.ownerName || <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm font-medium text-gray-700">Business Address</Label>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                {businessDetails.businessAddress || <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Business Email</Label>
              <p className="mt-1 text-sm text-gray-900">
                {businessDetails.businessEmail || <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Business Phone</Label>
              <p className="mt-1 text-sm text-gray-900">
                {businessDetails.businessPhone || <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm font-medium text-gray-700">GST Number</Label>
              <p className="mt-1 text-sm text-gray-900">
                {businessDetails.gstNumber || <span className="text-gray-400 italic">Not registered</span>}
              </p>
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm font-medium text-gray-700">Company Logo</Label>
              <div className="mt-2">
                {businessDetails.logoUrl ? (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img 
                        src={businessDetails.logoUrl} 
                        alt="Company Logo" 
                        className="w-full h-full object-contain bg-gray-50"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current company logo</p>
                      <p className="text-xs text-gray-500">This logo appears on your invoices</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 italic">No logo uploaded</p>
                      <p className="text-xs text-gray-500">Click "Edit Profile" to upload a company logo</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Signature Display (Read-only) */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium text-gray-700">Authorized Signature</Label>
              <div className="mt-2">
                {businessDetails.signatureUrl ? (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img 
                        src={businessDetails.signatureUrl} 
                        alt="Authorized Signature" 
                        className="w-full h-full object-contain bg-gray-50"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current authorized signature</p>
                      <p className="text-xs text-gray-500">This signature appears on your invoices</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 italic">No signature uploaded</p>
                      <p className="text-xs text-gray-500">Click "Edit Profile" to upload an authorized signature</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {!isProfileComplete && (
              <div className="md:col-span-2 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-0.5">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Profile Incomplete</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Complete your business profile to generate professional invoices with your company branding. 
                      All fields except GST number are required.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}