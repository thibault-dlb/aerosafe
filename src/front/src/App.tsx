import { RouterProvider } from "react-router-dom";

import { router } from "./AppRoute";
import PreferencesProvider from "./providers/PreferencesProvider";

export default function App() {
  return (
    <PreferencesProvider>
      <RouterProvider router={router} />
    </PreferencesProvider>
  );
}
