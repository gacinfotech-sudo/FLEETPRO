import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface LeaveRequest {
  _id: string;
  driverId: {
    name: string;
  };
  leaveType: {
    name: string;
  };
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string;
  createdAt: string;
}

interface Props {
  userRole?: string;
}

export const LeaveApprovalList: React.FC<Props> = ({ userRole }) => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    approvedLeaves: 0,
    totalDaysUsed: 0,
  });

  const isManager = userRole === 'manager' || userRole === 'admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch statistics
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';
        const statsResponse = await fetch(`${apiBase}/api/driver-leaves/stats`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
        // For pending leaves, we would need a dedicated endpoint
        // For now, we'll show pending leaves that the manager needs to approve
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (isManager) {
      fetchData();
    }
  }, [isManager]);

  const handleApprove = async (leave: LeaveRequest) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/driver-leaves/${leave._id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to approve leave');
      }

      // Remove from list
      setLeaves(leaves.filter((l) => l._id !== leave._id));
      alert('Leave approved successfully');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClick = (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  const handleReject = async () => {
    if (!selectedLeave || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/driver-leaves/${selectedLeave._id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reject leave');
      }

      // Remove from list
      setLeaves(leaves.filter((l) => l._id !== selectedLeave._id));
      setShowRejectDialog(false);
      setSelectedLeave(null);
      alert('Leave rejected successfully');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isManager) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Only managers can approve or reject leave requests</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading leave requests...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.pendingApprovals}</div>
              <p className="text-sm text-gray-600 mt-2">Pending Approvals</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.approvedLeaves}</div>
              <p className="text-sm text-gray-600 mt-2">Approved This Year</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.totalDaysUsed}</div>
              <p className="text-sm text-gray-600 mt-2">Total Days Used</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pending Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {leaves.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>No pending leave requests to review</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {leaves.map((leave) => (
                <div
                  key={leave._id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{leave.driverId?.name || 'Unknown'}</h3>
                      <Badge className="bg-blue-100 text-blue-800">
                        {leave.leaveType?.name || 'N/A'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Date Range:</span>{' '}
                        {formatDate(leave.startDate)} to {formatDate(leave.endDate)}
                      </div>
                      <div>
                        <span className="font-medium">Duration:</span> {leave.days} day(s)
                      </div>
                    </div>

                    <div className="mb-3">
                      <span className="font-medium text-sm">Reason:</span>
                      <p className="text-sm text-gray-600 mt-1">{leave.reason}</p>
                    </div>

                    <p className="text-xs text-gray-500">
                      Requested on {formatDate(leave.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleApprove(leave)}
                      disabled={actionLoading}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectClick(leave)}
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedLeave && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Driver:</strong> {selectedLeave.driverId?.name}
                </p>
                <p className="text-sm">
                  <strong>Leave Type:</strong> {selectedLeave.leaveType?.name}
                </p>
                <p className="text-sm">
                  <strong>Duration:</strong> {selectedLeave.days} day(s)
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide reason for rejection..."
                rows={4}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
            >
              {actionLoading ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
