# 🎓 CampusWorks - Complete Codebase & Architectural Analysis

Welcome to the comprehensive codebase and architectural analysis of the **CampusWorks** project. This document provides a file-by-file, service-by-service investigation of the system structure, design patterns, security protocols, database setups, and API endpoints, as well as a list of identified system gaps and future enhancement tracks.

---

## 1. System Overview & Core Business Workflows

# CampusWorks – Campus Student Service Marketplace

**CampusWorks** is a peer-to-peer campus service marketplace designed exclusively for university students. It connects students who need assistance with verified peers who can provide **technical services, academic support, or on-campus errand services**, creating a trusted marketplace for skill sharing, emergency task completion, and everyday campus needs.

The platform functions as a localized micro-gig marketplace (connecting workers with short-term tasks), similar to Upwork or Fiverr, but tailored specifically for campus life. Students can either request assistance or offer their skills by creating service listings across multiple categories.

### Core Services

* **Technical Services**

  * Custom programming assignments and coding assistance
  * Database design and SQL setup
  * Web development support
  * Debugging and software troubleshooting
  * Documentation formatting and report preparation
  * Mathematical equation formatting (LaTeX)
  * Lab diagram digitization and technical drawing

* **Academic Support**

  * Record writing and note preparation
  * Assignment formatting
  * Lab report organization
  * Presentation preparation
  * Study material creation
  * Emergency academic assistance for urgent deadlines

* **Campus Errand Services**

  * Xerox/printing requests
  * Library book pickup or return
  * Collecting study materials
  * Delivering documents between departments or hostels
  * Purchasing small campus essentials
  * Any quick, location-based student task that another student can complete

---


### B. Ethical Gating & System Design Choices
- **High-Trust Campus Gating**: By forcing registration through official college email domains (`n######@rguktn.ac.in`), the system restricts transactions to verified members of the student body, mitigating anonymous scams and malicious third-party contract cheating services.
- **Double Role System Flexibility**: Built as a single-role (`STUDENT`) system. Traditional platforms enforce a strict split between "Buyers" and "Sellers." In a campus ecosystem, a student might buy a custom illustration service for a web app one day, and work as a freelance Python coder the next. CampusWorks handles this fluid role-switching gracefully at the database level.
- **Fair Market Reverse Auction**: The bidding service runs an automated reverse auction scheduler. By auto-assigning the task to the lowest bidder when the timer expires, the system ensures fair pricing and prevents exploitation or price gouging within the student community.

### 🔑 Core Business Pillars & Rules:
1. **Single Student Role**: All registered users are `STUDENT`s by default (except one admin). A student can both post freelance contracts and bid on contracts posted by others.
2. **Owner Bidding Restriction**: Students are strictly blocked from placing bids on contracts they created to prevent bid manipulation and conflict of interest.
3. **Automatic Bid Selection**: Once a contract's bidding deadline expires, a background scheduler automatically selects the **lowest bid amount**. In case of a tie, the **earliest placed bid** wins.
4. **Contract Modification Constraints**:
   - Owners can only edit or delete a contract while it is in the `OPEN` state.
   - Once a contract has received bids, editing or deleting is locked to protect bidders who have already spent time analyzing the requirements.
   - If the bidding deadline passes with zero bids, the owner can edit or delete the contract to adjust the budget or description.
5. **Two-Stage Escrow & Validation (Conceptual / Manual)**:
   - When a bid is accepted, the status shifts to `IN_PROGRESS`.
   - The worker completes the contract offline, submits their UPI ID online, and notifies completion.
   - The contract owner verifies the work offline, reviews the UPI ID, and accepts it online, which completes the contract lifecycle (`COMPLETED`).

---

## 2. Microservices Architecture & Topography

CampusWorks is built on a **Spring Cloud Microservices Architecture** paired with a **NodeJS Real-Time Chat Service** and a **Vite React Frontend**.

