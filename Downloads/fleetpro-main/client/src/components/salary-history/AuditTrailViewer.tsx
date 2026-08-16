import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  AlertTriangle,
  User,
  Zap,
} from 'lucide-react';

interface AuditTrail {
  _id: string;
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'applied' | 'viewed' | 'exported';
  actionDetails?: {
    fieldChanged?: string;
    oldValue?: any;
    newValue?: any;
    changeDescription?: string;
  };
  actor: {
    userId: string;
    userName: string;
    role: string;
  };
  severity: 'low' | 'medium' | 'high';
  status: 'success' | 'failed';
  createdAt: string;
  tags?: string[];
}

interface Props {
  recordId: string;
}

export function AuditTrailViewer({ recordId }: Props) {
  const [trails, setTrails] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditTrail();
  }, [recordId]);

  const fetchAuditTrail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/salary-history/${recordId}/audit`, {
        method: 'GET',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTrails(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Zap className="h-4 w-4 text-blue-600" />;
      case 'updated':
        return <Zap className="h-4 w-4 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'applied':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'viewed':
        return <Eye className="h-4 w-4 text-gray-600" />;
      case 'exported':
        return <Download className="h-4 w-4 text-purple-600" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading audit trail...</div>;
  }

  if (trails.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No audit trail found.</div>;
  }

  return (
    <div className="space-y-4">
      {trails.map((trail, index) => (
        <div key={trail._id} className="relative pb-8">
          {/* Timeline connector */}
          {index < trails.length - 1 && (
            <div className="absolute left-5 top-12 w-0.5 h-full bg-gray-200" />
          )}

          {/* Timeline dot and content */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center relative z-10">
                {getActionIcon(trail.action)}
              </div>
            </div>

            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-semibold capitalize">
                    {trail.action.replace('_', ' ')}
                  </span>
                  <Badge className={getSeverityColor(trail.severity)} variant="outline">
                    {trail.severity}
                  </Badge>
                  {trail.status === 'failed' && (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(trail.createdAt), 'dd MMM yyyy, HH:mm:ss')}
                </span>
              </div>

              {/* Actor Information */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>{trail.actor.userName}</span>
                <span className="text-xs">({trail.actor.role})</span>
              </div>

              {/* Action Details */}
              {trail.actionDetails && (
                <div className="mt-2 bg-gray-50 p-3 rounded text-sm">
                  {trail.actionDetails.changeDescription && (
                    <p className="text-gray-700 mb-2">
                      {trail.actionDetails.changeDescription}
                    </p>
                  )}

                  {trail.actionDetails.fieldChanged && (
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold text-gray-600">
                        Field: {trail.actionDetails.fieldChanged}
                      </div>
                      {trail.actionDetails.oldValue !== undefined && (
                        <div>
                          <span className="text-gray-600">Old: </span>
                          <span className="font-mono text-red-600">
                            {JSON.stringify(trail.actionDetails.oldValue)}
                          </span>
                        </div>
                      )}
                      {trail.actionDetails.newValue !== undefined && (
                        <div>
                          <span className="text-gray-600">New: </span>
                          <span className="font-mono text-green-600">
                            {JSON.stringify(trail.actionDetails.newValue)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {trail.tags && trail.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {trail.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AuditTrailViewer;
