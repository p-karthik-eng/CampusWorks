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
public class BidResponse {
    private Long id;
    private Long taskId;
    private Long bidderId;
    private String bidderEmail;
    private BigDecimal amount;
    private String proposal;
    private String status;
    private Boolean isWinning;
    private Boolean isAccepted;
    private String upiId;
    private Boolean upiIdViewed;
    private LocalDateTime upiIdSubmittedAt;
    private LocalDateTime upiIdViewedAt;
}
