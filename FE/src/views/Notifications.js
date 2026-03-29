import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Col, Container, Row, Table } from "react-bootstrap";

import {
  clearNotifications,
  formatNotificationTime,
  loadNotifications,
  NOTIFICATIONS_UPDATED_EVENT,
} from "../utils/notificationsStorage";

function getNotificationColor(type) {
  switch (type) {
    case "asset-created":
      return "success";
    case "asset-deleted":
      return "warning";
    case "password-reset-request":
      return "danger";
    default:
      return "info";
  }
}

function getNotificationTypeLabel(type) {
  if (type === "asset-created") return "Thêm tài sản";
  if (type === "asset-deleted") return "Xóa tài sản";
  if (type === "password-reset-request") return "Quên mật khẩu";
  return "Thông báo";
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const syncNotifications = async () => {
      try {
        setNotifications(await loadNotifications());
      } catch (error) {
        console.error(error);
      }
    };

    syncNotifications();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, syncNotifications);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, syncNotifications);
    };
  }, []);

  const assetCreatedNotifications = useMemo(
    () => notifications.filter((item) => item?.type === "asset-created"),
    [notifications],
  );

  const assetDeletedNotifications = useMemo(
    () => notifications.filter((item) => item?.type === "asset-deleted"),
    [notifications],
  );

  const passwordResetNotifications = useMemo(
    () => notifications.filter((item) => item?.type === "password-reset-request"),
    [notifications],
  );

  const handleClear = async () => {
    await clearNotifications();
    setNotifications([]);
  };

  return (
    <Container fluid>
      <Row>
        <Col md="12">
          <Card className="strpied-tabled-with-hover">
            <Card.Header>
              <Row className="align-items-center">
                <Col>
                  <Card.Title as="h4">Thông báo hệ thống</Card.Title>
                  <p className="card-category mb-0">
                    Admin xem được nhật ký thêm/xóa chi tiết tài sản và yêu cầu quên mật khẩu.
                  </p>
                </Col>
                <Col className="text-right" md="auto">
                  <Button variant="outline-danger" size="sm" onClick={handleClear}>
                    Xóa nhật ký
                  </Button>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              <div className="px-4 pb-3">
                <Row>
                  <Col md="4">
                    <div className="mb-2">
                      <strong>Tổng thông báo:</strong> {notifications.length}
                    </div>
                  </Col>
                  <Col md="4">
                    <div className="mb-2">
                      <strong>Thêm chi tiết tài sản:</strong> {assetCreatedNotifications.length}
                    </div>
                    <div className="mb-2">
                      <strong>Xóa chi tiết tài sản:</strong> {assetDeletedNotifications.length}
                    </div>
                    <div className="mb-2">
                      <strong>Yêu cầu quên mật khẩu:</strong> {passwordResetNotifications.length}
                    </div>
                  </Col>
                  <Col md="4">
                    <div className="mb-2">
                      <strong>Mới nhất:</strong>{" "}
                      {notifications[0]?.createdAt
                        ? formatNotificationTime(notifications[0].createdAt)
                        : "Chưa có"}
                    </div>
                  </Col>
                </Row>
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 pb-4">Chưa có thông báo nào.</div>
              ) : (
                <Table className="table-hover table-striped mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Loại</th>
                      <th>Thời gian</th>
                      <th>Người thao tác</th>
                      <th>Cung</th>
                      <th>Ga</th>
                      <th>Nhóm thiết bị</th>
                      <th>Tài sản</th>
                      <th>Mã code</th>
                      <th>Nội dung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((item, index) => (
                      <tr key={item.id || `${item.createdAt}_${index}`}>
                        <td>{index + 1}</td>
                        <td>
                          <Badge variant={getNotificationColor(item.type)}>
                            {getNotificationTypeLabel(item.type)}
                          </Badge>
                        </td>
                        <td>{formatNotificationTime(item.createdAt)}</td>
                        <td>{item.actorName || item.actorUsername || "-"}</td>
                        <td>{item.branchName || "-"}</td>
                        <td>{item.stationName || "-"}</td>
                        <td>{item.categoryName || "-"}</td>
                        <td>{item.assetName || "-"}</td>
                        <td>{item.assetCode || "-"}</td>
                        <td>{item.message || item.title || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
