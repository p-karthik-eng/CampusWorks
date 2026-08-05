package com.campusworks.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskResponse {
    private Long id;
    private String title;
    private String description;
    private BigDecimal budget;
    private String category;
    private String status;
    private Long ownerId;
    private String ownerEmail;
    private Long assignedUserId;
    private String assignedUserEmail;
    private LocalDateTime biddingDeadline;
    private LocalDateTime completionDeadline;
    private LocalDateTime completedAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
