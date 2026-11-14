import { createBrowserRouter, type RouteObject } from "react-router-dom";

import AuthScreen from "@/components/auth/AuthScreen";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireRole from "@/components/auth/RequireRole";
import AppLayout from "@/components/layout/AppLayout";
import AppShell from "@/components/layout/AppShell";
import Accounts from "@/pages/admin/Accounts";
import AircraftRecord from "@/pages/aircraft/AircraftRecord";
import AircraftSearch from "@/pages/aircraft/AircraftSearch";
import Alerts from "@/pages/alerts/Alerts";
import Dashboard from "@/pages/dashboard/Dashboard";
import FlightDetail from "@/pages/flights/FlightDetail";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Rules from "@/pages/rules/Rules";

/**
 * Three frames. The home page, and the page for an address that leads nowhere, are public and
 * share the landing frame. The log in and sign up screen has its own, and the one route of its
 * two modes keeps it in place while it turns from one into the other. Every other page needs a
 * login and lives in the shell with the side bar; the supervision pages need a Supervisor.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    element: <AuthScreen />,
    children: [{ path: "/login" }, { path: "/signup" }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
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
];

export const router = createBrowserRouter(routes);
