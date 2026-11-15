import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { DataProvider } from "./store/DataContext";
import "./styles.css";
import "./catch-up.css";
import "./reports-tax.css";
import "./aris.css";
import "./theme.css";
import "./insights.css";
import "./aris-enhancements.css";
import "./intelligence-only.css";

const savedTheme = localStorage.getItem("aris-theme-mode");
const initialMode = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "auto";
document.documentElement.dataset.themeMode = initialMode;
document.documentElement.dataset.theme = initialMode === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : initialMode;

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><HashRouter><DataProvider><App/></DataProvider></HashRouter></React.StrictMode>);
window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) void navigator.serviceWorker.getRegistrations().then(items => Promise.all(items.map(item => item.unregister()))).catch(() => undefined);
  if ("caches" in window) void caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).catch(() => undefined);
});
