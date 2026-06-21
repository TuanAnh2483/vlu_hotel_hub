# Sơ đồ cấu trúc 2 model AI của HotelHub

Tài liệu mô tả kiến trúc 2 tính năng AI trong backend:

1. **Chatbot** (trợ lý đặt phòng / quản lý) — dùng Gemini **function-calling**.
2. **Gợi ý giá** (AI Pricing) — engine luật + **Logistic Regression** tự học, kèm Gemini sinh lý do.

---

## 1. Chatbot (Gemini Function-Calling)

### 1.1. Sơ đồ thành phần

```mermaid
flowchart TD
    subgraph Client["Client (Web)"]
        U["Khách / Đối tác"]
    end

    subgraph Controller["ChatController"]
        EP["POST /api/chat/customer<br/>POST /api/chat/partner<br/>+ /stream (SSE)"]
        RL["ChatRateLimiter<br/>(IP + role)"]
        EX["chatStreamExecutor<br/>(propagate SecurityContext)"]
    end

    subgraph Orchestrator["ChatService — orchestrator"]
        LOOP["Vòng lặp function-calling<br/>(tối đa 5 lượt)"]
        CONF["PendingActionStore<br/>(xác nhận tool ghi)"]
        MV["modelView()<br/>cắt field nặng khỏi history"]
        CARDS["emitCards()<br/>SSE thẻ KS / thanh toán / phòng"]
    end

    subgraph Session["State"]
        HIST["ChatSessionService<br/>(history, trim 20)"]
    end

    subgraph LLM["ChatGeminiClient"]
        GEN["generate() / generateStream()<br/>retry + backoff"]
        GAPI["Google Gemini API<br/>gemini-2.5-flash-lite"]
    end

    subgraph Tools["Tool layer"]
        DECL["ChatTools<br/>(function declarations)"]
        CTS["CustomerToolService<br/>(search_rooms, suggest_hotels,<br/>create_booking_hold, cancel...)"]
        PTS["PartnerToolService<br/>(get_today_overview, set_room_price,<br/>block_room, reply_to_review...)"]
    end

    subgraph Domain["Domain services & repositories"]
        SVC["HotelSearchService, BookingService,<br/>PartnerBookingService, ReviewService,<br/>Repositories..."]
    end

    U -->|message + sessionId + context| EP
    EP --> RL
    RL -->|allow| EX
    EX --> LOOP
    LOOP <--> HIST
    LOOP -->|contents + tools + systemPrompt| GEN
    GEN <--> GAPI
    DECL -.->|metadata tools| GEN
    GEN -->|functionCall| LOOP
    LOOP -->|isConfirmRequired?| CONF
    LOOP -->|dispatch| CTS
    LOOP -->|dispatch| PTS
    CTS --> SVC
    PTS --> SVC
    SVC -->|result| LOOP
    LOOP --> MV --> HIST
    LOOP --> CARDS -->|SSE events| U
    GEN -->|text delta| U
```

### 1.2. Luồng xử lý 1 request (sequence)

```mermaid
sequenceDiagram
    autonumber
    participant U as Client
    participant C as ChatController
    participant S as ChatService
    participant G as ChatGeminiClient
    participant API as Gemini API
    participant T as Tool Service

    U->>C: POST /chat/customer (message, sessionId)
    C->>C: rateLimiter.allow(IP+role)
    C->>S: chatCustomer(...)
    S->>S: load history + append user message
    loop tối đa 5 lượt
        S->>G: generate(history, tools, systemPrompt)
        G->>API: generateContent / streamGenerateContent
        API-->>G: text HOẶC functionCall
        alt model gọi tool
            alt tool ghi (cancel/hold/set_price...)
                S->>U: hỏi xác nhận + lưu PendingAction
            else tool đọc
                S->>T: dispatch(name, args)
                T-->>S: result
                S->>S: append functionResponse (modelView)
            end
        else model trả text
            S->>U: trả lời (text / SSE delta)
        end
    end
    S->>S: save history (trim 20)
```

**Điểm chính:**
- Tool **ghi** (`cancel_my_booking`, `create_booking_hold`, `block_room`, `set_room_price`, `reply_to_review`) không chạy ngay — lưu `PendingActionStore` + gửi nút xác nhận, chỉ chạy khi client gửi lại `confirm=true`.
- `modelView()` cắt `coverImage` / `payUrl` / `days` khỏi tool result trước khi đưa vào history → tiết kiệm token (history gửi lại Gemini mỗi lượt).
- Khi Gemini chưa cấu hình key hoặc lỗi/timeout → trả câu fallback thay vì 500.
- Partner cần JWT → controller propagate `SecurityContext` sang worker thread của SSE.

---

## 2. Gợi ý giá (AI Pricing)

### 2.1. Sơ đồ thành phần

