package com.campusworks.payment.client;

import com.campusworks.payment.config.FeignClientConfig;
import com.campusworks.payment.dto.TaskResponse;
import com.campusworks.payment.dto.UpdateTaskStatusRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Feign Client for calling Task Service
 */
@FeignClient(name = "task-service", fallback = TaskServiceClientFallback.class, configuration = FeignClientConfig.class)
public interface TaskServiceClient {
    
    @GetMapping("/tasks/{taskId}")
    TaskResponse getTaskById(@PathVariable("taskId") Long taskId);
    
    @PutMapping("/tasks/{taskId}/status")
    void updateTaskStatus(@PathVariable("taskId") Long taskId, @RequestBody UpdateTaskStatusRequest request);
}
