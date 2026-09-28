require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const express = require("express");
const cors = require("cors");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const app = express();

app.use(cors());
app.use(express.json());


// --------------------------------------------------
// Recommendation strategy
// --------------------------------------------------

let recommendationStrategy = "AI";


// --------------------------------------------------
// Product data
// --------------------------------------------------

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
    stock: 30,
    reorderThreshold: 12,
    demandVelocity: 30,
    status: "ACTIVE"
  }
];


// --------------------------------------------------
// Suggestion storage
// --------------------------------------------------

const pricingSuggestions = [];
const reorderSuggestions = [];


// --------------------------------------------------
// Check duplicate pending suggestions
// --------------------------------------------------

function hasPendingPricingSuggestion(
  productId,
  triggerReason
) {
  return pricingSuggestions.some(
    suggestion =>
      suggestion.productId === productId &&
      suggestion.triggerReason === triggerReason &&
      suggestion.status === "PENDING"
  );
}


function hasPendingReorderSuggestion(
  productId,
  triggerReason
) {
  return reorderSuggestions.some(
    suggestion =>
      suggestion.productId === productId &&
      suggestion.triggerReason === triggerReason &&
      suggestion.status === "PENDING"
  );
}


// --------------------------------------------------
// AI Recommendation
// --------------------------------------------------

