require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Product data
const products = [
  {
    id: 1,
    sku: "PRD-003",
    name: "T-Shirt",
    category: "APPAREL",
    currentPrice: 799,
    stock: 8,
    reorderThreshold: 15,
    demandVelocity: 10,
    status: "ACTIVE"
  },
  {
    id: 2,
    sku: "PRD-008",
    name: "Hoodie",
    category: "APPAREL",
    currentPrice: 1499,
    stock: 11,
    reorderThreshold: 12,
    demandVelocity: 15,
    status: "ACTIVE"
  }
];

async function getAIRecommendation(product, triggerReason) {
  const prompt = `
You are an inventory and pricing advisor.

Product: ${product.name}
Category: ${product.category}
Current price: ${product.currentPrice}
Current stock: ${product.stock}
Reorder threshold: ${product.reorderThreshold}
Demand velocity: ${product.demandVelocity}
Trigger: ${triggerReason}

Give a practical recommendation for the merchandising team.

Return ONLY valid JSON:
{
  "recommendedPrice": number,
  "direction": "INCREASE" or "DECREASE" or "HOLD",
  "confidence": number,
  "recommendedQuantity": number,
  "reasoning": "short explanation"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });

    const text = response.text;

    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
    } catch (error) {
    console.log("AI error:", error.message);

    return {
      recommendedPrice:
        product.stock < product.reorderThreshold
          ? Math.round(product.currentPrice * 1.10)
          : product.currentPrice,

      direction:
        product.stock < product.reorderThreshold
          ? "INCREASE"
          : "HOLD",

      confidence: 0.90,

      recommendedQuantity:
        Math.max(
          1,
          (product.reorderThreshold * 3) - product.stock
        ),

      reasoning:
        "Rule-based fallback used because the AI service was temporarily unavailable."
    };
  }
}

// --------------------------------------------------
// Commerce Advisor
// --------------------------------------------------

function commerceAdvisor(product, type) {

  // Pricing recommendation
  if (type === "PRICING") {

    // Inventory low
    if (product.stock < product.reorderThreshold) {
      return {
        recommendedPrice: Math.round(
          product.currentPrice * 1.10
        ),
        direction: "INCREASE",
        confidence: 0.90,
        reasoning:
          "Stock is below the reorder threshold, so price is increased by 10%.",
        triggerReason: "INVENTORY_LOW"
      };
    }

    // Demand spike
    if (product.demandVelocity > 20) {
      return {
        recommendedPrice: Math.round(
          product.currentPrice * 1.05
        ),
        direction: "INCREASE",
        confidence: 0.85,
        reasoning:
          "Demand velocity is high, so price is increased by 5%.",
        triggerReason: "DEMAND_SPIKE"
      };
    }

    return null;
  }

  // Reorder recommendation
  if (type === "REORDER") {

    if (product.stock < product.reorderThreshold) {

      const quantity =
        (product.reorderThreshold * 3) -
        product.stock;

      return {
        recommendedQuantity: Math.max(1, quantity),
        suggestedLeadTimeDays: 5,
        confidence: 0.90,
        reasoning:
          "Stock is below the reorder threshold, so additional inventory is recommended.",
        triggerReason: "INVENTORY_LOW"
      };
    }

    return null;
  }

  return null;
}

// --------------------------------------------------
// Create Pricing Suggestion
// --------------------------------------------------

function createPricingSuggestion(product) {

  const recommendation =
    commerceAdvisor(product, "PRICING");

  if (!recommendation) {
    return null;
  }

  return {
    productId: product.id,
    currentPrice: product.currentPrice,
    recommendedPrice:
      recommendation.recommendedPrice,
    direction:
      recommendation.direction,
    confidence:
      recommendation.confidence,
    reasoning:
      recommendation.reasoning,
    triggerReason:
      recommendation.triggerReason,
    status: "PENDING"
  };
}

// --------------------------------------------------
// Create Reorder Suggestion
// --------------------------------------------------

function createReorderSuggestion(product) {

  const recommendation =
    commerceAdvisor(product, "REORDER");

  if (!recommendation) {
    return null;
  }

  return {
    productId: product.id,
    currentStock: product.stock,
    recommendedQuantity:
      recommendation.recommendedQuantity,
    suggestedLeadTimeDays:
      recommendation.suggestedLeadTimeDays,
    confidence:
      recommendation.confidence,
    reasoning:
      recommendation.reasoning,
    triggerReason:
      recommendation.triggerReason,
    status: "PENDING"
  };
}

// --------------------------------------------------
// Home
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "StockPulse backend is running"
  });
});

app.get("/test-ai", async (req, res) => {
  const result = await getAIRecommendation(products[0], "INVENTORY_LOW");

  res.json(result);
});

app.post("/products/:id/suggest-pricing", async (req, res) => {
  const product = products.find(
    p => p.id === Number(req.params.id)
  );

  if (!product) {
    return res.status(404).json({
      message: "Product not found"
    });
  }

  const result = await getAIRecommendation(
    product,
    product.stock < product.reorderThreshold
      ? "INVENTORY_LOW"
      : "MANUAL"
  );

  if (!result) {
    return res.status(500).json({
      message: "Could not generate recommendation"
    });
  }

  res.json({
    productId: product.id,
    currentPrice: product.currentPrice,
    ...result,
    triggerReason:
      product.stock < product.reorderThreshold
        ? "INVENTORY_LOW"
        : "MANUAL",
    status: "PENDING"
  });
});

app.post("/products/:id/suggest-reorder", async (req, res) => {
  const product = products.find(
    p => p.id === Number(req.params.id)
  );

  if (!product) {
    return res.status(404).json({
      message: "Product not found"
    });
  }

  const result = await getAIRecommendation(
    product,
    "INVENTORY_LOW"
  );

  if (!result) {
    return res.status(500).json({
      message: "Could not generate recommendation"
    });
  }

  res.json({
    productId: product.id,
    currentStock: product.stock,
    recommendedQuantity: result.recommendedQuantity,
    suggestedLeadTimeDays: 5,
    confidence: result.confidence,
    reasoning: result.reasoning,
    triggerReason: "INVENTORY_LOW",
    status: "PENDING"
  });
});

// --------------------------------------------------
// Get Products
// --------------------------------------------------

app.get("/products", (req, res) => {
  res.json(products);
});

// --------------------------------------------------
// Update Stock
// --------------------------------------------------

app.patch("/products/:id/stock", (req, res) => {

  const product = products.find(
    p => p.id === Number(req.params.id)
  );

  if (!product) {
    return res.status(404).json({
      message: "Product not found"
    });
  }

  const { stock } = req.body;

  if (
    typeof stock !== "number" ||
    stock < 0
  ) {
    return res.status(400).json({
      message: "Stock must be a valid number"
    });
  }

  product.stock = stock;

  const pricingSuggestion =
    createPricingSuggestion(product);

  const reorderSuggestion =
    createReorderSuggestion(product);

  res.json({
    product,
    pricingSuggestion,
    reorderSuggestion
  });
});

// --------------------------------------------------
// Accept / Reject Pricing Suggestion
// --------------------------------------------------

app.patch(
  "/pricing-suggestions/:id",
  (req, res) => {

    const product = products.find(
      p => p.id === Number(req.params.id)
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    const {
      action,
      recommendedPrice
    } = req.body;

    if (
      action !== "ACCEPT" &&
      action !== "REJECT"
    ) {
      return res.status(400).json({
        message:
          "Action must be ACCEPT or REJECT"
      });
    }

    if (action === "ACCEPT") {

      if (
        typeof recommendedPrice !== "number" ||
        recommendedPrice <= 0
      ) {
        return res.status(400).json({
          message:
            "Recommended price must be positive"
        });
      }

      product.currentPrice =
        recommendedPrice;
    }

    res.json({
      message:
        action === "ACCEPT"
          ? "Pricing suggestion accepted"
          : "Pricing suggestion rejected",

      product,

      status:
        action === "ACCEPT"
          ? "ACCEPTED"
          : "REJECTED"
    });
  }
);

// --------------------------------------------------
// Accept / Reject Reorder Suggestion
// --------------------------------------------------

app.patch(
  "/reorder-suggestions/:id",
  (req, res) => {

    const product = products.find(
      p => p.id === Number(req.params.id)
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    const {
      action,
      recommendedQuantity
    } = req.body;

    if (
      action !== "ACCEPT" &&
      action !== "REJECT"
    ) {
      return res.status(400).json({
        message:
          "Action must be ACCEPT or REJECT"
      });
    }

    if (action === "ACCEPT") {

      if (
        !Number.isInteger(
          recommendedQuantity
        ) ||
        recommendedQuantity <= 0
      ) {
        return res.status(400).json({
          message:
            "Recommended quantity must be a positive integer"
        });
      }

      // Simulate incoming inventory
      product.stock +=
        recommendedQuantity;
    }

    res.json({
      message:
        action === "ACCEPT"
          ? "Reorder suggestion accepted"
          : "Reorder suggestion rejected",

      product,

      status:
        action === "ACCEPT"
          ? "ACCEPTED"
          : "REJECTED"
    });
  }
);

// --------------------------------------------------
// Place Order / Simulate Sale
// --------------------------------------------------

app.post(
  "/products/:id/orders",
  (req, res) => {

    const product = products.find(
      p => p.id === Number(req.params.id)
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    const { quantity } = req.body;

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        message:
          "Quantity must be a positive integer"
      });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        message: "Not enough stock"
      });
    }

    // Reduce inventory
    product.stock -= quantity;

    // Run commerce advisor
    const pricingSuggestion =
      createPricingSuggestion(product);

    const reorderSuggestion =
      createReorderSuggestion(product);

    res.json({
      message:
        "Order placed successfully",

      product,

      pricingSuggestion,

      reorderSuggestion
    });
  }
);

// --------------------------------------------------
// Start Server
// --------------------------------------------------

const PORT = 5000;

app.listen(PORT, () => {
  console.log(
    `StockPulse backend running on http://localhost:${PORT}`
  );
});