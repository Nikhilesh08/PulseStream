import axios from "axios";

// 1. Grab the pure root URL from the environment (or localhost)
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// 2. Append /api ONLY for Axios HTTP requests
const API_URL = `${BASE_URL}/api`;

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(err);
  },
);

export const fetchMetrics = () => api.get("/analytics");
export const fetchFailures = () => api.get("/analytics/failures");
export const retryDelivery = (id: string) => api.post(`/analytics/retry/${id}`);
export const triggerTestEvent = (payload: any) => api.post("/events", payload);
export const fetchUsers = () => api.get("/users");
export const updateWatchlist = (
  userId: string,
  productId: string,
  channel: "inApp" | "email",
) => api.patch(`/users/${userId}/watchlist`, { productId, channel });

export const loginUser = (email: string, password: string) =>
  api.post("/auth/login", { email, password });
export const signupUser = (name: string, email: string, password: string) =>
  api.post("/auth/signup", { name, email, password });
export const fetchCurrentUser = () => api.get("/auth/me");

// GOD MODE: Arm all notifications for the Master User
export const armMasterUser = async (userId: string, productIds: string[]) => {
  return axios.post(`${API_URL}/users/${userId}/arm-all`, { productIds });
};
