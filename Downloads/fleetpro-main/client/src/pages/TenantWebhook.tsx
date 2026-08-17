import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Copy, AlertCircle, TestTube } from 'lucide-react';

interface WebhookData {
  url: string;
  isEnabled: boolean;
  events: string[];
  secret?: string;
  testResult?: {
    success: boolean;
    statusCode: number;
    responseTime: number;
    error?: string;
  };
}

const webhookEvents = [
  { id: 'booking_created', label: 'Booking Created', description: 'Triggered when a new booking is created' },
  { id: 'booking_updated', label: 'Booking Updated', description: 'Triggered when a booking is updated' },
  { id: 'booking_completed', label: 'Booking Completed', description: 'Triggered when a booking is completed' },
  { id: 'booking_cancelled', label: 'Booking Cancelled', description: 'Triggered when a booking is cancelled' },
  { id: 'user_added', label: 'User Added', description: 'Triggered when a new user is added' },
  { id: 'user_removed', label: 'User Removed', description: 'Triggered when a user is removed' },
  { id: 'api_quota_exceeded', label: 'API Quota Exceeded', description: 'Triggered when API quota is exceeded' },
  { id: 'payment_received', label: 'Payment Received', description: 'Triggered when a payment is received' },
];

const TenantWebhook: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [webhook, setWebhook] = useState<WebhookData>({
    url: '',
    isEnabled: false,
    events: []
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

  // Fetch webhook settings
  const { data: fetchedWebhook, isLoading } = useQuery({
    queryKey: ['/api/tenant/settings/webhook'],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/tenant/settings/webhook`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch webhook settings');
      return response.json();
    },
    retry: 1
  });

  React.useEffect(() => {
    if (fetchedWebhook) {
      setWebhook(fetchedWebhook);
    }
  }, [fetchedWebhook]);

  // Update webhook mutation
  const updateMutation = useMutation({
    mutationFn: async (newWebhook: WebhookData) => {
      const response = await fetch(`${apiBase}/api/tenant/settings/webhook`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newWebhook)
      });
      if (!response.ok) throw new Error('Failed to update webhook');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/settings/webhook'] });
      setIsSaved(true);
      toast({
        title: 'Webhook Updated',
        description: 'Your webhook settings have been saved successfully.',
      });
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update webhook',
        variant: 'destructive'
      });
    }
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBase}/api/tenant/settings/webhook/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: webhook.url })
      });
      if (!response.ok) throw new Error('Webhook test failed');
      return response.json();
    },
    onSuccess: (data) => {
      setWebhook(prev => ({ ...prev, testResult: data }));
      toast({
        title: 'Webhook Test Sent',
        description: `Response received in ${data.responseTime}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Failed to test webhook',
        variant: 'destructive'
      });
    }
  });

  const handleSave = () => {
    if (!webhook.url) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a webhook URL',
        variant: 'destructive'
      });
      return;
    }
    updateMutation.mutate(webhook);
  };

  const toggleEvent = (eventId: string) => {
    setWebhook(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  if (isLoading) {
    return (
      <div className="grid gap-6">
        {[1, 2].map((i) => (
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
      {/* Webhook Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Webhooks allow FleetPro to send real-time notifications to your application when events occur.
        </AlertDescription>
      </Alert>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>Set up and manage your webhook endpoint</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg border">
            <input
              type="checkbox"
              id="webhookEnabled"
              checked={webhook.isEnabled}
              onChange={(e) => setWebhook({ ...webhook, isEnabled: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <Label htmlFor="webhookEnabled" className="flex-1 cursor-pointer">
              <div className="font-medium">Enable Webhooks</div>
              <p className="text-xs text-muted-foreground">Enable webhook notifications for selected events</p>
            </Label>
            {webhook.isEnabled && (
              <Badge variant="default" className="bg-green-600">Active</Badge>
            )}
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={webhook.url}
              onChange={(e) => setWebhook({ ...webhook, url: e.target.value })}
              placeholder="https://your-domain.com/webhooks/fleetpro"
              disabled={!webhook.isEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Must be a valid HTTPS URL that can receive POST requests
            </p>
          </div>

          {/* Webhook Secret */}
          {webhook.secret && (
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <div className="flex gap-2 p-3 bg-muted rounded-md border">
                <code className="text-xs font-mono flex-1 truncate">
                  {webhook.secret}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(webhook.secret!);
                    toast({
                      title: 'Copied',
                      description: 'Secret copied to clipboard',
                    });
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this secret to verify webhook signatures in the X-Webhook-Signature header
              </p>
            </div>
          )}

          {/* Test Button */}
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={!webhook.url || testMutation.isPending || isTestingWebhook}
            className="w-full gap-2"
          >
            {testMutation.isPending || isTestingWebhook ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing Webhook...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4" />
                Test Webhook
              </>
            )}
          </Button>

          {/* Test Result */}
          {webhook.testResult && (
            <Alert
              className={
                webhook.testResult.success
                  ? 'border-green-200 bg-green-50 dark:bg-green-950'
                  : 'border-red-200 bg-red-50 dark:bg-red-950'
              }
            >
              <AlertCircle
                className={`h-4 w-4 ${
                  webhook.testResult.success ? 'text-green-600' : 'text-red-600'
                }`}
              />
              <AlertDescription
                className={
                  webhook.testResult.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }
              >
                {webhook.testResult.success
                  ? `Webhook delivered successfully! Status: ${webhook.testResult.statusCode}, Response time: ${webhook.testResult.responseTime}ms`
                  : `Webhook test failed: ${webhook.testResult.error}`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Events Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Event Subscriptions</CardTitle>
          <CardDescription>Select which events should trigger webhook notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {webhookEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleEvent(event.id)}
              >
                <input
                  type="checkbox"
                  id={event.id}
                  checked={webhook.events.includes(event.id)}
                  onChange={() => toggleEvent(event.id)}
                  className="w-4 h-4 rounded mt-1"
                  disabled={!webhook.isEnabled}
                />
                <Label htmlFor={event.id} className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">{event.label}</div>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Payload Example */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Payload Example</CardTitle>
          <CardDescription>Sample payload structure for webhook events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg overflow-x-auto">
            <pre className="text-xs font-mono text-foreground">
{`{
  "id": "evt_1234567890",
  "type": "booking_created",
  "timestamp": "2026-08-18T10:30:00Z",
  "data": {
    "bookingId": "bk_1234567890",
    "customerId": "cust_1234567890",
    "pickupLocation": "123 Main St",
    "dropoffLocation": "456 Oak Ave",
    "scheduledTime": "2026-08-18T14:00:00Z",
    "fare": {
      "amount": 45.50,
      "currency": "USD"
    }
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Security Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Always use HTTPS for your webhook URL</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Verify webhook signatures using the X-Webhook-Signature header</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Implement retry logic with exponential backoff</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Keep webhook endpoint response time under 5 seconds</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Log all webhook events for debugging and monitoring</span>
          </div>
        </CardContent>
      </Card>

      {/* Save Status */}
      {isSaved && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Your webhook settings have been saved successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          variant="outline"
          onClick={() => setWebhook(fetchedWebhook || webhook)}
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
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};

export default TenantWebhook;
