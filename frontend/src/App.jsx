import { useEffect, useState } from "react";

const API = "http://localhost:5000";

function App() {
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API}/products`);
      const data = await response.json();
      setProducts(data);

      // Create pending suggestions for products currently below threshold
      const lowStockSuggestions = [];

      data.forEach((product) => {
        if (product.stock < product.reorderThreshold) {
          lowStockSuggestions.push({
            id: `price-${product.id}`,
            productId: product.id,
            type: "PRICING",
            triggerReason: "INVENTORY_LOW",
            recommendedPrice: Math.round(product.currentPrice * 1.1),
            recommendedQuantity:
              product.reorderThreshold * 3 - product.stock,
            confidence: 0.9,
            reasoning:
              "Stock is below the reorder threshold, so price is increased by 10%.",
            status: "PENDING",
          });

          lowStockSuggestions.push({
            id: `reorder-${product.id}`,
            productId: product.id,
            type: "REORDER",
            triggerReason: "INVENTORY_LOW",
            recommendedPrice: Math.round(product.currentPrice * 1.1),
            recommendedQuantity:
              product.reorderThreshold * 3 - product.stock,
            confidence: 0.9,
            reasoning:
              "Stock is below the reorder threshold, so additional inventory is recommended.",
            status: "PENDING",
          });
        }
      });

      setSuggestions(lowStockSuggestions);
    } catch (error) {
      setMessage("Cannot connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const simulateSale = async (productId) => {
    try {
      const response = await fetch(
        `${API}/products/${productId}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ quantity: 1 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      setMessage(`Sale simulated for ${data.product.name}`);

      await loadProducts();
    } catch (error) {
      setMessage("Failed to simulate sale.");
    }
  };

  const acceptPricing = async (suggestion) => {
    try {
      const response = await fetch(
        `${API}/pricing-suggestions/${suggestion.productId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "ACCEPT",
            recommendedPrice: suggestion.recommendedPrice,
          }),
        }
      );

      if (!response.ok) {
        setMessage("Failed to accept pricing suggestion.");
        return;
      }

      setSuggestions((current) =>
        current.map((item) =>
          item.id === suggestion.id
            ? { ...item, status: "ACCEPTED" }
            : item
        )
      );

      setProducts((current) =>
        current.map((product) =>
          product.id === suggestion.productId
            ? {
                ...product,
                currentPrice: suggestion.recommendedPrice,
              }
            : product
        )
      );

      setMessage("Pricing suggestion accepted.");
    } catch (error) {
      setMessage("Failed to accept pricing suggestion.");
    }
  };

  const rejectPricing = async (suggestion) => {
    try {
      const response = await fetch(
        `${API}/pricing-suggestions/${suggestion.productId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "REJECT",
          }),
        }
      );

      if (!response.ok) {
        setMessage("Failed to reject pricing suggestion.");
        return;
      }

      setSuggestions((current) =>
        current.map((item) =>
          item.id === suggestion.id
            ? { ...item, status: "REJECTED" }
            : item
        )
      );

      setMessage("Pricing suggestion rejected.");
    } catch (error) {
      setMessage("Failed to reject pricing suggestion.");
    }
  };

  const acceptReorder = async (suggestion) => {
    try {
      const response = await fetch(
        `${API}/reorder-suggestions/${suggestion.productId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "ACCEPT",
            recommendedQuantity: suggestion.recommendedQuantity,
          }),
        }
      );

      if (!response.ok) {
        setMessage("Failed to accept reorder suggestion.");
        return;
      }

      setSuggestions((current) =>
        current.map((item) =>
          item.id === suggestion.id
            ? { ...item, status: "ACCEPTED" }
            : item
        )
      );

      await loadProducts();

      setMessage("Reorder suggestion accepted.");
    } catch (error) {
      setMessage("Failed to accept reorder suggestion.");
    }
  };

  const rejectReorder = async (suggestion) => {
    try {
      const response = await fetch(
        `${API}/reorder-suggestions/${suggestion.productId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "REJECT",
          }),
        }
      );

      if (!response.ok) {
        setMessage("Failed to reject reorder suggestion.");
        return;
      }

      setSuggestions((current) =>
        current.map((item) =>
          item.id === suggestion.id
            ? { ...item, status: "REJECTED" }
            : item
        )
      );

      setMessage("Reorder suggestion rejected.");
    } catch (error) {
      setMessage("Failed to reject reorder suggestion.");
    }
  };

  const pendingSuggestions = suggestions.filter(
    (item) => item.status === "PENDING"
  );

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>StockPulse</h1>
          <p>AI Inventory & Dynamic Pricing Engine</p>
        </div>

        <button className="refresh" onClick={loadProducts}>
          Refresh
        </button>
      </header>

      {message && <div className="message">{message}</div>}

      <main>
        <section className="stats">
          <div className="stat-card">
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>

          <div className="stat-card">
            <span>Pending Suggestions</span>
            <strong>{pendingSuggestions.length}</strong>
          </div>

          <div className="stat-card">
            <span>Low Stock</span>
            <strong>
              {
                products.filter(
                  (p) => p.stock < p.reorderThreshold
                ).length
              }
            </strong>
          </div>
        </section>

        <section className="section">
          <div className="section-title">
            <div>
              <h2>Products</h2>
              <p>Monitor inventory, pricing and demand</p>
            </div>
          </div>

          {loading ? (
            <p>Loading products...</p>
          ) : (
            <div className="product-grid">
              {products.map((product) => {
                const lowStock =
                  product.stock < product.reorderThreshold;

                return (
                  <div className="product-card" key={product.id}>
                    <div className="product-top">
                      <div>
                        <span className="sku">{product.sku}</span>
                        <h3>{product.name}</h3>
                      </div>

                      <span
                        className={
                          lowStock
                            ? "badge danger"
                            : "badge success"
                        }
                      >
                        {lowStock ? "LOW STOCK" : "ACTIVE"}
                      </span>
                    </div>

                    <div className="product-info">
                      <div>
                        <span>Category</span>
                        <strong>{product.category}</strong>
                      </div>

                      <div>
                        <span>Price</span>
                        <strong>₹{product.currentPrice}</strong>
                      </div>

                      <div>
                        <span>Stock</span>
                        <strong>
                          {product.stock} / {product.reorderThreshold}
                        </strong>
                      </div>

                      <div>
                        <span>Demand / 24h</span>
                        <strong>{product.demandVelocity}</strong>
                      </div>
                    </div>

                    <button
                      className="sale-button"
                      onClick={() => simulateSale(product.id)}
                      disabled={product.stock === 0}
                    >
                      Simulate Sale
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-title">
            <div>
              <h2>Merchandising Suggestions</h2>
              <p>Review recommendations before applying changes</p>
            </div>
          </div>

          {pendingSuggestions.length === 0 ? (
            <div className="empty">
              No pending suggestions
            </div>
          ) : (
            <div className="suggestion-list">
              {pendingSuggestions.map((suggestion) => {
                const product = products.find(
                  (p) => p.id === suggestion.productId
                );

                if (!product) return null;

                return (
                  <div
                    className="suggestion-card"
                    key={suggestion.id}
                  >
                    <div className="suggestion-header">
                      <div>
                        <span className="sku">
                          {product.sku}
                        </span>

                        <h3>
                          {product.name} —{" "}
                          {suggestion.type === "PRICING"
                            ? "Pricing Recommendation"
                            : "Reorder Recommendation"}
                        </h3>
                      </div>

                      <span className="badge warning">
                        {suggestion.triggerReason}
                      </span>
                    </div>

                    <div className="recommendation">
                      {suggestion.type === "PRICING" ? (
                        <>
                          <div>
                            <span>Current Price</span>
                            <strong>
                              ₹{product.currentPrice}
                            </strong>
                          </div>

                          <div>
                            <span>Recommended Price</span>
                            <strong>
                              ₹{suggestion.recommendedPrice}
                            </strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span>Current Stock</span>
                            <strong>{product.stock}</strong>
                          </div>

                          <div>
                            <span>Recommended Quantity</span>
                            <strong>
                              {suggestion.recommendedQuantity}
                            </strong>
                          </div>

                          <div>
                            <span>Lead Time</span>
                            <strong>5 days</strong>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="reasoning">
                      <strong>Reasoning</strong>
                      <p>{suggestion.reasoning}</p>
                    </div>

                    <div className="confidence">
                      Confidence:{" "}
                      {Math.round(
                        suggestion.confidence * 100
                      )}
                      %
                    </div>

                    <div className="actions">
                      <button
                        className="accept"
                        onClick={() =>
                          suggestion.type === "PRICING"
                            ? acceptPricing(suggestion)
                            : acceptReorder(suggestion)
                        }
                      >
                        Accept
                      </button>

                      <button
                        className="reject"
                        onClick={() =>
                          suggestion.type === "PRICING"
                            ? rejectPricing(suggestion)
                            : rejectReorder(suggestion)
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;