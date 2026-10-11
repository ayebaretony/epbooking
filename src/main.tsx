import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./app/App";
import { AuthProvider } from "./features/auth/AuthProvider";
import { ConfigMissingScreen } from "./features/auth/StatusScreens";
import { missingFirebaseConfig } from "./lib/firebase";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {missingFirebaseConfig.length > 0 ? (
      <ConfigMissingScreen missing={missingFirebaseConfig} />
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
