import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

interface MarkAttendanceDialogProps {
  driverId: string;
  date?: Date;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MarkAttendanceDialog({
  driverId,
  date = new Date(),
  isOpen,
  onClose,
  onSuccess
}: MarkAttendanceDialogProps) {
  const [status, setStatus] = useState<'present' | 'absent' | 'LEAVE'>('present');
  const [leaveType, setLeaveType] = useState<'sick' | 'casual' | 'earned' | 'unpaid' | 'emergency'>('casual');
  const [workHours, setWorkHours] = useState<number>(8);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    try {
      setLoading(true);

      const payload = {
        driverId,
        date: date.toISOString().split('T')[0],
        status,
        leaveType: status === 'LEAVE' ? leaveType : undefined,
        workHours: status === 'present' ? workHours : 0,
        notes
      };

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050';
      const response = await fetch(`${apiBase}/api/driver-attendance/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to mark attendance');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Mark Attendance</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Date Display */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-gray-700">Date</label>
            <p className="text-gray-900 font-medium mt-1">{dateStr}</p>
          </div>

          {/* Status Selection */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-gray-700 block mb-3">
              Attendance Status
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="present"
                  checked={status === 'present'}
                  onChange={(e) => setStatus(e.target.value as 'present')}
                  className="w-4 h-4 text-green-600"
                />
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-gray-700">Present</span>
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="absent"
                  checked={status === 'absent'}
                  onChange={(e) => setStatus(e.target.value as 'absent')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span className="text-gray-700">Absent</span>
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  value="LEAVE"
                  checked={status === 'LEAVE'}
                  onChange={(e) => setStatus(e.target.value as 'LEAVE')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span className="text-gray-700">Leave</span>
                </span>
              </label>
            </div>
          </div>

          {/* Leave Type Selection */}
          {status === 'LEAVE' && (
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Leave Type
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="sick">Sick Leave</option>
                <option value="casual">Casual Leave</option>
                <option value="earned">Earned Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="emergency">Emergency Leave</option>
              </select>
            </div>
          )}

          {/* Work Hours */}
          {status === 'present' && (
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Working Hours
              </label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={workHours}
                onChange={(e) => setWorkHours(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Enter hours worked (0-24)</p>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">Attendance marked successfully!</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Mark Attendance
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MarkAttendanceDialog;
