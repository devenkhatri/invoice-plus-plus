'use client';

import { useState, useEffect } from 'react';
import { Invoice, Client, ApiResponse, InvoiceStatus } from '@/types';
import { InvoiceFormData } from '@/lib/validations';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { InvoiceTable } from '@/components/tables/invoice-table';
import { InvoiceDetail } from '@/components/invoices/invoice-detail';
import { RecurringInvoiceList } from '@/components/invoices/recurring-invoice-list';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import { PlusIcon, DocumentTextIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'recurring'>('invoices');

  // Fetch invoices and clients on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [invoicesResponse, clientsResponse] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/clients')
      ]);

      const invoicesData: ApiResponse<Invoice[]> = await invoicesResponse.json();
      const clientsData: ApiResponse<Client[]> = await clientsResponse.json();

      if (invoicesData.success) {
        // Convert date strings back to Date objects
        const invoicesWithDates = invoicesData.data.map(invoice => ({
          ...invoice,
          issueDate: new Date(invoice.issueDate),
          dueDate: new Date(invoice.dueDate),
          sentDate: invoice.sentDate ? new Date(invoice.sentDate) : undefined,
          createdAt: new Date(invoice.createdAt),
          updatedAt: new Date(invoice.updatedAt)
        }));
        setInvoices(invoicesWithDates);
      } else {
        setError(invoicesData.error.message);
      }

      if (clientsData.success) {
        // Handle the clients API response structure
        const clientsArray: Client[] = Array.isArray(clientsData.data)
          ? clientsData.data
          : (clientsData.data as any)?.clients || [];

        // Convert date strings back to Date objects
        const clientsWithDates = clientsArray.map((client: Client) => ({
          ...client,
          createdAt: new Date(client.createdAt),
          updatedAt: new Date(client.updatedAt)
        }));
        setClients(clientsWithDates);
      } else {
        setError(clientsData.error.message);
      }
    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setIsFormOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsFormOpen(true);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
  };

  const handleCloseInvoiceDetail = () => {
    setViewingInvoice(null);
  };

  const handleInvoiceUpdate = (updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      setError(null);

      const response = await fetch(`/api/invoices/${invoice.id}/pdf`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to generate PDF');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  };

  const handleStatusChange = async (invoice: Invoice, newStatus: InvoiceStatus) => {
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...invoice,
          status: newStatus,
          sentDate: newStatus === 'sent' && !invoice.sentDate ? new Date().toISOString() : invoice.sentDate?.toISOString()
        })
      });

      const data: ApiResponse<Invoice> = await response.json();

      if (data.success) {
        const invoiceWithDates = {
          ...data.data,
          issueDate: new Date(data.data.issueDate),
          dueDate: new Date(data.data.dueDate),
          sentDate: data.data.sentDate ? new Date(data.data.sentDate) : undefined,
          createdAt: new Date(data.data.createdAt),
          updatedAt: new Date(data.data.updatedAt)
        };

        setInvoices(prev => prev.map(i => i.id === invoice.id ? invoiceWithDates : i));
        setSuccess(`Invoice status updated to ${newStatus}`);
      } else {
        setError(data.error.message);
      }
    } catch (err) {
      setError('Failed to update invoice status. Please try again.');
      console.error('Error updating invoice status:', err);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE'
      });

      const data: ApiResponse<{ message: string }> = await response.json();

      if (data.success) {
        setInvoices(prev => prev.filter(i => i.id !== invoice.id));
        setSuccess('Invoice deleted successfully');
      } else {
        setError(data.error.message);
      }
    } catch (err) {
      setError('Failed to delete invoice. Please try again.');
      console.error('Error deleting invoice:', err);
    }
  };

  const handleFormSubmit = async (formData: InvoiceFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingInvoice ? `/api/invoices/${editingInvoice.id}` : '/api/invoices';
      const method = editingInvoice ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data: ApiResponse<Invoice> = await response.json();

      if (data.success) {
        // Convert date strings back to Date objects
        const invoiceWithDates = {
          ...data.data,
          issueDate: new Date(data.data.issueDate),
          dueDate: new Date(data.data.dueDate),
          sentDate: data.data.sentDate ? new Date(data.data.sentDate) : undefined,
          createdAt: new Date(data.data.createdAt),
          updatedAt: new Date(data.data.updatedAt)
        };

        if (editingInvoice) {
          setInvoices(prev => prev.map(i => i.id === editingInvoice.id ? invoiceWithDates : i));
          setSuccess('Invoice updated successfully');
        } else {
          setInvoices(prev => [invoiceWithDates, ...prev]);
          setSuccess('Invoice created successfully');
        }

        setIsFormOpen(false);
        setEditingInvoice(null);
      } else {
        setError(data.error.message);
      }
    } catch (err) {
      setError('Failed to save invoice. Please try again.');
      console.error('Error saving invoice:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingInvoice(null);
  };

  // Get client for viewing invoice
  const getClientById = (clientId: string): Client | undefined => {
    return clients.find(client => client.id === clientId);
  };

  // Clear alerts after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, success]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Manage your invoices and billing</p>
        </div>
        <Button onClick={handleCreateInvoice}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'invoices'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <DocumentTextIcon className="h-5 w-5 inline mr-2" />
            All Invoices
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'recurring'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <CalendarIcon className="h-5 w-5 inline mr-2" />
            Recurring Invoices
          </button>
        </nav>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Tab Content */}
      {activeTab === 'invoices' ? (
        <InvoiceTable
          invoices={invoices}
          clients={clients}
          onEdit={handleEditInvoice}
          onDelete={handleDeleteInvoice}
          onView={handleViewInvoice}
          onStatusChange={handleStatusChange}
          onDownloadPDF={handleDownloadPDF}
          isLoading={isLoading}
        />
      ) : (
        <RecurringInvoiceList clients={clients} />
      )}

      {/* Invoice Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleFormCancel}
        title={editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
        size="xl"
      >
        <InvoiceForm
          clients={clients}
          invoice={editingInvoice || undefined}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isLoading={isSubmitting}
        />
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!viewingInvoice}
        onClose={handleCloseInvoiceDetail}
        title="Invoice Details"
        size="xl"
      >
        {viewingInvoice && (
          <InvoiceDetail
            invoice={viewingInvoice}
            client={getClientById(viewingInvoice.clientId)!}
            onClose={handleCloseInvoiceDetail}
            onInvoiceUpdate={handleInvoiceUpdate}
          />
        )}
      </Modal>
    </div>
  );
}