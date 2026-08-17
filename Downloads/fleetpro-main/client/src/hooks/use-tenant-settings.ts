import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface TenantSettings {
  id: string;
  name: string;
  plan: 'starter' | 'pro' | 'enterprise';
  branding: {
    logo?: string;
    favicon?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    theme: 'light' | 'dark' | 'auto';
    customDomain?: string;
    companyName: string;
  };
  settings: {
    timezone: string;
    currency: string;
    language: string;
    dateFormat: string;
    passwordPolicyMinLength: number;
    passwordPolicyRequireSpecial: boolean;
    dataRetentionDays: number;
  };
  billing: {
    cycle: 'monthly' | 'yearly';
    email: string;
    taxId?: string;
    gstNumber?: string;
  };
  webhook?: {
    url: string;
    isEnabled: boolean;
    events: string[];
    secret?: string;
  };
  apiKeys?: Array<{
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsedAt?: string;
    usageCount: number;
    isActive: boolean;
  }>;
  features?: string[];
  usage?: {
    activeUsers: number;
    apiCallsThisMonth: number;
    storageUsed: number;
  };
}

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

export const useTenantSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tenant settings
  const useGetTenantSettings = () => {
    return useQuery({
      queryKey: ['/api/tenant/settings'],
      queryFn: async () => {
        const response = await fetch(`${apiBase}/api/tenant/settings`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch tenant settings');
        return response.json() as Promise<TenantSettings>;
      },
      retry: 1
    });
  };

  // Update tenant settings
  const useUpdateTenantSettings = () => {
    return useMutation({
      mutationFn: async (settings: Partial<TenantSettings>) => {
        const response = await fetch(`${apiBase}/api/tenant/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(settings)
        });
        if (!response.ok) throw new Error('Failed to update tenant settings');
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/tenant/settings'] });
        toast({
          title: 'Settings Updated',
          description: 'Your settings have been saved successfully.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update settings',
          variant: 'destructive'
        });
      }
    });
  };

  // Create API key
  const useCreateApiKey = () => {
    return useMutation({
      mutationFn: async (name: string) => {
        const response = await fetch(`${apiBase}/api/tenant/api-keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error('Failed to create API key');
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/tenant/api-keys'] });
        toast({
          title: 'API Key Created',
          description: 'Make sure to copy your secret key - it will only be shown once.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to create API key',
          variant: 'destructive'
        });
      }
    });
  };

  // Revoke API key
  const useRevokeApiKey = () => {
    return useMutation({
      mutationFn: async (keyId: string) => {
        const response = await fetch(`${apiBase}/api/tenant/api-keys/${keyId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to revoke API key');
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/tenant/api-keys'] });
        toast({
          title: 'API Key Revoked',
          description: 'The API key has been revoked and can no longer be used.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to revoke API key',
          variant: 'destructive'
        });
      }
    });
  };

  // Fetch API keys
  const useGetApiKeys = () => {
    return useQuery({
      queryKey: ['/api/tenant/api-keys'],
      queryFn: async () => {
        const response = await fetch(`${apiBase}/api/tenant/api-keys`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch API keys');
        return response.json();
      },
      retry: 1
    });
  };

  // Update branding
  const useUpdateBranding = () => {
    return useMutation({
      mutationFn: async (branding: Partial<TenantSettings['branding']>) => {
        const response = await fetch(`${apiBase}/api/tenant/settings/branding`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(branding)
        });
        if (!response.ok) throw new Error('Failed to update branding');
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/tenant/settings/branding'] });
        toast({
          title: 'Branding Updated',
          description: 'Your branding settings have been saved.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update branding',
          variant: 'destructive'
        });
      }
    });
  };

  // Fetch billing info
  const useGetBilling = () => {
    return useQuery({
      queryKey: ['/api/tenant/billing'],
      queryFn: async () => {
        const response = await fetch(`${apiBase}/api/tenant/billing`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch billing info');
        return response.json();
      },
      retry: 1
    });
  };

  // Update billing info
  const useUpdateBilling = () => {
    return useMutation({
      mutationFn: async (billing: Partial<TenantSettings['billing']>) => {
        const response = await fetch(`${apiBase}/api/tenant/billing`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(billing)
        });
        if (!response.ok) throw new Error('Failed to update billing');
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/tenant/billing'] });
        toast({
          title: 'Billing Updated',
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
  };

  // Upgrade plan
  const useUpgradePlan = () => {
    return useMutation({
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
          description: error instanceof Error ? error.message : 'Failed to upgrade plan',
          variant: 'destructive'
        });
      }
    });
  };

  // Fetch usage stats
  const useGetUsage = () => {
    return useQuery({
      queryKey: ['/api/tenant/usage'],
      queryFn: async () => {
        const response = await fetch(`${apiBase}/api/tenant/usage`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch usage');
        return response.json();
      },
      retry: 1
    });
  };

  // Fetch webhook settings
  const useGetWebhook = () => {
    return useQuery({
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
  };

  // Update webhook settings
  const useUpdateWebhook = () => {
    return useMutation({
      mutationFn: async (webhook: Partial<TenantSettings['webhook']>) => {
        const response = await fetch(`${apiBase}/api/tenant/settings/webhook`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(webhook)
        });
        if (!response.ok) throw new Error('Failed to update webhook');
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/tenant/settings/webhook'] });
        toast({
          title: 'Webhook Updated',
          description: 'Your webhook settings have been saved.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update webhook',
          variant: 'destructive'
        });
      }
    });
  };

  // Test webhook
  const useTestWebhook = () => {
    return useMutation({
      mutationFn: async (url: string) => {
        const response = await fetch(`${apiBase}/api/tenant/settings/webhook/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ url })
        });
        if (!response.ok) throw new Error('Webhook test failed');
        return response.json();
      },
      onSuccess: (data) => {
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
  };

  // Fetch features
  const useGetFeatures = () => {
    return useQuery({
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
  };

  return {
    useGetTenantSettings,
    useUpdateTenantSettings,
    useCreateApiKey,
    useRevokeApiKey,
    useGetApiKeys,
    useUpdateBranding,
    useGetBilling,
    useUpdateBilling,
    useUpgradePlan,
    useGetUsage,
    useGetWebhook,
    useUpdateWebhook,
    useTestWebhook,
    useGetFeatures
  };
};
