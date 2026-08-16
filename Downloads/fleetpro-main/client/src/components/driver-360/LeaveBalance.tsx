import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Calendar, CheckCircle, Clock } from 'lucide-react';

interface LeaveTypeBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  accrued: number;
  used: number;
  balance: number;
  daysPerYear: number;
  isNonDeductible: boolean;
}

interface Props {
  driverId: string;
}

export const LeaveBalance: React.FC<Props> = ({ driverId }) => {
  const [balances, setBalances] = useState<LeaveTypeBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/driver-leaves/balance/${driverId}`);
        if (!response.ok) throw new Error('Failed to fetch leave balance');
        const data = await response.json();
        setBalances(data.balance || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      fetchBalance();
    }
  }, [driverId]);

  if (loading) {
    return <div className="text-center py-8">Loading leave balance...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Leave Balance</h2>

      {balances.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No leave types configured</AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((balance) => (
            <Card key={balance.leaveTypeId} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  {balance.leaveTypeName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Accrued */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Accrued:</span>
                  <span className="font-semibold text-lg">{balance.accrued} days</span>
                </div>

                {/* Used */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Used:</span>
                  <span className="font-semibold text-orange-600">{balance.used} days</span>
                </div>

                {/* Balance */}
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Available Balance:</span>
                    <span
                      className={`text-xl font-bold ${
                        balance.balance > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {balance.balance} days
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min((balance.used / balance.accrued) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{Math.round((balance.used / balance.accrued) * 100)}% used</span>
                    <span>{Math.round(((balance.accrued - balance.used) / balance.accrued) * 100)}% available</span>
                  </div>
                </div>

                {/* Badge for non-deductible */}
                {balance.isNonDeductible && (
                  <div className="pt-2 border-t">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      <CheckCircle className="h-3 w-3" />
                      Non-Deductible
                    </span>
                  </div>
                )}

                {/* Warning for low balance */}
                {balance.balance <= 2 && balance.balance > 0 && (
                  <Alert className="mt-2 bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 text-sm">
                      Low balance remaining
                    </AlertDescription>
                  </Alert>
                )}

                {balance.balance === 0 && (
                  <Alert className="mt-2 bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-sm">
                      No balance available
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
