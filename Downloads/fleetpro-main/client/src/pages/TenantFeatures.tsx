import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Check, X, Lock, AlertCircle } from 'lucide-react';

interface Feature {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  plan: 'starter' | 'pro' | 'enterprise';
  icon?: string;
}

interface FeaturesData {
  currentPlan: string;
  features: Feature[];
}

const TenantFeatures: React.FC = () => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

  // Fetch features data
  const { data: featuresData, isLoading } = useQuery<FeaturesData>({
    queryKey: ['/api/tenant/settings/features'],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/tenant/settings/features`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch features');
      return response.json();
    },
    retry: 1
  });

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

  const currentPlanFeatures = featuresData?.features.filter(f => {
    if (featuresData.currentPlan === 'enterprise') return true;
    if (featuresData.currentPlan === 'pro') return f.plan !== 'enterprise';
    return f.plan === 'starter';
  }) || [];

  const upcomingFeatures = featuresData?.features.filter(f => {
    if (featuresData.currentPlan === 'enterprise') return false;
    if (featuresData.currentPlan === 'pro') return f.plan === 'enterprise';
    return f.plan === 'pro' || f.plan === 'enterprise';
  }) || [];

  return (
    <div className="grid gap-6">
      {/* Feature Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Your current plan ({featuresData?.currentPlan}) includes the following features. Upgrade to unlock more capabilities.
        </AlertDescription>
      </Alert>

      {/* Current Plan Features */}
      <Card>
        <CardHeader>
          <CardTitle>Enabled Features</CardTitle>
          <CardDescription>
            Features available on your {featuresData?.currentPlan || 'current'} plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentPlanFeatures.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <p>No features available on your plan.</p>
              </div>
            ) : (
              currentPlanFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        {feature.name}
                      </h4>
                    </div>
                    <Badge variant="default" className="bg-green-600">
                      Included
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Features */}
      {upcomingFeatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade to Access More</CardTitle>
            <CardDescription>
              Available features on higher plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="p-4 rounded-lg border bg-muted/30 space-y-3 relative opacity-75"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        {feature.name}
                      </h4>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {feature.plan.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Button>Upgrade Your Plan</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Comparison</CardTitle>
          <CardDescription>Compare features across all plans</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium">Feature</th>
                <th className="text-center py-3 px-4 font-medium">Starter</th>
                <th className="text-center py-3 px-4 font-medium">Pro</th>
                <th className="text-center py-3 px-4 font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {[
                'API Access',
                'Custom Reports',
                'Advanced Analytics',
                'White Label',
                'Multi-User Admin',
                'SSO / SAML',
                'Webhooks',
                'Custom Integrations',
                '24/7 Phone Support',
                'Dedicated Account Manager'
              ].map((feature, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium">{feature}</td>
                  <td className="py-3 px-4 text-center">
                    {idx < 4 ? (
                      <Check className="w-4 h-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {idx < 8 ? (
                      <Check className="w-4 h-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Check className="w-4 h-4 text-green-600 mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Feature Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>What Each Feature Includes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium">API Access</h4>
              <p className="text-sm text-muted-foreground">
                Full programmatic access to FleetPro via REST API for custom integrations and automation.
              </p>
            </div>
            <div>
              <h4 className="font-medium">Custom Reports</h4>
              <p className="text-sm text-muted-foreground">
                Create and schedule custom reports tailored to your business needs with advanced filtering and export options.
              </p>
            </div>
            <div>
              <h4 className="font-medium">Advanced Analytics</h4>
              <p className="text-sm text-muted-foreground">
                In-depth analytics with predictive insights, trend analysis, and performance benchmarking.
              </p>
            </div>
            <div>
              <h4 className="font-medium">White Label</h4>
              <p className="text-sm text-muted-foreground">
                Completely white-labeled application with your branding, colors, and custom domain.
              </p>
            </div>
            <div>
              <h4 className="font-medium">Multi-User Admin</h4>
              <p className="text-sm text-muted-foreground">
                Manage multiple administrative users with role-based access control and audit logging.
              </p>
            </div>
            <div>
              <h4 className="font-medium">SSO / SAML</h4>
              <p className="text-sm text-muted-foreground">
                Enterprise-grade single sign-on with SAML 2.0 for seamless identity management.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle>Ready to Unlock More?</CardTitle>
          <CardDescription>
            Upgrade to Pro or Enterprise to access premium features and take your fleet management to the next level.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3 flex-col sm:flex-row">
          <Button className="flex-1">View Upgrade Options</Button>
          <Button variant="outline" className="flex-1">Contact Sales</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantFeatures;
