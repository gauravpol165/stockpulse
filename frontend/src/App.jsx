import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

function App() {
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [strategy, setStrategy] = useState("AI");
  const [loading, setLoading] = useState(false);

  // --------------------------------------------------
  // Load products
  // --------------------------------------------------

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API}/products`);
      const data = await response.json();

      if (response.ok) {
        setProducts(data);
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  };

  // --------------------------------------------------
  // Load current strategy
  // --------------------------------------------------

  const loadStrategy = async () => {
    try {
      const response = await fetch(`${API}/strategy`);
      const data = await response.json();

      if (response.ok) {
        setStrategy(data.strategy);
      }
    } catch (error) {
      console.error("Failed to load strategy:", error);
    }
  };

  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------

  useEffect(() => {
    loadProducts();
    loadStrategy();
  }, []);

  // --------------------------------------------------
  // Refresh
  // --------------------------------------------------

  const refreshData = async () => {
    setLoading(true);

    await Promise.all([
      loadProducts(),
      loadStrategy()
    ]);

    setLoading(false);
  };

  // --------------------------------------------------
  // Simulate Sale
  // --------------------------------------------------

  const simulateSale = async (productId) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${API}/products/${productId}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            quantity: 1
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message);
        return;
      }

      setSuggestions((prev) => ({
        ...prev,
        [productId]: {
          pricing: data.pricingSuggestion,
          reorder: data.reorderSuggestion
        }
      }));

      await loadProducts();
    } catch (error) {
      alert("Could not connect to backend");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Accept Pricing
  // IMPORTANT: backend expects suggestion.id
  // --------------------------------------------------

  const acceptPricing = async (suggestion) => {
    if (!suggestion) return;

    try {
      const response = await fetch(
        `${API}/pricing-suggestions/${suggestion.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "ACCEPT",
            recommendedPrice: suggestion.recommendedPrice
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message);
        return;
      }

      setSuggestions((prev) => ({
        ...prev,
        [suggestion.productId]: {
          ...prev[suggestion.productId],
          pricing: {
            ...suggestion,
            status: "ACCEPTED"
          }
        }
      }));

      await loadProducts();
    } catch (error) {
      alert("Could not update pricing suggestion");
    }
  };

  // --------------------------------------------------
  // Reject Pricing
  // --------------------------------------------------

  const rejectPricing = async (suggestion) => {
    if (!suggestion) return;

    try {
      const response = await fetch(
        `${API}/pricing-suggestions/${suggestion.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "REJECT"
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message);
        return;
      }

      setSuggestions((prev) => ({
        ...prev,
        [suggestion.productId]: {
          ...prev[suggestion.productId],
          pricing: {
            ...suggestion,
            status: "REJECTED"
          }
        }
      }));
    } catch (error) {
      alert("Could not reject pricing suggestion");
    }
  };

  // --------------------------------------------------
  // Accept Reorder
  // IMPORTANT: backend expects suggestion.id
  // --------------------------------------------------

  const acceptReorder = async (suggestion) => {
    if (!suggestion) return;

    try {
      const response = await fetch(
        `${API}/reorder-suggestions/${suggestion.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "ACCEPT",
            recommendedQuantity: suggestion.recommendedQuantity
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message);
        return;
      }

      setSuggestions((prev) => ({
        ...prev,
        [suggestion.productId]: {
          ...prev[suggestion.productId],
          reorder: {
            ...suggestion,
            status: "ACCEPTED"
          }
        }
      }));

      await loadProducts();
    } catch (error) {
      alert("Could not update reorder suggestion");
    }
  };

  // --------------------------------------------------
  // Reject Reorder
  // --------------------------------------------------

  const rejectReorder = async (suggestion) => {
    if (!suggestion) return;

    try {
      const response = await fetch(
        `${API}/reorder-suggestions/${suggestion.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "REJECT"
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message);
        return;
      }

      setSuggestions((prev) => ({
        ...prev,
        [suggestion.productId]: {
          ...prev[suggestion.productId],
          reorder: {
            ...suggestion,
            status: "REJECTED"
          }
        }
      }));
    } catch (error) {
      alert("Could not reject reorder suggestion");
    }
  };

  // --------------------------------------------------
  // Summary calculations
  // --------------------------------------------------

  const lowStockCount = products.filter(
    (product) =>
      product.stock < product.reorderThreshold
  ).length;

  const pendingSuggestions = Object.values(
    suggestions
  ).reduce((count, item) => {
    if (item.pricing?.status === "PENDING") {
      count++;
    }

    if (item.reorder?.status === "PENDING") {
      count++;
    }

    return count;
  }, 0);

  return (
    <div className="app">

      {/* --------------------------------------------------
          Header
      -------------------------------------------------- */}

      <header className="header">

        <div>
          <h1>StockPulse</h1>
          <p>Inventory & Pricing Intelligence</p>
        </div>

        <div className="header-actions">

          <span className={`strategy ${strategy.toLowerCase()}`}>
            {strategy === "AI"
              ? "AI MODE"
              : "RULE MODE"}
          </span>

          <button
            className="refresh-btn"
            onClick={refreshData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

        </div>

      </header>

      <main>

        {/* --------------------------------------------------
            Summary
        -------------------------------------------------- */}

        <div className="summary">

          <div className="summary-card">
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>

          <div className="summary-card">
            <span>Low Stock</span>
            <strong>{lowStockCount}</strong>
          </div>

          <div className="summary-card">
            <span>Pending Suggestions</span>
            <strong>{pendingSuggestions}</strong>
          </div>

          <div className="summary-card">
            <span>Recommendation Mode</span>
            <strong>{strategy}</strong>
          </div>

        </div>

        {/* --------------------------------------------------
            Products
        -------------------------------------------------- */}

        <section>

          <div className="section-title">
            <div>
              <h2>Products</h2>
              <p>
                Monitor inventory and merchandising signals
              </p>
            </div>
          </div>

          <div className="product-grid">

            {products.map((product) => {

              const lowStock =
                product.stock <
                product.reorderThreshold;

              const peerProducts =
                products.filter(
                  (p) =>
                    p.category === product.category &&
                    p.id !== product.id
                );

              const categoryAverage =
                peerProducts.length > 0
                  ? peerProducts.reduce(
                      (sum, p) =>
                        sum + p.demandVelocity,
                      0
                    ) / peerProducts.length
                  : product.demandVelocity;

              const demandSpike =
                product.demandVelocity >
                categoryAverage * 2;

              const suggestion =
                suggestions[product.id];

              return (
                <div
                  className="product-card"
                  key={product.id}
                >

                  {/* Product Header */}

                  <div className="product-top">

                    <div>

                      <span className="sku">
                        {product.sku}
                      </span>

                      <h3>
                        {product.name}
                      </h3>

                      <span className="category">
                        {product.category}
                      </span>

                    </div>

                    <div className="badges">

                      {lowStock && (
                        <span className="status low">
                          LOW STOCK
                        </span>
                      )}

                      {demandSpike && (
                        <span className="status spike">
                          DEMAND SPIKE
                        </span>
                      )}

                      {!lowStock &&
                        !demandSpike && (
                          <span className="status active">
                            ACTIVE
                          </span>
                        )}

                    </div>

                  </div>

                  {/* Product Metrics */}

                  <div className="details">

                    <div>
                      <span>Price</span>
                      <strong>
                        ₹{product.currentPrice}
                      </strong>
                    </div>

                    <div>
                      <span>Stock</span>
                      <strong>
                        {product.stock}
                      </strong>
                    </div>

                    <div>
                      <span>Threshold</span>
                      <strong>
                        {product.reorderThreshold}
                      </strong>
                    </div>

                    <div>
                      <span>Demand / 24h</span>
                      <strong>
                        {product.demandVelocity}
                      </strong>
                    </div>

                  </div>

                  {/* Stock Bar */}

                  <div className="stock-section">

                    <div className="stock-label">
                      <span>Inventory level</span>

                      <span>
                        {product.stock}/
                        {product.reorderThreshold}
                      </span>
                    </div>

                    <div className="stock-bar">

                      <div
                        className={
                          lowStock
                            ? "stock-fill low-fill"
                            : "stock-fill"
                        }
                        style={{
                          width: `${Math.min(
                            100,
                            (product.stock /
                              Math.max(
                                product.reorderThreshold,
                                1
                              )) *
                              100
                          )}%`
                        }}
                      />

                    </div>

                  </div>

                  {/* Simulate Sale */}

                  <button
                    className="sale-btn"
                    onClick={() =>
                      simulateSale(product.id)
                    }
                    disabled={
                      loading ||
                      product.stock === 0
                    }
                  >
                    Simulate Sale
                  </button>

                  {/* --------------------------------------------------
                      Pricing Suggestion
                  -------------------------------------------------- */}

                  {suggestion?.pricing && (
                    <div className="suggestion">

                      <div className="suggestion-header">

                        <strong>
                          Pricing Recommendation
                        </strong>

                        <span className="badge">
                          {suggestion.pricing.triggerReason}
                        </span>

                      </div>

                      <p className="price-change">

                        ₹{suggestion.pricing.currentPrice}

                        <span> → </span>

                        <strong>
                          ₹{suggestion.pricing.recommendedPrice}
                        </strong>

                      </p>

                      <p className="reason">
                        {suggestion.pricing.reasoning}
                      </p>

                      <div className="confidence">

                        Confidence:{" "}
                        {Math.round(
                          suggestion.pricing.confidence *
                            100
                        )}
                        %

                      </div>

                      {suggestion.pricing.status ===
                      "PENDING" ? (

                        <div className="actions">

                          <button
                            className="accept"
                            onClick={() =>
                              acceptPricing(
                                suggestion.pricing
                              )
                            }
                          >
                            Accept
                          </button>

                          <button
                            className="reject"
                            onClick={() =>
                              rejectPricing(
                                suggestion.pricing
                              )
                            }
                          >
                            Reject
                          </button>

                        </div>

                      ) : (

                        <div className="decision">
                          {suggestion.pricing.status}
                        </div>

                      )}

                    </div>
                  )}

                  {/* --------------------------------------------------
                      Reorder Suggestion
                  -------------------------------------------------- */}

                  {suggestion?.reorder && (
                    <div className="suggestion">

                      <div className="suggestion-header">

                        <strong>
                          Reorder Recommendation
                        </strong>

                        <span className="badge">
                          {suggestion.reorder.triggerReason}
                        </span>

                      </div>

                      <p className="price-change">

                        Recommended quantity:{" "}

                        <strong>
                          {suggestion.reorder.recommendedQuantity}
                        </strong>

                      </p>

                      <p className="reason">
                        {suggestion.reorder.reasoning}
                      </p>

                      <div className="confidence">

                        Confidence:{" "}
                        {Math.round(
                          suggestion.reorder.confidence *
                            100
                        )}
                        %

                      </div>

                      {suggestion.reorder.status ===
                      "PENDING" ? (

                        <div className="actions">

                          <button
                            className="accept"
                            onClick={() =>
                              acceptReorder(
                                suggestion.reorder
                              )
                            }
                          >
                            Accept
                          </button>

                          <button
                            className="reject"
                            onClick={() =>
                              rejectReorder(
                                suggestion.reorder
                              )
                            }
                          >
                            Reject
                          </button>

                        </div>

                      ) : (

                        <div className="decision">
                          {suggestion.reorder.status}
                        </div>

                      )}

                    </div>
                  )}

                </div>
              );
            })}

          </div>

        </section>

      </main>

    </div>
  );
}

export default App;