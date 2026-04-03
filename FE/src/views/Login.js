import React, { useEffect, useMemo, useState } from "react";
import { Redirect, useHistory, useLocation } from "react-router-dom";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";

import { getCurrentUser, login, refreshCurrentUser } from "../utils/auth";
import { createPasswordResetRequest } from "../utils/passwordResetRequests";
import AppSnackbar from "../components/Feedback/AppSnackbar";

export default function Login() {
  const history = useHistory();
  const location = useLocation();
  const currentUser = getCurrentUser();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState({
    open: false,
    severity: "info",
    message: "",
  });

  const openNotice = (message, severity = "info") => {
    setNotice({ open: true, severity, message });
  };

  const redirectTo = useMemo(() => {
    const fromState = location.state && location.state.from;
    if (typeof fromState === "string" && fromState.startsWith("/")) {
      return fromState;
    }
    return "/admin/dashboard";
  }, [location.state]);

  if (currentUser) {
    return <Redirect to={redirectTo} />;
  }

  useEffect(() => {
    const handleAuthExpired = () => {
      openNotice(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        "warning",
      );
    };

    window.addEventListener("t3h-auth-expired", handleAuthExpired);
    refreshCurrentUser();

    return () => {
      window.removeEventListener("t3h-auth-expired", handleAuthExpired);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await login(username, password);

    if (!result.success) {
      openNotice(result.message || "Sai tên đăng nhập hoặc mật khẩu.", "error");
      return;
    }

    history.replace(redirectTo);
  };

const handleForgotPassword = async () => {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername) {
    openNotice("Nhập tên đăng nhập trước khi gửi yêu cầu quên mật khẩu.", "warning");
    return;
  }

  const requestResult = await createPasswordResetRequest({
    username: normalizedUsername,
  });

  if (!requestResult.success) {
    openNotice(requestResult.message || "Không gửi được yêu cầu quên mật khẩu.", "error");
    return;
  }

  openNotice(
    requestResult.message || "Nếu tên đăng nhập tồn tại, admin sẽ thấy cảnh báo để cấp lại mật khẩu.",
    "success",
  );
};
  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
        }}
      >
        <Container>
          <Row className="justify-content-center">
            <Col lg="6" md="8">
              <Card className="shadow border-0">
                <Card.Body className="p-4 p-md-5">
                  <div className="text-center mb-4">
                    <h3 className="mb-2">Đăng nhập</h3>
                    <p className="text-muted mb-0">
                      Nhập đúng tên đăng nhập và mật khẩu để vào hệ thống.
                    </p>
                  </div>

                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tên đăng nhập</Form.Label>
                      <Form.Control
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="Nhập tên đăng nhập"
                        autoComplete="username"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Mật khẩu</Form.Label>
                      <Form.Control
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Nhập mật khẩu"
                        autoComplete="current-password"
                      />
                    </Form.Group>
                    <Button type="submit" variant="primary" className="w-100">
                      Đăng nhập
                    </Button>
                  </Form>

                  <hr className="my-4" />
                  <Form.Group>
                    <Button
                      type="button"
                      variant="danger"
                      className="w-100"
                      onClick={handleForgotPassword}
                    >
                      Quên mật khẩu?
                    </Button>
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      <AppSnackbar
        open={notice.open}
        severity={notice.severity}
        message={notice.message}
        onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
