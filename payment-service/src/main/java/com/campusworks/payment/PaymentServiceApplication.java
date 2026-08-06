package com.campusworks.payment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

/**
 * Payment Service Application Entry Point
 * Implements escrow-based trusted payment system with automated .env configuration loader
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@EnableScheduling
@EnableAsync
public class PaymentServiceApplication {
    public static void main(String[] args) {
        // Load configurations from .env before Spring starts
        loadDotEnv();
        
        SpringApplication.run(PaymentServiceApplication.class, args);
    }
    
    private static void loadDotEnv() {
        try {
            // Check .env in current directory (service root) or parent directory (workspace root)
            String[] paths = {".env", "../.env"};
            for (String pathStr : paths) {
                File envFile = new File(pathStr);
                if (envFile.exists()) {
                    List<String> lines = Files.readAllLines(Paths.get(pathStr));
                    for (String line : lines) {
                        line = line.trim();
                        // Ignore empty lines and comments
                        if (line.isEmpty() || line.startsWith("#")) {
                            continue;
                        }
                        int eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            String key = line.substring(0, eqIdx).trim();
                            String value = line.substring(eqIdx + 1).trim();
                            
                            // Strip surrounding single/double quotes if present
                            if (value.startsWith("\"") && value.endsWith("\"")) {
                                value = value.substring(1, value.length() - 1);
                            } else if (value.startsWith("'") && value.endsWith("'")) {
                                value = value.substring(1, value.length() - 1);
                            }
                            
                            // Load key-value directly into JVM System Properties
                            System.setProperty(key, value);
                        }
                    }
                    System.out.println("✅ Environment loaded successfully from: " + envFile.getAbsolutePath());
                    break; // Stop checking once we find and load one file
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️ Failed to load environment variables from .env: " + e.getMessage());
        }
    }
}
