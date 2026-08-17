import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Copy, Trash2, Eye, EyeOff, Loader2, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  secret?: string;
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
  isActive: boolean;
}

const TenantApiKeys: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [showSecret, setShowSecret] = useState<{ [key: string]: boolean }>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';

  // Fetch API keys
  const { data: apiKeys = [], isLoading } = useQuery({
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

  // Create API key mutation
  const createMutation = useMutation({
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
      setNewKeyName('');
      setIsCreateDialogOpen(false);
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

  // Revoke API key mutation
  const revokeMutation = useMutation({
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
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
      {/* API Key Info */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          API keys are used to authenticate requests to our API. Keep your secret key safe and never share it publicly.
        </AlertDescription>
      </Alert>

      {/* Create New Key Card */}
      <Card>
        <CardHeader>
          <CardTitle>Create New API Key</CardTitle>
          <CardDescription>Generate a new API key for your application</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create New Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Enter a name for your API key to help you identify it later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., Mobile App, Desktop Integration"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setNewKeyName('');
                    }}
                    disabled={createMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(newKeyName)}
                    disabled={!newKeyName || createMutation.isPending}
                    className="gap-2"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            {apiKeys.length === 0
              ? 'No API keys yet. Create one to get started.'
              : `You have ${apiKeys.length} active API key${apiKeys.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No API keys created yet. Click the button above to create your first key.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey: ApiKey) => (
                <div
                  key={apiKey.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors space-y-3"
                >
                  {/* Key Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{apiKey.name}</h4>
                        {apiKey.isActive ? (
                          <Badge variant="default" className="bg-green-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => revokeMutation.mutate(apiKey.id)}
                      disabled={revokeMutation.isPending}
                      className="gap-2 w-full sm:w-auto"
                    >
                      {revokeMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Revoking...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Revoke
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Key Display */}
                  <div className="space-y-2 bg-muted/50 p-3 rounded-md">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium">Public Key:</Label>
                      <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1 truncate">
                        {apiKey.key}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(apiKey.key, 'Public key')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    {apiKey.secret && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-medium">Secret Key:</Label>
                        <code className="text-xs bg-background px-2 py-1 rounded font-mono flex-1">
                          {showSecret[apiKey.id]
                            ? apiKey.secret
                            : '●'.repeat(apiKey.secret.length)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowSecret(prev => ({
                              ...prev,
                              [apiKey.id]: !prev[apiKey.id]
                            }))
                          }
                        >
                          {showSecret[apiKey.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(apiKey.secret!, 'Secret key')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Usage Stats */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground">API Calls</p>
                      <p className="font-medium">{apiKey.usageCount.toLocaleString()}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground">Last Used</p>
                      <p className="font-medium text-xs">
                        {apiKey.lastUsedAt
                          ? formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>Learn how to use the FleetPro API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-mono text-sm font-medium mb-2">Example API Request</h4>
            <pre className="text-xs overflow-x-auto bg-background p-3 rounded border">
{`curl -X GET https://api.fleetpro.com/v1/vehicles \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>
          <Button variant="outline" className="w-full">
            Read Full API Documentation
          </Button>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Never share your secret key in public repositories or client-side code</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Rotate keys regularly for enhanced security</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Use separate keys for different applications or environments</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Monitor API usage for unusual activity</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>Revoke unused keys to minimize security risks</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantApiKeys;
