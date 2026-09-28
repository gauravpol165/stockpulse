import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

function App() {
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(false);

  const loadProducts = async () => {
    const response = await fetch(`${API}/products`);
    const data = await response.json();
    setProducts(data);
  };

  useEffect(() => {
    loadProducts();
  }, []);

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

      loadProducts();
    } catch (error) {
      alert("Could not connect to backend");
    } finally {
      setLoading(false);
    }
  };

  const acceptPricing = async (productId, price) => {
    const response = await fetch(
      `${API}/pricing-suggestions/${productId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "ACCEPT",
          recommendedPrice: price
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
        ...prev[productId],
        pricing: {
          ...prev[productId].pricing,
          status: "ACCEPTED"
        }
      }
    }));

    loadProducts();
  };

  const rejectPricing = (productId) => {
    setSuggestions((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        pricing: {
          ...prev[productId].pricing,
          status: "REJECTED"
        }
      }
    }));
  };

  const acceptReorder = async (productId, quantity) => {
    const response = await fetch(
      `${API}/reorder-suggestions/${productId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "ACCEPT",
          recommendedQuantity: quantity
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
        ...prev[productId],
        reorder: {
          ...prev[productId].reorder,
          status: "ACCEPTED"
        }
      }
    }));

    loadProducts();
  };

  const rejectReorder = (productId) => {
    setSuggestions((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        reorder: {
          ...prev[productId].reorder,
          status: "REJECTED"
        }
      }
    }));
  };

  return (
    <div className="app">

      <header className="header">
        <div>
          <h1>StockPulse</h1>
          <p>Inventory & Pricing Console</p>
        </div>

        <button
          className="refresh-btn"
          onClick={loadProducts}
        >
          Refresh
        </button>
      </header>

      <main>

        <div className="summary">
          <div className="summary-card">
            <span>Products</span>
            <strong>{products.length}</strong>
          </div>

          <div className="summary-card">
            <span>Low Stock</span>
            <strong>
              {
                products.filter(
                  (p) => p.stock < p.reorderThreshold
                ).length
              }
            </strong>
          </div>

          <div className="summary-card">
            <span>Pending Suggestions</span>
            <strong>
              {
                Object.values(suggestions).filter(
                  (s) =>
                    s.pricing?.status === "PENDING" ||
                    s.reorder?.status === "PENDING"
                ).length
              }
            </strong>
          </div>
        </div>

        <section>
          <div className="section-title">
            <h2>Products</h2>
            <p>Monitor inventory and merchandising signals</p>
          </div>

          <div className="product-grid">

            {products.map((product) => {

              const lowStock =
                product.stock < product.reorderThreshold;

              const suggestion =
                suggestions[product.id];

              return (
                <div
                  className="product-card"
                  key={product.id}
                >

                  <div className="product-top">

                    <div>
                      <span className="sku">
                        {product.sku}
                      </span>

                      <h3>{product.name}</h3>

                      <span className="category">
                        {product.category}
                      </span>
                    </div>

                    <span
                      className={
                        lowStock
                          ? "status low"
                          : "status active"
                      }
                    >
                      {lowStock
                        ? "LOW STOCK"
                        : "ACTIVE"}
                    </span>

                  </div>

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

                  <button
                    className="sale-btn"
                    onClick={() =>
                      simulateSale(product.id)
                    }
                    disabled={loading || product.stock === 0}
                  >
                    Simulate Sale
                  </button>

                  {suggestion?.pricing && (
                    <div className="suggestion">

                      <div className="suggestion-header">
                        <strong>
                          Pricing Suggestion
                        </strong>

                        <span className="badge">
                          {suggestion.pricing.triggerReason}
                        </span>
                      </div>

                      <p>
                        ₹{suggestion.pricing.currentPrice}
                        {" → "}
                        <strong>
                          ₹{suggestion.pricing.recommendedPrice}
                        </strong>
                      </p>

                      <p className="reason">
                        {suggestion.pricing.reasoning}
                      </p>

                      <span className="confidence">
                        Confidence:{" "}
                        {Math.round(
                          suggestion.pricing.confidence * 100
                        )}
                        %
                      </span>

                      {suggestion.pricing.status ===
                      "PENDING" ? (
                        <div className="actions">

                          <button
                            className="accept"
                            onClick={() =>
                              acceptPricing(
                                product.id,
                                suggestion.pricing
                                  .recommendedPrice
                              )
                            }
                          >
                            Accept
                          </button>

                          <button
                            className="reject"
                            onClick={() =>
                              rejectPricing(product.id)
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

                  {suggestion?.reorder && (
                    <div className="suggestion">

                      <div className="suggestion-header">
                        <strong>
                          Reorder Suggestion
                        </strong>

                        <span className="badge">
                          {suggestion.reorder.triggerReason}
                        </span>
                      </div>

                      <p>
                        Recommended quantity:{" "}
                        <strong>
                          {suggestion.reorder.recommendedQuantity}
                        </strong>
                      </p>

                      <p className="reason">
                        {suggestion.reorder.reasoning}
                      </p>

                      <span className="confidence">
                        Confidence:{" "}
                        {Math.round(
                          suggestion.reorder.confidence * 100
                        )}
                        %
                      </span>

                      {suggestion.reorder.status ===
                      "PENDING" ? (
                        <div className="actions">

                          <button
                            className="accept"
                            onClick={() =>
                              acceptReorder(
                                product.id,
                                suggestion.reorder
                                  .recommendedQuantity
                              )
                            }
                          >
                            Accept
                          </button>

                          <button
                            className="reject"
                            onClick={() =>
                              rejectReorder(product.id)
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