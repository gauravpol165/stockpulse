const express = require("express");

const router = express.Router();

let products = [
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

// GET all products
router.get("/", (req, res) => {
  res.json(products);
});

// POST new product
router.post("/", (req, res) => {
  const product = {
    id: products.length + 1,
    ...req.body,
    status: "ACTIVE"
  };

  products.push(product);

  res.status(201).json(product);
});

module.exports = router;