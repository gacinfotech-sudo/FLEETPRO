import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Car, Calendar, DollarSign, FileText, Upload, Trash2, Edit, ReceiptIcon } from "lucide-react";
import { format } from "date-fns";

interface Vehicle {
  _id: string;
  make: string;
  vehicleModel?: string;
  licensePlate?: string;
}

interface Expense {
  _id: string;
  vehicleId: {
    _id: string;
    make: string;
    vehicleModel?: string;
    licensePlate?: string;
  };
  category: string;
  amount: number;
  date: string;
  description?: string;
  attachmentUrl?: string;
  createdBy?: {
    userId: string;
    role: string;
  };
  createdAt: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'damage', label: 'Damage' },
  { value: 'tires', label: 'Tires' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'other', label: 'Other' }
];

export default function ManageExpenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    vehicleId: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    attachmentUrl: ''
  });

  // Fetch vehicles
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles'],
    enabled: !!user
  });

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading, refetch } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    enabled: !!user
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData: any) => {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseData),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to create expense');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense added successfully"
      });
      setShowForm(false);
      setFormData({
        vehicleId: '',
        category: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        attachmentUrl: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add expense",
        variant: "destructive"
      });
    }
  });

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to update expense');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense updated successfully"
      });
      setEditingExpense(null);
      setShowForm(false);
      setFormData({
        vehicleId: '',
        category: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        attachmentUrl: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update expense",
        variant: "destructive"
      });
    }
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete expense');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vehicleId || !formData.category || !formData.amount || !formData.date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const expenseData = {
      ...formData,
      amount: parseFloat(formData.amount)
    };

    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense._id, data: expenseData });
    } else {
      createExpenseMutation.mutate(expenseData);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      vehicleId: expense.vehicleId._id,
      category: expense.category,
      amount: expense.amount.toString(),
      date: new Date(expense.date).toISOString().split('T')[0],
      description: expense.description || '',
      attachmentUrl: expense.attachmentUrl || ''
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteExpenseMutation.mutate(id);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      maintenance: 'bg-blue-100 text-blue-800',
      damage: 'bg-red-100 text-red-800',
      tires: 'bg-green-100 text-green-800',
      fuel: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.other;
  };

  if (vehiclesLoading || expensesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptIcon className="w-7 h-7 text-blue-600" />
            Manage Expenses
          </h1>
          <p className="text-gray-600 mt-1">Track vehicle expenses and maintenance costs</p>
        </div>
        <Button 
          onClick={() => {
            setShowForm(true);
            setEditingExpense(null);
            setFormData({
              vehicleId: '',
              category: '',
              amount: '',
              date: new Date().toISOString().split('T')[0],
              description: '',
              attachmentUrl: ''
            });
          }}
          className="flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add Expense
        </Button>
      </div>

      {/* Add/Edit Expense Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle">Vehicle *</Label>
                  <Select value={formData.vehicleId} onValueChange={(value) => setFormData(prev => ({ ...prev, vehicleId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle: Vehicle) => (
                        <SelectItem key={vehicle._id} value={vehicle._id}>
                          {vehicle.make} {vehicle.vehicleModel ? `- ${vehicle.vehicleModel}` : ''} 
                          {vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter expense description..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachment">Attachment URL (Optional)</Label>
                <Input
                  id="attachment"
                  type="url"
                  placeholder="https://example.com/receipt.jpg"
                  value={formData.attachmentUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, attachmentUrl: e.target.value }))}
                />
                <p className="text-sm text-gray-500">Upload your receipt/bill image to a cloud service and paste the URL here</p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="submit" 
                  disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {(createExpenseMutation.isPending || updateExpenseMutation.isPending) ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {editingExpense ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      {editingExpense ? 'Update Expense' : 'Add Expense'}
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingExpense(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Recent Expenses ({expenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <ReceiptIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses recorded</h3>
              <p className="text-gray-600 mb-4">Start tracking your vehicle expenses by adding your first expense entry.</p>
              <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Add First Expense
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense: Expense) => (
                <div key={expense._id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-medium text-gray-900">
                          {expense.vehicleId.make} {expense.vehicleId.vehicleModel}
                        </h3>
                        <Badge className={getCategoryBadgeColor(expense.category)}>
                          {EXPENSE_CATEGORIES.find(cat => cat.value === expense.category)?.label || expense.category}
                        </Badge>
                        <span className="text-lg font-semibold text-green-600">
                          ₹{expense.amount.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(expense.date), 'dd MMM yyyy')}
                        </span>
                        {expense.vehicleId.licensePlate && (
                          <span className="flex items-center gap-1">
                            <Car className="w-4 h-4" />
                            {expense.vehicleId.licensePlate}
                          </span>
                        )}
                        {expense.createdBy && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {expense.createdBy.userId} ({expense.createdBy.role})
                          </span>
                        )}
                      </div>

                      {expense.description && (
                        <p className="text-gray-700 text-sm">{expense.description}</p>
                      )}

                      {expense.attachmentUrl && (
                        <a 
                          href={expense.attachmentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Upload className="w-4 h-4" />
                          View Attachment
                        </a>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(expense)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(expense._id)}
                        disabled={deleteExpenseMutation.isPending}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}