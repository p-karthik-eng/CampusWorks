package com.campusworks.payment.repo;

import com.campusworks.payment.model.Payment;
import com.campusworks.payment.model.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByContractId(Long contractId);
    boolean existsByContractId(Long contractId);
    boolean existsByContractIdAndPaymentStatus(Long contractId, PaymentStatus paymentStatus);
}
