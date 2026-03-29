import React from "react";
import { useLocation, Route, Switch, Redirect } from "react-router-dom";

import AdminNavbar from "components/Navbars/AdminNavbar";
import Footer from "components/Footer/Footer";
import Sidebar from "components/Sidebar/Sidebar";

import routes from "routes.js";
import sidebarImage from "assets/img/sidebar-3.jpg";
import { canAccessRoute, getCurrentUser } from "../utils/auth";

function Admin() {
  const [image] = React.useState(sidebarImage);
  const [color] = React.useState("black");
  const [hasImage] = React.useState(true);
  const location = useLocation();
  const mainPanel = React.useRef(null);
  const currentUser = getCurrentUser();
  const accessibleRoutes = React.useMemo(
    () => routes.filter((route) => canAccessRoute(currentUser, route)),
    [currentUser],
  );

  const getRoutes = (allowedRoutes) =>
    allowedRoutes.map((prop, key) => {
      if (prop.layout === "/admin") {
        return (
          <Route
            path={prop.layout + prop.path}
            render={(props) => <prop.component {...props} />}
            key={key}
          />
        );
      }
      return null;
    });

  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    if (mainPanel.current) {
      mainPanel.current.scrollTop = 0;
    }
    if (
      window.innerWidth < 993 &&
      document.documentElement.className.indexOf("nav-open") !== -1
    ) {
      document.documentElement.classList.toggle("nav-open");
      const element = document.getElementById("bodyClick");
      if (element?.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }, [location]);

  const defaultPath = accessibleRoutes[0]
    ? accessibleRoutes[0].layout + accessibleRoutes[0].path
    : "/login";

  return (
    <>
      <div className="wrapper">
        <Sidebar color={color} image={hasImage ? image : ""} routes={accessibleRoutes} />
        <div className="main-panel" ref={mainPanel}>
          <AdminNavbar />
          <div className="content">
            <Switch>
              {getRoutes(accessibleRoutes)}
              <Redirect to={defaultPath} />
            </Switch>
          </div>
          <Footer />
        </div>
      </div>
    </>
  );
}

export default Admin;
