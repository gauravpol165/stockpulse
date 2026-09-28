# StockPulse

StockPulse is an inventory and dynamic pricing engine for online commerce.

It detects inventory changes, generates pricing and reorder recommendations, and provides a human approval workflow for merchandising teams.

---

## Problem

Online stores often manage pricing and inventory manually.

StockPulse helps automate this process by detecting low inventory and demand conditions and generating recommendations for:

- Product pricing
- Inventory reorder quantity

The final decision remains with the merchandising user through an approval workflow.

---

## Features

- Product inventory dashboard
- Real-time stock updates
- Simulate customer orders/sales
- Automatic low-stock detection
- Pricing recommendations
- Reorder recommendations
- Recommendation confidence and reasoning
- Accept/reject pricing suggestions
- Accept/reject reorder suggestions
- Human approval workflow
- Rule-based commerce advisor
- REST API based frontend-backend communication

---

## Architecture

```text
                    React Frontend
                         |
                         | REST API
                         v
                  Express Backend
                         |
                         v
                Commerce Advisor
                         |
              +----------+----------+
              |                     |
              v                     v
       Pricing Suggestion    Reorder Suggestion
              |                     |
              +----------+----------+
                         |
                         v
                  Human Approval
                    /         \
               Accept          Reject
                  |               |
                  v               v
          Update Product      Keep Product
