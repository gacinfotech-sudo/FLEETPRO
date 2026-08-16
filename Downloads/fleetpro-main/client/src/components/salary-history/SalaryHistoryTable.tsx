import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronDown, History, FileText, TrendingUp, Calendar } from 'lucide-react';
import SalaryHistoryDetails from './SalaryHistoryDetails';
import AuditTrailViewer from './AuditTrailViewer';

export interface SalaryHistoryRecord {
  _id: string;
  driverId: string;
  changeType: 'hike' | 'adjustment' | 'deduction' | 'incentive_change' | 'initial_setup';
  previousValue?: {
    baseSalary?: number;
    incentives?: number;
    deductions?: number;
    netSalary?: number;
  };
  newValue: {
    baseSalary?: number;
    incentives?: number;
    deductions?: number;
    netSalary?: number;
  };
  changeAmount?: number;
  percentageChange?: number;
  reason?: string;
  appliedFrom: string;
  createdBy: {
    userId: string;
    userName: string;
    role: string;
  };
  approvedBy?: {
    userId: string;
    userName: string;
    approvalDate: string;
  };
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

interface Props {
  driverId: string;
  driverName: string;
  tenantId: string;
}

export function SalaryHistoryTable({ driverId, driverName, tenantId }: Props) {
  const [histories, setHistories] = useState<SalaryHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRecord, setSelectedRecord] = useState<SalaryHistoryRecord | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  useEffect(() => {
    fetchSalaryHistory();
  }, [driverId]);

  const fetchSalaryHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/salary-history/${driverId}`, {
        method: 'GET',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setHistories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching salary history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'hike':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'adjustment':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'deduction':
        return <TrendingUp className="h-4 w-4 rotate-180 text-red-600" />;
      case 'incentive_change':
        return <TrendingUp className="h-4 w-4 text-purple-600" />;
      case 'initial_setup':
        return <Calendar className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Salary History
          </CardTitle>
          <CardDescription>{driverName}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Salary History
            </CardTitle>
            <CardDescription>{driverName}</CardDescription>
          </div>
          <Button size="sm" onClick={fetchSalaryHistory}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {histories.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No salary history found for this driver.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Previous Base</TableHead>
                  <TableHead className="text-right">New Base</TableHead>
                  <TableHead className="text-right">Change %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {histories.map((record) => (
                  <React.Fragment key={record._id}>
                    <TableRow>
                      <TableCell>
                        <button
                          className="p-1"
                          onClick={() => toggleRow(record._id)}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedRows.has(record._id) ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.appliedFrom), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getChangeTypeIcon(record.changeType)}
                          <span className="capitalize">
                            {record.changeType.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(record.previousValue?.baseSalary)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(record.newValue.baseSalary)}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.percentageChange !== undefined ? (
                          <span className={record.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {record.percentageChange > 0 ? '+' : ''}{record.percentageChange.toFixed(2)}%
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(record.status)}>
                          {record.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.createdBy.userName}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedRecord(record)}
                              >
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Salary History Details</DialogTitle>
                                <DialogDescription>
                                  Complete information about this salary change
                                </DialogDescription>
                              </DialogHeader>
                              {selectedRecord && (
                                <SalaryHistoryDetails record={selectedRecord} />
                              )}
                            </DialogContent>
                          </Dialog>
                          <Dialog open={showAuditTrail} onOpenChange={setShowAuditTrail}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedRecord(record)}
                              >
                                Audit
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-96 overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Audit Trail</DialogTitle>
                                <DialogDescription>
                                  Complete audit log for this salary change
                                </DialogDescription>
                              </DialogHeader>
                              {selectedRecord && (
                                <AuditTrailViewer recordId={selectedRecord._id} />
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(record._id) && (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <div className="px-4 py-4 bg-muted/50 rounded">
                            <SalaryHistoryDetails record={record} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SalaryHistoryTable;
