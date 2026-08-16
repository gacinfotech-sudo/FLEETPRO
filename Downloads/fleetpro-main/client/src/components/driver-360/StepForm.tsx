import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import DocumentUpload from './DocumentUpload';

interface StepFormProps {
  step: any;
  stepIndex: number;
  onSave: (updates: any) => void;
  onCancel: () => void;
  saving: boolean;
  readOnly?: boolean;
}

const StepForm: React.FC<StepFormProps> = ({
  step,
  stepIndex,
  onSave,
  onCancel,
  saving,
  readOnly = false
}) => {
  const [formData, setFormData] = useState({
    status: step.status,
    notes: step.notes || '',
    attachmentUrl: step.attachmentUrl || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      status: formData.status === 'pending' ? 'in_progress' : formData.status,
      notes: formData.notes,
      attachmentUrl: formData.attachmentUrl
    });
  };

  const handleMarkComplete = () => {
    onSave({
      status: 'completed',
      notes: formData.notes,
      attachmentUrl: formData.attachmentUrl
    });
  };

  const renderStepSpecificFields = () => {
    switch (step.stepNumber) {
      case 1: // Personal Information
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">This information should be filled from the driver's profile.</p>
          </div>
        );

      case 3: // Government IDs
        return (
          <div className="space-y-4">
            <div>
              <Label>Aadhar Number (Upload)</Label>
              <DocumentUpload
                stepIndex={stepIndex}
                documentType="aadhar"
                onUpload={(url) => setFormData({ ...formData, attachmentUrl: url })}
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>PAN Number (Upload)</Label>
              <DocumentUpload
                stepIndex={stepIndex}
                documentType="pan"
                onUpload={(url) => setFormData({ ...formData, attachmentUrl: url })}
                disabled={readOnly}
              />
            </div>
          </div>
        );

      case 4: // Driver License
        return (
          <div className="space-y-4">
            <div>
              <Label>License Expiry Date</Label>
              <Input type="date" disabled={readOnly} className="bg-gray-50" />
            </div>
            <div>
              <Label>License Document</Label>
              <DocumentUpload
                stepIndex={stepIndex}
                documentType="license"
                onUpload={(url) => setFormData({ ...formData, attachmentUrl: url })}
                disabled={readOnly}
              />
            </div>
          </div>
        );

      case 6: // Bank Details
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Bank details should be configured in the Salary Setup section.</p>
          </div>
        );

      case 9: // Medical Fitness
        return (
          <div className="space-y-4">
            <div>
              <Label>Medical Fitness Certificate</Label>
              <DocumentUpload
                stepIndex={stepIndex}
                documentType="medical"
                onUpload={(url) => setFormData({ ...formData, attachmentUrl: url })}
                disabled={readOnly}
              />
            </div>
          </div>
        );

      case 10: // Training Completion
        return (
          <div className="space-y-4">
            <div>
              <Label>Training Certificate</Label>
              <DocumentUpload
                stepIndex={stepIndex}
                documentType="certificate"
                onUpload={(url) => setFormData({ ...formData, attachmentUrl: url })}
                disabled={readOnly}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {renderStepSpecificFields()}

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Add any notes or observations about this step..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          disabled={readOnly}
          className="min-h-[100px]"
        />
      </div>

      {!readOnly && (
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          {step.status === 'completed' ? (
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Update'}
            </Button>
          ) : (
            <>
              <Button type="submit" variant="outline" disabled={saving}>
                {saving ? 'Saving...' : 'Save Progress'}
              </Button>
              <Button
                type="button"
                onClick={handleMarkComplete}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? 'Marking...' : 'Mark Complete'}
              </Button>
            </>
          )}
        </div>
      )}
    </form>
  );
};

export default StepForm;
