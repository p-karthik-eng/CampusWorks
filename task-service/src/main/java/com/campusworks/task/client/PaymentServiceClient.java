package com.campusworks.task.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * Feign Client for calling Payment Service
 */
@FeignClient(name = "payment-service")
public interface PaymentServiceClient {
    
    /**
     * Check if escrow is currently held for a specific contract/task
     */
    @GetMapping("/payments/contract/{contractId}/held")
    Boolean isEscrowHeld(@PathVariable("contractId") Long contractId);
}
