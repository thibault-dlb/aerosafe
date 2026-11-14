import { createBrowserRouter, type RouteObject } from "react-router-dom";

import AppLayout from "@/components/layout/AppLayout";
import AuthScreen from "@/components/auth/AuthScreen";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireRole from "@/components/auth/RequireRole";
import Accounts from "@/pages/admin/Accounts";
import AircraftRecord from "@/pages/aircraft/AircraftRecord";
import AircraftSearch from "@/pages/aircraft/AircraftSearch";
import Alerts from "@/pages/alerts/Alerts";
import Dashboard from "@/pages/dashboard/Dashboard";
import FlightDetail from "@/pages/flights/FlightDetail";
import Home from "@/pages/Home";
import Rules from "@/pages/rules/Rules";

/**
 * The home page is public. The log in and sign up screen has its own frame, and the one route
 * of its two modes keeps it in place while it turns from one into the other. Every other page
 * needs a login, and the supervision pages a Supervisor.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/aircraft", element: <AircraftSearch /> },
          { path: "/aircraft/:aircraftId", element: <AircraftRecord /> },
          { path: "/flights/:flightId", element: <FlightDetail /> },
          {
            element: <RequireRole role="SUPERVISOR" />,
            children: [
              { path: "/alerts", element: <Alerts /> },
              { path: "/rules", element: <Rules /> },
              { path: "/admin/accounts", element: <Accounts /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <AuthScreen />,
    children: [{ path: "/login" }, { path: "/signup" }],
  },
];

export const router = createBrowserRouter(routes);
