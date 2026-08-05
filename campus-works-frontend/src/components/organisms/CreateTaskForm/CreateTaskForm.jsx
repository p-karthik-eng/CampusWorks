import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Chip,
  Stack
} from '@mui/material';
import {
  Assignment,
  AttachMoney,
  Category,
  Schedule,
  Description,
  Title
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import FormField from '../../molecules/FormField/FormField';
import { TASK_CATEGORIES, CATEGORY_LABELS } from '../../../constants';
import { createTask } from '../../../store/slices/tasksSlice';

const CreateTaskForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { isCreating: loading, error, message } = useSelector((state) => state.tasks);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      category: '',
      budget: '',
      biddingDeadline: '',
      completionDeadline: ''
    }
  });

  // Debug: Watch budget and deadline changes
  const budgetValue = watch('budget');
  const biddingDeadlineValue = watch('biddingDeadline');
  const completionDeadlineValue = watch('completionDeadline');
  console.log('Budget:', budgetValue, 'Bidding DL:', biddingDeadlineValue, 'Completion DL:', completionDeadlineValue, 'Form valid:', isValid, 'Errors:', errors);

  const onSubmit = async (data) => {
    try {
      // Additional validation before submission
      const budget = parseFloat(data.budget);
      
      if (isNaN(budget) || budget < 0) {
        console.error('Invalid budget:', budget);
        return; // Don't submit if budget is invalid
      }
      
      // Format the deadlines properly for the backend
      const formattedBiddingDeadline = data.biddingDeadline ? 
        data.biddingDeadline + (data.biddingDeadline.split(':').length === 2 ? ':00' : '') : null;
      const formattedCompletionDeadline = data.completionDeadline ? 
        data.completionDeadline + (data.completionDeadline.split(':').length === 2 ? ':00' : '') : null;
      
      const taskData = {
        title: data.title,
        description: data.description,
        category: data.category,
        budget: budget,
        biddingDeadline: formattedBiddingDeadline,
        completionDeadline: formattedCompletionDeadline
      };

      console.log('Sending task data:', taskData); // Debug log

      const result = await dispatch(createTask(taskData));
      
      if (result.payload) {
        // Navigate to task details or dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8eaf6 0%, #f3e5f5 100%)',
      py: 4,
      px: 2
    }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        {/* Header Section */}
        <Paper 
          elevation={8} 
          sx={{ 
            p: 4, 
            mb: 3, 
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              mb: 2,
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
            }}>
              <Assignment sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography 
              variant="h3" 
              component="h1" 
              sx={{ 
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1
              }}
            >
              Create New Task
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
              Post your task and find the perfect freelancer
            </Typography>
          </Box>

          {/* Status Messages */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                '& .MuiAlert-message': { fontWeight: 500 }
              }}
            >
              {error}
            </Alert>
          )}
          
          {message && (
            <Alert 
              severity="success" 
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                '& .MuiAlert-message': { fontWeight: 500 }
              }}
            >
              {message}
            </Alert>
          )}
        </Paper>

        {/* Form Section */}
        <Paper 
          elevation={8} 
          sx={{ 
            p: 4, 
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              {/* Task Title */}
              <FormField
                name="title"
                control={control}
                label="Task Title"
                placeholder="Enter a clear, descriptive title for your task"
                required
                rules={{
                  required: '❌ Task title is required',
                  minLength: {
                    value: 10,
                    message: '❌ Title must be at least 10 characters long'
                  },
                  maxLength: {
                    value: 100,
                    message: '❌ Title must not exceed 100 characters'
                  }
                }}
              />

              {/* Task Description */}
              <FormField
                name="description"
                control={control}
                label="Task Description"
                placeholder="Provide detailed description of what needs to be done, including specific requirements, format, and any additional context"
                multiline
                rows={5}
                required
                rules={{
                  required: '❌ Task description is required',
                  minLength: {
                    value: 50,
                    message: '❌ Description must be at least 50 characters long'
                  },
                  maxLength: {
                    value: 1000,
                    message: '❌ Description must not exceed 1000 characters'
                  }
                }}
              />

              {/* Category Selection */}
              <FormField
                name="category"
                control={control}
                label="Category"
                select
                required
                rules={{
                  required: '❌ Please select a category'
                }}
              >
                {Object.entries(TASK_CATEGORIES).map(([key, value]) => (
                  <MenuItem key={key} value={value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        label={CATEGORY_LABELS[value]} 
                        size="small" 
                        sx={{ 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          fontWeight: 'bold'
                        }} 
                      />
                    </Box>
                  </MenuItem>
                ))}
              </FormField>

              {/* Budget */}
              <FormField
                name="budget"
                control={control}
                label="Budget (₹)"
                type="number"
                placeholder="Enter your budget amount"
                required
                helperText="Budget must be a non-negative number"
                rules={{
                  required: '❌ Budget is required to post your task',
                  validate: {
                    isNumber: (value) => {
                      const num = parseFloat(value);
                      if (isNaN(num)) {
                        return '❌ Please enter a valid number';
                      }
                      return true;
                    },
                    minAmount: (value) => {
                      const num = parseFloat(value);
                      if (num < 0) {
                        return '❌ Budget cannot be negative.';
                      }
                      return true;
                    }
                  }
                }}
              />

              {/* Bidding Deadline */}
              <FormField
                name="biddingDeadline"
                control={control}
                label="Bidding Deadline"
                type="datetime-local"
                required
                helperText="ℹ️ Note: Specify when workers should stop bidding on your task."
                rules={{
                  required: '❌ Bidding deadline is required',
                  validate: (value) => {
                    const biddingDate = new Date(value);
                    const now = new Date();
                    if (biddingDate <= now) {
                      return '❌ Bidding deadline must be in the future';
                    }
                    return true;
                  }
                }}
              />

              {/* Completion Deadline */}
              <FormField
                name="completionDeadline"
                control={control}
                label="Completion Deadline"
                type="datetime-local"
                required
                helperText="ℹ️ Note: Specify when you want the task to be completed by."
                rules={{
                  required: '❌ Completion deadline is required',
                  validate: (value, formValues) => {
                    const completionDate = new Date(value);
                    const biddingDate = new Date(formValues.biddingDeadline);
                    if (completionDate <= biddingDate) {
                      return '❌ Task completion deadline must be after the bidding deadline.';
                    }
                    return true;
                  }
                }}
              />

              {/* Submit Buttons */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 3, 
                mt: 4,
                pt: 3,
                borderTop: '2px solid #f0f0f0'
              }}>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/dashboard')}
                  disabled={loading}
                  sx={{ 
                    minWidth: 140,
                    height: 50,
                    borderRadius: 2,
                    fontWeight: 'bold',
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': {
                      borderColor: '#764ba2',
                      color: '#764ba2',
                      background: 'rgba(102, 126, 234, 0.04)'
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || !isValid}
                  startIcon={loading && <CircularProgress size={20} color="inherit" />}
                  sx={{ 
                    minWidth: 160,
                    height: 50,
                    borderRadius: 2,
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                      boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
                      transform: 'translateY(-2px)'
                    },
                    '&:disabled': {
                      background: '#e0e0e0',
                      color: '#9e9e9e',
                      boxShadow: 'none'
                    }
                  }}
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </Button>
              </Box>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Box>
  );
};

export default CreateTaskForm;
