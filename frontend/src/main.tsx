
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "@fontsource-variable/fredoka";
  import "./index.css";
  import { initAnalytics } from "./analytics";
import { setupNativeApp } from "./native";

  initAnalytics();
setupNativeApp();

  createRoot(document.getElementById("root")!).render(<App />);
  