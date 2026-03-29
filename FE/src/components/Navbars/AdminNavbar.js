import React from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Navbar, Container, Nav, Button, Badge } from "react-bootstrap";

import routes from "routes.js";
import {
  canAccessRoute,
  formatLoginTime,
  getCurrentUser,
  getRoleLabel,
  logout,
} from "../../utils/auth";

function Header() {
  const history = useHistory();
  const location = useLocation();
  const currentUser = getCurrentUser();

  const mobileSidebarToggle = (e) => {
    e.preventDefault();
    document.documentElement.classList.toggle("nav-open");
    const node = document.createElement("div");
    node.id = "bodyClick";
    node.onclick = function onBodyClick() {
      this.parentElement.removeChild(this);
      document.documentElement.classList.toggle("nav-open");
    };
    document.body.appendChild(node);
  };

  const getBrandText = () => {
    const matchedRoute = routes.find(
      (route) =>
        canAccessRoute(currentUser, route) &&
        location.pathname.indexOf(route.layout + route.path) !== -1,
    );

    return matchedRoute?.name || "Dashboard";
  };

  const handleLogout = async () => {
    await logout();
    history.replace("/login");
  };

  const loginTimeText = formatLoginTime(currentUser?.loginAt);
  const scopeText = currentUser?.branch || "Toàn hệ thống";

  return (
    <Navbar bg="light" expand="lg">
      <Container fluid>
        <div className="d-flex justify-content-center align-items-center ml-2 ml-lg-0">
          <Button
            variant="dark"
            className="d-lg-none btn-fill d-flex justify-content-center align-items-center rounded-circle p-2"
            onClick={mobileSidebarToggle}
          >
            <i className="fas fa-ellipsis-v" />
          </Button>
          <Navbar.Brand href="#top" onClick={(e) => e.preventDefault()} className="mr-2">
            {getBrandText()}
          </Navbar.Brand>
        </div>
        <Navbar.Toggle aria-controls="basic-navbar-nav" className="mr-2">
          <span className="navbar-toggler-bar burger-lines" />
          <span className="navbar-toggler-bar burger-lines" />
          <span className="navbar-toggler-bar burger-lines" />
        </Navbar.Toggle>
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="mr-auto" navbar>
            <Nav.Item>
              <div className="m-0 nav-link text-muted">{scopeText}</div>
            </Nav.Item>
          </Nav>
          <Nav className="ml-auto align-items-lg-center" navbar>
            <Nav.Item className="mr-lg-3">
              <div className="text-right px-2">
                <div style={{ fontWeight: 600 }}>{currentUser?.displayName || "Người dùng"}</div>
                <small className="text-muted d-block">
                  {getRoleLabel(currentUser?.role)}
                  {currentUser?.username ? ` - ${currentUser.username}` : ""}
                </small>
                {currentUser?.role === "admin" && loginTimeText && (
                  <small className="text-muted d-block">Đăng nhập lúc: {loginTimeText}</small>
                )}
              </div>
            </Nav.Item>
            <Nav.Item className="mr-lg-2 mb-2 mb-lg-0">
              <Badge bg={currentUser?.role === "admin" ? "danger" : "info"}>
                {getRoleLabel(currentUser?.role)}
              </Badge>
            </Nav.Item>
            <Nav.Item>
              <Button variant="outline-danger" size="sm" onClick={handleLogout}>
                Đăng xuất
              </Button>
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Header;
