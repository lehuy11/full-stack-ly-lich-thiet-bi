import Dashboard from "views/Dashboard.js";
import UserProfile from "views/UserProfile.js";
import TableList from "views/TableList.js";
import Notifications from "views/Notifications.js";

const dashboardRoutes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "nc-icon nc-chart-pie-35",
    component: Dashboard,
    layout: "/admin",
    roles: ["admin", "cungtruong"],
    showInSidebar: true,
  },
  {
    path: "/table",
    name: "Danh sách thiết bị",
    icon: "nc-icon nc-notes",
    component: TableList,
    layout: "/admin",
    roles: ["admin", "cungtruong"],
    showInSidebar: true,
  },
  {
    path: "/user",
    name: "Quản lý tài khoản",
    icon: "nc-icon nc-circle-09",
    component: UserProfile,
    layout: "/admin",
    roles: ["admin"],
    showInSidebar: true,
  },
  {
    path: "/notifications",
    name: "Thông báo",
    icon: "nc-icon nc-bell-55",
    component: Notifications,
    layout: "/admin",
    roles: ["admin"],
    showInSidebar: true,
  },
];

export default dashboardRoutes;
