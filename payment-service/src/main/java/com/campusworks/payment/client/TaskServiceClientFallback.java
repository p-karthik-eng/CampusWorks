package com.campusworks.payment.client;

import com.campusworks.payment.dto.TaskResponse;
import com.campusworks.payment.dto.UpdateTaskStatusRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Fallback implementation for TaskServiceClient using Hystrix/Resilience4j
 */
@Component
@Slf4j
public class TaskServiceClientFallback implements TaskServiceClient {
    
    @Override
    public TaskResponse getTaskById(Long taskId) {
        log.error("Fallback triggered for getTaskById. Task Service is down for ID: {}", taskId);
        throw new RuntimeException("Task Service is currently unavailable. Please try again later.");
    }
    
    @Override
    public void updateTaskStatus(Long taskId, UpdateTaskStatusRequest request) {
        log.error("Fallback triggered for updateTaskStatus. Task Service is down for ID: {} with status: {}", taskId, request.getStatus());
        throw new RuntimeException("Task Service is currently unavailable. Cannot update contract status.");
    }
}
