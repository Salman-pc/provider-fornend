
import axios from "axios";
const baseURL =  "https://tarakingbackend.vercel.app/";

const axiosConfig = axios.create({
  baseURL,
});

export default axiosConfig;

axiosConfig.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);