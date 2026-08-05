import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
  IconButton
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import FormField from '../../components/molecules/FormField/FormField';
import { TASK_CATEGORIES, CATEGORY_LABELS, ROUTES } from '../../constants';
import apiService from '../../services/api';

const EditTaskPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [task, setTask] = useState(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset
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

  useEffect(() => {
    if (id) {
      fetchTaskDetails();
    }
  }, [id]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.tasks.getById(id);
      const taskData = response.data;
      
      // Check if user owns this task
      if (taskData.ownerEmail !== user.email) {
        setError('You are not authorized to edit this task.');
        return;
      }
      
      // Check if task can be edited (only OPEN tasks)
      if (taskData.status !== 'OPEN') {
        setError('This task cannot be edited as it is no longer open for bidding.');
        return;
      }
      
      setTask(taskData);
      
      // Populate form with existing data
      reset({
        title: taskData.title,
        description: taskData.description,
        category: taskData.category,
        budget: taskData.budget.toString(),
        biddingDeadline: taskData.biddingDeadline ? 
          new Date(taskData.biddingDeadline).toLocaleString('sv-SE').slice(0, 16) : '',
        completionDeadline: taskData.completionDeadline ? 
          new Date(taskData.completionDeadline).toLocaleString('sv-SE').slice(0, 16) : ''
      });
      
    } catch (error) {
      console.error('Error fetching task details:', error);
      setError('Failed to load task details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setSaving(true);
      setError(null);
      
      // Additional validation before submission
      const budget = parseFloat(data.budget);
      
      if (isNaN(budget) || budget < 0) {
        setError('Budget must be a non-negative number.');
        setSaving(false);
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

      console.log('Updating task data:', taskData);

      await apiService.tasks.update(id, taskData);
      
      // Navigate back to task details
      navigate(`${ROUTES.TASK_DETAIL.replace(':id', id)}`);
      
    } catch (error) {
      console.error('Error updating task:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update task.';
      
      // Show specific error messages based on the error
      if (errorMessage.includes('bids already exist')) {
        setError('You cannot edit this task because bids already exist. Please wait until the bidding deadline passes and no bids are placed.');
      } else if (errorMessage.includes('bidding period has ended')) {
        setError('You cannot edit this task because the bidding period has ended.');
      } else {
        setError(`Failed to update task: ${errorMessage}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  if (error && !task) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={handleGoBack}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Card elevation={3}>
        <CardContent>
          {/* Header */}
          <Box display="flex" alignItems="center" sx={{ mb: 4 }}>
            <IconButton onClick={handleGoBack} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" component="h1">
              Edit Task
            </Typography>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              {/* Task Title */}
              <Grid item xs={12}>
                <FormField
                  name="title"
                  control={control}
                  label="Task Title"
                  placeholder="Enter a clear, descriptive title for your task"
                  required
                  rules={{
                    required: 'Task title is required',
                    minLength: {
                      value: 10,
                      message: 'Title must be at least 10 characters long'
                    },
                    maxLength: {
                      value: 100,
                      message: 'Title must not exceed 100 characters'
                    }
                  }}
                />
              </Grid>

              {/* Task Description */}
              <Grid item xs={12}>
                <FormField
                  name="description"
                  control={control}
                  label="Task Description"
                  placeholder="Provide detailed description of what needs to be done, including specific requirements, format, and any additional context"
                  multiline
                  rows={4}
                  required
                  rules={{
                    required: 'Task description is required',
                    minLength: {
                      value: 50,
                      message: 'Description must be at least 50 characters long'
                    },
                    maxLength: {
                      value: 1000,
                      message: 'Description must not exceed 1000 characters'
                    }
                  }}
                />
              </Grid>

              {/* Category Selection */}
              <Grid item xs={12} md={6}>
                <FormField
                  name="category"
                  control={control}
                  label="Category"
                  select
                  required
                  rules={{
                    required: 'Please select a category'
                  }}
                >
                  {Object.entries(TASK_CATEGORIES).map(([key, value]) => (
                    <MenuItem key={key} value={value}>
                      {CATEGORY_LABELS[value]}
                    </MenuItem>
                  ))}
                </FormField>
              </Grid>

              {/* Budget */}
              <Grid item xs={12} md={6}>
                <FormField
                  name="budget"
                  control={control}
                  label="Budget (₹)"
                  type="number"
                  placeholder="Enter your budget amount"
                  required
                  helperText="Budget must be a non-negative number"
                  rules={{
                    required: 'Budget is required to update your task',
                    validate: {
                      isNumber: (value) => {
                        const num = parseFloat(value);
                        if (isNaN(num)) {
                          return 'Please enter a valid number';
                        }
                        return true;
                      },
                      minAmount: (value) => {
                        const num = parseFloat(value);
                        if (num < 0) {
                          return 'Budget cannot be negative.';
                        }
                        return true;
                      }
                    }
                  }}
                />
              </Grid>

              {/* Bidding Deadline */}
              <Grid item xs={12} md={6}>
                <FormField
                  name="biddingDeadline"
                  control={control}
                  label="Bidding Deadline"
                  type="datetime-local"
                  required
                  rules={{
                    required: 'Bidding deadline is required',
                    validate: (value) => {
                      const biddingDate = new Date(value);
                      const now = new Date();
                      if (biddingDate <= now) {
                        return 'Bidding deadline must be in the future';
                      }
                      return true;
                    }
                  }}
                />
              </Grid>

              {/* Completion Deadline */}
              <Grid item xs={12} md={6}>
                <FormField
                  name="completionDeadline"
                  control={control}
                  label="Completion Deadline"
                  type="datetime-local"
                  required
                  rules={{
                    required: 'Completion deadline is required',
                    validate: (value, formValues) => {
                      const completionDate = new Date(value);
                      const biddingDate = new Date(formValues.biddingDeadline);
                      if (completionDate <= biddingDate) {
                        return 'Completion deadline must be after bidding deadline';
                      }
                      return true;
                    }
                  }}
                />
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleGoBack}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving || !isValid}
                    startIcon={saving && <CircularProgress size={20} />}
                    sx={{ minWidth: 120 }}
                  >
                    {saving ? 'Updating...' : 'Update Task'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EditTaskPage;
