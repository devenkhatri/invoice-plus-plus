import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { paymentFormSchema } from '@/lib/validations';
import { ApiResponse, Payment } from '@/types';
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = await params;

    if (!id) {
      return createErrorResponse('VALIDATION_ERROR', 'Payment ID is required', 400);
    }

    const sheetsService = await GoogleSheetsService.getAuthenticatedService();
    const payment = await sheetsService.getPayment(id);

    if (!payment) {
      return createErrorResponse('NOT_FOUND', 'Payment not found', 404);
    }

    return createSuccessResponse(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return createErrorResponse(
      'FETCH_ERROR',
      error instanceof Error ? error.message : 'Failed to fetch payment',
      500,
      error
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = await params;

    if (!id) {
      return createErrorResponse('VALIDATION_ERROR', 'Payment ID is required', 400);
    }

    const body = await request.json();
    
    // Validate request body
    const result = paymentFormSchema.safeParse(body);
    if (!result.success) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid payment data',
        400,
        result.error.issues
      );
    }

    const sheetsService = await GoogleSheetsService.getAuthenticatedService();
    
    // Check if payment exists
    const existingPayment = await sheetsService.getPayment(id);
    if (!existingPayment) {
      return createErrorResponse('NOT_FOUND', 'Payment not found', 404);
    }

    // For payment updates, we need to delete the old payment and create a new one
    // because updating payments affects invoice balances
    const oldAmount = existingPayment.amount;
    const oldInvoiceId = existingPayment.invoiceId;
    
    // Delete the old payment
    await sheetsService.deletePayment(id);
    
    // Create the new payment
    const paymentData = {
      invoiceId: result.data.invoiceId,
      amount: result.data.amount,
      paymentDate: new Date(result.data.paymentDate),
      paymentMethod: result.data.paymentMethod,
      notes: result.data.notes,
    };

    const updatedPayment = await sheetsService.createPayment(paymentData);

    return createSuccessResponse(updatedPayment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return createErrorResponse(
      'UPDATE_ERROR',
      error instanceof Error ? error.message : 'Failed to update payment',
      500,
      error
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = await params;

    if (!id) {
      return createErrorResponse('VALIDATION_ERROR', 'Payment ID is required', 400);
    }

    const sheetsService = await GoogleSheetsService.getAuthenticatedService();
    const success = await sheetsService.deletePayment(id);

    if (!success) {
      return createErrorResponse('NOT_FOUND', 'Payment not found', 404);
    }

    return createSuccessResponse({ id });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return createErrorResponse(
      'DELETE_ERROR',
      error instanceof Error ? error.message : 'Failed to delete payment',
      500,
      error
    );
  }
}