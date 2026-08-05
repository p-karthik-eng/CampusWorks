package com.campusworks.payment.gateway;

import java.math.BigDecimal;

/**
 * Payment Gateway Abstraction
 * Allows plug-and-play support for different payment providers
 */
public interface PaymentGateway {
    
    /**
     * Create a transaction order in the payment gateway
     * 
     * @param amount Amount to charge (in main currency unit, e.g., Rupees)
     * @param currency Currency code (e.g. "INR")
     * @param receiptId Unique receipt ID for tracking
     * @return The unique gateway order ID
     * @throws Exception if order creation fails
     */
    String createOrder(BigDecimal amount, String currency, String receiptId) throws Exception;
    
    /**
     * Verify the payment signature returned by the gateway after completion
     * 
     * @param orderId Gateway Order ID
     * @param paymentId Gateway Payment ID
     * @param signature Gateway Signature to verify
     * @return true if signature is valid and authentic
     */
    boolean verifyPaymentSignature(String orderId, String paymentId, String signature);
}
