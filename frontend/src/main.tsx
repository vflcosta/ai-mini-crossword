
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "@fontsource-variable/fredoka";
  import "./index.css";
  import { initAnalytics } from "./analytics";

  initAnalytics();

  createRoot(document.getElementById("root")!).render(<App />);
  