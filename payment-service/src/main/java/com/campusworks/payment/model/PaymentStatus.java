package com.campusworks.payment.model;

/**
 * Payment Status Enum representing the lifecycle of the escrow payment
 */
public enum PaymentStatus {
    PENDING,
    ESCROW_HELD,
    RELEASED,
    REFUNDED,
    FAILED
}
