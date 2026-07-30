import React, { useEffect, useState } from "react";
import {
  fetchMetrics,
  fetchFailures,
  retryDelivery,
  triggerTestEvent,
} from "../services/api";
import { INITIAL_CATALOG } from "../data/catalog";
import type { Product } from "../data/catalog";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Package,
  PackageX,
} from "lucide-react";

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>({
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    successRate: 100,
  });
  const [failures, setFailures] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>(INITIAL_CATALOG);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, failuresRes] = await Promise.all([
        fetchMetrics(),
        fetchFailures(),
      ]);
      setMetrics(metricsRes.data);
      // Ensure we bind the array of failures properly based on the backend response
      setFailures(Array.isArray(failuresRes.data) ? failuresRes.data : []);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePriceChange = async (productId: string, delta: number) => {
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
            newPrice: newPrice,
            currency: "USD",
          },
        });
        // Wait 1 second to give the queue time to process, then force a UI refresh
        setTimeout(loadData, 1000);
      }
    } catch (err) {
      console.error("Failed to trigger automated alert:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStock = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, inStock: !p.inStock } : p)),
    );
  };

  const handleRetryJob = async (id: string) => {
    setRetryingId(id);
    try {
      await retryDelivery(id);
      await loadData();
    } catch (err) {
      console.error("Failed to retry job:", err);
    } finally {
      setRetryingId(null);
    }
  };

  // Safely extract the failure type for the table display
  const getFaultType = (item: any) => {
    const rawType = item.faultType || item.errorType || "UNKNOWN_ERROR";
    return rawType.toString().replaceAll("_", " ");
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Inventory & Flight Recorder
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            State changes below automatically push background events to BullMQ
            workers
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />{" "}
          Refresh Metrics
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Processed
          </span>
          <div className="text-3xl font-black text-slate-800 mt-2">
            {metrics.totalProcessed}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Successful
          </span>
          <div className="text-3xl font-black text-emerald-600 mt-2 flex items-center">
            {metrics.successful} <CheckCircle2 className="h-6 w-6 ml-2" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Dead Letters (Failed)
          </span>
          <div className="text-3xl font-black text-rose-600 mt-2 flex items-center">
            {metrics.failed}{" "}
            {metrics.failed > 0 && (
              <AlertTriangle className="h-6 w-6 ml-2 animate-bounce" />
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Success Rate
          </span>
          <div className="text-3xl font-black text-blue-600 mt-2">
            {metrics.successRate}%
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-600" /> Live Inventory
              Catalog Control
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lowering an item's price below its previous value will
              automatically trigger a real-time price drop alert to all
              subscribed users.
            </p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">
            {products.length} Active SKUs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-50/30">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {product.category}
                  </span>
                  <button
                    onClick={() => handleToggleStock(product.id)}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center transition-all ${
                      product.inStock
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {product.inStock ? (
                      <Package className="h-3 w-3 mr-1" />
                    ) : (
                      <PackageX className="h-3 w-3 mr-1" />
                    )}
                    {product.inStock ? "In Stock" : "Out of Stock"}
                  </button>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mt-1">
                  {product.name}
                </h3>

                <div className="mt-4 flex items-baseline space-x-2">
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

              <div className="mt-6 pt-4 border-t border-slate-100 flex space-x-2">
                <button
                  onClick={() => handlePriceChange(product.id, -50)}
                  disabled={updatingId === product.id}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold py-2 rounded-lg text-xs flex items-center justify-center transition-all shadow-sm active:scale-95"
                >
                  <TrendingDown className="h-3.5 w-3.5 mr-1" /> -$50 (Drop)
                </button>
                <button
                  onClick={() => handlePriceChange(product.id, 50)}
                  disabled={updatingId === product.id}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold py-2 rounded-lg text-xs flex items-center justify-center transition-all shadow-sm active:scale-95"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1" /> +$50 (Hike)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center">
            <ShieldAlert className="h-5 w-5 mr-2 text-rose-500" /> Dead Letter
            Queue (DLQ) — Failed Deliveries
          </h2>
          <span className="text-xs bg-rose-100 text-rose-700 font-semibold px-2.5 py-1 rounded-full">
            {failures.length} Actionable
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                <th className="py-3 px-6">Channel</th>
                <th className="py-3 px-6">User Details</th>
                <th className="py-3 px-6">Fault Category</th>
                <th className="py-3 px-6">Error Log</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {failures.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-slate-400 font-medium"
                  >
                    🎉 All clear! No failed deliveries sitting in the Dead
                    Letter Queue.
                  </td>
                </tr>
              ) : (
                failures.map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold uppercase">
                      <span
                        className={`px-2 py-1 rounded text-xs ${item.channel === "email" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {item.channel}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800">
                        {item.user?.name || "Test User"}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {item.user?.email || item.user}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          getFaultType(item).includes("USER QUOTA EXCEEDED") ||
                          getFaultType(item).includes("INVALID EMAIL ADDRESS")
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
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
                          className="inline-flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3 w-3 mr-1.5 ${retryingId === item._id ? "animate-spin" : ""}`}
                          />
                          {retryingId === item._id
                            ? "Re-queuing..."
                            : "🔄 Retry Job"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          User Exception (Skip)
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
