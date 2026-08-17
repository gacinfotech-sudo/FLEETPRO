import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface GeneralSettings {
  timezone: string;
  currency: string;
  language: string;
  dateFormat: string;
  passwordPolicyMinLength: number;
  passwordPolicyRequireSpecial: boolean;
  dataRetentionDays: number;
}

const TenantGeneralSettings: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<GeneralSettings>({
    timezone: 'UTC',
    currency: 'USD',
    language: 'en',
    dateFormat: 'YYYY-MM-DD',
    passwordPolicyMinLength: 8,
    passwordPolicyRequireSpecial: true,
    dataRetentionDays: 90
  });
  const [isSaved, setIsSaved] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

  // Fetch tenant settings
  const { data: fetchedSettings, isLoading } = useQuery({
    queryKey: ['/api/tenant/settings/general'],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/tenant/settings/general`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    retry: 1
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
    }
  }, [fetchedSettings]);

  // Mutation for updating settings
  const updateMutation = useMutation({
    mutationFn: async (newSettings: GeneralSettings) => {
      const response = await fetch(`${apiBase}/api/tenant/settings/general`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newSettings)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/settings/general'] });
      setIsSaved(true);
      toast({
        title: 'Settings Updated',
        description: 'Your general settings have been saved successfully.',
      });
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update settings',
        variant: 'destructive'
      });
    }
  });

  const handleSave = () => {
    updateMutation.mutate(settings);
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
      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
          <CardDescription>Configure timezone, currency, and language preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={settings.timezone} onValueChange={(value) => setSettings({ ...settings, timezone: value })}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                  <SelectItem value="IST">IST (Indian Standard Time, UTC+5:30)</SelectItem>
                  <SelectItem value="EST">EST (Eastern Standard Time, UTC-5)</SelectItem>
                  <SelectItem value="CST">CST (Central Standard Time, UTC-6)</SelectItem>
                  <SelectItem value="MST">MST (Mountain Standard Time, UTC-7)</SelectItem>
                  <SelectItem value="PST">PST (Pacific Standard Time, UTC-8)</SelectItem>
                  <SelectItem value="GMT">GMT (Greenwich Mean Time, UTC)</SelectItem>
                  <SelectItem value="CET">CET (Central European Time, UTC+1)</SelectItem>
                  <SelectItem value="JST">JST (Japan Standard Time, UTC+9)</SelectItem>
                  <SelectItem value="AEST">AEST (Australian Eastern Standard Time, UTC+10)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for scheduling and reporting</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={settings.currency} onValueChange={(value) => setSettings({ ...settings, currency: value })}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for billing and reports</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={settings.language} onValueChange={(value) => setSettings({ ...settings, language: value })}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Interface language</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select value={settings.dateFormat} onValueChange={(value) => setSettings({ ...settings, dateFormat: value })}>
                <SelectTrigger id="dateFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-08-18)</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (08/18/2026)</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (18/08/2026)</SelectItem>
                  <SelectItem value="DD.MM.YYYY">DD.MM.YYYY (18.08.2026)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Display format for dates</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
          <CardDescription>Configure password policies and security requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passwordMinLength">Minimum Password Length</Label>
              <Input
                id="passwordMinLength"
                type="number"
                min="6"
                max="32"
                value={settings.passwordPolicyMinLength}
                onChange={(e) => setSettings({ ...settings, passwordPolicyMinLength: parseInt(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Minimum characters required (6-32)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataRetention">Data Retention Period (Days)</Label>
              <Input
                id="dataRetention"
                type="number"
                min="30"
                max="2555"
                value={settings.dataRetentionDays}
                onChange={(e) => setSettings({ ...settings, dataRetentionDays: parseInt(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">How long to keep deleted data (30-2555 days)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border">
            <input
              type="checkbox"
              id="requireSpecial"
              checked={settings.passwordPolicyRequireSpecial}
              onChange={(e) => setSettings({ ...settings, passwordPolicyRequireSpecial: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <Label htmlFor="requireSpecial" className="flex-1 cursor-pointer">
              <div className="font-medium">Require Special Characters</div>
              <p className="text-xs text-muted-foreground">Passwords must contain at least one special character (!@#$%^&*)</p>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Data retention policy applies to soft-deleted records. Hard deletes are permanent and cannot be recovered.
        </AlertDescription>
      </Alert>

      {/* Save Status */}
      {isSaved && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Your settings have been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => setSettings(fetchedSettings || settings)}
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
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default TenantGeneralSettings;
