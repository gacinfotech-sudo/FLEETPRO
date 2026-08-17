import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "../../lib/api";
import { Save, AlertCircle, CheckCircle } from "lucide-react";

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings = {} } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/admin/settings`);
        return await res.json();
      } catch {
        return {};
      }
    }
  });

  const [formData, setFormData] = useState({
    maxLoginAttempts: settings.maxLoginAttempts || 5,
    sessionTimeout: settings.sessionTimeout || 3600,
    passwordMinLength: settings.passwordMinLength || 8,
    requireSpecialChars: settings.requireSpecialChars ?? true,
    requireNumbers: settings.requireNumbers ?? true,
    requireUppercase: settings.requireUppercase ?? true,
    enableTwoFactor: settings.enableTwoFactor ?? false,
    enableAuditLogging: settings.enableAuditLogging ?? true,
    enableRateLimiting: settings.enableRateLimiting ?? true,
    maxRequestsPerMinute: settings.maxRequestsPerMinute || 100,
    maintenanceMode: settings.maintenanceMode ?? false,
    maintenanceMessage: settings.maintenanceMessage || 'System under maintenance',
    emailNotifications: settings.emailNotifications ?? true,
    slackIntegration: settings.slackIntegration ?? false,
    slackWebhook: settings.slackWebhook || '',
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("PUT", `/api/admin/settings`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Success",
        description: "System settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update system settings",
        variant: "destructive",
      });
    }
  });

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">System Settings</h2>
        <Button
          onClick={() => updateSettingsMutation.mutate(formData)}
          disabled={updateSettingsMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
              <Input
                id="maxLoginAttempts"
                type="number"
                value={formData.maxLoginAttempts}
                onChange={(e) => handleChange('maxLoginAttempts', parseInt(e.target.value))}
                min="1"
                max="20"
              />
              <p className="text-xs text-gray-500">Lock account after failed attempts</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (seconds)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={formData.sessionTimeout}
                onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value))}
                min="300"
                step="300"
              />
              <p className="text-xs text-gray-500">Auto-logout inactive users</p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold">Password Policy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="passwordMinLength">Minimum Length</Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  value={formData.passwordMinLength}
                  onChange={(e) => handleChange('passwordMinLength', parseInt(e.target.value))}
                  min="6"
                  max="20"
                />
              </div>

              <div className="space-y-2">
                <Label>Requirements</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.requireSpecialChars}
                      onCheckedChange={(checked) => handleChange('requireSpecialChars', checked)}
                    />
                    <Label>Special Characters (!@#$%)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.requireNumbers}
                      onCheckedChange={(checked) => handleChange('requireNumbers', checked)}
                    />
                    <Label>Numbers (0-9)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.requireUppercase}
                      onCheckedChange={(checked) => handleChange('requireUppercase', checked)}
                    />
                    <Label>Uppercase Letters (A-Z)</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Two-Factor Authentication</Label>
                <p className="text-xs text-gray-500">Require 2FA for admin users</p>
              </div>
              <Switch
                checked={formData.enableTwoFactor}
                onCheckedChange={(checked) => handleChange('enableTwoFactor', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit & Logging */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Audit & Logging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Audit Logging</Label>
              <p className="text-xs text-gray-500">Track all user actions and system events</p>
            </div>
            <Switch
              checked={formData.enableAuditLogging}
              onCheckedChange={(checked) => handleChange('enableAuditLogging', checked)}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Email Notifications</Label>
                <p className="text-xs text-gray-500">Send alerts for critical events</p>
              </div>
              <Switch
                checked={formData.emailNotifications}
                onCheckedChange={(checked) => handleChange('emailNotifications', checked)}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Slack Integration</Label>
                <p className="text-xs text-gray-500">Send alerts to Slack channel</p>
              </div>
              <Switch
                checked={formData.slackIntegration}
                onCheckedChange={(checked) => handleChange('slackIntegration', checked)}
              />
            </div>
            {formData.slackIntegration && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
                <Input
                  id="slackWebhook"
                  type="password"
                  placeholder="https://hooks.slack.com/..."
                  value={formData.slackWebhook}
                  onChange={(e) => handleChange('slackWebhook', e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Rate Limiting</Label>
              <p className="text-xs text-gray-500">Protect against brute force and DDoS</p>
            </div>
            <Switch
              checked={formData.enableRateLimiting}
              onCheckedChange={(checked) => handleChange('enableRateLimiting', checked)}
            />
          </div>

          {formData.enableRateLimiting && (
            <div className="space-y-2">
              <Label htmlFor="maxRequestsPerMinute">Max Requests Per Minute</Label>
              <Input
                id="maxRequestsPerMinute"
                type="number"
                value={formData.maxRequestsPerMinute}
                onChange={(e) => handleChange('maxRequestsPerMinute', parseInt(e.target.value))}
                min="10"
                max="1000"
                step="10"
              />
              <p className="text-xs text-gray-500">Per IP address</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-900">Maintenance Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-orange-900">Enable Maintenance Mode</Label>
              <p className="text-xs text-orange-700">Block all user access except admins</p>
            </div>
            <Switch
              checked={formData.maintenanceMode}
              onCheckedChange={(checked) => handleChange('maintenanceMode', checked)}
            />
          </div>

          {formData.maintenanceMode && (
            <div className="space-y-2">
              <Label htmlFor="maintenanceMessage" className="text-orange-900">Maintenance Message</Label>
              <Input
                id="maintenanceMessage"
                placeholder="System under maintenance. Expected to be back online..."
                value={formData.maintenanceMessage}
                onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
