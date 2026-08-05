package com.campusworks.payment.client;

import com.campusworks.payment.config.FeignClientConfig;
import com.campusworks.payment.dto.BidResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * Feign Client for Bidding Service
 */
@FeignClient(name = "bidding-service", configuration = FeignClientConfig.class)
public interface BiddingServiceClient {
    
    @GetMapping("/bids/task/{taskId}/accepted")
    BidResponse getAcceptedBidForTask(@PathVariable("taskId") Long taskId);
    
    @org.springframework.web.bind.annotation.PutMapping("/bids/task/{taskId}/complete")
    void completeBidForTask(@PathVariable("taskId") Long taskId);
}