```
                           ┌──────────────────────────────────────────┐
                           │            Vite React Client             │
                           │               (Port 3000)                │
                           └────────────────────┬─────────────────────┘
                                                │ (HTTP / WebSockets)
                                                ▼
     ┌───────────────────────────────────────────────────────────────────────────────────┐
     │                             API Gateway (Port 8080)                               │
     │     - Route Dispatching, Centralized CORS, JWT Validation & Header Injection      │
     └──────────┬───────────────────────────────┬─────────────────────────────┬──────────┘
                │ (Feign / HTTP)                │ (Feign / HTTP)              │ (WebSockets)
                ▼                               ▼                             ▼
    ┌───────────────────────┐       ┌───────────────────────┐     ┌───────────────────────┐
    │     Auth Service      │       │     Task Service      │     │  Chat Service (Node)  │
    │      (Port 9000)      │       │      (Port 9001)      │     │      (Port 3001)      │
    ├───────────────────────┤       ├───────────────────────┤     ├───────────────────────┤
    │ - Reg & Verification  │       │ - Task CRUD & Status  │     │ - real-time WS chat   │
    │ - Login & JWT Issuer  │       │ - Deadline Management │     │ - Task room isolation │
    └──────────┬────────────┘       └───────────┬───────────┘     └───────────┬───────────┘
                │                               │                             │
                ▼                               ▼                             ▼
    ┌───────────────────────┐       ┌───────────────────────┐                 │
    │    Bidding Service    │◄─────►│    Profile Service    │                 │
    │      (Port 9002)      │ Feign │      (Port 9003)      │                 │
    ├───────────────────────┤       ├───────────────────────┤                 │
    │ - Bid management      │       │ - User profiles       │                 │
    │ - Auto-assignment     │       │ - Task statistics     │                 │
    └──────────┬────────────┘       └───────────┬───────────┘                 │
                │                               │                             │
                ▼                               ▼                             ▼
    ┌───────────────────────────────────────────────────────┐     ┌───────────────────────┐
    │               MySQL Databases (1 per Service)         │     │     MongoDB Chat      │
    │    `tcampusworks_auth`, `tcampusworks_bids`, etc.     │     │ `campusworks_chat` DB │
    └───────────────────────────────────────────────────────┘     └───────────────────────┘
```

*Note: All microservices automatically register with the **Eureka Discovery Server** (running on Port 8761) to allow dynamic route resolution and OpenFeign service-to-service calls.*

---

## 3. Service-by-Service Deep-Dive

### A. Eureka Server (`eureka-server`)
- **Port**: `8761`
- **Main Class**: [EurekaServerApplication.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/eureka-server/src/main/java/com/campusworks/eureka/EurekaServerApplication.java)
- **Role**: Registry lookup hub for all services.
- **Key Settings**:
  - `eureka.client.register-with-eureka=false` & `eureka.client.fetch-registry=false` (avoids registering itself).
  - Self-preservation is disabled for fast eviction of offline instances in development.

### B. API Gateway (`api-gateway`)
- **Port**: `8080`
- **Main Class**: [ApiGatewayApplication.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/api-gateway/src/main/java/com/campusworks/gateway/ApiGatewayApplication.java)
- **CORS Handling**: Done centrally in [SecurityConfig.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/api-gateway/src/main/java/com/campusworks/gateway/security/SecurityConfig.java). It allows requests from `http://localhost:3000`, enables cookies/credentials, and exposes auth headers (`Authorization`, `X-User-Id`, etc.).
- **JWT Validation Filter**: In [JwtAuthFilter.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/api-gateway/src/main/java/com/campusworks/gateway/security/JwtAuthFilter.java), incoming requests are inspected.
  - Skips endpoints starting with `/auth/`, `/api/auth/`, `/actuator/`, `/health`, or `/info`.
  - Parses the JWT signature against the secret key.
  - Extracts the subject (User ID), email, and roles claims, then injects them as downstream headers:
    - `X-User-Id`
    - `X-User-Email`
    - `X-User-Roles`

### C. Auth Service (`auth-service`)
- **Port**: `9000` (mapped as `lb://auth-service` via gateway route `/api/auth/**`)
- **Database**: `tcampusworks_auth`
- **Main Controller**: [AuthController.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/auth-service/src/main/java/com/campusworks/auth/controller/AuthController.java)
- **Important Features**:
  - **College Email Verification**: In [EmailValidationService.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/auth-service/src/main/java/com/campusworks/auth/service/EmailValidationService.java), registration requires a domain pattern match: `^n\d{6}@rguktn\.ac\.in$`. It extracts the student ID (e.g. `210419` from `n210419`) and calculates their academic year.
  - **Inactive Account State**: Newly registered users are created with `enabled = false` and `emailVerified = false`. They are only enabled after validating their unique token via a generated verification URL emailed to them.
  - **Token Blacklisting**: Includes [TokenBlacklistService.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/auth-service/src/main/java/com/campusworks/auth/service/TokenBlacklistService.java) to record logged-out JWT tokens in the database, preventing reuse of active tokens.
  - **Auto-created Admin**: Generates a default admin (`admin@campusworks.com` / `admin123`) on startup.

