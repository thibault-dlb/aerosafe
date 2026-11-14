import { RouterProvider } from "react-router-dom";

import { router } from "./AppRoute";
import AuthProvider from "./providers/AuthProvider";
import PreferencesProvider from "./providers/PreferencesProvider";
import ToastProvider from "./providers/ToastProvider";

export default function App() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}
