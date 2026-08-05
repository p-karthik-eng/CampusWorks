import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  Divider,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  TextField,
  Stack
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  Assignment,
  Schedule,
  AttachMoney,
  Category,
  Person,
  Payment as PaymentIcon,
  TaskAlt,
  Info,
  Shield,
  Chat,
  Warning,
  CheckCircle,
  PlayCircleFilled,
  Lock,
  LockOpen
} from '@mui/icons-material';
import Layout from '@components/templates/Layout';
import ChatButton from '@components/chat/ChatButton';
import { selectAuth } from '@store/slices/authSlice';
import { ROUTES, CATEGORY_LABELS } from '@constants';
import apiService from '@services/api';
import { showEmailSuccessToast, showEmailErrorToast } from '@services/toastService';
import { isDeadlineExpired, getDeadlineWarning, getDeadlineStatusColor } from '@utils/deadlineUtils';
import CountdownTimer from '@components/common/CountdownTimer';

const TaskDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector(selectAuth);
  
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [taskBids, setTaskBids] = useState([]);
  const [canEditDelete, setCanEditDelete] = useState(false);
  
  // Escrow payment state
  const [payment, setPayment] = useState(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [acceptedBid, setAcceptedBid] = useState(null);
  
  // Action state dialogues
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [acceptWorkDialogOpen, setAcceptWorkDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  
  const [processingAction, setProcessingAction] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTaskDetails();
      fetchPaymentDetails();
    }
  }, [id]);

  // Update canEditDelete when task or bids change
  useEffect(() => {
    if (task && taskBids) {
      const canEdit = checkCanEditDelete(task, taskBids);
      setCanEditDelete(canEdit);
    }
  }, [task, taskBids]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.tasks.getById(id);
      if (response && response.data) {
        setTask(response.data);
        await fetchTaskBids();
        
        // Fetch accepted bid details if the task is active
        if (response.data.status !== 'OPEN' && response.data.status !== 'CANCELLED') {
          const bidRes = await apiService.bids.getAcceptedBid(id).catch(() => null);
          if (bidRes?.data) {
            setAcceptedBid(bidRes.data);
          }
        }
      } else {
        setError('Task not found.');
      }
    } catch (err) {
      console.error('Error fetching task details:', err);
      if (err.response?.status === 404) {
        setError('Task not found.');
      } else {
        setError(`Failed to load task: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentDetails = async () => {
    try {
      setLoadingPayment(true);
      const res = await apiService.payments.getByContract(id);
      if (res && res.data) {
        setPayment(res.data);
      } else {
        setPayment(null);
      }
    } catch (err) {
      console.warn('No active payment or failed to load payment:', err.message);
      setPayment(null);
    } finally {
      setLoadingPayment(false);
    }
  };

  const fetchTaskBids = async () => {
    try {
      const response = await apiService.bids.getByTask(id);
      setTaskBids(response.data || []);
    } catch (err) {
      console.error('Error fetching task bids:', err);
      setTaskBids([]);
    }
  };

  const checkCanEditDelete = (task, bids) => {
    if (task.status !== 'OPEN') return false;
    if (!isBiddingDeadlinePassed(task.biddingDeadline)) return false;
    return bids.length === 0;
  };

  const isBiddingDeadlinePassed = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const handleEditTask = () => {
    navigate(`${ROUTES.EDIT_TASK.replace(':id', id)}`);
  };

  const handleDeleteTask = async () => {
    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      try {
        setDeleting(true);
        await apiService.tasks.delete(id);
        dispatch(showEmailSuccessToast('task_deleted'));
        navigate(ROUTES.MY_TASKS);
      } catch (err) {
        console.error('Error deleting task:', err);
        setError(err.response?.data?.message || 'Failed to delete task.');
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // 1. Pay securely to hold in Escrow
  const handleDepositEscrow = async () => {
    try {
      setProcessingAction(true);
      const res = await apiService.payments.depositEscrow(id);
      if (res.data) {
        dispatch(showEmailSuccessToast('payment_successful'));
        setPayDialogOpen(false);
        // Refresh details
        await fetchTaskDetails();
        await fetchPaymentDetails();
      }
    } catch (err) {
      console.error('Error funding escrow:', err);
      alert(err.response?.data?.message || 'Failed to fund escrow. Please try again.');
    } finally {
      setProcessingAction(false);
    }
  };

  // 2. Worker marks task completed
  const handleMarkWorkCompleted = async () => {
    if (window.confirm('Are you sure you want to mark this task as completed? This will request the owner to release the escrow payment.')) {
      try {
        setProcessingAction(true);
        const res = await apiService.tasks.complete(id);
        if (res.data) {
          dispatch(showEmailSuccessToast('work_submitted'));
          await fetchTaskDetails();
        }
      } catch (err) {
        console.error('Error marking completed:', err);
        alert(err.response?.data?.message || 'Failed to mark completed.');
      } finally {
        setProcessingAction(false);
      }
    }
  };

  // 3. Requester accepts work to release escrow funds
  const handleConfirmAcceptWork = async () => {
    try {
      setProcessingAction(true);
      const res = await apiService.payments.releaseEscrow(id);
      if (res.data) {
        setSuccessAnimation(true);
        setAcceptWorkDialogOpen(false);
        dispatch(showEmailSuccessToast('work_accepted'));
        
        // Refresh data
        await fetchTaskDetails();
        await fetchPaymentDetails();
      }
    } catch (err) {
      console.error('Error releasing escrow:', err);
      alert(err.response?.data?.message || 'Failed to release payment.');
    } finally {
      setProcessingAction(false);
    }
  };

  // 4. Requester raises a dispute
  const handleConfirmDispute = async () => {
    if (!disputeReason.trim()) {
      alert('Please provide a reason for raising an issue.');
      return;
    }
    try {
      setProcessingAction(true);
      const res = await apiService.tasks.updateStatus(id, 'DISPUTED');
      if (res.data) {
        alert('Dispute raised successfully. CampusWorks moderators will review this task.');
        setDisputeDialogOpen(false);
        await fetchTaskDetails();
      }
    } catch (err) {
      console.error('Error raising dispute:', err);
      alert(err.response?.data?.message || 'Failed to raise dispute.');
    } finally {
      setProcessingAction(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOwner = user?.email === task?.ownerEmail;
  const isAssignedWorker = user?.email === task?.assignedUserEmail;

  // Timeline tracking configuration
  const getTimelineSteps = () => {
    const isAccepted = task.status !== 'OPEN' && task.status !== 'CANCELLED';
    const isSecured = payment?.paymentStatus === 'ESCROW_HELD' || payment?.paymentStatus === 'RELEASED';
    const isWip = isSecured && (task.status === 'IN_PROGRESS' || task.status === 'ASSIGNED');
    const isCompletedByWorker = task.status === 'PENDING_CONFIRMATION' || task.status === 'COMPLETED' || task.status === 'ACCEPTED';
    const isVerifying = task.status === 'PENDING_CONFIRMATION';
    const isReleased = payment?.paymentStatus === 'RELEASED';
    const isDone = task.status === 'COMPLETED' || task.status === 'ACCEPTED';

    const steps = [
      { label: 'Bid Accepted', active: isAccepted, completed: isSecured },
      { label: 'Payment Secured', active: isSecured, completed: isWip || isCompletedByWorker },
      { label: 'Work In Progress', active: isWip, completed: isCompletedByWorker },
      { label: 'Worker Completed', active: isCompletedByWorker, completed: isDone },
      { label: 'Verification', active: isVerifying, completed: isDone },
      { label: 'Payment Released', active: isReleased, completed: isDone },
      { label: 'Completed', active: isDone, completed: isDone }
    ];

    let activeStepIdx = 0;
    if (isDone) {
      activeStepIdx = 6;
    } else if (isReleased) {
      activeStepIdx = 5;
    } else if (isVerifying) {
      activeStepIdx = 4;
    } else if (isCompletedByWorker) {
      activeStepIdx = 3;
    } else if (isWip) {
      activeStepIdx = 2;
    } else if (isSecured) {
      activeStepIdx = 1;
    } else if (isAccepted) {
      activeStepIdx = 0;
    }

    return { steps, activeStepIdx };
  };

  if (loading) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={60} />
        </Container>
      </Layout>
    );
  }

  if (error || !task) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error || 'Task not found.'}
          </Alert>
          <Button variant="contained" onClick={handleGoBack} startIcon={<ArrowBack />}>
            Go Back
          </Button>
        </Container>
      </Layout>
    );
  }

  const { steps, activeStepIdx } = task.status !== 'OPEN' && task.status !== 'CANCELLED' 
    ? getTimelineSteps() 
    : { steps: [], activeStepIdx: 0 };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header Back Button */}
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={handleGoBack} sx={{ bgcolor: 'white', border: '1px solid rgba(0,0,0,0.06)' }}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" fontWeight={800} color="#2C3E50" sx={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Contract Workroom
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Task ID: {task.id}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={2}>
            {isOwner && canEditDelete && (
              <>
                <Button variant="outlined" color="primary" onClick={handleEditTask} startIcon={<Edit />} sx={{ borderRadius: '10px' }}>
                  Edit
                </Button>
                <Button variant="outlined" color="error" onClick={handleDeleteTask} startIcon={<Delete />} sx={{ borderRadius: '10px' }}>
                  Delete
                </Button>
              </>
            )}
            {(isOwner || isAssignedWorker) && task.status !== 'OPEN' && (
              <ChatButton currentUser={user} taskTitle={task.title} recipientEmail={isOwner ? task.assignedUserEmail : task.ownerEmail} taskId={task.id} variant="contained" />
            )}
          </Box>
        </Box>

        {/* timeline tracker (only for active contracts) */}
        {task.status !== 'OPEN' && task.status !== 'CANCELLED' && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: '24px', border: '1px solid rgba(0,0,0,0.05)', bgcolor: 'white' }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Shield sx={{ fontSize: 18, color: '#31258E' }} /> ESCROW CONTRACT PROGRESS TIMELINE
            </Typography>
            <Stepper activeStep={activeStepIdx} alternativeLabel connector={<StepConnector sx={{ '& .MuiStepConnector-line': { borderColor: 'rgba(0,0,0,0.08)' } }} />}>
              {steps.map((step, idx) => (
                <Step key={idx} completed={step.completed}>
                  <StepLabel 
                    StepIconProps={{
                      sx: {
                        color: step.active ? '#31258E' : 'rgba(0,0,0,0.15)',
                        '&.Mui-active': { color: '#31258E' },
                        '&.Mui-completed': { color: '#4CAF50' }
                      }
                    }}
                  >
                    <Typography variant="caption" fontWeight={step.active ? 700 : 500} color={step.active ? '#31258E' : 'text.secondary'}>
                      {step.label}
                    </Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>
        )}

        <Grid container spacing={3}>
          {/* Main Details and Actions */}
          <Grid item xs={12} md={8}>
            <Stack spacing={3}>
              {/* Actions Box */}
              {task.status !== 'OPEN' && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', border: '1px solid', borderColor: 'rgba(49, 37, 142, 0.1)', bgcolor: '#F8F9FA' }}>
                  <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 2 }}>
                    Escrow Operations
                  </Typography>

                  {/* Requester Workflows */}
                  {isOwner && (
                    <Box>
                      {/* Awaiting Escrow Deposit */}
                      {(!payment || payment.paymentStatus === 'PENDING') && (
                        <Box>
                          <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
                            <strong>Payment Required:</strong> You have accepted a worker for this task. Secure the escrow payment below so that the worker can safely start.
                          </Alert>
                          <Button 
                            variant="contained" 
                            color="primary" 
                            size="large"
                            onClick={() => setPayDialogOpen(true)}
                            startIcon={<Lock />}
                            sx={{ borderRadius: '12px', bgcolor: '#31258E', '&:hover': { bgcolor: '#221966' } }}
                          >
                            Pay Securely
                          </Button>
                        </Box>
                      )}

                      {/* Escrow Funded - Active WIP */}
                      {payment?.paymentStatus === 'ESCROW_HELD' && (task.status === 'IN_PROGRESS' || task.status === 'ASSIGNED') && (
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Chip icon={<CheckCircle sx={{ color: '#4CAF50 !important' }} />} label="ESCROW HELD" color="success" sx={{ fontWeight: 700 }} />
                          <Typography variant="body2" color="text.secondary">
                            CampusWorks is securely holding your payment. The worker can safely begin working.
                          </Typography>
                        </Box>
                      )}

                      {/* Worker Completed - Pending Verification */}
                      {task.status === 'PENDING_CONFIRMATION' && (
                        <Box>
                          <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
                            <strong>Verification Required:</strong> The worker has marked this task as completed. Please verify the completed work offline before releasing funds.
                          </Alert>
                          <Box display="flex" gap={2}>
                            <Button 
                              variant="contained" 
                              color="success" 
                              startIcon={<TaskAlt />}
                              onClick={() => setAcceptWorkDialogOpen(true)}
                              sx={{ borderRadius: '10px' }}
                            >
                              Accept Work (Release Payment)
                            </Button>
                            <Button 
                              variant="outlined" 
                              color="error" 
                              onClick={() => setDisputeDialogOpen(true)}
                              sx={{ borderRadius: '10px' }}
                            >
                              Raise Issue
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Worker Workflows */}
                  {isAssignedWorker && (
                    <Box>
                      {/* Awaiting Escrow Deposit */}
                      {(!payment || payment.paymentStatus === 'PENDING') && (
                        <Alert severity="info" icon={<Warning />} sx={{ borderRadius: '12px' }}>
                          <strong>Awaiting Escrow Deposit:</strong> Do not begin work until the requester funds the escrow account. CampusWorks will notify you once payment is secured.
                        </Alert>
                      )}

                      {/* Escrow Funded - Safe to Work */}
                      {payment?.paymentStatus === 'ESCROW_HELD' && (task.status === 'IN_PROGRESS' || task.status === 'ASSIGNED') && (
                        <Box>
                          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'rgba(76, 175, 80, 0.05)', borderRadius: '12px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                            <Box display="flex" alignItems="center" gap={1} color="#388E3C" sx={{ mb: 1 }}>
                              <CheckCircle fontSize="small" />
                              <Typography variant="subtitle2" fontWeight={700}>
                                Payment Secured
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              CampusWorks has secured the payment. You may safely begin working.
                            </Typography>
                          </Paper>
                          <Button 
                            variant="contained" 
                            color="primary"
                            onClick={handleMarkWorkCompleted}
                            disabled={processingAction}
                            sx={{ borderRadius: '10px', bgcolor: '#31258E', '&:hover': { bgcolor: '#221966' } }}
                          >
                            Mark Work as Completed
                          </Button>
                        </Box>
                      )}

                      {/* Worker Completed - Pending Verification */}
                      {task.status === 'PENDING_CONFIRMATION' && (
                        <Alert severity="info" sx={{ borderRadius: '12px' }}>
                          <strong>Pending Confirmation:</strong> You have submitted the completed task. Waiting for the task owner to review your work and release the payment.
                        </Alert>
                      )}
                    </Box>
                  )}

                  {/* Success Animation Area */}
                  {successAnimation && (
                    <Paper elevation={0} sx={{ p: 3, mt: 2, textAlign: 'center', bgcolor: 'rgba(76, 175, 80, 0.08)', borderRadius: '16px', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                      <CheckCircle sx={{ fontSize: 50, color: '#388E3C', mb: 1 }} />
                      <Typography variant="subtitle1" fontWeight={700} color="#388E3C">
                        Payment Released Successfully
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Funds have been transferred to the worker. Contract completed.
                      </Typography>
                    </Paper>
                  )}

                  {/* Completed Contract Lifecycle */}
                  {payment?.paymentStatus === 'RELEASED' && (
                    <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.05)', borderRadius: '12px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                      <Typography variant="subtitle2" color="#388E3C" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle /> CONTRACT FINALIZED & COMPLETED
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        This escrow contract has been successfully resolved. Funds have been released to the worker.
                      </Typography>
                    </Box>
                  )}

                  {/* Disputed state */}
                  {task.status === 'DISPUTED' && (
                    <Alert severity="error" icon={<Warning />} sx={{ borderRadius: '12px' }}>
                      <strong>Contract Disputed:</strong> An issue was raised regarding this contract. Escrow funds will remain locked until a CampusWorks moderator resolves the dispute.
                    </Alert>
                  )}
                </Paper>
              )}

              {/* Task Details Card */}
              <Paper elevation={0} sx={{ p: 4, borderRadius: '24px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                  <Box>
                    <Chip 
                      label={CATEGORY_LABELS[task.category] || task.category} 
                      size="small" 
                      sx={{ bgcolor: 'rgba(49, 37, 142, 0.05)', color: '#31258E', fontWeight: 600, mb: 1.5 }} 
                    />
                    <Typography variant="h5" fontWeight={750} color="#2C3E50">
                      {task.title}
                    </Typography>
                  </Box>
                  <Chip 
                    label={task.status} 
                    color={task.status === 'COMPLETED' || task.status === 'ACCEPTED' ? 'success' : 'warning'} 
                    sx={{ fontWeight: 700 }} 
                  />
                </Box>

                <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 4, lineHeight: 1.6 }}>
                  {task.description}
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Original Budget
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {formatCurrency(task.budget)}
                    </Typography>
                  </Grid>
                  {task.biddingDeadline && (
                    <Grid item xs={6} md={4.5}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Bidding End Date
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {formatDate(task.biddingDeadline)}
                      </Typography>
                    </Grid>
                  )}
                  {task.completionDeadline && (
                    <Grid item xs={6} md={4.5}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Work Deadline
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={600} color={getDeadlineStatusColor(task.completionDeadline)}>
                        {formatDate(task.completionDeadline)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Stack>
          </Grid>

          {/* Right Column: Escrow & Details */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* Payment details card */}
              {task.status !== 'OPEN' && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', bgcolor: 'white' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PaymentIcon /> Escrow Payment Card
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Contract Amount
                    </Typography>
                    <Typography variant="h5" fontWeight={850} color="#388E3C">
                      {formatCurrency(acceptedBid?.amount || task.budget)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Escrow Status:</Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {payment?.paymentStatus || 'AWAITING_FUNDING'}
                    </Typography>
                  </Box>

                  {payment?.transactionId && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Transaction Ref:</Typography>
                      <Typography variant="caption" fontWeight={600} sx={{ wordBreak: 'break-all' }}>
                        {payment.transactionId}
                      </Typography>
                    </Box>
                  )}

                  <Divider sx={{ my: 2 }} />

                  <Box display="flex" gap={1.5} sx={{ p: 1.5, bgcolor: 'rgba(33, 150, 243, 0.05)', borderRadius: '12px' }}>
                    <Shield sx={{ color: '#2196F3', fontSize: 24, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="#1976D2" display="block">
                        Protected By CampusWorks Escrow
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.725rem', lineHeight: 1.2, display: 'block', mt: 0.5 }}>
                        Your payment is securely held by CampusWorks and will only be released after successful work verification.
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              )}

              {/* Participants Card */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2 }}>
                  Contract Participants
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">Requester</Typography>
                  <Typography variant="body2" fontWeight={600}>{task.ownerEmail}</Typography>
                </Box>

                {task.assignedUserEmail ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Assigned Worker</Typography>
                    <Typography variant="body2" fontWeight={600}>{task.assignedUserEmail}</Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Worker Status</Typography>
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                      Awaiting lowest bid assignment
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Stack>
          </Grid>
        </Grid>

        {/* 1. Checkout Escrow Dialog */}
        <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Lock color="primary" /> Escrow Secure Deposit
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 3 }}>
              Confirm your escrow deposit. The payment will be securely held by CampusWorks and will only be released once you accept the completed work.
            </DialogContentText>
            <Box sx={{ p: 2.5, borderRadius: '12px', bgcolor: 'rgba(33, 150, 243, 0.05)', border: '1px solid rgba(33, 150, 243, 0.15)', mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Deposit Amount</Typography>
              <Typography variant="h5" fontWeight={800} color="primary.main">
                {formatCurrency(acceptedBid?.amount || task.budget)}
              </Typography>
            </Box>
            <Box display="flex" gap={1} alignItems="flex-start">
              <Shield sx={{ fontSize: 18, color: '#31258E', mt: 0.3 }} />
              <Typography variant="caption" color="text.secondary">
                Protected by CampusWorks Escrow protocol. Cancellation or refund requests will be reviewed by admin.
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleDepositEscrow} 
              disabled={processingAction}
              sx={{ bgcolor: '#31258E', '&:hover': { bgcolor: '#221966' } }}
            >
              {processingAction ? 'Processing...' : 'Confirm & Deposit'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 2. Accept Work Confirmation Dialog */}
        <Dialog open={acceptWorkDialogOpen} onClose={() => setAcceptWorkDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TaskAlt color="success" /> Accept Completed Work
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Are you sure you want to accept this work? This will release the secured escrow funds to the worker and finalize the contract.
            </DialogContentText>
            <Alert severity="warning" sx={{ borderRadius: '12px' }}>
              This action cannot be undone. Make sure you have verified the work offline before proceeding.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setAcceptWorkDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              color="success" 
              onClick={handleConfirmAcceptWork} 
              disabled={processingAction}
            >
              {processingAction ? 'Releasing...' : 'Confirm & Release'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 3. Raise Issue/Dispute Dialog */}
        <Dialog open={disputeDialogOpen} onClose={() => setDisputeDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="error" /> Raise Contract Issue
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Please describe the issue or incomplete work. CampusWorks moderators will review this contract and resolve the locked escrow funds.
            </DialogContentText>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Describe Issue"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Provide details about why the work was not accepted..."
            />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setDisputeDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              color="error" 
              onClick={handleConfirmDispute} 
              disabled={processingAction || !disputeReason.trim()}
            >
              {processingAction ? 'Submitting...' : 'Submit Issue'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default TaskDetailPage;