### D. Task Service (`task-service`)
- **Port**: `9001`
- **Database**: `tcampusworks_tasks`
- **Main Class**: [TaskService.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/task-service/src/main/java/com/campusworks/task/service/TaskService.java)
- **Status Lifecycle**: States are tracked via the `TaskStatus` enum: `OPEN` ➔ `ASSIGNED` (same as `IN_PROGRESS` in some contexts) ➔ `COMPLETED` ➔ `ACCEPTED` (or `CANCELLED`).
- **Deadline Logic**:
  - Bidding deadline and task completion deadline are explicitly defined by the contract owner (requester) during task posting.
  - No default calculations or hardcoded offset constraints (such as the previous 30-hour minimum interval) are enforced.
  - The system performs sanity checks only: the bidding deadline must be in the future, and the completion deadline must be chronologically after the bidding deadline. This enables emergency assignments or fast errand tasks.

### E. Bidding Service (`bidding-service`)
- **Port**: `9002`
- **Database**: `tcampusworks_bids`
- **Main Class**: [BiddingService.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/bidding-service/src/main/java/com/campusworks/bidding/service/BiddingService.java)
- **Background Schedulers**:
  1. `processExpiredBiddingDeadlines()`: Runs periodically (`bidding.auto-assignment-check-interval`). Finds tasks where the bidding period has ended. It queries the database for all bids ordered by amount ascending and time ascending. It awards the task to the lowest bidder (tie-broken by placement timestamp) and rejects the remaining bids.
  2. `processExpiredTasks()`: Scans tasks and auto-cancels any task where the completion deadline expired before work was accepted.
- **Milestone Actions**:
  - `submitUpiId()`: Allows the winning bidder to store their UPI identifier after the work is completed.
  - `viewUpiId()`: Allows the task owner to fetch the worker's UPI address to process payment offline.
  - `acceptCompletedWork()`: Moves the task status to `COMPLETED` and locks the transaction.

### F. Profile Service (`profile-service`)
- **Port**: `9003`
- **Database**: `tcampusworks_profile`
- **Main Class**: [ProfileService.java](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/profile-service/src/main/java/com/campusworks/profile/service/ProfileService.java)
- **Role**: Tracks user attributes, majors, academic year mapping (e.g. `E1` ➔ Year 3), and aggregates task records:
  - `completedTasks` (number of tasks worked on)
  - `successfulTasks` (completed tasks successfully verified and accepted by owners)
  - `totalEarnings` (accrued earnings balance from task budgets)

### G. Chat Service (`campusworks-chat-service`)
- **Port**: `3001`
- **Tech Stack**: NodeJS, Express, Socket.io, MongoDB (`campusworks_chat` database).
- **Class**: [server.js](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/campusworks-chat-service/src/server.js) & [socketHandler.js](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/campusworks-chat-service/src/socket/socketHandler.js)
- **Access Gating**: In `validateTaskAccess()`, the socket handler validates that the task status is `IN_PROGRESS` and that the user ID corresponds to either the task owner or the assigned worker. Unauthenticated or unassigned users are denied room entry.

