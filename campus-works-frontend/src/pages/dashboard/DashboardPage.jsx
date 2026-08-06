import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  Container, 
  Typography, 
  Paper, 
  Grid, 
  Button, 
  Box, 
  Chip, 
  Card, 
  CardContent, 
  Divider,
  CircularProgress,
  useTheme
} from '@mui/material';
import { 
  Add, 
  Assignment, 
  Gavel, 
  TrendingUp, 
  AssignmentTurnedIn, 
  MonetizationOn, 
  People,
  Work,
  CheckCircle,
  AccountBalanceWallet,
  PlayCircleFilled,
  Star
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '@components/templates/Layout';
import { selectAuth } from '@store/slices/authSlice';
import { ROUTES } from '@constants';
import apiService from '@services/api';

const DashboardPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useSelector(selectAuth);

  const [stats, setStats] = useState({
    tasksPosted: 0,
    availableTasks: 0,
    activeContracts: 0,
    totalEarnings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetchDashboardStats();
    }
  }, [user?.email]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      // Fetch all tasks to get open task count and active worker task statuses
      const allTasksRes = await apiService.tasks.getAll().catch(() => ({ data: [] }));
      const allTasks = allTasksRes.data || [];
      const openTasksCount = allTasks.filter(t => t.status === 'OPEN' && t.ownerEmail !== user.email).length;

      // Fetch user's posted tasks
      const postedTasksRes = await apiService.tasks.getByOwnerEmail(user.email).catch(() => ({ data: [] }));
      const postedTasks = postedTasksRes.data || [];
      const postedTasksCount = postedTasks.length;

      // Fetch user's dynamic earnings from task-service with profile-service fallback
      let totalEarnings = 0;
      if (user.id) {
        try {
          const earningsRes = await apiService.tasks.getEarnings(user.id);
          totalEarnings = earningsRes.data?.totalEarnings || 0;
        } catch (err) {
          console.error('Error fetching dynamic earnings:', err);
          const profileRes = await apiService.profiles.getByUserEmail(user.email).catch(() => null);
          totalEarnings = profileRes?.data?.totalEarnings || 0;
        }
      } else {
        const profileRes = await apiService.profiles.getByUserEmail(user.email).catch(() => null);
        totalEarnings = profileRes?.data?.totalEarnings || 0;
      }

      // Fetch user's bids to check active contracts as worker
      const bidsRes = await apiService.bids.getByUserEmail(user.email).catch(() => ({ data: [] }));
      const bids = bidsRes.data || [];
      
      // Calculate active contracts:
      // 1. Posted tasks where status is IN_PROGRESS, ASSIGNED, PENDING_CONFIRMATION, or DISPUTED
      const activePostedCount = postedTasks.filter(t => 
        t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED' || t.status === 'PENDING_CONFIRMATION' || t.status === 'DISPUTED'
      ).length;
      
      // 2. Worker bids that are ACCEPTED and the task actually exists and is active (IN_PROGRESS, ASSIGNED, PENDING_CONFIRMATION, or DISPUTED)
      const activeWorkerCount = bids.filter(b => {
        if (b.status !== 'ACCEPTED') return false;
        const task = allTasks.find(t => t.id === b.taskId);
        return task && (task.status === 'IN_PROGRESS' || task.status === 'ASSIGNED' || task.status === 'PENDING_CONFIRMATION' || task.status === 'DISPUTED');
      }).length;

      setStats({
        tasksPosted: postedTasksCount,
        availableTasks: openTasksCount,
        activeContracts: activePostedCount + activeWorkerCount,
        totalEarnings: totalEarnings
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
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

  return (
    <Layout>
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: { md: 'calc(100vh - 90px)' }, 
          maxHeight: { md: 'calc(100vh - 90px)' },
          overflow: { md: 'hidden' },
          backgroundColor: '#FAFBFC',
          p: { xs: 2, md: 3 },
          boxSizing: 'border-box'
        }}
      >
        {/* Welcome Row */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 2,
            flexShrink: 0
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700} color="#2C3E50" sx={{ letterSpacing: '-0.02em' }}>
              Welcome back, {user?.email?.split('@')[0] || 'Student'}! 👋
            </Typography>
            <Typography variant="body2" color="text.secondary">
              RGUKT Peer-to-Peer Academic & Service Marketplace
            </Typography>
          </Box>
          <Chip 
            label={`Role: ${user?.role || 'STUDENT'}`} 
            color="primary" 
            variant="outlined" 
            icon={<Star sx={{ fontSize: '16px' }} />}
            sx={{
              borderColor: 'rgba(49, 37, 142, 0.2)',
              color: '#31258E',
              fontWeight: 600,
              backgroundColor: 'rgba(49, 37, 142, 0.05)',
              px: 1
            }}
          />
        </Box>

        {/* Stats Row */}
        <Grid container spacing={2} sx={{ mb: 2, flexShrink: 0 }}>
          {[
            { 
              title: 'Tasks Posted', 
              value: stats.tasksPosted, 
              desc: 'Created by you', 
              icon: <AssignmentTurnedIn sx={{ color: '#2196F3', fontSize: 28 }} />,
              bg: 'rgba(33, 150, 243, 0.04)' 
            },
            { 
              title: 'Available Tasks', 
              value: stats.availableTasks, 
              desc: 'Open for bidding', 
              icon: <Work sx={{ color: '#FF9800', fontSize: 28 }} />,
              bg: 'rgba(255, 152, 0, 0.04)' 
            },
            { 
              title: 'Active Contracts', 
              value: stats.activeContracts, 
              desc: 'In-progress projects', 
              icon: <PlayCircleFilled sx={{ color: '#4CAF50', fontSize: 28 }} />,
              bg: 'rgba(76, 175, 80, 0.04)' 
            },
            { 
              title: 'Total Earnings', 
              value: formatCurrency(stats.totalEarnings), 
              desc: 'Secured via escrow', 
              icon: <MonetizationOn sx={{ color: '#9C27B0', fontSize: 28 }} />,
              bg: 'rgba(156, 39, 176, 0.04)' 
            }
          ].map((stat, idx) => (
            <Grid item xs={6} md={3} key={idx}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '16px',
                  border: '1px solid rgba(0, 0, 0, 0.04)',
                  backgroundColor: 'white',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 20px rgba(0, 0, 0, 0.04)',
                    borderColor: 'rgba(49, 37, 142, 0.1)'
                  }
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {stat.title}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#2C3E50" sx={{ my: 0.5 }}>
                    {loading ? <CircularProgress size={20} /> : stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.desc}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: stat.bg, display: 'flex', alignItems: 'center' }}>
                  {stat.icon}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Main Workspaces Layout (Split View) */}
        <Grid container spacing={2} sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Column - Worker Journey */}
          <Grid 
            item 
            xs={12} 
            md={6} 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%', 
              minHeight: 0
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '20px',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                minHeight: 0,
                overflowY: 'auto'
              }}
            >
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ letterSpacing: '-0.01em' }}>
                  Get Work & Earn Money
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Browse available work and manage your earning activities.
                </Typography>
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                {[
                  {
                    title: 'Available Tasks',
                    desc: 'Search academic records, coding requests, or campus errands to bid on.',
                    icon: <Assignment sx={{ fontSize: '32px', color: '#31258E' }} />,
                    actionLabel: 'Browse Tasks',
                    color: '#31258E',
                    bg: 'rgba(49, 37, 142, 0.05)',
                    onClick: () => navigate(ROUTES.TASKS + '?section=available')
                  },
                  {
                    title: 'My Bids',
                    desc: 'Track and review the status of bids you submitted to open listings.',
                    icon: <Gavel sx={{ fontSize: '32px', color: '#FF9800' }} />,
                    actionLabel: 'View Bids',
                    color: '#FF9800',
                    bg: 'rgba(255, 152, 0, 0.05)',
                    onClick: () => navigate(ROUTES.TASKS + '?section=bids')
                  },
                  {
                    title: 'Active Work',
                    desc: 'Manage your ongoing work, communicate with buyers, and complete tasks.',
                    icon: <CheckCircle sx={{ fontSize: '32px', color: '#4CAF50' }} />,
                    actionLabel: 'Manage Work',
                    color: '#4CAF50',
                    bg: 'rgba(76, 175, 80, 0.05)',
                    onClick: () => navigate(ROUTES.TASKS + '?section=active')
                  }
                ].map((card, idx) => (
                  <Card 
                    key={idx}
                    elevation={0}
                    sx={{
                      borderRadius: '16px',
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.04)',
                        borderColor: 'rgba(0, 0, 0, 0.1)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: card.bg, display: 'flex', alignItems: 'center' }}>
                        {card.icon}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700} color="#2C3E50">
                          {card.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1, fontSize: '0.825rem' }}>
                          {card.desc}
                        </Typography>
                        <Button 
                          variant="outlined" 
                          size="small"
                          onClick={card.onClick}
                          sx={{ 
                            borderRadius: '8px', 
                            color: card.color, 
                            borderColor: card.color,
                            px: 2,
                            '&:hover': {
                              bgcolor: card.bg,
                              borderColor: card.color
                            }
                          }}
                        >
                          {card.actionLabel}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Right Column - Requester Journey */}
          <Grid 
            item 
            xs={12} 
            md={6} 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%', 
              minHeight: 0
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '20px',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                minHeight: 0,
                overflowY: 'auto'
              }}
            >
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700} color="#2C3E50" sx={{ letterSpacing: '-0.01em' }}>
                  Place Work / Need Help
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create tasks and manage workers helping you.
                </Typography>
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                {[
                  {
                    title: 'Create Task',
                    desc: 'Delegate assignments, copy editing, or library fetch jobs to other peers.',
                    icon: <Add sx={{ fontSize: '32px', color: '#2196F3' }} />,
                    actionLabel: 'Post Task',
                    color: '#2196F3',
                    bg: 'rgba(33, 150, 243, 0.05)',
                    onClick: () => navigate(ROUTES.CREATE_TASK)
                  },
                  {
                    title: 'My Tasks',
                    desc: 'Track completion status, view details, and manage tasks you posted.',
                    icon: <AssignmentTurnedIn sx={{ fontSize: '32px', color: '#9C27B0' }} />,
                    actionLabel: 'Manage Tasks',
                    color: '#9C27B0',
                    bg: 'rgba(156, 39, 176, 0.05)',
                    onClick: () => navigate(ROUTES.MY_TASKS + '?section=tasks')
                  },
                  {
                    title: 'Received Bids',
                    desc: 'Examine competitive submissions from workers on your active tasks.',
                    icon: <People sx={{ fontSize: '32px', color: '#E91E63' }} />,
                    actionLabel: 'Review Bids',
                    color: '#E91E63',
                    bg: 'rgba(233, 30, 99, 0.05)',
                    onClick: () => navigate(ROUTES.MY_TASKS + '?section=bids')
                  }
                ].map((card, idx) => (
                  <Card 
                    key={idx}
                    elevation={0}
                    sx={{
                      borderRadius: '16px',
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.04)',
                        borderColor: 'rgba(0, 0, 0, 0.1)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: card.bg, display: 'flex', alignItems: 'center' }}>
                        {card.icon}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700} color="#2C3E50">
                          {card.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1, fontSize: '0.825rem' }}>
                          {card.desc}
                        </Typography>
                        <Button 
                          variant="outlined" 
                          size="small"
                          onClick={card.onClick}
                          sx={{ 
                            borderRadius: '8px', 
                            color: card.color, 
                            borderColor: card.color,
                            px: 2,
                            '&:hover': {
                              bgcolor: card.bg,
                              borderColor: card.color
                            }
                          }}
                        >
                          {card.actionLabel}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
};

export default DashboardPage;
