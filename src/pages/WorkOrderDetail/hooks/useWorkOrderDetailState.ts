import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useWorkOrder, useSubmitWorkOrder, useApproveWorkOrder, useRejectWorkOrder,
  useUpdateWorkOrder, useCompleteWorkOrder, useAddCostItem, useDeleteCostItem,
  type CostCategory,
} from '@/hooks/useWorkOrders';

export function useWorkOrderDetailState() {
  const { id } = useParams<{ id: string }>();
  const { data: wo, isLoading } = useWorkOrder(id);

  const submitWO = useSubmitWorkOrder();
  const approveWO = useApproveWorkOrder();
  const rejectWO = useRejectWorkOrder();
  const updateWO = useUpdateWorkOrder();
  const completeWO = useCompleteWorkOrder();
  const addCost = useAddCostItem();
  const deleteCost = useDeleteCostItem();

  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [approvedBudget, setApprovedBudget] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [costForm, setCostForm] = useState({
    description: '', category: 'labour' as CostCategory,
    amount: '', vat_amount: '', is_estimated: false,
  });

  const handleApprove = async () => {
    if (!wo || !approvedBudget) return;
    await approveWO.mutateAsync({ id: wo.id, approvedBudget: parseFloat(approvedBudget) });
    setShowApprove(false);
  };

  const handleReject = async () => {
    if (!wo || !rejectReason) return;
    await rejectWO.mutateAsync({ id: wo.id, reason: rejectReason });
    setShowReject(false);
  };

  const handleRecordInvoice = async () => {
    if (!wo) return;
    await updateWO.mutateAsync({
      id: wo.id, status: 'invoiced',
      invoice_reference: invoiceRef || null,
      invoice_amount: invoiceAmount ? parseFloat(invoiceAmount) : null,
      invoice_date: new Date().toISOString().split('T')[0],
    });
    setShowInvoice(false);
  };

  const handleAddCost = async () => {
    if (!wo || !costForm.description || !costForm.amount) return;
    await addCost.mutateAsync({
      work_order_id: wo.id,
      description: costForm.description,
      category: costForm.category,
      amount: parseFloat(costForm.amount),
      vat_amount: costForm.vat_amount ? parseFloat(costForm.vat_amount) : 0,
      is_estimated: costForm.is_estimated,
    });
    setCostForm({ description: '', category: 'labour', amount: '', vat_amount: '', is_estimated: false });
    setShowAddCost(false);
  };

  const openApproveFromBudget = () => {
    if (!wo) return;
    setApprovedBudget(String(wo.estimated_cost || ''));
    setShowApprove(true);
  };

  return {
    wo, isLoading,
    submitWO, approveWO, rejectWO, updateWO, completeWO, addCost, deleteCost,
    showApprove, setShowApprove, showReject, setShowReject,
    showInvoice, setShowInvoice, showAddCost, setShowAddCost,
    approvedBudget, setApprovedBudget, rejectReason, setRejectReason,
    invoiceRef, setInvoiceRef, invoiceAmount, setInvoiceAmount,
    costForm, setCostForm,
    handleApprove, handleReject, handleRecordInvoice, handleAddCost,
    openApproveFromBudget,
  };
}

export type WorkOrderDetailState = ReturnType<typeof useWorkOrderDetailState>;