### H. Frontend Application (`campus-works-frontend`)
- **Port**: `3000` (proxies `/api` routes to the gateway at `http://localhost:8080`)
- **Tech Stack**: Vite + React, Redux Toolkit (`@store`), Material-UI (`@theme`), Axios.
- **Routing**: Handled in [App.jsx](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/campus-works-frontend/src/App.jsx). Uses `ProtectedRoute` to enforce authentication or redirect logged-out users to `/login`.
- **API Wrapper**: Centralized in [api/index.js](file:///c:/Users/Nithinkumar/Desktop/Lakshman%20Desktop/desktop/CampusWorks-V1/campus-works-frontend/src/services/api/index.js) with request interceptors injecting the JWT Bearer token, and response interceptors routing 401 Unauthorized errors back to `/login`.

---

## 4. Database Schema Design & Isolation

Each service uses its own isolated MySQL database schema (enforced in `application.properties`), adhering to the **Database-per-Service** architectural pattern to avoid database coupling.

### 🗄️ Database Schemas:

#### 1. `tcampusworks_auth`
- **`users` Table**: ID, email, encrypted password, role (STUDENT, ADMIN), enabled, email_verified, email_verified_at, created_at, updated_at.
- **`verification_tokens` Table**: ID, token, user_id, expiry_date, created_at.
- **`blacklisted_tokens` Table**: ID, token, reason, blacklisted_at.

#### 2. `tcampusworks_tasks`
- **`tasks` Table**: ID, title, description, budget, category, status (OPEN, ASSIGNED, COMPLETED, ACCEPTED, CANCELLED), owner_id, owner_email, assigned_user_id, assigned_user_email, bidding_deadline, completion_deadline, completed_at, accepted_at, created_at, updated_at.

#### 3. `tcampusworks_bids`
- **`bids` Table**: ID, task_id, bidder_id, bidder_email, amount, proposal, status (PENDING, ACCEPTED, REJECTED, WITHDRAWN, CANCELLED), is_winning, is_accepted, upi_id, upi_submitted, upi_submitted_at, upi_viewed, upi_viewed_at, rejection_reason, created_at, updated_at.

#### 4. `tcampusworks_profile`
- **`profiles` Table**: ID, user_id, user_email, first_name, last_name, university, major, academic_year, completed_tasks, successful_tasks, total_earnings, is_verified, is_public, availability_status, last_active, created_at, updated_at.

#### 5. MongoDB Database (`campusworks_chat`)
- **`messages` Collection**: Task room message logs containing task_id, sender_id, message_content, timestamp.

---

## 5. Inter-Service Communication Details

The microservices communicate asynchronously via REST calls using **Spring Cloud OpenFeign** clients. 

### Header Propagation Interceptor:
To ensure the target microservice knows who is calling it, each service contains a Feign configuration that intercepts outbound requests and forwards the user context headers received from the API Gateway:

```java
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
                String roles = request.getHeader("X-User-Roles");
                
                if (userId != null) template.header("X-User-Id", userId);
                if (userEmail != null) template.header("X-User-Email", userEmail);
                if (roles != null) template.header("X-User-Roles", roles);
            }
        };
    }
}
```

---

## 6. Identified Architectural Gaps & Discrepancies

During our codebase inspection, we identified several gaps between the documentation (`TOTAL_BACKEND_DOCUMENT.md` and `CampusWorks_Project_Blueprint.md`) and the actual implementation:

1. 🛑 **Missing Payment Service**: 
   - Both the Blueprint and the Gateway config point to a Payment Service on Port `8084` or `9004` (routing requests under `/api/payments/**` to `lb://payment-service`).
   - The React frontend defines a payment API service that attempts to interact with this path.
   - **Gap**: The Payment Service codebase does not exist, and there is no database schema or package configured for it.
2. 🛑 **Unimplemented Rating Endpoint**:
   - `TOTAL_BACKEND_DOCUMENT.md` describes a profile rating endpoint: `PUT /profiles/user/{userId}/rating`.
   - The React frontend has a matching method `profiles.addRating` calling this path.
   - **Gap**: In the Profile Service, `AddRatingRequest` is defined as a DTO class within `ProfileController.java`, but no endpoint mapping or service logic exists to accept or calculate user ratings. Calling this endpoint from the UI will return a `404 Not Found` or `405 Method Not Allowed`.
3. ⚠️ **Port Configuration Discrepancies**:
   - `CampusWorks_Project_Blueprint.md` lists ports for services as Auth (9001), Task (9002), Bidding (9003), and Profile (9006).
   - The actual `application.properties` files configure them as Auth (9000), Task (9001), Bidding (9002), and Profile (9003).
   - **Impact**: While dynamic routing via Eureka works fine, manual testing using hardcoded ports or static links might fail due to these document conflicts.

---

## 7. Recommended Next Steps

To round out the platform and bridge these gaps, we recommend working on the following files/folders:
1. **Implement Profile Rating Endpoints**: Add a mapping in `ProfileController.java` to handle the `AddRatingRequest` and update the average rating fields in the `Profile` model.
2. **Build the Payment Microservice**: Create a new Spring Boot service (`payment-service`) on port `9004` using the properties configured in the gateway, implementing escrow logic, wallets, or test gateways (e.g. Razorpay).
3. **Harmonize Documentation Ports**: Update `CampusWorks_Project_Blueprint.md` to match the actual ports used in the codebase (`9000` to `9003`) to avoid confusion for new developers.
