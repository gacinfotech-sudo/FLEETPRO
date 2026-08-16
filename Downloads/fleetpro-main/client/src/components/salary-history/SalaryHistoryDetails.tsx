import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { FileText, User, CheckCircle, XCircle, Clock } from 'lucide-react';

interface SalaryHistoryRecord {
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
  notes?: string;
  createdAt: string;
}

interface Props {
  record: SalaryHistoryRecord;
}

export function SalaryHistoryDetails({ record }: Props) {
  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'pending_approval':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'draft':
        return <FileText className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(record.status)}
          <span className="font-semibold capitalize">{record.status.replace('_', ' ')}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          Created: {format(new Date(record.createdAt), 'dd MMM yyyy, HH:mm')}
        </span>
      </div>

      {/* Change Details */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Previous Values</h3>
          <div className="space-y-2 bg-red-50 p-3 rounded">
            {record.previousValue?.baseSalary !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Base Salary:</span>
                <span className="font-medium">{formatCurrency(record.previousValue.baseSalary)}</span>
              </div>
            )}
            {record.previousValue?.incentives !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Incentives:</span>
                <span className="font-medium">{formatCurrency(record.previousValue.incentives)}</span>
              </div>
            )}
            {record.previousValue?.deductions !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Deductions:</span>
                <span className="font-medium">{formatCurrency(record.previousValue.deductions)}</span>
              </div>
            )}
            {record.previousValue?.netSalary !== undefined && (
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Net Salary:</span>
                <span>{formatCurrency(record.previousValue.netSalary)}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">New Values</h3>
          <div className="space-y-2 bg-green-50 p-3 rounded">
            {record.newValue.baseSalary !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Base Salary:</span>
                <span className="font-medium">{formatCurrency(record.newValue.baseSalary)}</span>
              </div>
            )}
            {record.newValue.incentives !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Incentives:</span>
                <span className="font-medium">{formatCurrency(record.newValue.incentives)}</span>
              </div>
            )}
            {record.newValue.deductions !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Deductions:</span>
                <span className="font-medium">{formatCurrency(record.newValue.deductions)}</span>
              </div>
            )}
            {record.newValue.netSalary !== undefined && (
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Net Salary:</span>
                <span>{formatCurrency(record.newValue.netSalary)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Summary */}
      {record.percentageChange !== undefined && (
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="text-sm font-semibold mb-2">Change Summary</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Percentage Change:</span>
              <span className={`font-medium ${record.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {record.percentageChange > 0 ? '+' : ''}{record.percentageChange.toFixed(2)}%
              </span>
            </div>
            {record.changeAmount !== undefined && (
              <div className="flex justify-between">
                <span>Amount Change:</span>
                <span className="font-medium">{formatCurrency(record.changeAmount)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reason and Notes */}
      <div className="space-y-4">
        {record.reason && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Reason</h3>
            <p className="text-sm bg-gray-50 p-3 rounded">{record.reason}</p>
          </div>
        )}

        {record.notes && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Notes</h3>
            <p className="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap">{record.notes}</p>
          </div>
        )}
      </div>

      {/* Approval Information */}
      {record.approvedBy && (
        <div className="bg-green-50 p-4 rounded">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Approved By
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Approver:</span>
              <span className="font-medium">{record.approvedBy.userName}</span>
            </div>
            <div className="flex justify-between">
              <span>Approval Date:</span>
              <span className="font-medium">
                {format(new Date(record.approvedBy.approvalDate), 'dd MMM yyyy, HH:mm')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Applied From Date */}
      <div className="bg-blue-50 p-4 rounded">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Effective Date</h3>
        <p className="text-sm">
          {format(new Date(record.appliedFrom), 'dd MMMM yyyy')}
        </p>
      </div>

      {/* Creator Information */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Created by</span>
          <span className="font-medium">{record.createdBy.userName}</span>
          <span className="text-muted-foreground">({record.createdBy.role})</span>
        </div>
      </div>
    </div>
  );
}

export default SalaryHistoryDetails;
