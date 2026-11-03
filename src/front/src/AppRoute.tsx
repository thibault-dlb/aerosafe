import { createBrowserRouter, type RouteObject } from "react-router-dom";

import Home from "@/pages/Home";

export const routes: RouteObject[] = [{ path: "/", element: <Home /> }];

export const router = createBrowserRouter(routes);
