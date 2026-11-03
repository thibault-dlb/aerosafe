import { RouterProvider } from "react-router-dom";

import { router } from "./AppRoute";

export default function App() {
  return <RouterProvider router={router} />;
}
