package com.campusworks.payment.controller;

import com.campusworks.payment.dto.PaymentOrderResponse;
import com.campusworks.payment.dto.PaymentVerificationRequest;
import com.campusworks.payment.model.Payment;
import com.campusworks.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Payment Controller Exposes REST APIs for escrow-based payment processing
 */
@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * Create Razorpay payment order for a contract Step 2a in the Escrow
     * payment flow
     */
    @PostMapping("/order/{contractId}")
    public ResponseEntity<?> createPaymentOrder(@PathVariable Long contractId,
            @RequestHeader(value = "X-User-Id", required = false) String userIdStr) {
        log.info("📥 Request to create payment order for contract ID: {}, Payer: {}", contractId, userIdStr);

        if (userIdStr == null || userIdStr.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User ID is missing from headers");
        }

        try {
            Long payerId = Long.parseLong(userIdStr);
            PaymentOrderResponse order = paymentService.createPaymentOrder(contractId, payerId);
            return ResponseEntity.ok(order);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid User ID format in headers");
        } catch (Exception e) {
            log.error("❌ Failed to create payment order: {}", e.getMessage());
            Map<String, String> errResponse = new HashMap<>();
            errResponse.put("error", "Order creation failed");
            errResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errResponse);
        }
    }

    /**
     * Verify payment signature and hold payment in escrow Step 2b in the Escrow
     * payment flow
     */
    @PostMapping("/verify/{contractId}")
    public ResponseEntity<?> verifyAndHoldPayment(@PathVariable Long contractId,
            @RequestBody PaymentVerificationRequest verification,
            @RequestHeader(value = "X-User-Id", required = false) String userIdStr) {
        log.info("📥 Payment verification request received for contract ID: {}, Payer: {}", contractId, userIdStr);

        if (userIdStr == null || userIdStr.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User ID is missing from headers");
        }

        try {
            Long payerId = Long.parseLong(userIdStr);
            Payment payment = paymentService.verifyAndHoldPayment(contractId, payerId, verification);
            return ResponseEntity.ok(payment);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid User ID format in headers");
        } catch (Exception e) {
            log.error("❌ Failed to verify payment: {}", e.getMessage());
            Map<String, String> errResponse = new HashMap<>();
            errResponse.put("error", "Payment verification failed");
            errResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errResponse);
        }
    }

    /**
     * Deposit escrow payment for a contract (Mock/UPI fallback method) Called
     * by contract owner after bid accepted (bypasses gateway validation)
     */
    @PostMapping("/escrow/{contractId}")
    public ResponseEntity<?> holdPayment(@PathVariable Long contractId,
            @RequestHeader(value = "X-User-Id", required = false) String userIdStr) {
        log.info("📥 Escrow payment request received for contract ID: {}, Payer: {}", contractId, userIdStr);

        if (userIdStr == null || userIdStr.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User ID is missing from headers");
        }

        try {
            Long payerId = Long.parseLong(userIdStr);
            Payment payment = paymentService.holdPayment(contractId, payerId);
            return ResponseEntity.status(HttpStatus.CREATED).body(payment);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid User ID format in headers");
        } catch (Exception e) {
            log.error("❌ Failed to secure escrow payment: {}", e.getMessage());
            Map<String, String> errResponse = new HashMap<>();
            errResponse.put("error", "Escrow payment failed");
            errResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errResponse);
        }
    }

    /**
     * Get payment by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getPaymentById(@PathVariable Long id) {
        log.info("🔍 Fetching payment by ID: {}", id);

        Optional<Payment> paymentOpt = paymentService.getPaymentById(id);
        if (paymentOpt.isPresent()) {
            return ResponseEntity.ok(paymentOpt.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Get payment details by contract/task ID
     */
    @GetMapping("/contract/{contractId}")
    public ResponseEntity<?> getPaymentByContractId(@PathVariable Long contractId) {
        log.info("🔍 Fetching payment for contract ID: {}", contractId);

        Optional<Payment> paymentOpt = paymentService.getPaymentByContractId(contractId);
        if (paymentOpt.isPresent()) {
            return ResponseEntity.ok(paymentOpt.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Check if payment is held for a contract Internal endpoint called by other
     * services (like Task Service)
     */
    @GetMapping("/contract/{contractId}/held")
    public ResponseEntity<Boolean> isEscrowHeld(@PathVariable Long contractId) {
        log.info("🔍 Checking if escrow is held for contract ID: {}", contractId);
        boolean isHeld = paymentService.isEscrowHeld(contractId);
        return ResponseEntity.ok(isHeld);
    }

    /**
     * Release payment to worker Called by contract owner after work is
     * completed and verified
     */
    @PostMapping("/release/{contractId}")
    public ResponseEntity<?> releasePayment(@PathVariable Long contractId,
            @RequestHeader(value = "X-User-Id", required = false) String userIdStr) {
        log.info("📥 Release payment request received for contract ID: {}, Payer: {}", contractId, userIdStr);

        if (userIdStr == null || userIdStr.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User ID is missing from headers");
        }

        try {
            Long ownerId = Long.parseLong(userIdStr);
            Payment payment = paymentService.releasePayment(contractId, ownerId);
            return ResponseEntity.ok(payment);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid User ID format in headers");
        } catch (Exception e) {
            log.error("❌ Failed to release payment: {}", e.getMessage());
            Map<String, String> errResponse = new HashMap<>();
            errResponse.put("error", "Release payment failed");
            errResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errResponse);
        }
    }

    /**
     * Refund payment back to task owner
     */
    @PostMapping("/refund/{contractId}")
    public ResponseEntity<?> refundPayment(@PathVariable Long contractId,
            @RequestHeader(value = "X-User-Id", required = false) String userIdStr) {
        log.info("📥 Refund payment request received for contract ID: {}, Payer: {}", contractId, userIdStr);

        if (userIdStr == null || userIdStr.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User ID is missing from headers");
        }

        try {
            Long ownerId = Long.parseLong(userIdStr);
            Payment payment = paymentService.refundPayment(contractId, ownerId);
            return ResponseEntity.ok(payment);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid User ID format in headers");
        } catch (Exception e) {
            log.error("❌ Failed to refund payment: {}", e.getMessage());
            Map<String, String> errResponse = new HashMap<>();
            errResponse.put("error", "Refund payment failed");
            errResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errResponse);
        }
    }
}
