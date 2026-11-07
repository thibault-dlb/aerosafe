import { createBrowserRouter, type RouteObject } from "react-router-dom";

import AppLayout from "@/components/layout/AppLayout";
import Accounts from "@/pages/admin/Accounts";
import AircraftRecord from "@/pages/aircraft/AircraftRecord";
import AircraftSearch from "@/pages/aircraft/AircraftSearch";
import Alerts from "@/pages/alerts/Alerts";
import Login from "@/pages/auth/Login";
import SignUp from "@/pages/auth/SignUp";
import Dashboard from "@/pages/dashboard/Dashboard";
import FlightDetail from "@/pages/flights/FlightDetail";
import Home from "@/pages/Home";
import Rules from "@/pages/rules/Rules";

// Every work package already has its pages here: fill the page, not this file.
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <SignUp /> },
      { path: "/admin/accounts", element: <Accounts /> },
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/alerts", element: <Alerts /> },
      { path: "/rules", element: <Rules /> },
      { path: "/aircraft", element: <AircraftSearch /> },
      { path: "/aircraft/:aircraftId", element: <AircraftRecord /> },
      { path: "/flights/:flightId", element: <FlightDetail /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
