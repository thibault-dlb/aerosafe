import { RouterProvider } from "react-router-dom";

import { router } from "./AppRoute";
import AuthProvider from "./providers/AuthProvider";
import PreferencesProvider from "./providers/PreferencesProvider";

export default function App() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PreferencesProvider>
  );
}
