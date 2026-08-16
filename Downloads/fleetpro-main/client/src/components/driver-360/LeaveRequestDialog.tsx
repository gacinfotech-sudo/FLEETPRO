import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Calendar } from 'lucide-react';

interface LeaveType {
  _id: string;
  name: string;
  daysPerYear: number;
  requiresApproval: boolean;
  isNonDeductible: boolean;
}

interface Props {
  driverId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LeaveRequestDialog: React.FC<Props> = ({
  driverId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatedDays, setCalculatedDays] = useState(0);

  // Fetch leave types on mount
  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        // For now, we'll use dummy data. In production, create an endpoint
        // to fetch leave types for the tenant
        setLeaveTypes([
          {
            _id: '1',
            name: 'Casual Leave',
            daysPerYear: 12,
            requiresApproval: true,
            isNonDeductible: false,
          },
          {
            _id: '2',
            name: 'Sick Leave',
            daysPerYear: 8,
            requiresApproval: true,
            isNonDeductible: true,
          },
          {
            _id: '3',
            name: 'Earned Leave',
            daysPerYear: 10,
            requiresApproval: false,
            isNonDeductible: false,
          },
        ]);
      } catch (err: any) {
        setError('Failed to load leave types');
      }
    };

    if (isOpen) {
      fetchLeaveTypes();
    }
  }, [isOpen]);

  // Calculate number of days when dates change
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);

      if (end >= start) {
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setCalculatedDays(days);
      }
    }
  }, [formData.startDate, formData.endDate]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
        throw new Error('Please fill all required fields');
      }

      const response = await fetch('/api/driver-leaves/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          leaveType: formData.leaveType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to request leave');
      }

      // Reset form
      setFormData({
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
        notes: '',
      });
      setCalculatedDays(0);

      // Close dialog and trigger refresh
      onClose();
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Request Leave
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Leave Type <span className="text-red-500">*</span>
            </label>
            <select
              name="leaveType"
              value={formData.leaveType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((type) => (
                <option key={type._id} value={type._id}>
                  {type.name} ({type.daysPerYear} days/year)
                  {type.isNonDeductible ? ' - Non-Deductible' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium mb-1">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {calculatedDays > 0 && (
              <p className="text-sm text-blue-600 mt-1">
                Total days: <strong>{calculatedDays} day(s)</strong>
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Provide reason for leave request"
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Additional Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Any additional information..."
              rows={2}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
