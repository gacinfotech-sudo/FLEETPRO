import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Check, ArrowUpRight, Download, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BillingData {
  currentPlan: 'starter' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  billingEmail: string;
  taxId?: string;
  gstNumber?: string;
  invoices: Invoice[];
  nextBillingDate: string;
  amount: number;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  description: string;
  features: string[];
  isCurrent?: boolean;
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    interval: 'monthly',
    description: 'Perfect for small teams',
    features: [
      'Up to 10 vehicles',
      'Up to 5 users',
      'Basic reporting',
      'Mobile app access',
      'Email support'
    ]
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 299,
    interval: 'monthly',
    description: 'For growing businesses',
    features: [
      'Unlimited vehicles',
      'Up to 25 users',
      'Advanced analytics',
      'Custom reports',
      'API access',
      'Priority support'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 999,
    interval: 'monthly',
    description: 'For large organizations',
    features: [
      'Unlimited everything',
      'Dedicated account manager',
      'Custom integrations',
      'SSO & SAML',
      'Advanced security',
      '24/7 phone support'
    ]
  }
];

const TenantBilling: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [billingData, setBillingData] = useState<BillingData>({
    currentPlan: 'starter',
    billingCycle: 'monthly',
    billingEmail: '',
    invoices: [],
    nextBillingDate: '',
    amount: 99
  });

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

  // Fetch billing data
  const { data: fetchedBilling, isLoading } = useQuery({
    queryKey: ['/api/tenant/billing'],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/tenant/billing`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch billing data');
      return response.json();
    },
    retry: 1
  });

  React.useEffect(() => {
    if (fetchedBilling) {
      setBillingData(fetchedBilling);
    }
  }, [fetchedBilling]);

  // Update billing info mutation
  const updateBillingMutation = useMutation({
    mutationFn: async (data: Partial<BillingData>) => {
      const response = await fetch(`${apiBase}/api/tenant/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update billing info');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/billing'] });
      setEditMode(false);
      toast({
        title: 'Billing Info Updated',
        description: 'Your billing information has been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update billing',
        variant: 'destructive'
      });
    }
  });

  // Upgrade plan mutation
  const upgradePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`${apiBase}/api/tenant/billing/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId })
      });
      if (!response.ok) throw new Error('Failed to upgrade plan');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/billing'] });
      toast({
        title: 'Plan Upgraded',
        description: 'Your plan has been upgraded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upgrade',
        variant: 'destructive'
      });
    }
  });

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
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are currently on the {billingData.currentPlan} plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div>
              <p className="text-sm text-muted-foreground">Plan Name</p>
              <h3 className="text-2xl font-bold capitalize mt-1">{billingData.currentPlan}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Next billing date: {new Date(billingData.nextBillingDate).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">${billingData.amount}</p>
              <p className="text-sm text-muted-foreground">per {billingData.billingCycle === 'monthly' ? 'month' : 'year'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Update Payment Method
            </Button>
            <Button variant="outline" className="gap-2">
              Download Invoice
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing Contact Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Billing Information</CardTitle>
            <CardDescription>Manage your billing contact and tax details</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? 'Cancel' : 'Edit'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Billing Email</Label>
                <Input
                  id="billingEmail"
                  type="email"
                  value={billingData.billingEmail}
                  onChange={(e) => setBillingData({ ...billingData, billingEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID (Optional)</Label>
                <Input
                  id="taxId"
                  value={billingData.taxId || ''}
                  onChange={(e) => setBillingData({ ...billingData, taxId: e.target.value })}
                  placeholder="Your tax ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstNumber">GST Number (Optional)</Label>
                <Input
                  id="gstNumber"
                  value={billingData.gstNumber || ''}
                  onChange={(e) => setBillingData({ ...billingData, gstNumber: e.target.value })}
                  placeholder="Your GST number"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditMode(false)}
                  disabled={updateBillingMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => updateBillingMutation.mutate({
                    billingEmail: billingData.billingEmail,
                    taxId: billingData.taxId,
                    gstNumber: billingData.gstNumber
                  })}
                  disabled={updateBillingMutation.isPending}
                  className="gap-2"
                >
                  {updateBillingMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Billing Email</p>
                <p className="font-medium">{billingData.billingEmail || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tax ID</p>
                <p className="font-medium">{billingData.taxId || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">GST Number</p>
                <p className="font-medium">{billingData.gstNumber || 'Not provided'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Upgrade Your Plan</CardTitle>
          <CardDescription>Choose a plan that fits your business needs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-6 rounded-lg border-2 transition-all ${
                  plan.id === billingData.currentPlan
                    ? 'border-primary bg-primary/5'
                    : 'border-muted'
                }`}
              >
                {plan.id === billingData.currentPlan && (
                  <Badge className="absolute top-4 right-4">Current Plan</Badge>
                )}

                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

                <div className="mt-4 mb-6">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground ml-2">/{plan.interval}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="text-sm flex gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.id === billingData.currentPlan ? 'outline' : 'default'}
                  onClick={() => plan.id !== billingData.currentPlan && upgradePlanMutation.mutate(plan.id)}
                  disabled={plan.id === billingData.currentPlan || upgradePlanMutation.isPending}
                >
                  {plan.id === billingData.currentPlan ? (
                    'Current Plan'
                  ) : (
                    <>
                      {upgradePlanMutation.isPending ? 'Upgrading...' : 'Upgrade Now'}
                      {plan.id !== billingData.currentPlan && <ArrowUpRight className="w-4 h-4 ml-1" />}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>Download and manage your invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {billingData.invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No invoices yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Invoice</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Amount</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{invoice.number}</td>
                      <td className="py-3 px-4">{new Date(invoice.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">${invoice.amount.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            invoice.status === 'paid'
                              ? 'default'
                              : invoice.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {invoice.pdfUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(invoice.pdfUrl, '_blank')}
                            className="gap-1"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Warning */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Need a custom plan? Contact our sales team for enterprise solutions tailored to your needs.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default TenantBilling;