```mermaid
flowchart TD
    subgraph Client["Partner Dashboard"]
        P["Đối tác"]
    end

    subgraph Controller["PriceSuggestionController"]
        EP1["GET /price-suggestions"]
        EP2["POST /price-feedback"]
        EP3["GET /revenue-analytics"]
        EP4["POST /train"]
    end

    subgraph Service["PriceSuggestionService — orchestrator"]
        VAL["PricingValidator"]
        SEC["SecurityService (ownerId)"]
    end

    subgraph Engine["Pricing pipeline"]
        OCC["OccupancyForecastService<br/>dự báo lấp đầy/ngày<br/>(EMA smoothing, holiday floor)"]
        ENG["PricingEngineService<br/>demand×weekend×holiday×seasonal<br/>+ LR override + clamp + smoothing"]
        SEAS["SeasonalPricingService"]
        HOL["HolidayService"]
    end

    subgraph Model["ModelTrainingService (self-learning)"]
        MGET["getOrDefault(roomId)<br/>→ PricingModel"]
        TRAIN["trainForRoom() — nightly cron 02:00<br/>Phase1 feedback · Phase2 occupancy · Phase3 LR"]
        OPT["optimizePrice()<br/>argmax(price × P(accept))"]
    end

    subgraph AI["AiReasonService"]
        GP["GeminiPromptBuilder"]
        GC["GeminiClient (async, timeout 10s)"]
        RP["GeminiResponseParser"]
        FB["RuleBasedReasonService (fallback)"]
        GAPI["Gemini API"]
    end

    subgraph Data["Repositories / Entities"]
        DB["RoomRepository, DailyRateRepository,<br/>BookingRepository, PriceFeedbackRepository,<br/>PricingModelRepository"]
    end

    subgraph Out["Output"]
        MAP["PriceSuggestionMapper"]
        RESP["PriceSuggestionResponse<br/>(items + model meta)"]
    end

    P --> EP1 --> Service
    P --> EP2 --> Service
    P --> EP4 --> Service
    Service --> VAL
    Service --> SEC
    Service -->|load room/rates/bookings| DB
    Service --> MGET
    MGET --> DB
    Service --> OCC
    OCC --> ENG
    ENG --> SEAS
    OCC --> HOL
    ENG -->|nếu LR ready| OPT
    OPT --> MGET
    Service --> AI
    GP --> GC --> GAPI
    GC --> RP
    RP --> FB
    AI -->|reasons| MAP
    ENG -->|pricing| MAP
    MAP --> RESP --> P
    EP2 -->|outcome| DB
    TRAIN --> DB
```

### 2.2. Pipeline tính giá cho 1 phòng

```mermaid
flowchart LR
    A["Input: roomId, from, to"] --> B["Load: Room, DailyRate,<br/>Bookings 90 ngày"]
    B --> C["PricingModel<br/>(getOrDefault)"]
    C --> D["OccupancyForecast<br/>dự báo occupancy/ngày"]
    D --> E["PricingEngine: tính giá"]
    E --> E1["demand × weekend ×<br/>holiday × seasonal"]
    E1 --> E2{"LR đã train?"}
    E2 -->|có| E3["optimizePrice()<br/>argmax(price×P)"]
    E2 -->|chưa| E4["giá rule-based"]
    E3 --> F["Soft clamp<br/>(±15/25/35%)"]
    E4 --> F
    F --> G["Day-over-day smoothing<br/>(±20%/ngày)"]
    G --> H["AiReasonService<br/>sinh lý do (Gemini→fallback)"]
    H --> I["PriceSuggestionResponse"]
```

### 2.3. Vòng học của model (training loop)

```mermaid
flowchart TD
    S1["Partner xem đề xuất giá"] --> S2["Quyết định: APPLIED /<br/>APPLIED_PLUS5 / MINUS5 / SKIPPED"]
    S2 -->|POST /price-feedback| S3["PriceFeedback lưu DB"]
    S3 --> S4["Nightly cron 02:00<br/>trainForRoom()"]
    S4 --> P1["Phase 1: học acceptance<br/>→ priceAggressiveness, partnerAdjustment<br/>(time-decay λ=0.025)"]
    S4 --> P2["Phase 2: occupancy lịch sử<br/>→ weekday/weekend boost"]
    S4 --> P3["Phase 3: Logistic Regression<br/>8 features, weighted gradient descent"]
    P1 --> M["PricingModel cập nhật"]
    P2 --> M
    P3 --> M
    M -->|dùng cho lần đề xuất sau| S1
```

**Đặc trưng (features) của Logistic Regression (8 chiều):**

| # | Feature | Ý nghĩa |
|---|---------|---------|
| 0 | bias | hằng số |
| 1 | priceUplift | (giá đề xuất / giá gốc) − 1 |
| 2 | isWeekend | cuối tuần? |
| 3 | isHoliday | ngày lễ? |
| 4 | sin(dow) | chu kỳ thứ trong tuần |
| 5 | cos(dow) | chu kỳ thứ trong tuần |
| 6 | leadTimeNorm | thời gian đặt trước (0=sát ngày, 1=60 ngày) |
| 7 | seasonalDeviation | hệ số mùa vụ − 1.0 |

**Điểm chính:**
- `optimizePrice()` quét giá từ 75%→150% giá gốc, chọn giá tối đa hoá **kỳ vọng doanh thu = giá × P(chấp nhận)**.
- Feedback được **time-decay** (mới hơn = trọng số cao hơn, half-life ≈ 28 ngày).
- Cần tối thiểu **5 feedback** trong cửa sổ 60 ngày mới train (nếu không → `hasSufficientData=false`, dùng rule-based).
- AI sinh lý do (Gemini) có **timeout 10s + cache + fallback rule-based** → không bao giờ chặn luồng tính giá.

---

## So sánh nhanh 2 model

| | Chatbot | Gợi ý giá |
|---|---------|-----------|
| Vai trò AI | Gemini quyết định gọi tool nào (function-calling) | LR tự học + engine luật; Gemini chỉ sinh lý do |
| Tự học | Không (stateless theo session) | Có (nightly training từ feedback) |
| Fallback khi Gemini lỗi | Câu xin lỗi cố định | Lý do rule-based, giá vẫn tính bình thường |
| Đầu vào chính | history hội thoại + context | bookings, dailyRate, feedback, holiday/season |
| Output | text (stream) + thẻ UI | danh sách giá đề xuất theo ngày + lý do |
```
