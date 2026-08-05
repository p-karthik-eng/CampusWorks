package com.campusworks.payment.service;

import com.campusworks.payment.client.BiddingServiceClient;
import com.campusworks.payment.client.TaskServiceClient;
import com.campusworks.payment.dto.BidResponse;
import com.campusworks.payment.dto.TaskResponse;
import com.campusworks.payment.dto.UpdateTaskStatusRequest;
import com.campusworks.payment.dto.PaymentOrderResponse;
import com.campusworks.payment.dto.PaymentVerificationRequest;
import com.campusworks.payment.gateway.PaymentGateway;
import com.campusworks.payment.model.Payment;
import com.campusworks.payment.model.PaymentStatus;
import com.campusworks.payment.repo.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Payment Service Implementation
 * Handles business logic for escrow payments, release, and refund workflows
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PaymentService {
    
    private final PaymentRepository paymentRepository;
    private final TaskServiceClient taskServiceClient;
    private final BiddingServiceClient biddingServiceClient;
    private final MailService mailService;
    private final PaymentGateway paymentGateway;
    
    @Value("${razorpay.key.id}")
    private String razorpayKeyId;
    
    /**
     * Deposit payment into escrow for a specific contract/task (Bypasses verification/mock method)
     */
    public Payment holdPayment(Long contractId, Long payerId) {
        log.info("💳 Processing mock escrow payment for contract ID: {} by user ID: {}", contractId, payerId);
        return verifyAndHoldPayment(contractId, payerId, new PaymentVerificationRequest());
    }
    
    /**
     * Step 2a: Create order in Razorpay Payment Gateway
     */
    public PaymentOrderResponse createPaymentOrder(Long contractId, Long payerId) {
        log.info("💳 Creating Razorpay payment order for contract ID: {} by user ID: {}", contractId, payerId);
        
        // 1. Fetch task details to validate ownership and status
        TaskResponse task = taskServiceClient.getTaskById(contractId);
        if (task == null) {
            log.error("❌ Task not found for contract ID: {}", contractId);
            throw new RuntimeException("Task not found");
        }
        
        // 2. Business Rule: Only the contract owner can deposit escrow
        if (!task.getOwnerId().equals(payerId)) {
            log.error("❌ Unauthorized payment order request: User {} is not the owner of task {}", payerId, contractId);
            throw new RuntimeException("Only the contract owner can deposit escrow payment");
        }
        
        // 3. Business Rule: Only accepted contracts can receive escrow payments
        if (!"IN_PROGRESS".equals(task.getStatus())) {
            log.error("❌ Cannot create payment order: Task status is {}, expected IN_PROGRESS", task.getStatus());
            throw new RuntimeException("Only accepted contracts (status: In Progress) can receive escrow payments");
        }
        
        // 4. Fetch amount to verify
        BigDecimal escrowAmount = task.getBudget();
        Long receiverId = task.getAssignedUserId();
        
        try {
            BidResponse bid = biddingServiceClient.getAcceptedBidForTask(contractId);
            if (bid != null) {
                escrowAmount = bid.getAmount();
                receiverId = bid.getBidderId();
                log.info("💰 Verified bid details: Bidder ID: {}, Amount: ₹{}", receiverId, escrowAmount);
            }
        } catch (Exception e) {
            log.warn("⚠️ Bidding service unavailable. Falling back to task budget: ₹{}", escrowAmount);
        }
        
        if (receiverId == null) {
            throw new RuntimeException("No worker has been assigned to this contract yet");
        }
        
        // 5. Create Order in Razorpay Gateway
        String orderId;
        String receiptId = "receipt_" + contractId + "_" + System.currentTimeMillis();
        try {
            orderId = paymentGateway.createOrder(escrowAmount, "INR", receiptId);
        } catch (Exception e) {
            log.error("❌ Failed to create Razorpay order: {}", e.getMessage());
            throw new RuntimeException("Failed to register order with Razorpay gateway: " + e.getMessage());
        }
        
        // 6. Save/update Payment record in PENDING status
        Payment payment = paymentRepository.findByContractId(contractId).orElse(null);
        if (payment == null) {
            payment = new Payment();
        }
        
        payment.setContractId(contractId);
        payment.setPayerId(payerId);
        payment.setReceiverId(receiverId);
        payment.setAmount(escrowAmount);
        payment.setCurrency("INR");
        payment.setPaymentMethod("RAZORPAY_ESCROW");
        payment.setGatewayReference(orderId);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        
        paymentRepository.save(payment);
        log.info("✅ Payment order recorded in PENDING status for contract ID: {}. Gateway Ref: {}", contractId, orderId);
        
        return PaymentOrderResponse.builder()
                .orderId(orderId)
                .keyId(razorpayKeyId)
                .amount(escrowAmount)
                .currency("INR")
                .contractId(contractId)
                .status("PENDING")
                .build();
    }
    
    /**
     * Step 2b: Verify signature and mark payment status as ESCROW_HELD
     */
    public Payment verifyAndHoldPayment(Long contractId, Long payerId, PaymentVerificationRequest verification) {
        log.info("🔐 Verifying and securing escrow payment for contract ID: {} by user ID: {}", contractId, payerId);
        
        // 1. Fetch task details
        TaskResponse task = taskServiceClient.getTaskById(contractId);
        if (task == null) {
            log.error("❌ Task not found for contract ID: {}", contractId);
            throw new RuntimeException("Task not found");
        }
        
        // 2. Business Rule: Only the contract owner can deposit escrow
        if (!task.getOwnerId().equals(payerId)) {
            log.error("❌ Unauthorized verification attempt: User {} is not the owner of task {}", payerId, contractId);
            throw new RuntimeException("Only the contract owner can deposit escrow payment");
        }
        
        // 3. Fetch or create Payment entity
        Payment payment = paymentRepository.findByContractId(contractId)
                .orElseGet(() -> {
                    BigDecimal escrowAmount = task.getBudget();
                    Long receiverId = task.getAssignedUserId();
                    try {
                        BidResponse bid = biddingServiceClient.getAcceptedBidForTask(contractId);
                        if (bid != null) {
                            escrowAmount = bid.getAmount();
                            receiverId = bid.getBidderId();
                        }
                    } catch (Exception e) {
                        log.warn("⚠️ Bidding service unavailable. Falling back to task budget: ₹{}", escrowAmount);
                    }
                    
                    return Payment.builder()
                            .contractId(contractId)
                            .payerId(payerId)
                            .receiverId(receiverId != null ? receiverId : 0L)
                            .amount(escrowAmount)
                            .currency("INR")
                            .paymentStatus(PaymentStatus.PENDING)
                            .build();
                });
        
        if (payment.getPaymentStatus() == PaymentStatus.ESCROW_HELD) {
            log.warn("⚠️ Escrow payment is already held for contract ID: {}", contractId);
            return payment;
        }
        
        // 4. Verify signature if credentials are supplied (Live Gateway integration)
        if (verification.getRazorpaySignature() != null && verification.getRazorpayPaymentId() != null) {
            boolean isVerified = paymentGateway.verifyPaymentSignature(
                    verification.getRazorpayOrderId(),
                    verification.getRazorpayPaymentId(),
                    verification.getRazorpaySignature()
            );
            
            if (!isVerified) {
                log.error("❌ Razorpay payment verification signature mismatch!");
                payment.setPaymentStatus(PaymentStatus.FAILED);
                paymentRepository.save(payment);
                throw new RuntimeException("Invalid payment signature. Transaction verification failed.");
            }
            
            payment.setTransactionId(verification.getRazorpayPaymentId());
            payment.setGatewayReference(verification.getRazorpayOrderId());
            payment.setPaymentMethod(verification.getPaymentMethod() != null ? verification.getPaymentMethod() : "RAZORPAY_ESCROW");
        } else {
            // Mock transaction fallback
            String txnId = "TXN-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 1000);
            String gatewayRef = "GWR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            
            payment.setTransactionId(txnId);
            payment.setGatewayReference(gatewayRef);
            payment.setPaymentMethod(verification.getPaymentMethod() != null ? verification.getPaymentMethod() : "UPI_ESCROW");
        }
        
        // 5. Update Status
        payment.setPaymentStatus(PaymentStatus.ESCROW_HELD);
        Payment savedPayment = paymentRepository.save(payment);
        log.info("✅ Escrow payment ID: {} successfully secured in ESCROW_HELD status", savedPayment.getId());
        
        // 6. Send Email Notifications
        mailService.sendEscrowHeldNotification(task.getOwnerEmail(), task.getAssignedUserEmail(), task.getTitle(), payment.getAmount());
        
        return savedPayment;
    }
    
    /**
     * Release payment to the worker after successful task completion
     */
    public Payment releasePayment(Long contractId, Long userId) {
        log.info("💰 Releasing escrow payment for contract ID: {} by user ID: {}", contractId, userId);
        
        // 1. Fetch payment details
        Payment payment = paymentRepository.findByContractId(contractId)
                .orElseThrow(() -> new RuntimeException("No payment record found for contract ID: " + contractId));
        
        // 2. Validate Payment status
        if (payment.getPaymentStatus() != PaymentStatus.ESCROW_HELD) {
            log.error("❌ Payment cannot be released: status is {}, expected ESCROW_HELD", payment.getPaymentStatus());
            throw new RuntimeException("Escrow payment can only be released if it is currently held (ESCROW_HELD)");
        }
        
        // 3. Business Rule: Only the contract owner can release payment
        if (!payment.getPayerId().equals(userId)) {
            log.error("❌ Unauthorized release attempt: User {} is not the payer of contract {}", userId, contractId);
            throw new RuntimeException("Only the contract owner can release escrow payment");
        }
        
        // 4. Fetch task details to verify completion
        TaskResponse task = taskServiceClient.getTaskById(contractId);
        if (task == null) {
            throw new RuntimeException("Contract task details not found");
        }
        
        // 5. Business Rule: Requester cannot release payment before worker marks completion
        if (!"PENDING_CONFIRMATION".equals(task.getStatus())) {
            log.error("❌ Cannot release payment: Task status is {}, expected PENDING_CONFIRMATION", task.getStatus());
            throw new RuntimeException("Cannot release payment before worker marks task as complete (status: PENDING_CONFIRMATION)");
        }
        
        // 6. Update payment status to RELEASED
        payment.setPaymentStatus(PaymentStatus.RELEASED);
        payment.setReleasedAt(LocalDateTime.now());
        Payment savedPayment = paymentRepository.save(payment);
        log.info("✅ Escrow payment ID: {} released to worker ID: {}", savedPayment.getId(), savedPayment.getReceiverId());
        
        // 7. Call Task Service to transition status to COMPLETED
        try {
            UpdateTaskStatusRequest statusRequest = new UpdateTaskStatusRequest("COMPLETED");
            taskServiceClient.updateTaskStatus(contractId, statusRequest);
            log.info("✅ Task status successfully transitioned to COMPLETED for contract ID: {}", contractId);
        } catch (Exception e) {
            log.error("❌ Failed to transition task status: {}", e.getMessage());
            throw new RuntimeException("Payment released but failed to update task status in Task Service: " + e.getMessage());
        }
        
        // 7.5 Call Bidding Service to transition bid status to COMPLETED
        try {
            biddingServiceClient.completeBidForTask(contractId);
            log.info("✅ Bid status successfully transitioned to COMPLETED for task ID: {}", contractId);
        } catch (Exception e) {
            log.warn("⚠️ Failed to update bid status in Bidding Service: {}", e.getMessage());
            // Continue even if Bidding Service update fails (graceful degradation)
        }
        
        // 8. Send Notifications
        mailService.sendPaymentReleasedNotification(task.getOwnerEmail(), task.getAssignedUserEmail(), task.getTitle(), payment.getAmount());
        
        return savedPayment;
    }
    
    /**
     * Refund payment back to the contract owner
     */
    public Payment refundPayment(Long contractId, Long userId) {
        log.info("↩️ Refunding payment for contract ID: {} by user ID: {}", contractId, userId);
        
        // 1. Fetch payment details
        Payment payment = paymentRepository.findByContractId(contractId)
                .orElseThrow(() -> new RuntimeException("No payment record found for contract ID: " + contractId));
        
        // 2. Validate Payment status
        if (payment.getPaymentStatus() != PaymentStatus.ESCROW_HELD) {
            log.error("❌ Payment cannot be refunded: status is {}, expected ESCROW_HELD", payment.getPaymentStatus());
            throw new RuntimeException("Escrow payment can only be refunded if it is currently held (ESCROW_HELD)");
        }
        
        // 3. Business Rule: Only the contract owner (or admin) can request refund
        if (!payment.getPayerId().equals(userId)) {
            log.error("❌ Unauthorized refund attempt: User {} is not the payer of contract {}", userId, contractId);
            throw new RuntimeException("Only the contract owner can request a refund");
        }
        
        // 4. Fetch task details
        TaskResponse task = taskServiceClient.getTaskById(contractId);
        if (task == null) {
            throw new RuntimeException("Contract task details not found");
        }
        
        // 5. Update payment status to REFUNDED
        payment.setPaymentStatus(PaymentStatus.REFUNDED);
        Payment savedPayment = paymentRepository.save(payment);
        log.info("✅ Payment ID: {} successfully refunded to payer ID: {}", savedPayment.getId(), savedPayment.getPayerId());
        
        // 6. Call Task Service to transition status to CANCELLED
        try {
            UpdateTaskStatusRequest statusRequest = new UpdateTaskStatusRequest("CANCELLED");
            taskServiceClient.updateTaskStatus(contractId, statusRequest);
            log.info("✅ Task status successfully transitioned to CANCELLED for contract ID: {}", contractId);
        } catch (Exception e) {
            log.error("❌ Failed to transition task status: {}", e.getMessage());
            throw new RuntimeException("Payment refunded but failed to update task status in Task Service: " + e.getMessage());
        }
        
        // 7. Send Notifications
        mailService.sendPaymentRefundedNotification(task.getOwnerEmail(), task.getAssignedUserEmail(), task.getTitle(), payment.getAmount());
        
        return savedPayment;
    }
    
    /**
     * Get payment by transaction ID
     */
    public Optional<Payment> getPaymentById(Long id) {
        return paymentRepository.findById(id);
    }
    
    /**
     * Get payment by contract/task ID
     */
    public Optional<Payment> getPaymentByContractId(Long contractId) {
        return paymentRepository.findByContractId(contractId);
    }
    
    /**
     * Check if escrow is held for a contract
     */
    public boolean isEscrowHeld(Long contractId) {
        return paymentRepository.existsByContractIdAndPaymentStatus(contractId, PaymentStatus.ESCROW_HELD);
    }
}
