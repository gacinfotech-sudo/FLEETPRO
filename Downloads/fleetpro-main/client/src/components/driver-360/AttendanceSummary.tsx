import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Users, Calendar } from 'lucide-react';

interface AttendanceSummaryData {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  totalWorkingDays: number;
  attendancePercentage: number | string;
  totalSalaryDeduction: number;
  month: number;
  year: number;
}

interface AttendanceSummaryProps {
  driverId: string;
  month?: number;
  year?: number;
  onMarkAttendanceClick?: () => void;
}

export function AttendanceSummary({
  driverId,
  month,
  year,
  onMarkAttendanceClick
}: AttendanceSummaryProps) {
  const [summary, setSummary] = useState<AttendanceSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchSummaryAndStats();
  }, [driverId, month, year]);

  const fetchSummaryAndStats = async () => {
    try {
      setLoading(true);
      const currentMonth = month || new Date().getMonth() + 1;
      const currentYear = year || new Date().getFullYear();

      const [summaryRes, statsRes] = await Promise.all([
        fetch(
          `/api/driver-attendance/summary/${driverId}?month=${currentMonth}&year=${currentYear}`
        ),
        fetch(`/api/driver-attendance/stats/${driverId}`)
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  const attendancePercentage = Number(summary.attendancePercentage);
  const isLowAttendance = attendancePercentage < 80;

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Present Days Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Present Days</h3>
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-700">{summary.presentDays}</span>
            <span className="text-sm text-green-600">days</span>
          </div>
          <p className="text-xs text-green-600 mt-2">This month</p>
        </div>

        {/* Absent Days Card */}
        <div className={`rounded-lg shadow p-6 border transition ${
          summary.absentDays > 0
            ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Absent Days</h3>
            <AlertTriangle className={`w-5 h-5 ${summary.absentDays > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${summary.absentDays > 0 ? 'text-red-700' : 'text-gray-700'}`}>
              {summary.absentDays}
            </span>
            <span className={`text-sm ${summary.absentDays > 0 ? 'text-red-600' : 'text-gray-600'}`}>days</span>
          </div>
          <p className={`text-xs mt-2 ${summary.absentDays > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            This month
          </p>
        </div>

        {/* Leave Days Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Leave Days</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-700">{summary.leaveDays}</span>
            <span className="text-sm text-blue-600">days</span>
          </div>
          <p className="text-xs text-blue-600 mt-2">This month</p>
        </div>

        {/* Attendance Percentage Card */}
        <div className={`rounded-lg shadow p-6 border transition ${
          isLowAttendance
            ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
            : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Attendance %</h3>
            <TrendingUp className={`w-5 h-5 ${isLowAttendance ? 'text-orange-600' : 'text-purple-600'}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${isLowAttendance ? 'text-orange-700' : 'text-purple-700'}`}>
              {attendancePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition ${isLowAttendance ? 'bg-orange-600' : 'bg-purple-600'}`}
              style={{ width: `${Math.min(attendancePercentage, 100)}%` }}
            ></div>
          </div>
          {isLowAttendance && (
            <p className="text-xs text-orange-600 mt-2">⚠️ Below 80% threshold</p>
          )}
        </div>
      </div>

      {/* Salary Deduction and Action Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Salary Deduction */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">💰 Salary Impact</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Deduction this month</p>
              <p className="text-2xl font-bold text-red-600">
                -₹{summary.totalSalaryDeduction.toFixed(2)}
              </p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">Based on {summary.absentDays} absent days</p>
            </div>
          </div>
        </div>

        {/* Quick Action */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Quick Action</h3>
          <button
            onClick={onMarkAttendanceClick}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Mark Today's Attendance
          </button>
          <p className="text-xs text-gray-600 mt-3">
            Mark or update attendance for today
          </p>
        </div>
      </div>

      {/* 90-Day Stats */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📊 90-Day Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Days</p>
              <p className="text-2xl font-bold text-gray-900">{stats.last90Days?.total || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Present</p>
              <p className="text-2xl font-bold text-green-600">{stats.last90Days?.present || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Absent</p>
              <p className="text-2xl font-bold text-red-600">{stats.last90Days?.absent || 0}</p>
            </div>
          </div>
          {stats.lowAttendanceFlag && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                ⚠️ <strong>Alert:</strong> Attendance is below 80% in the last 90 days. This may impact salary.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AttendanceSummary;
