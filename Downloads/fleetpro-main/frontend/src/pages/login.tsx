import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await login(userId, password);
      toast({
        title: "Success",
        description: "Logged in successfully",
      });
    } catch (error: any) {
      let errorMessage = "Invalid credentials";
      
      if (error.status === 403 && error.code === "ACCOUNT_INACTIVE") {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full flex items-center justify-center">
          <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl border-0 rounded-3xl overflow-hidden">
            <CardHeader className="text-center pb-4 lg:pb-8 px-4 lg:px-8 pt-6 lg:pt-10">
              
              <div>
                <CardTitle className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2 lg:mb-4">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-base lg:text-lg text-slate-600 leading-relaxed">
                  Sign in to access your fleet management dashboard
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4 lg:space-y-8 px-4 lg:px-8 pb-6 lg:pb-10">
              <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-8" noValidate autoComplete="off">
                <div className="space-y-2 lg:space-y-3">
                  <Label htmlFor="userId" className="text-sm lg:text-base font-semibold text-slate-700">
                    User ID
                  </Label>
                  <Input
                    id="userId"
                    name="userId"
                    type="text"
                    placeholder="Enter your User ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="h-12 lg:h-14 px-3 lg:px-4 text-sm lg:text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all duration-200 bg-slate-50 focus:bg-white"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                </div>
                
                <div className="space-y-2 lg:space-y-3">
                  <Label htmlFor="password" className="text-sm lg:text-base font-semibold text-slate-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 lg:h-14 px-3 lg:px-4 pr-12 lg:pr-14 text-sm lg:text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl transition-all duration-200 bg-slate-50 focus:bg-white"
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 lg:right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} className="lg:w-[22px] lg:h-[22px]" /> : <Eye size={18} className="lg:w-[22px] lg:h-[22px]" />}
                    </button>
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 lg:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base lg:text-lg rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl mt-6 lg:mt-8 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2 lg:space-x-3">
                      <div className="w-4 h-4 lg:w-5 lg:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    "Sign In to Dashboard"
                  )}
                </Button>
                
                <div className="text-center pt-2 lg:pt-4">
                  <p className="text-xs lg:text-sm text-slate-500">
                    Forgot Password? Please contact your administrator to reset.
                  </p>
                </div>
              </form>
              
              <div className="pt-3 lg:pt-6 border-t border-slate-200">
                <div className="bg-blue-50 p-3 lg:p-5 rounded-xl">
                  <div className="flex items-start space-x-3 lg:space-x-4">
                    <Shield className="text-blue-600 mt-0.5 lg:mt-1" size={16} />
                    <div className="space-y-0.5 lg:space-y-1">
                      <p className="text-sm lg:text-base font-semibold text-blue-800">Security Notice</p>
                      <p className="text-xs lg:text-sm text-blue-600 leading-relaxed">
                        Single session enforcement - Previous sessions will be automatically logged out for enhanced security
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}