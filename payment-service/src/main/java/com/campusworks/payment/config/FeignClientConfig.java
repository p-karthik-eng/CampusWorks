package com.campusworks.payment.config;

import feign.RequestInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Feign Client Configuration
 * Propagates user authentication headers from API Gateway down to microservices
 */
@Configuration
public class FeignClientConfig {
    
    @Bean
    public RequestInterceptor authHeaderInterceptor() {
        return template -> {
            ServletRequestAttributes attributes = 
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                
                String userId = request.getHeader("X-User-Id");
                String userEmail = request.getHeader("X-User-Email");
                String userRoles = request.getHeader("X-User-Roles");
                
                if (userId != null) template.header("X-User-Id", userId);
                if (userEmail != null) template.header("X-User-Email", userEmail);
                if (userRoles != null) template.header("X-User-Roles", userRoles);
            }
        };
    }
}