async function getAIRecommendation(
  product,
  triggerReason
) {

  let triggerContext = "";

  if (triggerReason === "INVENTORY_LOW") {

    triggerContext = `
The product has low inventory.
Focus on protecting remaining inventory and recommending
a sensible price adjustment and reorder quantity.
`;

  } else if (triggerReason === "DEMAND_SPIKE") {

    triggerContext = `
The product is experiencing a demand spike compared with
other products in its category.
Focus on capturing increased demand while maintaining
a sensible price and sufficient replenishment.
`;

  } else {

    triggerContext = `
This is a manual recommendation request.
Provide a balanced pricing and replenishment recommendation.
`;
  }


  const prompt = `
You are an inventory and pricing advisor.

Product: ${product.name}
Category: ${product.category}
Current price: ${product.currentPrice}
Current stock: ${product.stock}
Reorder threshold: ${product.reorderThreshold}
Demand velocity: ${product.demandVelocity}
Trigger: ${triggerReason}

${triggerContext}

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

    const response =
      await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt
      });


    const text = response.text;


    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();


    const result =
      JSON.parse(cleaned);


    if (
      typeof result.recommendedPrice !== "number" ||
      result.recommendedPrice <= 0 ||
      typeof result.recommendedQuantity !== "number" ||
      !Number.isInteger(
        result.recommendedQuantity
      ) ||
      result.recommendedQuantity <= 0 ||
      typeof result.confidence !== "number" ||
      result.confidence < 0 ||
      result.confidence > 1
    ) {

      throw new Error(
        "Invalid AI response"
      );
    }


    return result;


  } catch (error) {

    console.log(
      "AI error:",
      error.message
    );


    return getRuleRecommendation(
      product,
      triggerReason
    );
  }
}


// --------------------------------------------------
// Rule-based Recommendation
// --------------------------------------------------

function getRuleRecommendation(
  product,
  triggerReason
) {

  let recommendedPrice =
    product.currentPrice;

  let direction = "HOLD";

  let reasoning =
    "Rule-based recommendation generated.";


  if (
    product.stock <
    product.reorderThreshold
  ) {

    recommendedPrice =
      Math.round(
        product.currentPrice * 1.10
      );

    direction = "INCREASE";

    reasoning =
      "Stock is below the reorder threshold, so price is increased by 10%.";

  } else if (
    triggerReason === "DEMAND_SPIKE"
  ) {

    recommendedPrice =
      Math.round(
        product.currentPrice * 1.05
      );

    direction = "INCREASE";

    reasoning =
      "Demand velocity is significantly above the demand of other products in the category, so price is increased by 5%.";

  }


  return {

    recommendedPrice,

    direction,

    confidence:
      triggerReason === "DEMAND_SPIKE"
        ? 0.85
        : 0.90,

    recommendedQuantity:
      Math.max(
        1,
        (product.reorderThreshold * 3) -
        product.stock
      ),

    reasoning

  };
}


// --------------------------------------------------
// Main Recommendation Strategy
// --------------------------------------------------

async function getRecommendation(
  product,
  triggerReason
) {

  if (
    recommendationStrategy === "RULE"
  ) {

    return getRuleRecommendation(
      product,
      triggerReason
    );

  }


  return await getAIRecommendation(
    product,
    triggerReason
  );
}


// --------------------------------------------------
// Commerce Advisor - Rule Based
// --------------------------------------------------

function commerceAdvisor(
  product,
  type
) {

  if (type === "PRICING") {

    if (
      product.stock <
      product.reorderThreshold
    ) {

      return {

        recommendedPrice:
          Math.round(
            product.currentPrice * 1.10
          ),

        direction:
          "INCREASE",

        confidence:
          0.90,

        reasoning:
          "Stock is below the reorder threshold, so price is increased by 10%.",

        triggerReason:
          "INVENTORY_LOW"

      };
    }


    if (
      product.demandVelocity > 20
    ) {

      return {

        recommendedPrice:
          Math.round(
            product.currentPrice * 1.05
          ),

        direction:
          "INCREASE",

        confidence:
          0.85,

        reasoning:
          "Demand velocity is high, so price is increased by 5%.",

        triggerReason:
          "DEMAND_SPIKE"

      };
    }


    return null;
  }


  if (type === "REORDER") {

    if (
      product.stock <
      product.reorderThreshold
    ) {

      const quantity =
        (product.reorderThreshold * 3) -
        product.stock;


      return {

        recommendedQuantity:
          Math.max(
            1,
            quantity
          ),

        suggestedLeadTimeDays:
          5,

        confidence:
          0.90,

        reasoning:
          "Stock is below the reorder threshold, so additional inventory is recommended.",

        triggerReason:
          "INVENTORY_LOW"

      };
    }


    if (
      product.demandVelocity > 20
    ) {

      const quantity =
        Math.max(
          1,
          (product.reorderThreshold * 3) -
          product.stock
        );


      return {

        recommendedQuantity:
          quantity,

        suggestedLeadTimeDays:
          5,

        confidence:
          0.85,

        reasoning:
          "Demand velocity is high, so additional inventory is recommended.",

        triggerReason:
          "DEMAND_SPIKE"

      };
    }


    return null;
  }


  return null;
}


// --------------------------------------------------
// Home
// --------------------------------------------------

app.get(
  "/",
  (req, res) => {

    res.json({
      message:
        "StockPulse backend is running"
    });

  }
);


// --------------------------------------------------
// Get current strategy
// --------------------------------------------------

app.get(
  "/strategy",
  (req, res) => {

    res.json({
      strategy:
        recommendationStrategy
    });

  }
);


// --------------------------------------------------
// Change strategy at runtime
// --------------------------------------------------

app.post(
  "/strategy",
  (req, res) => {

    const { strategy } =
      req.body;


    if (
      strategy !== "AI" &&
      strategy !== "RULE"
    ) {

      return res.status(400).json({

        message:
          "Strategy must be AI or RULE"

      });

    }


    recommendationStrategy =
      strategy;


    res.json({

      message:
        `Recommendation strategy changed to ${strategy}`,

      strategy:
        recommendationStrategy

    });

  }
);


// --------------------------------------------------
// Test AI / Recommendation
// --------------------------------------------------

app.get(
  "/test-ai",
  async (req, res) => {

    const result =
      await getRecommendation(
        products[0],
        "INVENTORY_LOW"
      );


    res.json({

      strategy:
        recommendationStrategy,

      ...result

    });

  }
);


// --------------------------------------------------
// Get Products
// --------------------------------------------------

app.get(
  "/products",
  (req, res) => {

    res.json(products);

  }
);


// --------------------------------------------------
// AI / Rule Pricing Suggestion
// --------------------------------------------------

app.post(
  "/products/:id/suggest-pricing",
  async (req, res) => {

    const product =
      products.find(
        p =>
          p.id ===
          Number(req.params.id)
      );


    if (!product) {

      return res.status(404).json({

        message:
          "Product not found"

      });

    }


    let triggerReason =
      "MANUAL";


    if (
      product.stock <
      product.reorderThreshold
    ) {

      triggerReason =
        "INVENTORY_LOW";

    } else {

      const peerProducts =
        products.filter(
          p =>
            p.category ===
              product.category &&
            p.id !== product.id
        );


      const categoryAverageDemand =
        peerProducts.length > 0

          ? peerProducts.reduce(
              (sum, p) =>
                sum + p.demandVelocity,
              0
            ) / peerProducts.length

          : product.demandVelocity;


      if (
        product.demandVelocity >
        categoryAverageDemand * 2
      ) {

        triggerReason =
          "DEMAND_SPIKE";

      }

    }


    if (
      hasPendingPricingSuggestion(
        product.id,
        triggerReason
      )
    ) {

      return res.json({

        message:
          "A pending pricing suggestion already exists",

        duplicate:
          true,

        triggerReason,

        status:
          "PENDING"

      });

    }


    const result =
      await getRecommendation(
        product,
        triggerReason
      );


    const suggestion = {

      id:
        pricingSuggestions.length + 1,

      productId:
        product.id,

      currentPrice:
        product.currentPrice,

      recommendedPrice:
        result.recommendedPrice,

      direction:
        result.direction,

      confidence:
        result.confidence,

      reasoning:
        result.reasoning,

      triggerReason,

      strategy:
        recommendationStrategy,

      status:
        "PENDING"

    };


    pricingSuggestions.push(
      suggestion
    );


    res.json(
      suggestion
    );

  }
);


// --------------------------------------------------
// AI / Rule Reorder Suggestion
// --------------------------------------------------

app.post(
  "/products/:id/suggest-reorder",
  async (req, res) => {

    const product =
      products.find(
        p =>
          p.id ===
          Number(req.params.id)
      );


    if (!product) {

      return res.status(404).json({

        message:
          "Product not found"

      });

    }


    const triggerReason =
      "INVENTORY_LOW";


    if (
      hasPendingReorderSuggestion(
        product.id,
        triggerReason
      )
    ) {

      return res.json({

        message:
          "A pending reorder suggestion already exists",

        duplicate:
          true,

        triggerReason,

        status:
          "PENDING"

      });

    }


    const result =
      await getRecommendation(
        product,
        triggerReason
      );


    const suggestion = {

      id:
        reorderSuggestions.length + 1,

      productId:
        product.id,

      currentStock:
        product.stock,

      recommendedQuantity:
        result.recommendedQuantity,

      suggestedLeadTimeDays:
        5,

      confidence:
        result.confidence,

      reasoning:
        result.reasoning,

      triggerReason,

      strategy:
        recommendationStrategy,

      status:
        "PENDING"

    };


    reorderSuggestions.push(
      suggestion
    );


    res.json(
      suggestion
    );

  }
);


// --------------------------------------------------
// Update Stock
// --------------------------------------------------

app.patch(
  "/products/:id/stock",
  async (req, res) => {

    const product =
      products.find(
        p =>
          p.id ===
          Number(req.params.id)
      );


    if (!product) {

      return res.status(404).json({

        message:
          "Product not found"

      });

    }


    const { stock } =
      req.body;


    if (
      typeof stock !== "number" ||
      stock < 0
    ) {

      return res.status(400).json({

        message:
          "Stock must be a valid number"

      });

    }


    product.stock =
      stock;


    let pricingSuggestion =
      null;

    let reorderSuggestion =
      null;


    const peerProducts =
      products.filter(
        p =>
          p.category ===
            product.category &&
          p.id !== product.id
      );


    const categoryAverageDemand =
      peerProducts.length > 0

        ? peerProducts.reduce(
            (sum, p) =>
              sum + p.demandVelocity,
            0
          ) / peerProducts.length

        : product.demandVelocity;


    const inventoryLow =
      product.stock <
      product.reorderThreshold;


    const demandSpike =
      product.demandVelocity >
      categoryAverageDemand * 2;


    let triggerReason =
      null;


    if (inventoryLow) {

      triggerReason =
        "INVENTORY_LOW";

    } else if (demandSpike) {

      triggerReason =
        "DEMAND_SPIKE";

    }


    if (triggerReason) {

      if (
        !hasPendingPricingSuggestion(
          product.id,
          triggerReason
        )
      ) {

        const result =
          await getRecommendation(
            product,
            triggerReason
          );


        pricingSuggestion = {

          id:
            pricingSuggestions.length + 1,

          productId:
            product.id,

          currentPrice:
            product.currentPrice,

          recommendedPrice:
            result.recommendedPrice,

          direction:
            result.direction,

          confidence:
            result.confidence,

          reasoning:
            result.reasoning,

          triggerReason,

          strategy:
            recommendationStrategy,

          status:
            "PENDING"

        };


        pricingSuggestions.push(
          pricingSuggestion
        );

      }


      if (
        !hasPendingReorderSuggestion(
          product.id,
          triggerReason
        )
      ) {

        const result =
          await getRecommendation(
            product,
            triggerReason
          );


        reorderSuggestion = {

          id:
            reorderSuggestions.length + 1,

          productId:
            product.id,

          currentStock:
            product.stock,

          recommendedQuantity:
            result.recommendedQuantity,

          suggestedLeadTimeDays:
            5,

          confidence:
            result.confidence,

          reasoning:
            result.reasoning,

          triggerReason,

          strategy:
            recommendationStrategy,

          status:
            "PENDING"

        };


        reorderSuggestions.push(
          reorderSuggestion
        );

      }

    }


    res.json({

      product,

      pricingSuggestion,

      reorderSuggestion

    });

  }
);


// --------------------------------------------------
// Accept / Reject Pricing Suggestion
// --------------------------------------------------

app.patch(
  "/pricing-suggestions/:id",
  (req, res) => {

    const suggestion =
      pricingSuggestions.find(
        s =>
          s.id ===
          Number(req.params.id)
      );


    if (!suggestion) {

      return res.status(404).json({

        message:
          "Pricing suggestion not found"

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


    const product =
      products.find(
        p =>
          p.id ===
          suggestion.productId
      );


    if (!product) {

      return res.status(404).json({

        message:
          "Product not found"

      });

    }


    if (action === "ACCEPT") {

      if (
        typeof recommendedPrice !==
          "number" ||
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


    suggestion.status =
      action === "ACCEPT"
        ? "ACCEPTED"
        : "REJECTED";


    res.json({

      message:
        action === "ACCEPT"
          ? "Pricing suggestion accepted"
          : "Pricing suggestion rejected",

      product,

      suggestion

    });

  }
);


// --------------------------------------------------
// Accept / Reject Reorder Suggestion
// --------------------------------------------------

app.patch(
  "/reorder-suggestions/:id",
  (req, res) => {

    const suggestion =
      reorderSuggestions.find(
        s =>
          s.id ===
          Number(req.params.id)
      );


    if (!suggestion) {

      return res.status(404).json({

        message:
          "Reorder suggestion not found"

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


    const product =
      products.find(
        p =>
          p.id ===
          suggestion.productId
      );


    if (!product) {

      return res.status(404).json({

        message:
          "Product not found"

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


      product.stock +=
        recommendedQuantity;

    }


    suggestion.status =
      action === "ACCEPT"
        ? "ACCEPTED"
        : "REJECTED";


    res.json({

      message:
        action === "ACCEPT"
          ? "Reorder suggestion accepted"
          : "Reorder suggestion rejected",

      product,

      suggestion

    });

  }
);


// --------------------------------------------------
// Place Order / Simulate Sale
// --------------------------------------------------

app.post(
  "/products/:id/orders",
  async (req, res) => {

    const product =
      products.find(
        p =>
          p.id ===
          Number(req.params.id)
      );


    if (!product) {

      return res.status(404).json({

        message:
          "Product not found"

      });

    }


    const { quantity } =
      req.body;


    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {

      return res.status(400).json({

        message:
          "Quantity must be a positive integer"

      });

    }


    if (
      quantity > product.stock
    ) {

      return res.status(400).json({

        message:
          "Not enough stock"

      });

    }


    // Reduce inventory

    product.stock -=
      quantity;


    // Increase demand velocity

    product.demandVelocity +=
      quantity;


    let pricingSuggestion =
      null;

    let reorderSuggestion =
      null;


    // --------------------------------------------------
    // Automatic triggers
    // --------------------------------------------------

    const peerProducts =
      products.filter(
        p =>
          p.category ===
            product.category &&
          p.id !== product.id
      );


    const categoryAverageDemand =
      peerProducts.length > 0

        ? peerProducts.reduce(
            (sum, p) =>
              sum + p.demandVelocity,
            0
          ) / peerProducts.length

        : product.demandVelocity;


    const inventoryLow =
      product.stock <
      product.reorderThreshold;


    const demandSpike =
      product.demandVelocity >
      categoryAverageDemand * 2;


    let triggerReason =
      null;


    if (inventoryLow) {

      triggerReason =
        "INVENTORY_LOW";

    } else if (demandSpike) {

      triggerReason =
        "DEMAND_SPIKE";

    }


    // --------------------------------------------------
    // Generate automatic suggestions
    // --------------------------------------------------

    if (triggerReason) {

      // Pricing suggestion

      if (
        !hasPendingPricingSuggestion(
          product.id,
          triggerReason
        )
      ) {

        const result =
          await getRecommendation(
            product,
            triggerReason
          );


        pricingSuggestion = {

          id:
            pricingSuggestions.length + 1,

          productId:
            product.id,

          currentPrice:
            product.currentPrice,

          recommendedPrice:
            result.recommendedPrice,

          direction:
            result.direction,

          confidence:
            result.confidence,

          reasoning:
            result.reasoning,

          triggerReason,

          strategy:
            recommendationStrategy,

          status:
            "PENDING"

        };


        pricingSuggestions.push(
          pricingSuggestion
        );

      }


      // Reorder suggestion

      if (
        !hasPendingReorderSuggestion(
          product.id,
          triggerReason
        )
      ) {

        const result =
          await getRecommendation(
            product,
            triggerReason
          );


        reorderSuggestion = {

          id:
            reorderSuggestions.length + 1,

          productId:
            product.id,

          currentStock:
            product.stock,

          recommendedQuantity:
            result.recommendedQuantity,

          suggestedLeadTimeDays:
            5,

          confidence:
            result.confidence,

          reasoning:
            result.reasoning,

          triggerReason,

          strategy:
            recommendationStrategy,

          status:
            "PENDING"

        };


        reorderSuggestions.push(
          reorderSuggestion
        );

      }

    }


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

app.listen(
  PORT,
  () => {

    console.log(
      `StockPulse backend running on http://localhost:${PORT}`
    );

  }
);