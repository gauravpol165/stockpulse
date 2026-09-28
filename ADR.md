# 🏗️ StockPulse — Architecture Decision Record

> **StockPulse** is an AI-assisted inventory and dynamic pricing engine that detects inventory and demand signals, generates pricing + reorder recommendations, and keeps a human in control before applying changes.

---

## 📌 1. Context

Online stores often rely on manual inventory and pricing decisions.

StockPulse automates the decision-support part of this process:

```text
📦 Product / Order Event
          ↓
🔍 Detect Commerce Signal
          ↓
🤖 Generate Recommendation
          ↓
👤 Human Approval
          ↓
✅ Apply Approved Change

The main signals currently handled are:

🔻 Low Inventory
📈 Demand Spike
🖱️ Manual Recommendation

The goal of the current implementation is to demonstrate the complete:

Signal → Recommendation → Human Approval → Action

workflow.

⚙️ 2. Architecture Decisions
🧠 Decision 1 — Keep Commerce Logic in the Backend
Problem

Pricing and replenishment decisions should not depend on the frontend.

Decision

Commerce rules are handled in the backend.

The backend checks:

Current stock
Reorder threshold
Demand velocity
Category demand average
Pricing adjustment
Reorder quantity

This allows both API requests and automatic triggers to use the same business logic.

💡 Why?

Keeping the decision logic in one place makes the system easier to understand and prevents business rules from being duplicated in the UI.

⚖️ Trade-off

This keeps the hackathon implementation simple.

In a larger production system, these rules could be separated into dedicated strategy or domain services.

🤖 3. AI Recommendation + Rule-Based Fallback
Problem

Gemini is an external service. API failures, temporary service issues, quota limits, or invalid responses can happen.

Decision

StockPulse uses AI for recommendation generation but keeps a rule-based fallback.

                Recommendation Request
                         │
                         ▼
                    🤖 Gemini
                    /       \
                  OK         Failure
                  │             │
                  ▼             ▼
             AI Result      📋 Rules
                  │             │
                  └──────┬──────┘
                         ▼
                   Recommendation

The recommendation contains:

💰 Recommended price
📊 Pricing direction
📦 Recommended reorder quantity
🎯 Confidence
📝 Reasoning
💡 Why?

The inventory workflow should continue even if the AI service is temporarily unavailable.

⚖️ Trade-off

The rule-based fallback is less flexible than an LLM recommendation, but it provides reliability and predictable behavior.

📈 4. Separate Trigger Contexts
Problem

Low inventory and demand spikes represent different business situations.

For example:

🔻 Low inventory → protect remaining stock and replenish
📈 Demand spike → respond to unusually high demand
Decision

StockPulse identifies the reason for every recommendation:

INVENTORY_LOW
DEMAND_SPIKE
MANUAL

The trigger reason is passed to the recommendation logic so the recommendation can consider the situation that caused it.

💡 Why?

This makes the recommendation easier to understand and gives the merchandising team context about why the suggestion was generated.

⚖️ Trade-off

Trigger-specific handling adds some backend logic, but makes the system clearer and easier to extend.

👤 5. Human Approval Checkpoint
Problem

AI-generated recommendations should not directly modify business data without review.

Decision

Every recommendation starts as:

PENDING

The merchandising user can:

             🤖 Recommendation
                     │
              ┌──────┴──────┐
              │             │
           ✅ Accept      ❌ Reject
              │             │
              ▼             ▼
        Apply Change     No Change

For pricing:

Current Price → Recommended Price

For reorder:

Current Stock + Recommended Quantity
💡 Why?

The system acts as a decision-support tool, while the final business decision remains with the merchandising team.

⚖️ Trade-off

Human approval adds one additional step, but prevents recommendations from being applied automatically without review.

🔄 6. Recommendation Workflow

StockPulse follows a simple agent-style workflow:

👀 OBSERVE
    ↓
🔍 REASON
    ↓
💡 SUGGEST
    ↓
👤 CHECKPOINT
    ↓
⚡ ACT
Example
Customer places order
        ↓
📦 Stock decreases
        ↓
🔍 Check inventory / demand
        ↓
🚨 Trigger detected
        ↓
🤖 Generate pricing + reorder suggestions
        ↓
⏳ Suggestions become PENDING
        ↓
👤 Merchandiser reviews
        ↓
✅ Accept / ❌ Reject
        ↓
📦 Update product
💡 Why?

This separates detection, recommendation, and approval instead of directly changing product data after every event.

⚖️ Trade-off

The current hackathon implementation keeps the workflow lightweight rather than introducing a full distributed event-processing system.

A production implementation could use a message queue for larger workloads.

💾 7. In-Memory Product Storage
Problem

The hackathon has limited implementation time, while the main objective is demonstrating the recommendation workflow.

Decision

The current prototype stores product information in backend memory.

💡 Why?

It avoids additional database setup and allows the complete workflow to run quickly during the hackathon.

⚠️ Trade-off

Data is lost when the backend restarts.

For production, persistent storage such as PostgreSQL would be required.

🌐 8. Single Backend API
Decision

A single Express backend exposes the REST APIs required by the frontend.

Main endpoints include:

Method	Endpoint	Purpose
POST	/products	Create product
GET	/products	Get products
PATCH	/products/:id/stock	Update stock
POST	/products/:id/orders	Simulate sale
POST	/products/:id/suggest-pricing	Generate pricing suggestion
POST	/products/:id/suggest-reorder	Generate reorder suggestion
PATCH	/pricing-suggestions/:id	Accept / reject pricing
PATCH	/reorder-suggestions/:id	Accept / reject reorder
💡 Why?

A single backend keeps the hackathon architecture easy to run, test, and demonstrate.

⚖️ Trade-off

As the application grows, inventory, pricing, AI recommendations, and approval services could be separated.

🧩 9. Extensibility

The current implementation focuses on the core hackathon workflow.

Possible future improvements include:

📊 Business Intelligence
Competitor price comparison
Margin protection
Category-specific pricing rules
🚚 Supply Chain
Supplier information
Supplier lead times
Purchase order generation
🤖 Automation
Automatic application of high-confidence recommendations
Recommendation cooldowns
More advanced demand forecasting
⚡ Real-Time Architecture
Message queues
Server-Sent Events
Event-driven processing

These features are intentionally outside the current implementation scope.

🎯 10. Architecture Summary

The current architecture prioritizes simplicity, reliability, explainability, and human control.

                    ┌───────────────┐
                    │   Frontend    │
                    │ Merchandising │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Express API  │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
          📦 Products    🔍 Rules       🤖 Gemini
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                   💡 Suggestions
                            │
                            ▼
                    👤 Human Approval
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                 💰 Price        📦 Stock
                  Update          Update
🚀 Core Principle

StockPulse does not replace the merchandiser. It gives the merchandiser a faster, data-driven recommendation and keeps the final decision under human control.

📝 11. Final Decision

For the hackathon, StockPulse intentionally uses a lightweight architecture that can demonstrate the complete business flow without unnecessary infrastructure.

The implementation focuses on:

🔍 Detecting meaningful inventory signals
🤖 AI-assisted recommendations
🛡️ Rule-based fallback
👤 Human approval
📦 Inventory updates
💰 Dynamic pricing suggestions
📈 Demand-spike handling
