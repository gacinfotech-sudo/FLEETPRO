import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Palette, Key, CreditCard, Webhook, Zap, Settings, BarChart3, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import TenantBranding from './TenantBranding';
import TenantApiKeys from './TenantApiKeys';
import TenantBilling from './TenantBilling';
import TenantWebhook from './TenantWebhook';
import TenantFeatures from './TenantFeatures';
import TenantUsage from './TenantUsage';
import TenantGeneralSettings from './TenantGeneralSettings';

const TenantSettings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin
    if (user && (user.role === 'admin' || user.role === 'client')) {
      setIsAdmin(true);
    }
  }, [user]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Only administrators can access tenant settings. Please contact your administrator if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tenant Settings</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Manage your workspace configuration, billing, and features
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 w-full h-auto p-1 bg-muted">
            <TabsTrigger
              value="general"
              className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger
              value="branding"
              className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger
              value="api-keys"
              className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2"
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger
              value="webhooks"
              className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2"
            >
              <Webhook className="w-4 h-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger
              value="features"
              className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Features</span>
            </TabsTrigger>
            <TabsTrigger
              value="usage"
              className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Usage</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <div className="mt-6 animate-in fade-in">
            <TabsContent value="general" className="space-y-6">
              <TenantGeneralSettings />
            </TabsContent>

            <TabsContent value="branding" className="space-y-6">
              <TenantBranding />
            </TabsContent>

            <TabsContent value="api-keys" className="space-y-6">
              <TenantApiKeys />
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <TenantBilling />
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-6">
              <TenantWebhook />
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <TenantFeatures />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <TenantUsage />
            </TabsContent>
          </div>
        </Tabs>

        {/* Help Section */}
        <div className="mt-12 pt-8 border-t">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Visit our documentation for detailed guides on configuring your tenant settings.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  View Documentation
                </Button>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Contact Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Our support team is available to help you with any questions.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Us
                </Button>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">API Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Explore our complete API documentation and examples.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Read API Docs
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantSettings;
