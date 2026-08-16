import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Check, Clock, AlertCircle, FileText } from 'lucide-react';
import StepForm from './StepForm';
import DocumentUpload from './DocumentUpload';

interface OnboardingStep {
  stepNumber: number;
  name: string;
  description: string;
  documentType?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  required: boolean;
  completedAt?: string;
  completedBy?: {
    userId: string;
    userName: string;
  };
  notes?: string;
  attachmentUrl?: string;
}

interface OnboardingChecklistProps {
  driverId: string;
  tenantId: string;
  readOnly?: boolean;
}

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  driverId,
  tenantId,
  readOnly = false
}) => {
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch checklist
  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/driver-onboarding/${driverId}`);
        if (!response.ok) throw new Error('Failed to fetch checklist');
        const data = await response.json();
        setChecklist(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch checklist');
      } finally {
        setLoading(false);
      }
    };

    fetchChecklist();
  }, [driverId]);

  const handleStepUpdate = async (stepIndex: number, updates: any) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/driver-onboarding/${driverId}/step/${stepIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update step');
      const updated = await response.json();
      setChecklist(updated);
      setEditingStep(null);
      setSuccess(`Step "${checklist.steps[stepIndex].name}" updated successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update step');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/driver-onboarding/${driverId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to complete onboarding');
      }

      const updated = await response.json();
      setChecklist(updated.checklist);
      setSuccess('Onboarding completed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Driver Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading checklist...</div>
        </CardContent>
      </Card>
    );
  }

  if (!checklist) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Driver Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load onboarding checklist</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const allRequired = checklist.steps.filter((s: OnboardingStep) => s.required);
  const completedRequired = allRequired.filter((s: OnboardingStep) => s.status === 'completed');
  const canComplete = completedRequired.length === allRequired.length && checklist.status !== 'completed';

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Driver Onboarding Checklist</CardTitle>
              <CardDescription>Complete all required steps to finish onboarding</CardDescription>
            </div>
            <Badge
              className={
                checklist.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }
            >
              {checklist.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-gray-600">{checklist.overallProgress}%</span>
            </div>
            <Progress value={checklist.overallProgress} className="h-2" />
            <p className="text-sm text-gray-600">
              {checklist.steps.filter((s: OnboardingStep) => s.status === 'completed').length} of {checklist.steps.length} steps completed
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Steps List */}
          <div className="space-y-2">
            {checklist.steps.map((step: OnboardingStep, index: number) => (
              <div key={index} className="border rounded-lg">
                <button
                  onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                  disabled={editingStep === index}
                >
                  {getStatusIcon(step.status)}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{step.stepNumber}. {step.name}</span>
                      {step.required && (
                        <span className="text-xs text-red-600 font-semibold">*Required</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(step.status)}
                    {expandedStep === index ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedStep === index && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    {editingStep === index ? (
                      <StepForm
                        step={step}
                        stepIndex={index}
                        onSave={(updates) => handleStepUpdate(index, updates)}
                        onCancel={() => setEditingStep(null)}
                        saving={saving}
                        readOnly={readOnly}
                      />
                    ) : (
                      <div className="space-y-3">
                        {step.completedAt && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                            <p className="font-medium text-green-800">✓ Completed</p>
                            <p className="text-green-700 text-xs mt-1">
                              by {step.completedBy?.userName} on {new Date(step.completedAt).toLocaleDateString()}
                            </p>
                          </div>
                        )}

                        {step.notes && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm font-medium text-blue-900">Notes</p>
                            <p className="text-sm text-blue-700">{step.notes}</p>
                          </div>
                        )}

                        {step.attachmentUrl && (
                          <div className="p-3 bg-gray-100 border border-gray-300 rounded flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-600" />
                            <a href={step.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                              View Document
                            </a>
                          </div>
                        )}

                        {!readOnly && step.status !== 'completed' && (
                          <Button
                            onClick={() => setEditingStep(index)}
                            variant="outline"
                            size="sm"
                            disabled={saving}
                          >
                            {step.status === 'in_progress' ? 'Continue' : 'Start'} Step
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Complete Button */}
          {checklist.status !== 'completed' && !readOnly && (
            <Button
              onClick={handleCompleteOnboarding}
              disabled={!canComplete || saving}
              className="w-full"
              size="lg"
            >
              {saving ? 'Completing...' : 'Complete Onboarding'}
            </Button>
          )}

          {checklist.status === 'completed' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium text-green-800">Onboarding Completed</p>
              <p className="text-sm text-green-700 mt-1">
                Completed by {checklist.completedBy?.userName} on {new Date(checklist.completedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingChecklist;
