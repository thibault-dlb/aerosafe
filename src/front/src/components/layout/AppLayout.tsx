import { Link, Outlet } from "react-router-dom";

const LINKS = [
  { to: "/aircraft", label: "Aircraft" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/alerts", label: "Alerts" },
  { to: "/rules", label: "Rules" },
  { to: "/admin/accounts", label: "Accounts" },
  { to: "/login", label: "Log in" },
];

/** Shared page frame: the navigation, then the current page. */
export default function AppLayout() {
  return (
    <>
      <nav aria-label="Main">
        <Link to="/">AeroSafe</Link>
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
