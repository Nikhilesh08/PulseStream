import { useEffect, useState } from "react";
import {
  fetchMetrics,
  fetchFailures,
  retryDelivery,
  triggerTestEvent,
  resetMetrics,
} from "../services/api";
import { INITIAL_CATALOG } from "../data/catalog";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Package,
  PackageX,
  Gauge,
} from "lucide-react";

export const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    successRate: 100,
  });
  const [resetting, setResetting] = useState(false);
  const [failures, setFailures] = useState([]);
  const [products, setProducts] = useState(INITIAL_CATALOG);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const actionableFailureCount = failures.filter(
    (item) => item.actionable !== false,
  ).length;

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, failuresRes] = await Promise.all([
        fetchMetrics(),
        fetchFailures(),
      ]);

      setMetrics(
        metricsRes.data || {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          pending: 0,
          successRate: 100,
        },
      );

      setFailures(Array.isArray(failuresRes.data) ? failuresRes.data : []);
      setErrorMsg("");
    } catch (err) {
      console.error("Error fetching admin data:", err);
      setErrorMsg(
        err.response?.data?.error ||
          err.message ||
          "Could not reach the backend. Is the server running?",
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  // NO setInterval here. Socket.io drives subsequent updates.
  useEffect(() => {
    loadData();

    const handleRealtimeMetrics = () => loadData();
    window.addEventListener(
      "pulsestream:metrics-update",
      handleRealtimeMetrics,
    );

    return () => {
      window.removeEventListener(
        "pulsestream:metrics-update",
        handleRealtimeMetrics,
      );
    };
  }, []);

  const handleResetMetrics = async () => {
    const confirmed = window.confirm(
      "Reset all PulseStream metrics?\n\n" +
        "This will permanently delete all events, deliveries, and in-app notifications and clear pending BullMQ jobs.\n\n" +
        "Users and subscriptions will NOT be deleted.",
    );

    if (!confirmed) return;

    setResetting(true);
    setErrorMsg("");

    try {
      const response = await resetMetrics();
      console.log("✅ Metrics reset successfully:", response.data);

      setMetrics({
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        successRate: 100,
      });
      setFailures([]);

      // Clear notification state elsewhere in the app.
      window.dispatchEvent(new Event("pulsestream:metrics-reset"));

      // Confirm state from MongoDB.
      await loadData();
    } catch (err) {
      console.error("❌ Failed to reset metrics:", err);
      setErrorMsg(
        err.response?.data?.error || err.message || "Failed to reset metrics.",
      );
    } finally {
      setResetting(false);
    }
  };

  const handlePriceChange = async (productId, delta) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setUpdatingId(productId);
    try {
      const newPrice = Math.max(99, product.price + delta);
      const isPriceDrop = newPrice < product.price;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, oldPrice: p.price, price: newPrice } : p,
        ),
      );

      if (isPriceDrop) {
        await triggerTestEvent({
          topicId: product.id,
          type: "price_drop",
          payload: {
            productId: product.id,
            productName: product.name,
            oldPrice: product.price,
            newPrice,
            currency: "USD",
          },
        });
        // NO setTimeout(loadData). Fanout / In-App / Email workers will emit "metrics:update" through Socket.io.
      }
      setErrorMsg("");
    } catch (err) {
      console.error("Failed to trigger automated alert:", err);
      setErrorMsg(
        err.response?.data?.error ||
          err.message ||
          "Failed to trigger the price-drop event — check the backend logs.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStock = (productId) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, inStock: !p.inStock } : p)),
    );
  };

  const handleRetryJob = async (id) => {
    setRetryingId(id);
    try {
      await retryDelivery(id);
      setErrorMsg("");
    } catch (err) {
      console.error("Failed to retry job:", err);
      setErrorMsg(
        err.response?.data?.error || err.message || "Failed to retry the job.",
      );
    } finally {
      setRetryingId(null);
    }
  };

  const getFaultType = (item) => {
    const rawType = item.faultType || item.errorType || "UNKNOWN_ERROR";
    return rawType.toString().replaceAll("_", " ");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {errorMsg && (
        <div className="flex items-start bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold px-4 py-3 rounded-2xl animate-shake">
          <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/70">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Inventory &amp; Flight Recorder
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Price changes below push real events through BullMQ workers.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh Metrics
          </button>
          <button
            onClick={handleResetMetrics}
            disabled={resetting}
            className="flex items-center justify-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${resetting ? "animate-spin" : ""}`}
            />
            {resetting ? "Resetting..." : "Reset Metrics"}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Deliveries
            </span>
            <Gauge className="h-4 w-4 text-slate-300" />
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {metrics.totalProcessed}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Successful
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">
            {metrics.successful}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Dead Letters
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${metrics.failed > 0 ? "text-rose-400 animate-pulse" : "text-slate-300"}`}
            />
          </div>
          <div className="text-3xl font-black text-rose-600 mt-2">
            {metrics.failed}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/70">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Success Rate
            </span>
          </div>
          <div className="text-3xl font-black text-violet-600 mt-2">
            {metrics.successRate}%
          </div>
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center">
              <Package className="h-5 w-5 mr-2 text-violet-500" />
              Live Inventory Catalog
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dropping a price below its previous value triggers a real-time
              alert to every subscriber.
            </p>
          </div>
          <span className="text-xs bg-violet-50 text-violet-700 font-semibold px-2.5 py-1 rounded-full shrink-0 self-start sm:self-auto">
            {products.length} Active SKUs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/40">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {product.category}
                  </span>
                  <button
                    onClick={() => handleToggleStock(product.id)}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center transition-colors ${product.inStock ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                  >
                    {product.inStock ? (
                      <Package className="h-3 w-3 mr-1" />
                    ) : (
                      <PackageX className="h-3 w-3 mr-1" />
                    )}
                    {product.inStock ? "In Stock" : "Out of Stock"}
                  </button>
                </div>
                <h3 className="font-bold text-slate-800 text-base mt-1.5">
                  {product.name}
                </h3>
                <div className="mt-3 flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-slate-900">
                    ${product.price}
                  </span>
                  {product.oldPrice !== product.price && (
                    <span className="text-xs text-slate-400 line-through font-mono">
                      ${product.oldPrice}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => handlePriceChange(product.id, -50)}
                  disabled={updatingId === product.id}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold py-2 rounded-xl text-xs flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                >
                  <TrendingDown className="h-3.5 w-3.5 mr-1" />
                  -$50
                </button>
                <button
                  onClick={() => handlePriceChange(product.id, 50)}
                  disabled={updatingId === product.id}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-2 rounded-xl text-xs flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1" />
                  +$50
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Failed Deliveries */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center">
            <ShieldAlert className="h-5 w-5 mr-2 text-rose-500" />
            Failed Deliveries
          </h2>
          <span className="text-xs bg-rose-50 text-rose-700 font-semibold px-2.5 py-1 rounded-full">
            {actionableFailureCount} Actionable
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                <th className="py-3 px-6">Channel</th>
                <th className="py-3 px-6">User</th>
                <th className="py-3 px-6">Fault</th>
                <th className="py-3 px-6">Error</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {failures.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-slate-400 font-medium"
                  >
                    All clear — no failed deliveries.
                  </td>
                </tr>
              ) : (
                failures.map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold uppercase">
                      <span
                        className={`px-2 py-1 rounded-lg text-[11px] ${item.channel === "email" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}
                      >
                        {item.channel}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800">
                        {item.userId?.name || "Unknown User"}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {item.userId?.email || "—"}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${getFaultType(item).includes("USER QUOTA EXCEEDED") || getFaultType(item).includes("INVALID EMAIL ADDRESS") ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}
                      >
                        {getFaultType(item)}
                      </span>
                    </td>
                    <td
                      className="py-4 px-6 font-mono text-xs text-rose-600 max-w-xs truncate"
                      title={item.errorMessage}
                    >
                      {item.errorMessage || "Unknown queue processing error"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {item.actionable !== false ? (
                        <button
                          onClick={() => handleRetryJob(item._id)}
                          disabled={retryingId === item._id}
                          className="inline-flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3 w-3 mr-1.5 ${retryingId === item._id ? "animate-spin" : ""}`}
                          />
                          {retryingId === item._id ? "Re-queuing..." : "Retry"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Skip (user error)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
