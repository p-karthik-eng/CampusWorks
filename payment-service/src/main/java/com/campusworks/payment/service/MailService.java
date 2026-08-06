package com.campusworks.payment.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Mail Service for Payment notifications
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MailService {
    
    private final JavaMailSender mailSender;
    
    @Value("${spring.mail.username}")
    private String fromEmail;
    
    /**
     * Send email notification that escrow payment has been received and held
     */
    @Async
    public void sendEscrowHeldNotification(String payerEmail, String receiverEmail, String taskTitle, BigDecimal amount) {
        // Notify Payer
        try {
            SimpleMailMessage payerMsg = new SimpleMailMessage();
            payerMsg.setFrom(fromEmail);
            payerMsg.setTo(payerEmail);
            payerMsg.setSubject("💳 Escrow Secured - " + taskTitle);
            payerMsg.setText(String.format("""
                Dear Student,
                
                We have received your payment of ₹%s for the contract '%s'.
                
                The amount is now safely held in the CampusWorks Escrow system.
                The worker has been notified that they can safely begin working on your task.
                
                The money will only be released to the worker once you accept and confirm completion of the work.
                
                Best regards,
                CampusWorks Escrow System
                """, amount.toString(), taskTitle));
            mailSender.send(payerMsg);
            log.info("📧 Escrow held notification sent to payer: {}", payerEmail);
        } catch (Exception e) {
            log.error("❌ Failed to send escrow held email to payer: {}", e.getMessage());
        }
        
        // Notify Worker (Receiver)
        try {
            SimpleMailMessage workerMsg = new SimpleMailMessage();
            workerMsg.setFrom(fromEmail);
            workerMsg.setTo(receiverEmail);
            workerMsg.setSubject("🚀 Work Authorized: Escrow Secured - " + taskTitle);
            workerMsg.setText(String.format("""
                Dear Worker,
                
                The contract owner has successfully secured the payment of ₹%s in the CampusWorks Escrow system for the task '%s'.
                
                You are now authorized to start work! You can complete the task knowing your payment is already secured by the platform.
                
                Once finished, please mark the task as complete in your dashboard to request release of the payment.
                
                Best regards,
                CampusWorks Escrow System
                """, amount.toString(), taskTitle));
            mailSender.send(workerMsg);
            log.info("📧 Escrow held notification sent to worker: {}", receiverEmail);
        } catch (Exception e) {
            log.error("❌ Failed to send escrow held email to worker: {}", e.getMessage());
        }
    }
    
    /**
     * Send email notification that escrow has been released to the worker
     */
    @Async
    public void sendPaymentReleasedNotification(String payerEmail, String receiverEmail, String taskTitle, BigDecimal amount) {
        // Notify Payer
        try {
            SimpleMailMessage payerMsg = new SimpleMailMessage();
            payerMsg.setFrom(fromEmail);
            payerMsg.setTo(payerEmail);
            payerMsg.setSubject("✅ Escrow Released - " + taskTitle);
            payerMsg.setText(String.format("""
                Dear Student,
                
                You have approved the completed work for task '%s'.
                
                We have successfully released the payment of ₹%s to the worker.
                
                Thank you for using CampusWorks!
                
                Best regards,
                CampusWorks Escrow System
                """, taskTitle, amount.toString()));
            mailSender.send(payerMsg);
            log.info("📧 Escrow release notification sent to payer: {}", payerEmail);
        } catch (Exception e) {
            log.error("❌ Failed to send escrow release email to payer: {}", e.getMessage());
        }
        
        // Notify Worker (Receiver)
        try {
            SimpleMailMessage workerMsg = new SimpleMailMessage();
            workerMsg.setFrom(fromEmail);
            workerMsg.setTo(receiverEmail);
            workerMsg.setSubject("💰 Escrow Payment Released! - " + taskTitle);
            workerMsg.setText(String.format("""
                Dear Worker,
                
                Great news! The contract owner has accepted your work for task '%s'.
                
                We have released the payment of ₹%s from escrow. The money is now being transferred to your account.
                
                Thank you for your excellent service on the CampusWorks platform!
                
                Best regards,
                CampusWorks Escrow System
                """, taskTitle, amount.toString()));
            mailSender.send(workerMsg);
            log.info("📧 Escrow release notification sent to worker: {}", receiverEmail);
        } catch (Exception e) {
            log.error("❌ Failed to send escrow release email to worker: {}", e.getMessage());
        }
    }
    
    /**
     * Send email notification that payment has been refunded to the payer
     */
    @Async
    public void sendPaymentRefundedNotification(String payerEmail, String receiverEmail, String taskTitle, BigDecimal amount) {
        // Notify Payer
        try {
            SimpleMailMessage payerMsg = new SimpleMailMessage();
            payerMsg.setFrom(fromEmail);
            payerMsg.setTo(payerEmail);
            payerMsg.setSubject("↩️ Escrow Refunded - " + taskTitle);
            payerMsg.setText(String.format("""
                Dear Student,
                
                Your payment of ₹%s for the contract '%s' has been refunded back to your account.
                
                The contract has been cancelled or disputed.
                
                Best regards,
                CampusWorks Escrow System
                """, amount.toString(), taskTitle));
            mailSender.send(payerMsg);
            log.info("📧 Escrow refund notification sent to payer: {}", payerEmail);
        } catch (Exception e) {
            log.error("❌ Failed to send escrow refund email to payer: {}", e.getMessage());
        }
        
        // Notify Worker (Receiver)
        try {
            SimpleMailMessage workerMsg = new SimpleMailMessage();
            workerMsg.setFrom(fromEmail);
            workerMsg.setTo(receiverEmail);
            workerMsg.setSubject("⚠️ Escrow Refunded / Task Cancelled - " + taskTitle);
            workerMsg.setText(String.format("""
                Dear Worker,
                
                The escrow payment of ₹%s for the task '%s' has been refunded to the payer.
                
                This task has been cancelled or resolved via dispute. No further work is required.
                
                Best regards,
                CampusWorks Escrow System
                """, amount.toString(), taskTitle));
            mailSender.send(workerMsg);
            log.info("📧 Escrow refund notification sent to worker: {}", receiverEmail);
        } catch (Exception e) {
            log.error("❌ Failed to send escrow refund email to worker: {}", e.getMessage());
        }
    }
}
