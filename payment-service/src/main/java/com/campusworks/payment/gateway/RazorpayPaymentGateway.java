package com.campusworks.payment.gateway;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Razorpay Payment Gateway Implementation
 * Interfaces with Razorpay API using keys configured in properties
 */
@Component
@Slf4j
public class RazorpayPaymentGateway implements PaymentGateway {
    
    @Value("${razorpay.key.id}")
    private String keyId;
    
    @Value("${razorpay.key.secret}")
    private String keySecret;
    
    private RazorpayClient razorpayClient;
    
    @PostConstruct
    public void init() {
        try {
            log.info("💳 Initializing Razorpay Client with Key ID: {}", keyId);
            this.razorpayClient = new RazorpayClient(keyId, keySecret);
        } catch (Exception e) {
            log.error("❌ Failed to initialize Razorpay Client: {}", e.getMessage(), e);
        }
    }
    
    @Override
    public String createOrder(BigDecimal amount, String currency, String receiptId) throws Exception {
        log.info("💰 Creating Razorpay order for amount: {} {}, receipt: {}", amount, currency, receiptId);
        
        if (razorpayClient == null) {
            throw new IllegalStateException("Razorpay Client is not initialized");
        }
        
        // Amount must be in paise (e.g. ₹1.00 = 100 paise)
        BigDecimal paiseAmount = amount.multiply(BigDecimal.valueOf(100));
        int amountInPaise = paiseAmount.intValue();
        
        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", amountInPaise);
        orderRequest.put("currency", currency);
        orderRequest.put("receipt", receiptId);
        orderRequest.put("payment_capture", 1); // Captures transaction automatically
        
        Order order = razorpayClient.orders.create(orderRequest);
        String orderId = order.get("id");
        log.info("✅ Razorpay order created successfully. Order ID: {}", orderId);
        
        return orderId;
    }
    
    @Override
    public boolean verifyPaymentSignature(String orderId, String paymentId, String signature) {
        log.info("🔐 Verifying payment signature for Order: {}, Payment: {}", orderId, paymentId);
        
        try {
            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id", orderId);
            attributes.put("razorpay_payment_id", paymentId);
            attributes.put("razorpay_signature", signature);
            
            boolean verified = Utils.verifyPaymentSignature(attributes, keySecret);
            log.info("🔒 Signature verification result: {}", verified);
            return verified;
        } catch (Exception e) {
            log.error("❌ Exception during signature verification: {}", e.getMessage(), e);
            return false;
        }
    }
}
