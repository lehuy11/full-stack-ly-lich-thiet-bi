import React from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Table,
} from "react-bootstrap";
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
import {
  getBranchNames,
  SYSTEMS_UPDATED_EVENT,
} from "../utils/systemsStorage";
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
  branch: "",
  stations: "",
  password: "",
};

function UserProfile() {
  const currentUser = getCurrentUser();
  const [branches, setBranches] = React.useState([]);
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
      } catch (error) {
        console.error(error);
      }
    };
    const syncBranches = async () => {
      try {
        setBranches(await getBranchNames());
      } catch (error) {
        console.error(error);
      }
    };
    const syncRequests = async () => {
      try {
        setPendingRequests(await getPendingPasswordResetRequests());
      } catch (error) {
        console.error(error);
      }
    };

    syncUsers();
    syncBranches();
    syncRequests();

    window.addEventListener(USERS_UPDATED_EVENT, syncUsers);
    window.addEventListener(SYSTEMS_UPDATED_EVENT, syncBranches);
    window.addEventListener(PASSWORD_RESET_REQUESTS_UPDATED_EVENT, syncRequests);
    return () => {
      window.removeEventListener(USERS_UPDATED_EVENT, syncUsers);
      window.removeEventListener(SYSTEMS_UPDATED_EVENT, syncBranches);
      window.removeEventListener(PASSWORD_RESET_REQUESTS_UPDATED_EVENT, syncRequests);
    };
  }, []);

  React.useEffect(() => {
    if (!form.branch && branches.length > 0) {
      setForm((prev) => ({ ...prev, branch: branches[0] || "" }));
    }
  }, [branches, form.branch]);

  const pendingRequestsByUsername = React.useMemo(() => {
    return pendingRequests.reduce((accumulator, item) => {
      accumulator[item.username] = item;
      return accumulator;
    }, {});
  }, [pendingRequests]);

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
        next.branch = "";
        next.stations = "";
      }
      return next;
    });
  };

  const handleGeneratePassword = () => {
    setForm((prev) => ({
      ...prev,
      password: generateUniquePassword(),
    }));
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
    const nextBranches = await getBranchNames();
    setBranches(nextBranches);

    const stationsMessage = Array.isArray(result.addedStations) && result.addedStations.length > 0
      ? ` Đã bổ sung ga: ${result.addedStations.join(", ")}.`
      : "";

    setSuccess(
      `Đã tạo tài khoản ${result.user.username} thành công. Mật khẩu hiện tại: ${result.password}.${stationsMessage}`,
    );
    setGeneratedPassword(result.password);
    setForm({
      ...initialForm,
      branch: nextBranches[0] || "",
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
                Admin có thể nhập tên cung, thêm các ga trực thuộc, và hệ thống sẽ tự tạo cấu
                trúc mặc định cho từng ga như các ga hiện có.
              </p>
            </Card.Header>
            <Card.Body>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              {success ? <Alert variant="success">{success}</Alert> : null}
              <Form onSubmit={handleCreateUser}>
                <Form.Group>
                  <Form.Label>Tên đăng nhập</Form.Label>
                  <Form.Control
                    value={form.username}
                    onChange={handleFormChange("username")}
                    placeholder="Ví dụ: longkhanh2"
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label>Tên hiển thị</Form.Label>
                  <Form.Control
                    value={form.displayName}
                    onChange={handleFormChange("displayName")}
                    placeholder="Ví dụ: Cung trưởng Cung Long Khánh"
                  />
                </Form.Group>

                <Row>
                  <Col md="6">
                    <Form.Group>
                      <Form.Label>Vai trò</Form.Label>
                      <Form.Control
                        as="select"
                        value={form.role}
                        onChange={handleFormChange("role")}
                      >
                        <option value="cungtruong">Cung trưởng</option>
                        <option value="admin">Admin</option>
                      </Form.Control>
                    </Form.Group>
                  </Col>
                  <Col md="6">
                    <Form.Group>
                      <Form.Label>Cung phụ trách</Form.Label>
                      <Form.Control
                        value={form.branch}
                        onChange={handleFormChange("branch")}
                        placeholder="Ví dụ: Cung Biên Hòa"
                        disabled={form.role === "admin"}
                        list="branch-suggestions"
                      />
                      <datalist id="branch-suggestions">
                        {branches.map((branch) => (
                          <option key={branch} value={branch} />
                        ))}
                      </datalist>
                      <Form.Text className="text-muted">
                        Có thể nhập cung mới hoặc nhập lại cung đã có.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                {form.role !== "admin" ? (
                  <Form.Group>
                    <Form.Label>Danh sách ga</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={form.stations}
                      onChange={handleFormChange("stations")}
                      placeholder={"Mỗi ga một dòng hoặc ngăn cách bằng dấu phẩy\nVí dụ:\nHố Nai\nTrảng Bom\nTrung Hòa"}
                    />
                    <Form.Text className="text-muted">
                      Nếu cung đã tồn tại, các ga mới sẽ được bổ sung thêm. Mỗi ga sẽ tự có sẵn
                      các nhóm mặc định như Thiết bị thông tin, Thiết bị tín hiệu, Thiết bị khác...
                    </Form.Text>
                  </Form.Group>
                ) : null}

                <Form.Group>
                  <Form.Label>Mật khẩu</Form.Label>
                  <div className="d-flex gap-2" style={{ gap: 8 }}>
                    <Form.Control
                      value={form.password}
                      onChange={handleFormChange("password")}
                      placeholder="Bỏ trống để tự sinh mật khẩu"
                    />
                    <Button variant="secondary" onClick={handleGeneratePassword} type="button">
                      Tự sinh
                    </Button>
                  </div>
                  <Form.Text className="text-muted">
                    Mỗi tài khoản phải có mật khẩu khác nhau.
                  </Form.Text>
                </Form.Group>

                <Button className="btn-fill" variant="info" type="submit">
                  Tạo tài khoản
                </Button>
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
                  <p className="card-category mb-0">
                    Admin có thể cấp lại mật khẩu. Yêu cầu quên mật khẩu sẽ làm nút cấp lại đổi sang
                    màu đỏ.
                  </p>
                </Col>
                <Col className="text-right" md="auto">
                  <Badge variant={pendingRequests.length > 0 ? "danger" : "secondary"}>
                    {pendingRequests.length} yêu cầu quên mật khẩu
                  </Badge>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              <Table hover>
                <thead>
                  <tr>
                    <th>Tên đăng nhập</th>
                    <th>Vai trò</th>
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
                          {pendingRequest ? (
                            <div className="mt-1">
                              <Badge variant="danger">Đang chờ cấp lại mật khẩu</Badge>
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <Badge variant={user.role === "admin" ? "danger" : "info"}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </td>
                        <td>{user.branch || "Toàn hệ thống"}</td>
                        <td>{formatDateTime(user.createdAt) || "-"}</td>
                        <td>{formatDateTime(user.passwordUpdatedAt) || "-"}</td>
                        <td>
                          {pendingRequest ? (
                            <div>
                              <div className="text-danger font-weight-bold">Có yêu cầu mới</div>
                              <div className="small text-muted">
                                {formatPasswordResetTime(pendingRequest.requestedAt) || "-"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted">Không có</span>
                          )}
                        </td>
                        <td className="text-right">
                          <Button
                            size="sm"
                            variant={pendingRequest ? "danger" : "warning"}
                            onClick={() => handleResetPassword(user.username)}
                          >
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

          {generatedPassword ? (
            <Card className="mt-3">
              <Card.Header>
                <Card.Title as="h5">Mật khẩu vừa tạo / cấp lại</Card.Title>
              </Card.Header>
              <Card.Body>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 18,
                    background: "#f7f7f8",
                    borderRadius: 8,
                    padding: 12,
                    wordBreak: "break-all",
                  }}
                >
                  {generatedPassword}
                </div>
              </Card.Body>
            </Card>
          ) : null}
        </Col>
      </Row>
    </Container>
  );
}

export default UserProfile;
