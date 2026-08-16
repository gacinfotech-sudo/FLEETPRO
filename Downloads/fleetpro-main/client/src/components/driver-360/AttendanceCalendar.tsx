import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceData {
  date: string;
  status: 'present' | 'absent' | 'LEAVE' | 'BOOKING_SERVE' | 'IDLE_AVAILABLE' | 'MANUAL_OVERRIDE';
  workHours?: number;
  notes?: string;
  leaveType?: string;
}

interface AttendanceCalendarProps {
  driverId: string;
  onDateSelect?: (date: Date) => void;
}

export function AttendanceCalendar({ driverId, onDateSelect }: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendances, setAttendances] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendances();
  }, [currentDate, driverId]);

  const fetchAttendances = async () => {
    try {
      setLoading(true);
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await fetch(
        `/api/driver-attendance/calendar/${driverId}?month=${month}&year=${year}`
      );
      if (response.ok) {
        const data = await response.json();
        setAttendances(data.calendar || []);
      }
    } catch (error) {
      console.error('Failed to fetch attendances:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
      case 'BOOKING_SERVE':
      case 'IDLE_AVAILABLE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'absent':
      case 'ABSENT':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'LEAVE':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'MANUAL_OVERRIDE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'present': 'Present',
      'absent': 'Absent',
      'LEAVE': 'Leave',
      'BOOKING_SERVE': 'Booking',
      'IDLE_AVAILABLE': 'Available',
      'MANUAL_OVERRIDE': 'Override'
    };
    return labels[status] || status;
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getAttendanceForDate = (day: number | null): AttendanceData | undefined => {
    if (!day) return undefined;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return attendances.find((a: any) => {
      const attendanceDate = new Date(a.date);
      return attendanceDate.toDateString() === date.toDateString();
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">{monthName}</h3>
          <div className="flex gap-2">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>Present</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <span>Leave</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Override</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, index) => {
          const attendance = day ? getAttendanceForDate(day) : undefined;
          return (
            <div
              key={index}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg border-2 cursor-pointer transition hover:shadow-md ${
                day
                  ? attendance
                    ? getStatusColor(attendance.status)
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                  : 'border-transparent'
              }`}
              onClick={() => {
                if (day && onDateSelect) {
                  const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  onDateSelect(selectedDate);
                }
              }}
              title={attendance ? `${getStatusLabel(attendance.status)}${attendance.notes ? ': ' + attendance.notes : ''}` : ''}
            >
              {day && (
                <>
                  <span className="font-semibold text-lg">{day}</span>
                  {attendance && (
                    <span className="text-xs mt-1">{getStatusLabel(attendance.status)}</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AttendanceCalendar;
