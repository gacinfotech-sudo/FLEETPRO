import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Eye, EyeOff, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PasswordResetPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  // Password strength calculation
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const getStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-500";
    if (passwordStrength <= 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (passwordStrength <= 2) return "Weak";
    if (passwordStrength <= 4) return "Medium";
    return "Strong";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await resetPassword(newPassword, confirmPassword);
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully. Redirecting to login page...",
      });
      // Keep loading state active during redirect
      // The resetPassword function will clear user state and redirect to login
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Password reset failed",
        variant: "destructive",
      });
      setLoading(false);
    }
    // Don't set loading to false on success - keep loading state during redirect
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-6 pb-8 pt-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <Lock className="text-white" size={28} />
            </div>
            
            <div className="space-y-3">
              <CardTitle className="text-2xl font-bold text-slate-800">Set New Password</CardTitle>
              <CardDescription className="text-slate-600 text-base leading-relaxed">
                You are using a temporary password. Please set a new secure password to continue accessing FleetPro.
              </CardDescription>
            </div>

            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-orange-600 mt-0.5 flex-shrink-0" size={18} />
                <div className="text-left">
                  <p className="text-sm font-medium text-orange-800">Password Reset Required</p>
                  <p className="text-xs text-orange-600 mt-1">
                    You cannot skip this step. Your new password will replace the temporary one assigned by your administrator.
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="newPassword" className="text-base font-semibold text-slate-700">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter your new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-12 px-4 pr-12 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all duration-200 bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Password Strength:</span>
                      <span className={`font-medium ${
                        passwordStrength <= 2 ? 'text-red-600' : 
                        passwordStrength <= 4 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {getStrengthText()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                        style={{ width: `${(passwordStrength / 6) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="text-base font-semibold text-slate-700">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 px-4 pr-12 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all duration-200 bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                
                {/* Password Match Indicator */}
                {confirmPassword && (
                  <div className="flex items-center space-x-2 text-sm">
                    {newPassword === confirmPassword ? (
                      <>
                        <CheckCircle className="text-green-600" size={16} />
                        <span className="text-green-600">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="text-red-600" size={16} />
                        <span className="text-red-600">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-4 pt-4">
                <Button
                  type="submit"
                  disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Setting Password...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Shield size={18} />
                      <span>Set New Password</span>
                    </div>
                  )}
                </Button>
                
                <div className="text-center">
                  <p className="text-sm text-slate-500">
                    Password requirements: Minimum 6 characters
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}