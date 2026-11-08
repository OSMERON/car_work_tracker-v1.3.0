import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { DataProvider } from "./store/DataContext";
import "./styles.css";
import "./catch-up.css";
import "./reports-tax.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><HashRouter><DataProvider><App/></DataProvider></HashRouter></React.StrictMode>);
if ("serviceWorker" in navigator && import.meta.env.PROD) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
