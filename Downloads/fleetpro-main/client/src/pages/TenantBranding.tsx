import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Loader2, CheckCircle2, Eye } from 'lucide-react';

interface BrandingData {
  logo?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  theme: 'light' | 'dark' | 'auto';
  customDomain?: string;
  companyName: string;
}

const TenantBranding: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [branding, setBranding] = useState<BrandingData>({
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B',
    theme: 'auto',
    companyName: ''
  });
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

  // Fetch branding settings
  const { data: fetchedBranding, isLoading } = useQuery({
    queryKey: ['/api/tenant/settings/branding'],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/tenant/settings/branding`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch branding');
      return response.json();
    },
    retry: 1
  });

  useEffect(() => {
    if (fetchedBranding) {
      setBranding(fetchedBranding);
      if (fetchedBranding.logo) setLogoPreview(fetchedBranding.logo);
      if (fetchedBranding.favicon) setFaviconPreview(fetchedBranding.favicon);
    }
  }, [fetchedBranding]);

  // Mutation for updating branding
  const updateMutation = useMutation({
    mutationFn: async (newBranding: BrandingData) => {
      const response = await fetch(`${apiBase}/api/tenant/settings/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newBranding)
      });
      if (!response.ok) throw new Error('Failed to update branding');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/settings/branding'] });
      setIsSaved(true);
      toast({
        title: 'Branding Updated',
        description: 'Your branding settings have been saved successfully.',
      });
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update branding',
        variant: 'destructive'
      });
    }
  });

  // Mutation for uploading logo
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${apiBase}/api/tenant/settings/branding/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!response.ok) throw new Error('Failed to upload logo');
      return response.json();
    },
    onSuccess: (data) => {
      setBranding(prev => ({ ...prev, logo: data.url }));
      setLogoPreview(data.url);
      toast({
        title: 'Logo Uploaded',
        description: 'Your logo has been uploaded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload Error',
        description: error instanceof Error ? error.message : 'Failed to upload logo',
        variant: 'destructive'
      });
    }
  });

  // Mutation for uploading favicon
  const uploadFaviconMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${apiBase}/api/tenant/settings/branding/favicon`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!response.ok) throw new Error('Failed to upload favicon');
      return response.json();
    },
    onSuccess: (data) => {
      setBranding(prev => ({ ...prev, favicon: data.url }));
      setFaviconPreview(data.url);
      toast({
        title: 'Favicon Uploaded',
        description: 'Your favicon has been uploaded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload Error',
        description: error instanceof Error ? error.message : 'Failed to upload favicon',
        variant: 'destructive'
      });
    }
  });

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingLogo(true);
      await uploadLogoMutation.mutateAsync(file);
      setIsUploadingLogo(false);
    }
  };

  const handleFaviconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingFavicon(true);
      await uploadFaviconMutation.mutateAsync(file);
      setIsUploadingFavicon(false);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(branding);
  };

  if (isLoading) {
    return (
      <div className="grid gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-10 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Logo & Favicon Section */}
      <Card>
        <CardHeader>
          <CardTitle>Logo & Favicon</CardTitle>
          <CardDescription>Upload your brand logo and favicon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Logo Upload */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Logo</Label>
              <div className="relative border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  disabled={isUploadingLogo}
                  className="hidden"
                />
                {logoPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={logoPreview} alt="Logo" className="h-20 object-contain" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Change Logo
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="flex flex-col items-center gap-2 w-full"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <div className="text-sm font-medium">Click to upload logo</div>
                    <div className="text-xs text-muted-foreground">PNG, JPG or GIF (max 5MB)</div>
                  </button>
                )}
              </div>
            </div>

            {/* Favicon Upload */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Favicon</Label>
              <div className="relative border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/x-icon,image/png"
                  onChange={handleFaviconChange}
                  disabled={isUploadingFavicon}
                  className="hidden"
                />
                {faviconPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={faviconPreview} alt="Favicon" className="h-12 w-12 object-contain" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={isUploadingFavicon}
                    >
                      {isUploadingFavicon ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Change Favicon
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={isUploadingFavicon}
                    className="flex flex-col items-center gap-2 w-full"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <div className="text-sm font-medium">Click to upload favicon</div>
                    <div className="text-xs text-muted-foreground">ICO or PNG (max 1MB)</div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors Section */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>Customize your brand color palette</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Primary Color */}
            <div className="space-y-3">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-3">
                <div
                  className="w-12 h-10 rounded border cursor-pointer"
                  style={{ backgroundColor: branding.primaryColor }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = branding.primaryColor;
                    input.onchange = (e) => {
                      setBranding({
                        ...branding,
                        primaryColor: (e.target as HTMLInputElement).value
                      });
                    };
                    input.click();
                  }}
                />
                <Input
                  id="primaryColor"
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  placeholder="#3B82F6"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used for buttons and links</p>
            </div>

            {/* Secondary Color */}
            <div className="space-y-3">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-3">
                <div
                  className="w-12 h-10 rounded border cursor-pointer"
                  style={{ backgroundColor: branding.secondaryColor }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = branding.secondaryColor;
                    input.onchange = (e) => {
                      setBranding({
                        ...branding,
                        secondaryColor: (e.target as HTMLInputElement).value
                      });
                    };
                    input.click();
                  }}
                />
                <Input
                  id="secondaryColor"
                  type="text"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  placeholder="#10B981"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used for secondary actions</p>
            </div>

            {/* Accent Color */}
            <div className="space-y-3">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex gap-3">
                <div
                  className="w-12 h-10 rounded border cursor-pointer"
                  style={{ backgroundColor: branding.accentColor }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = branding.accentColor;
                    input.onchange = (e) => {
                      setBranding({
                        ...branding,
                        accentColor: (e.target as HTMLInputElement).value
                      });
                    };
                    input.click();
                  }}
                />
                <Input
                  id="accentColor"
                  type="text"
                  value={branding.accentColor}
                  onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                  placeholder="#F59E0B"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used for highlights and alerts</p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
            <div className="text-sm font-medium">Color Preview</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <div
                  className="w-full h-20 rounded border"
                  style={{ backgroundColor: branding.primaryColor }}
                />
                <p className="text-xs text-center text-muted-foreground">Primary</p>
              </div>
              <div className="space-y-1">
                <div
                  className="w-full h-20 rounded border"
                  style={{ backgroundColor: branding.secondaryColor }}
                />
                <p className="text-xs text-center text-muted-foreground">Secondary</p>
              </div>
              <div className="space-y-1">
                <div
                  className="w-full h-20 rounded border"
                  style={{ backgroundColor: branding.accentColor }}
                />
                <p className="text-xs text-center text-muted-foreground">Accent</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme & Domain Section */}
      <Card>
        <CardHeader>
          <CardTitle>Theme & Domain</CardTitle>
          <CardDescription>Configure theme preference and custom domain</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme Mode</Label>
              <Select value={branding.theme} onValueChange={(value: any) => setBranding({ ...branding, theme: value })}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Mode</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                  <SelectItem value="auto">Auto (System Preference)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Default theme for your application</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                value={branding.companyName}
                onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                placeholder="Your Company Name"
              />
              <p className="text-xs text-muted-foreground">Displayed in UI and email</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDomain">Custom Domain</Label>
            <Input
              id="customDomain"
              type="text"
              value={branding.customDomain || ''}
              onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })}
              placeholder="app.yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">Premium feature: Custom domain for white-label deployment</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-6 rounded-lg border bg-card space-y-4">
            <div className="text-center">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="h-16 mx-auto mb-4" />
              )}
              <div className="text-sm text-muted-foreground">Your branding will appear in the header and throughout the application</div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4">
              <Button style={{ backgroundColor: branding.primaryColor }} className="text-white">
                Primary
              </Button>
              <Button style={{ backgroundColor: branding.secondaryColor }} className="text-white">
                Secondary
              </Button>
              <Button style={{ backgroundColor: branding.accentColor }} className="text-white">
                Accent
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Status */}
      {isSaved && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Your branding settings have been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => {
            setBranding(fetchedBranding || branding);
            setLogoPreview(fetchedBranding?.logo || '');
            setFaviconPreview(fetchedBranding?.favicon || '');
          }}
          disabled={updateMutation.isPending}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="gap-2"
        >
          {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {updateMutation.isPending ? 'Saving...' : 'Save Branding'}
        </Button>
      </div>
    </div>
  );
};

export default TenantBranding;
