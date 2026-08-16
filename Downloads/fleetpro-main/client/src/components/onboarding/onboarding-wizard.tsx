import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CheckCircle, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const onboardingSteps = [
  {
    title: "Complete Your Business Profile",
    description: "Go to the Profile section and complete your business identity. Fill in:\n\n• Brand Name\n• Company Name\n• Business Address\n• GST Number (if applicable)\n• Contact Email and Phone\n• Upload your company logo\n\n📝 This info will be used in every invoice automatically."
  },
  {
    title: "Add Vehicles to Your Fleet",
    description: "Go to \"Manage Fleet\" and add your vehicles.\n\nInclude:\n• Vehicle Type (Sedan/SUV/etc.)\n• Fuel Type\n• Registration Number\n• Segment & Rate (Per Km or Per Day)\n\n📝 No bookings can be created without adding at least one vehicle."
  },
  {
    title: "Add Drivers",
    description: "In \"Manage Drivers\", add drivers who can be assigned to bookings.\n\nDetails to enter:\n• Driver Name\n• Phone Number\n• License Number\n• Driver Photo (optional)\n\n📝 You can assign drivers later while making bookings."
  },
  {
    title: "Create New Booking",
    description: "Navigate to \"Add Booking\".\n\nEnter:\n• Trip Details\n• Customer Details\n• Vehicle & Driver\n• Choose Rate: By Day or Per Km\n\n📝 Final step lets you review and confirm. A PDF confirmation (no pricing) will be generated."
  },
  {
    title: "Generate Editable Invoice",
    description: "From Booking History, click \"Generate Invoice\".\n\n• Modify Base Amount, Toll, Parking, Damage Charges, etc.\n• Reflects your company name, logo, and address\n• Works for both \"Per Km\" and \"Per Day\" bookings\n\n📝 Easily export PDF and share it with customers."
  },
  {
    title: "Add Managers (Optional)",
    description: "In \"Manage Users\", add manager accounts for your team.\n\nManagers can:\n• Add/Delete bookings\n• Generate invoices\n• Cannot delete drivers, vehicles, or company profile\n\n📝 All manager actions are logged with their name and timestamp."
  },
  {
    title: "Need Help?",
    description: "• Forgot password? Use Reset Password from Profile\n• Can't access account? Contact Admin\n• Ensure your profile is complete for best experience\n\n🎉 You're all set to use your dashboard smoothly!"
  }
];

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const completeOnboardingMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/auth/complete-onboarding'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Welcome to FleetPro!",
        description: "Your setup guide is now complete. Let's get started!",
      });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      });
      setIsCompleting(false);
    }
  });

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      console.log('Attempting to complete onboarding...');
      await completeOnboardingMutation.mutateAsync();
    } catch (error) {
      console.error('Onboarding completion error:', error);
      toast({
        title: "Setup Error",
        description: `Failed to complete setup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setIsCompleting(false);
    }
  };

  const handleSkip = async () => {
    setIsCompleting(true);
    try {
      console.log('Skipping onboarding and marking as complete...');
      await completeOnboardingMutation.mutateAsync();
      onSkip();
    } catch (error) {
      console.error('Skip onboarding error:', error);
      // Even if the API call fails, still close the modal
      onSkip();
    } finally {
      setIsCompleting(false);
    }
  };

  const progressPercentage = ((currentStep + 1) / onboardingSteps.length) * 100;
  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="bg-white shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-xl lg:text-2xl font-bold text-gray-900">
                Welcome to FleetPro!
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSkip}
                disabled={isCompleting}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Step {currentStep + 1} of {onboardingSteps.length}</span>
                <span>{Math.round(progressPercentage)}% Complete</span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="min-h-[300px] lg:min-h-[350px] flex flex-col">
              <div className="flex-1">
                <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4">
                  {isLastStep ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-green-600" size={24} />
                      {currentStepData.title}
                    </div>
                  ) : (
                    `${currentStep + 1}. ${currentStepData.title}`
                  )}
                </h3>

                <div className="text-gray-600 text-sm lg:text-base leading-relaxed">
                  {currentStepData.description.split('\n').map((line, index) => (
                    <div key={index} className="mb-2">
                      {line || <br />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft size={16} />
                  Back
                </Button>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    disabled={isCompleting}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    {isCompleting ? "Completing..." : "Skip Setup"}
                  </Button>

                  {isLastStep ? (
                    <Button
                      onClick={handleComplete}
                      disabled={isCompleting}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle size={16} />
                      {isCompleting ? "Completing..." : "Complete Setup"}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      className="flex items-center gap-2"
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}