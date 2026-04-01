import React from "react";
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Table } from "react-bootstrap";
import {
  createUserAccount,
  formatDateTime,
  generateUniquePassword,
  getAllUsers,
  getCurrentUser,
  getRoleLabel,
  resetUserPassword,
  USERS_UPDATED_EVENT,
} from "../utils/auth";
import { getBranchNamesByEnterprise, getEnterpriseNames, SYSTEMS_UPDATED_EVENT } from "../utils/systemsStorage";
import {
  formatPasswordResetTime,
  getPendingPasswordResetByUsername,
  getPendingPasswordResetRequests,
  PASSWORD_RESET_REQUESTS_UPDATED_EVENT,
} from "../utils/passwordResetRequests";

const initialForm = {
  username: "",
  displayName: "",
  role: "cungtruong",
  enterprise: "",
  branch: "",
  password: "",
};

function UserProfile() {
  const currentUser = getCurrentUser();
  const [enterprises, setEnterprises] = React.useState([]);
  const [branchOptions, setBranchOptions] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [pendingRequests, setPendingRequests] = React.useState([]);
  const [form, setForm] = React.useState(initialForm);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [generatedPassword, setGeneratedPassword] = React.useState("");

  React.useEffect(() => {
    const syncUsers = async () => {
      try {
        setUsers(await getAllUsers());
      } catch (syncError) {
        console.error(syncError);
      }
    };

    const syncOrganizations = async () => {
      try {
        const nextEnterprises = await getEnterpriseNames();
        setEnterprises(nextEnterprises);
      } catch (syncError) {
        console.error(syncError);
      }
    };

    const syncRequests = async () => {
      try {
        setPendingRequests(await getPendingPasswordResetRequests());
      } catch (syncError) {
        console.error(syncError);
      }
    };

    syncUsers();
    syncOrganizations();
    syncRequests();

    window.addEventListener(USERS_UPDATED_EVENT, syncUsers);
    window.addEventListener(SYSTEMS_UPDATED_EVENT, syncOrganizations);
    window.addEventListener(PASSWORD_RESET_REQUESTS_UPDATED_EVENT, syncRequests);
    return () => {
      window.removeEventListener(USERS_UPDATED_EVENT, syncUsers);
      window.removeEventListener(SYSTEMS_UPDATED_EVENT, syncOrganizations);
      window.removeEventListener(PASSWORD_RESET_REQUESTS_UPDATED_EVENT, syncRequests);
    };
  }, []);

  React.useEffect(() => {
    if (!form.enterprise && enterprises.length > 0 && form.role !== "admin") {
      setForm((prev) => ({ ...prev, enterprise: enterprises[0] || "" }));
    }
  }, [enterprises, form.enterprise, form.role]);

  React.useEffect(() => {
    const syncBranches = async () => {
      if (!form.enterprise || form.role === "admin") {
        setBranchOptions([]);
        return;
      }
      try {
        const nextBranches = await getBranchNamesByEnterprise(form.enterprise);
        setBranchOptions(nextBranches);
      } catch (syncError) {
        console.error(syncError);
      }
    };
    syncBranches();
  }, [form.enterprise, form.role]);

  React.useEffect(() => {
    if (form.role === "admin") return;
    if (!form.branch && branchOptions.length > 0) {
      setForm((prev) => ({ ...prev, branch: branchOptions[0] || "" }));
      return;
    }
    if (form.branch && !branchOptions.includes(form.branch)) {
      setForm((prev) => ({ ...prev, branch: branchOptions[0] || "" }));
    }
  }, [branchOptions, form.branch, form.role]);

  const pendingRequestsByUsername = React.useMemo(() => (
    pendingRequests.reduce((accumulator, item) => {
      accumulator[item.username] = item;
      return accumulator;
    }, {})
  ), [pendingRequests]);

  const orderedUsers = React.useMemo(() => {
    const nextUsers = [...users];
    nextUsers.sort((left, right) => {
      const leftPending = pendingRequestsByUsername[left.username] ? 1 : 0;
      const rightPending = pendingRequestsByUsername[right.username] ? 1 : 0;
      if (leftPending !== rightPending) return rightPending - leftPending;
      return left.username.localeCompare(right.username, "vi");
    });
    return nextUsers;
  }, [users, pendingRequestsByUsername]);

  const handleFormChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "role" && value === "admin") {
        next.enterprise = "";
        next.branch = "";
      }
      if (field === "enterprise") {
        next.branch = "";
      }
      return next;
    });
  };

  const handleGeneratePassword = () => {
    setForm((prev) => ({ ...prev, password: generateUniquePassword() }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setGeneratedPassword("");

    const result = await createUserAccount(form);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setUsers(await getAllUsers());
    const nextEnterprises = await getEnterpriseNames();
    setEnterprises(nextEnterprises);

    const stationsMessage = Array.isArray(result.addedStations) && result.addedStations.length > 0
      ? ` Ga thuộc cung này gồm: ${result.addedStations.join(", ")}.`
      : "";

    setSuccess(`Đã tạo tài khoản ${result.user.username} thành công. Mật khẩu hiện tại: ${result.password}.${stationsMessage}`);
    setGeneratedPassword(result.password);
    setForm({
      ...initialForm,
      enterprise: nextEnterprises[0] || "",
    });
  };

  const handleResetPassword = async (username) => {
    setError("");
    setSuccess("");
    setGeneratedPassword("");

    const hadPendingRequest = Boolean(await getPendingPasswordResetByUsername(username));
    const result = await resetUserPassword(username);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setUsers(await getAllUsers());
    setPendingRequests(await getPendingPasswordResetRequests());

    setSuccess(
      hadPendingRequest
        ? `Đã cấp lại mật khẩu cho ${username} theo yêu cầu quên mật khẩu. Mật khẩu mới: ${result.password}`
        : `Đã cấp lại mật khẩu cho ${username}. Mật khẩu mới: ${result.password}`,
    );
    setGeneratedPassword(result.password);
  };

  if (currentUser?.role !== "admin") {
    return (
      <Container fluid>
        <Card>
          <Card.Body>
            <Alert variant="warning" className="mb-0">
              Chỉ tài khoản admin mới được quản lý tài khoản và cấp lại mật khẩu.
            </Alert>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row>
        <Col lg="5" md="12">
          <Card>
            <Card.Header>
              <Card.Title as="h4">Tạo tài khoản mới</Card.Title>
              <p className="card-category mb-0">
                Admin chọn xí nghiệp rồi chọn cung. Hệ thống sẽ tự gắn đúng các ga thuộc cung đó.
              </p>
            </Card.Header>
            <Card.Body>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              {success ? <Alert variant="success">{success}</Alert> : null}
              {generatedPassword ? <Alert variant="info">Mật khẩu vừa tạo: <strong>{generatedPassword}</strong></Alert> : null}

              <Form onSubmit={handleCreateUser}>
                <Form.Group>
                  <Form.Label>Tên đăng nhập</Form.Label>
                  <Form.Control value={form.username} onChange={handleFormChange("username")} placeholder="Ví dụ: longkhanh2" />
                </Form.Group>

                <Form.Group>
                  <Form.Label>Tên hiển thị</Form.Label>
                  <Form.Control value={form.displayName} onChange={handleFormChange("displayName")} placeholder="Ví dụ: Cung trưởng Cung Long Khánh" />
                </Form.Group>

                <Row>
                  <Col md="4">
                    <Form.Group>
                      <Form.Label>Vai trò</Form.Label>
                      <Form.Control as="select" value={form.role} onChange={handleFormChange("role")}>
                        <option value="cungtruong">Cung trưởng</option>
                        <option value="admin">Admin</option>
                      </Form.Control>
                    </Form.Group>
                  </Col>
                  <Col md="4">
                    <Form.Group>
                      <Form.Label>Xí nghiệp</Form.Label>
                      <Form.Control
                        as="select"
                        value={form.enterprise}
                        onChange={handleFormChange("enterprise")}
                        disabled={form.role === "admin"}
                      >
                        {enterprises.map((enterprise) => (
                          <option key={enterprise} value={enterprise}>{enterprise}</option>
                        ))}
                      </Form.Control>
                    </Form.Group>
                  </Col>
                  <Col md="4">
                    <Form.Group>
                      <Form.Label>Cung phụ trách</Form.Label>
                      <Form.Control
                        as="select"
                        value={form.branch}
                        onChange={handleFormChange("branch")}
                        disabled={form.role === "admin" || branchOptions.length === 0}
                      >
                        {branchOptions.map((branch) => (
                          <option key={branch} value={branch}>{branch}</option>
                        ))}
                      </Form.Control>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group>
                  <Form.Label>Mật khẩu</Form.Label>
                  <div className="d-flex gap-2" style={{ gap: 8 }}>
                    <Form.Control value={form.password} onChange={handleFormChange("password")} placeholder="Bỏ trống để tự sinh mật khẩu" />
                    <Button variant="secondary" onClick={handleGeneratePassword} type="button">Tự sinh</Button>
                  </div>
                  <Form.Text className="text-muted">Mỗi tài khoản phải có mật khẩu khác nhau.</Form.Text>
                </Form.Group>

                <Button className="btn-fill" variant="info" type="submit">Tạo tài khoản</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg="7" md="12">
          <Card>
            <Card.Header>
              <Row className="align-items-center">
                <Col>
                  <Card.Title as="h4">Danh sách tài khoản</Card.Title>
                  <p className="card-category mb-0">Admin có thể cấp lại mật khẩu. Yêu cầu quên mật khẩu sẽ làm nút cấp lại đổi sang màu đỏ.</p>
                </Col>
                <Col className="text-right" md="auto">
                  <Badge variant={pendingRequests.length > 0 ? "danger" : "secondary"}>{pendingRequests.length} yêu cầu quên mật khẩu</Badge>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              <Table hover>
                <thead>
                  <tr>
                    <th>Tên đăng nhập</th>
                    <th>Vai trò</th>
                    <th>Xí nghiệp</th>
                    <th>Cung</th>
                    <th>Tạo lúc</th>
                    <th>Đổi mật khẩu</th>
                    <th>Yêu cầu quên mật khẩu</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedUsers.map((user) => {
                    const pendingRequest = pendingRequestsByUsername[user.username] || null;
                    return (
                      <tr key={user.username}>
                        <td>
                          <div className="font-weight-bold">{user.displayName}</div>
                          <div className="text-muted small">{user.username}</div>
                          {pendingRequest ? <div className="mt-1"><Badge variant="danger">Đang chờ cấp lại mật khẩu</Badge></div> : null}
                        </td>
                        <td><Badge variant={user.role === "admin" ? "danger" : "info"}>{getRoleLabel(user.role)}</Badge></td>
                        <td>{user.enterprise || "Toàn hệ thống"}</td>
                        <td>{user.branch || "Toàn hệ thống"}</td>
                        <td>{formatDateTime(user.createdAt) || "-"}</td>
                        <td>{formatDateTime(user.passwordUpdatedAt) || "-"}</td>
                        <td>
                          {pendingRequest ? (
                            <>
                              <div>{formatPasswordResetTime(pendingRequest.requestedAt)}</div>
                              <div className="text-muted small">{pendingRequest.displayName || pendingRequest.username}</div>
                            </>
                          ) : (
                            <span className="text-muted">Không có</span>
                          )}
                        </td>
                        <td className="text-right">
                          <Button variant={pendingRequest ? "danger" : "secondary"} size="sm" onClick={() => handleResetPassword(user.username)}>
                            {pendingRequest ? "Cấp lại ngay" : "Cấp lại mật khẩu"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default UserProfile;
