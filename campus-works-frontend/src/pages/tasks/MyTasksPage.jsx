import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Assignment,
  Edit,
  Delete,
  Visibility,
  Add,
  Publish,
  Info,
  Payment,
  Chat,
  ArrowBack,
  CheckCircle,
  PlayCircleFilled,
  Gavel,
  Warning,
  PlusOne
} from '@mui/icons-material';
import Layout from '@components/templates/Layout';
import ChatButton from '@components/chat/ChatButton';
import { selectAuth } from '@store/slices/authSlice';
import { ROUTES, CATEGORY_LABELS, TASK_STATUS } from '@constants';
import apiService from '@services/api';
import { showEmailSuccessToast, showEmailErrorToast } from '@services/toastService';

const MyTasksPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector(selectAuth);
  
  const queryParams = new URLSearchParams(location.search);
  const initialSection = queryParams.get('section') || 'tasks';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [tasks, setTasks] = useState([]);
  const [taskBids, setTaskBids] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [acceptingBidId, setAcceptingBidId] = useState(null);

  // Sync state with URL search param
  useEffect(() => {
    const section = queryParams.get('section');
    if (section && ['tasks', 'bids', 'assigned', 'completed'].includes(section)) {
      setActiveSection(section);
    }
  }, [location.search]);

  useEffect(() => {
    if (user?.email) {
      fetchMyTasksData();
    }
  }, [user?.email]);

  const fetchMyTasksData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.tasks.getByOwnerEmail(user.email);
      const tasksData = response.data || [];
      setTasks(tasksData);
      
      // Fetch bids for all tasks
      const bidsPromises = tasksData.map(async (task) => {
        try {
          const bidsResponse = await apiService.bids.getByTask(task.id);
          return { taskId: task.id, bids: bidsResponse.data || [] };
        } catch (err) {
          console.error(`Error fetching bids for task ${task.id}:`, err);
          return { taskId: task.id, bids: [] };
        }
      });
      
      const bidsResults = await Promise.all(bidsPromises);
      const bidsMap = {};
      bidsResults.forEach(({ taskId, bids }) => {
        bidsMap[taskId] = bids;
      });
      
      setTaskBids(bidsMap);
    } catch (err) {
      console.error('Error loading requester tasks:', err);
      setError('Failed to load your tasks and bids. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`${ROUTES.MY_TASKS}?section=${section}`, { replace: true });
  };

  const handleAcceptBid = async (bidId, taskId) => {
    try {
      setAcceptingBidId(bidId);
      setActionLoading(true);
      
      // Accept specific bid
      const response = await apiService.bids.accept(bidId);
      if (response.data) {
        dispatch(showEmailSuccessToast('bid_accepted'));
        
        // Refresh data
        await fetchMyTasksData();
        
        // Navigate to contract/task details page to complete payment
        navigate(`${ROUTES.TASK_DETAIL.replace(':id', taskId)}`);
      }
    } catch (err) {
      console.error('Error accepting bid:', err);
      setError(err.response?.data?.message || 'Failed to accept bid. Please try again.');
      dispatch(showEmailErrorToast('bid_accepted'));
    } finally {
      setAcceptingBidId(null);
      setActionLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        setActionLoading(true);
        await apiService.tasks.delete(taskId);
        setTasks(tasks.filter(task => task.id !== taskId));
        setError(null);
        dispatch(showEmailSuccessToast('task_deleted'));
      } catch (err) {
        console.error('Error deleting task:', err);
        const errMsg = err.response?.data?.message || err.message || 'Failed to delete task.';
        if (errMsg.includes('bids already exist')) {
          setError('You cannot delete this task because bids already exist.');
        } else {
          setError(`Failed to delete task: ${errMsg}`);
        }
      } finally {
        setActionLoading(false);
      }
    }
  };

  const isBiddingDeadlinePassed = (deadline) => {
    return new Date(deadline) < new Date();
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Lists categorization
  const allReceivedBids = [];
  tasks.forEach(task => {
    const bids = taskBids[task.id] || [];
    bids.forEach(bid => {
      if (bid.status !== 'WITHDRAWN') {
        allReceivedBids.push({ ...bid, taskTitle: task.title, taskBudget: task.budget });
      }
    });
  });

  const assignedTasks = tasks.filter(t => 
    t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED' || t.status === 'PENDING_CONFIRMATION'
  );

  const completedTasks = tasks.filter(t => 
    t.status === 'COMPLETED' || t.status === 'ACCEPTED'
  );

  if (loading) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={60} />
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={800} color="#2C3E50" gutterBottom sx={{ letterSpacing: '-0.02em' }}>
            Task Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage the work you've posted and collaborate with workers.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Requester Navigation Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            {
              id: 'create',
              title: 'Create Task',
              desc: 'Post a new job',
              icon: <Add sx={{ fontSize: 32 }} />,
              bg: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
              color: 'white',
              onClick: () => navigate(ROUTES.CREATE_TASK)
            },
            {
              id: 'tasks',
              title: 'My Tasks',
              desc: `${tasks.length} tasks posted`,
              icon: <Assignment sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#31258E',
              onClick: () => handleSectionChange('tasks')
            },
            {
              id: 'bids',
              title: 'Received Bids',
              desc: `${allReceivedBids.length} pending bids`,
              icon: <Gavel sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#FF9800',
              onClick: () => handleSectionChange('bids')
            },
            {
              id: 'assigned',
              title: 'Assigned Tasks',
              desc: `${assignedTasks.length} in progress`,
              icon: <PlayCircleFilled sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#4CAF50',
              onClick: () => handleSectionChange('assigned')
            },
            {
              id: 'completed',
              title: 'Completed Contracts',
              desc: `${completedTasks.length} finalized`,
              icon: <CheckCircle sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#9C27B0',
              onClick: () => handleSectionChange('completed')
            }
          ].map((card) => {
            const isSelected = activeSection === card.id;
            const isInteractive = card.id !== 'create';
            
            return (
              <Grid item xs={6} md={2.4} key={card.id}>
                <Paper
                  onClick={card.onClick}
                  sx={{
                    p: 2.5,
                    height: '100%',
                    cursor: 'pointer',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: isSelected ? '#31258E' : 'rgba(0, 0, 0, 0.05)',
                    background: card.bg,
                    color: card.color === 'white' ? 'white' : 'text.primary',
                    boxShadow: isSelected ? '0 10px 25px rgba(49, 37, 142, 0.15)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: card.id === 'create' 
                        ? '0 12px 30px rgba(25, 118, 210, 0.3)' 
                        : '0 12px 25px rgba(0, 0, 0, 0.06)',
                      borderColor: isSelected ? '#31258E' : 'rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  <Box 
                    sx={{ 
                      p: 1, 
                      borderRadius: '12px', 
                      bgcolor: card.color === 'white' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0,0,0,0.03)',
                      color: card.color === 'white' ? 'white' : card.color,
                      alignSelf: 'flex-start',
                      display: 'flex'
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.5, display: 'block' }}>
                      {card.desc}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <Divider sx={{ mb: 4 }} />

        {/* Render Active Sub-section */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: '24px', border: '1px solid rgba(0,0,0,0.04)', bgcolor: 'white' }}>
          
          {/* 1. All Tasks Sub-section */}
          {activeSection === 'tasks' && (
            <Box>
              <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 3 }}>
                All Posted Tasks
              </Typography>
              {tasks.length === 0 ? (
                <EmptyState 
                  title="No Tasks Posted" 
                  desc="Create your first task to find skilled campus peers who can help you." 
                  actionLabel="Post Your First Task"
                  onAction={() => navigate(ROUTES.CREATE_TASK)}
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Budget</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Deadline</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Bids</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tasks.map((task) => {
                        const bidsCount = taskBids[task.id]?.length || 0;
                        return (
                          <TableRow key={task.id} hover>
                            <TableCell>
                              <Typography 
                                variant="subtitle2" 
                                fontWeight={700} 
                                color="primary" 
                                onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', task.id))}
                                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              >
                                {task.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {CATEGORY_LABELS[task.category] || task.category}
                              </Typography>
                            </TableCell>
                            <TableCell fontWeight={600}>{formatCurrency(task.budget)}</TableCell>
                            <TableCell>{formatDate(task.biddingDeadline)}</TableCell>
                            <TableCell>
                              <Chip label={`${bidsCount} bids`} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={task.status} />
                            </TableCell>
                            <TableCell align="right">
                              <Box display="flex" justifyContent="flex-end" gap={1}>
                                <Tooltip title="View Details">
                                  <IconButton size="small" onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', task.id))}>
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {task.status === 'OPEN' && (
                                  <>
                                    <Tooltip title="Edit Task">
                                      <IconButton size="small" onClick={() => navigate(ROUTES.EDIT_TASK.replace(':id', task.id))}>
                                        <Edit fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Task">
                                      <IconButton size="small" color="error" onClick={() => handleDeleteTask(task.id)}>
                                        <Delete fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* 2. Received Bids Sub-section */}
          {activeSection === 'bids' && (
            <Box>
              <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 3 }}>
                Received Bids
              </Typography>
              {allReceivedBids.length === 0 ? (
                <EmptyState 
                  title="No Bids Yet" 
                  desc="Bids submitted by other students on your open tasks will appear here." 
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Task</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Bidder</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Bid Amount</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Proposal</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allReceivedBids.map((bid) => (
                        <TableRow key={bid.id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {bid.taskTitle}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Budget: {formatCurrency(bid.taskBudget)}
                            </Typography>
                          </TableCell>
                          <TableCell>{bid.bidderEmail}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#388E3C' }}>{formatCurrency(bid.amount)}</TableCell>
                          <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bid.proposal}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={bid.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" justifyContent="flex-end" gap={1}>
                              {bid.status === 'PENDING' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  disabled={actionLoading}
                                  onClick={() => handleAcceptBid(bid.id, bid.taskId)}
                                  sx={{ borderRadius: '8px', textTransform: 'none' }}
                                >
                                  {acceptingBidId === bid.id ? 'Accepting...' : 'Accept Bid'}
                                </Button>
                              )}
                              <ChatButton currentUser={user} taskTitle={bid.taskTitle} recipientEmail={bid.bidderEmail} taskId={bid.taskId} size="small" />
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* 3. Assigned Tasks Sub-section */}
          {activeSection === 'assigned' && (
            <Box>
              <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 3 }}>
                Assigned Tasks (Active Work)
              </Typography>
              {assignedTasks.length === 0 ? (
                <EmptyState 
                  title="No Assigned Work" 
                  desc="Accept worker bids to get started. You will be able to fund and manage contracts here." 
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Assigned Worker</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Price</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {assignedTasks.map((task) => (
                        <TableRow key={task.id} hover>
                          <TableCell>
                            <Typography 
                              variant="subtitle2" 
                              fontWeight={700} 
                              color="primary" 
                              onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', task.id))}
                              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {task.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Deadline: {formatDate(task.completionDeadline)}
                            </Typography>
                          </TableCell>
                          <TableCell>{task.assignedUserEmail}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(task.budget)}</TableCell>
                          <TableCell>
                            <StatusBadge status={task.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" justifyContent="flex-end" gap={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', task.id))}
                                sx={{ borderRadius: '8px', textTransform: 'none' }}
                              >
                                View Contract
                              </Button>
                              <ChatButton currentUser={user} taskTitle={task.title} recipientEmail={task.assignedUserEmail} taskId={task.id} size="small" />
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* 4. Completed Contracts Sub-section */}
          {activeSection === 'completed' && (
            <Box>
              <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 3 }}>
                Completed Contracts
              </Typography>
              {completedTasks.length === 0 ? (
                <EmptyState 
                  title="No Completed Contracts" 
                  desc="Contracts will appear here after workers complete tasks and you release escrow payments." 
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Worker</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Final Price</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {completedTasks.map((task) => (
                        <TableRow key={task.id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {task.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Category: {CATEGORY_LABELS[task.category] || task.category}
                            </Typography>
                          </TableCell>
                          <TableCell>{task.assignedUserEmail}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#388E3C' }}>{formatCurrency(task.budget)}</TableCell>
                          <TableCell>
                            <StatusBadge status={task.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', task.id))}
                              sx={{ borderRadius: '8px', textTransform: 'none' }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Paper>
      </Container>
    </Layout>
  );
};

// Reusable Empty State component
const EmptyState = ({ title, desc, actionLabel, onAction }) => (
  <Box 
    display="flex" 
    flexDirection="column" 
    alignItems="center" 
    justifyContent="center" 
    sx={{ py: 6, px: 2, textAlign: 'center' }}
  >
    <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'rgba(49, 37, 142, 0.04)', color: '#31258E', mb: 2 }}>
      <Assignment sx={{ fontSize: 48 }} />
    </Box>
    <Typography variant="h6" fontWeight={700} color="#2C3E50">
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 400 }}>
      {desc}
    </Typography>
    {actionLabel && (
      <Button 
        variant="contained" 
        onClick={onAction}
        startIcon={<Add />}
        sx={{
          borderRadius: '12px',
          bgcolor: '#31258E',
          px: 3,
          py: 1,
          '&:hover': { bgcolor: '#221966' }
        }}
      >
        {actionLabel}
      </Button>
    )}
  </Box>
);

// Reusable Status Badge component
const StatusBadge = ({ status }) => {
  let label = status;
  let color = 'default';
  
  if (status === 'OPEN') {
    label = 'Open for Bids';
    color = 'primary';
  } else if (status === 'IN_PROGRESS' || status === 'ASSIGNED') {
    label = 'In Progress';
    color = 'warning';
  } else if (status === 'PENDING_CONFIRMATION') {
    label = 'Pending Verification';
    color = 'info';
  } else if (status === 'COMPLETED' || status === 'ACCEPTED') {
    label = 'Completed';
    color = 'success';
  } else if (status === 'CANCELLED') {
    label = 'Cancelled';
    color = 'error';
  }
  
  return <Chip label={label} size="small" color={color} sx={{ fontWeight: 600 }} />;
};

export default MyTasksPage;
