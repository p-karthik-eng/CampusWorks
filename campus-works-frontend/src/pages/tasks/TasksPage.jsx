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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Assignment,
  Visibility,
  Gavel,
  Schedule,
  Search,
  Refresh,
  ArrowBack,
  CheckCircle,
  PlayCircleFilled,
  MonetizationOn,
  Clear,
  FilterList
} from '@mui/icons-material';
import Layout from '@components/templates/Layout';
import ChatButton from '@components/chat/ChatButton';
import { selectAuth } from '@store/slices/authSlice';
import { ROUTES, CATEGORY_LABELS, TASK_CATEGORIES } from '@constants';
import apiService from '@services/api';
import { showEmailSuccessToast, showEmailErrorToast } from '@services/toastService';

const TasksPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector(selectAuth);

  const queryParams = new URLSearchParams(location.search);
  const initialSection = queryParams.get('section') || 'available';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [userBids, setUserBids] = useState([]);
  const [taskBidCounts, setTaskBidCounts] = useState({});
  const [profileEarnings, setProfileEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Bid dialog states
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidProposal, setBidProposal] = useState('');
  const [placingBid, setPlacingBid] = useState(false);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Sync state with URL search param
  useEffect(() => {
    const section = queryParams.get('section');
    if (section && ['available', 'bids', 'active', 'completed'].includes(section)) {
      setActiveSection(section);
    }
  }, [location.search]);

  useEffect(() => {
    fetchMarketplaceData();
  }, [user?.email]);

  useEffect(() => {
    filterTasks();
  }, [tasks, categoryFilter, searchQuery, sortBy, sortOrder]);

  const fetchMarketplaceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all tasks
      const tasksRes = await apiService.tasks.getAll();
      const tasksData = tasksRes.data || [];
      setTasks(tasksData);

      // Fetch user's profile for earnings
      if (user?.email) {
        const profileRes = await apiService.profiles.getByUserEmail(user.email).catch(() => null);
        setProfileEarnings(profileRes?.data?.totalEarnings || 0);

        // Fetch user's submitted bids
        const bidsRes = await apiService.bids.getByUserEmail(user.email);
        setUserBids(bidsRes.data || []);
      }

      // Fetch bid counts for tasks
      const openTasks = tasksData.filter(t => t.status === 'OPEN');
      const countsMap = {};
      await Promise.all(
        openTasks.map(async (t) => {
          try {
            const res = await apiService.bids.getByTask(t.id);
            countsMap[t.id] = res.data?.length || 0;
          } catch (err) {
            countsMap[t.id] = 0;
          }
        })
      );
      setTaskBidCounts(countsMap);

    } catch (err) {
      console.error('Error fetching marketplace data:', err);
      setError('Failed to load marketplace information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`${ROUTES.TASKS}?section=${section}`, { replace: true });
  };

  const filterTasks = () => {
    let result = tasks.filter(task => task.status === 'OPEN' && task.ownerEmail !== user?.email);

    if (categoryFilter) {
      result = result.filter(task => task.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        task =>
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query)
      );
    }

    // Sort tasks
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'budget') {
        comparison = a.budget - b.budget;
      } else if (sortBy === 'biddingDeadline') {
        comparison = new Date(a.biddingDeadline) - new Date(b.biddingDeadline);
      } else {
        comparison = new Date(a.createdAt) - new Date(b.createdAt);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredTasks(result);
  };

  const handleOpenBidDialog = (task) => {
    setSelectedTask(task);
    setBidAmount('');
    setBidProposal('');
    setBidDialogOpen(true);
  };

  const handleCloseBidDialog = () => {
    setBidDialogOpen(false);
    setSelectedTask(null);
    setBidAmount('');
    setBidProposal('');
  };

  const handleSubmitBid = async () => {
    if (!bidAmount || !bidProposal.trim()) {
      alert('Please fill in both bid amount and proposal.');
      return;
    }

    const amountNum = parseFloat(bidAmount);
    if (amountNum <= 0) {
      alert('Bid amount must be a positive number.');
      return;
    }

    if (amountNum > selectedTask.budget) {
      alert(`Your bid amount (${formatCurrency(amountNum)}) cannot exceed the task budget (${formatCurrency(selectedTask.budget)}).`);
      return;
    }

    try {
      setPlacingBid(true);
      const bidData = {
        taskId: selectedTask.id,
        amount: amountNum,
        proposal: bidProposal.trim()
      };

      await apiService.bids.placeBid(bidData);
      dispatch(showEmailSuccessToast('bid_placed'));
      handleCloseBidDialog();
      
      // Refresh data
      await fetchMarketplaceData();
    } catch (err) {
      console.error('Error placing bid:', err);
      alert(err.response?.data?.message || 'Failed to place bid. Please try again.');
    } finally {
      setPlacingBid(false);
    }
  };

  const handleDeleteBid = async (bidId) => {
    if (window.confirm('Are you sure you want to withdraw this bid?')) {
      try {
        setActionLoading(true);
        await apiService.bids.delete(bidId);
        dispatch(showEmailSuccessToast('bid_deleted'));
        await fetchMarketplaceData();
      } catch (err) {
        console.error('Error deleting bid:', err);
        alert(err.response?.data?.message || 'Failed to withdraw bid.');
      } finally {
        setActionLoading(false);
      }
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Categorize lists for worker
  const activeWork = tasks.filter(t => 
    t.assignedUserEmail === user?.email && 
    (t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED' || t.status === 'PENDING_CONFIRMATION')
  );

  const completedWork = tasks.filter(t => 
    t.assignedUserEmail === user?.email && 
    (t.status === 'COMPLETED' || t.status === 'ACCEPTED')
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
            Work Marketplace
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Discover tasks and earn money using your campus skills.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Worker Navigation Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            {
              id: 'available',
              title: 'Available Tasks',
              desc: `${filteredTasks.length} jobs open for bid`,
              icon: <Search sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#31258E',
              onClick: () => handleSectionChange('available')
            },
            {
              id: 'bids',
              title: 'My Bids',
              desc: `${userBids.length} bids submitted`,
              icon: <Gavel sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#FF9800',
              onClick: () => handleSectionChange('bids')
            },
            {
              id: 'active',
              title: 'Active Work',
              desc: `${activeWork.length} jobs in progress`,
              icon: <PlayCircleFilled sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#4CAF50',
              onClick: () => handleSectionChange('active')
            },
            {
              id: 'completed',
              title: 'Completed Work',
              desc: `${completedWork.length} finalized gigs`,
              icon: <CheckCircle sx={{ fontSize: 32 }} />,
              bg: 'white',
              color: '#9C27B0',
              onClick: () => handleSectionChange('completed')
            },
            {
              id: 'earnings',
              title: 'Earnings Balance',
              desc: `${formatCurrency(profileEarnings)} earned`,
              icon: <MonetizationOn sx={{ fontSize: 32 }} />,
              bg: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
              color: 'white',
              onClick: () => {}
            }
          ].map((card) => {
            const isSelected = activeSection === card.id;
            const isStatic = card.id === 'earnings';
            
            return (
              <Grid item xs={6} md={2.4} key={card.id}>
                <Paper
                  onClick={isStatic ? undefined : card.onClick}
                  sx={{
                    p: 2.5,
                    height: '100%',
                    cursor: isStatic ? 'default' : 'pointer',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: isSelected ? '#31258E' : 'rgba(0, 0, 0, 0.05)',
                    background: card.bg,
                    color: card.color === 'white' ? 'white' : 'text.primary',
                    boxShadow: isSelected ? '0 10px 25px rgba(49, 37, 142, 0.15)' : 'none',
                    transition: isStatic ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': {
                      transform: isStatic ? 'none' : 'translateY(-4px)',
                      boxShadow: isStatic ? 'none' : '0 12px 25px rgba(0, 0, 0, 0.06)',
                      borderColor: isSelected || isStatic ? 'transparent' : 'rgba(0, 0, 0, 0.1)'
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
          
          {/* 1. Available Tasks Sub-section (With Search & Filters) */}
          {activeSection === 'available' && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight={700} color="#2C3E50">
                  Find Work
                </Typography>
                <Button 
                  startIcon={<Refresh />} 
                  onClick={fetchMarketplaceData} 
                  variant="outlined" 
                  size="small"
                  sx={{ borderRadius: '8px' }}
                >
                  Refresh
                </Button>
              </Box>

              {/* Filters Block */}
              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {Object.keys(TASK_CATEGORIES).map((catKey) => (
                        <MenuItem key={catKey} value={catKey}>
                          {CATEGORY_LABELS[catKey]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      label="Sort By"
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <MenuItem value="createdAt">Date Posted</MenuItem>
                      <MenuItem value="budget">Budget</MenuItem>
                      <MenuItem value="biddingDeadline">Bidding Deadline</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Order</InputLabel>
                    <Select
                      value={sortOrder}
                      label="Order"
                      onChange={(e) => setSortOrder(e.target.value)}
                    >
                      <MenuItem value="asc">Ascending</MenuItem>
                      <MenuItem value="desc">Descending</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {filteredTasks.length === 0 ? (
                <EmptyState 
                  title="No Tasks Found" 
                  desc="Try adjusting your filters or search term to discover other open campus gigs." 
                />
              ) : (
                <Grid container spacing={3}>
                  {filteredTasks.map((task) => {
                    const bidCount = taskBidCounts[task.id] || 0;
                    const hasUserBid = userBids.some(b => b.taskId === task.id);
                    
                    return (
                      <Grid item xs={12} sm={6} md={4} key={task.id}>
                        <Card 
                          elevation={0} 
                          sx={{ 
                            borderRadius: '16px', 
                            border: '1px solid rgba(0,0,0,0.06)',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
                              borderColor: '#31258E'
                            }
                          }}
                        >
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" sx={{ mb: 1.5 }}>
                              <Chip 
                                label={CATEGORY_LABELS[task.category] || task.category} 
                                size="small" 
                                sx={{ bgcolor: 'rgba(49, 37, 142, 0.05)', color: '#31258E', fontWeight: 600 }}
                              />
                              <Typography variant="subtitle2" fontWeight={800} color="#388E3C">
                                {formatCurrency(task.budget)}
                              </Typography>
                            </Box>
                            <Typography variant="h6" fontWeight={700} gutterBottom noWrap>
                              {task.title}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              color="text.secondary" 
                              sx={{ 
                                mb: 2, 
                                display: '-webkit-box', 
                                WebkitLineBreak: 'auto', 
                                WebkitLineClamp: 3, 
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                height: '60px'
                              }}
                            >
                              {task.description}
                            </Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Gavel fontSize="small" color="action" />
                                <Typography variant="caption" color="text.secondary">
                                  {bidCount} bids
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                Ends: {formatDate(task.biddingDeadline)}
                              </Typography>
                            </Box>
                          </CardContent>
                          <Box sx={{ p: 2, pt: 0 }}>
                            {hasUserBid ? (
                              <Button 
                                fullWidth 
                                variant="outlined" 
                                color="warning"
                                onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', task.id))}
                                sx={{ borderRadius: '8px', textTransform: 'none' }}
                              >
                                View Submitted Bid
                              </Button>
                            ) : (
                              <Button 
                                fullWidth 
                                variant="contained" 
                                color="primary"
                                onClick={() => handleOpenBidDialog(task)}
                                sx={{ borderRadius: '8px', textTransform: 'none', bgcolor: '#31258E', '&:hover': { bgcolor: '#221966' } }}
                              >
                                Bid on Task
                              </Button>
                            )}
                          </Box>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          )}

          {/* 2. My Bids Sub-section */}
          {activeSection === 'bids' && (
            <Box>
              <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 3 }}>
                Submitted Bids
              </Typography>
              {userBids.length === 0 ? (
                <EmptyState 
                  title="No Bids Yet" 
                  desc="Browse available tasks to start submitting bids and earn money." 
                  actionLabel="Search Tasks"
                  onAction={() => handleSectionChange('available')}
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Task Title</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Bid Amount</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Proposal</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {userBids.map((bid) => (
                        <TableRow key={bid.id} hover>
                          <TableCell>
                            <Typography 
                              variant="subtitle2" 
                              fontWeight={700}
                              color="primary"
                              onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', bid.taskId))}
                              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {bid.taskTitle || `Task #${bid.taskId}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Submitted: {formatDate(bid.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(bid.amount)}</TableCell>
                          <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bid.proposal}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={bid.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" justifyContent="flex-end" gap={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', bid.taskId))}
                                sx={{ borderRadius: '8px', textTransform: 'none' }}
                              >
                                Details
                              </Button>
                              {bid.status === 'PENDING' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  disabled={actionLoading}
                                  onClick={() => handleDeleteBid(bid.id)}
                                  sx={{ borderRadius: '8px', textTransform: 'none' }}
                                >
                                  Withdraw
                                </Button>
                              )}
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

          {/* 3. Active Work Sub-section */}
          {activeSection === 'active' && (
            <Box>
              <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 3 }}>
                Active Work (Contracts In Progress)
              </Typography>
              {activeWork.length === 0 ? (
                <EmptyState 
                  title="No Active Work" 
                  desc="Submit bids and win projects. You will be able to complete tasks and receive escrow payments here." 
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Task Title</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Requester</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Contract Price</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeWork.map((task) => (
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
                          <TableCell>{task.ownerEmail}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#388E3C' }}>{formatCurrency(task.budget)}</TableCell>
                          <TableCell>
                            <StatusBadge status={task.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" justifyContent="flex-end" gap={1}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => navigate(ROUTES.TASK_DETAIL.replace(':id', task.id))}
                                sx={{ borderRadius: '8px', textTransform: 'none', bgcolor: '#31258E', '&:hover': { bgcolor: '#221966' } }}
                              >
                                View Contract
                              </Button>
                              <ChatButton currentUser={user} taskTitle={task.title} recipientEmail={task.ownerEmail} taskId={task.id} size="small" />
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

          {/* 4. Completed Work Sub-section */}
          {activeSection === 'completed' && (
            <Box>
              <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ mb: 3 }}>
                Completed Work & Earnings
              </Typography>
              {completedWork.length === 0 ? (
                <EmptyState 
                  title="No Completed Tasks" 
                  desc="Completed gigs and earnings history will appear here once requesters release escrow funds." 
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Task Title</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Payer</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Earnings Released</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {completedWork.map((task) => (
                        <TableRow key={task.id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {task.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Completed: {formatDate(task.completedAt || task.updatedAt)}
                            </Typography>
                          </TableCell>
                          <TableCell>{task.ownerEmail}</TableCell>
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
                              View Contract
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

        {/* Place Bid Dialog */}
        <Dialog open={bidDialogOpen} onClose={handleCloseBidDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            Place Bid on "{selectedTask?.title}"
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Bid Amount (₹)"
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                sx={{ mb: 3 }}
                placeholder="Enter your bid amount"
                helperText={`Task Budget: ${selectedTask ? formatCurrency(selectedTask.budget) : ''} | Your bid must be positive and not exceed the budget.`}
                inputProps={{ 
                  min: 0.01, 
                  step: 0.01
                }}
                error={bidAmount && parseFloat(bidAmount) <= 0}
              />
              
              <TextField
                fullWidth
                label="Proposal"
                multiline
                rows={4}
                value={bidProposal}
                onChange={(e) => setBidProposal(e.target.value)}
                placeholder="Describe how you will complete this task..."
                helperText="Explain your approach and why you're the best fit for this task"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseBidDialog} disabled={placingBid}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitBid}
              variant="contained"
              disabled={placingBid || !bidAmount || !bidProposal.trim() || parseFloat(bidAmount) <= 0}
              sx={{ bgcolor: '#31258E', '&:hover': { bgcolor: '#221966' } }}
            >
              {placingBid ? 'Submitting...' : 'Submit Bid'}
            </Button>
          </DialogActions>
        </Dialog>
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
    label = 'Open for Bidding';
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
  } else if (status === 'PENDING') {
    label = 'Pending Review';
    color = 'warning';
  } else if (status === 'ACCEPTED') {
    label = 'Winning Bid';
    color = 'success';
  } else if (status === 'REJECTED') {
    label = 'Not Selected';
    color = 'error';
  } else if (status === 'WITHDRAWN') {
    label = 'Withdrawn';
    color = 'default';
  }
  
  return <Chip label={label} size="small" color={color} sx={{ fontWeight: 600 }} />;
};

export default TasksPage;