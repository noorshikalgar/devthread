import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/geist-sans/latin-400.css";
import "@fontsource/geist-sans/latin-500.css";
import "@fontsource/geist-sans/latin-600.css";
import "@fontsource/geist-sans/latin-700.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import App from "./App";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import KitchenSink from "./dev/KitchenSink";
import "./styles.css";

const showKitchenSink = import.meta.env.DEV && new URLSearchParams(location.search).has("ds");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      {showKitchenSink ? <KitchenSink /> : <App />}
      <Toaster />
    </TooltipProvider>
  </StrictMode>,
);
