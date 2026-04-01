import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Card, Col, Container, Row, Table } from "react-bootstrap";

import {
  getVisibleOrganizations,
  loadBranchesData,
  SYSTEMS_UPDATED_EVENT,
} from "../utils/systemsStorage";
import { getCurrentUser } from "../utils/auth";

const CURRENT_YEAR = new Date().getFullYear();

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeStatus(value) {
  const normalized = normalizeText(value);

  if (normalized === "hong") return "Hỏng";
  if (normalized === "tot") return "Tốt";
  if (normalized === "binh thuong") return "Bình thường";

  return "Khác";
}

function toNumber(value) {
  const raw = String(value || "").trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

function hasMeaningfulAssetData(node) {
  if (!node || typeof node !== "object") return false;

  const fields = ["id", "name", "code", "material", "number", "year", "expired", "unit", "note", "status"];
  return fields.some((key) => String(node[key] || "").trim() !== "");
}

function isAssetLeaf(node) {
  return (
    node &&
    typeof node === "object" &&
    !Array.isArray(node.children) &&
    ["code", "material", "number", "year", "expired", "unit", "note", "status"].some((key) =>
      Object.prototype.hasOwnProperty.call(node, key),
    )
  );
}

function collectAssetsFromNode(node, enterpriseName, branchName, stationName, path, result) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node.children)) {
    const nextPath = node.name ? [...path, node.name] : path;
    node.children.forEach((child) =>
      collectAssetsFromNode(child, enterpriseName, branchName, stationName, nextPath, result),
    );
    return;
  }

  if (!isAssetLeaf(node) || !hasMeaningfulAssetData(node)) return;

  const quantity = toNumber(node.number) || 0;
  const year = toNumber(node.year);
  const expired = toNumber(node.expired);

  result.push({
    enterpriseName,
    branchName,
    stationName,
    categoryPath: path,
    categoryLabel: path.join(" › "),
    id: String(node.id || "").trim(),
    name: String(node.name || "").trim(),
    code: String(node.code || "").trim(),
    material: String(node.material || "").trim(),
    unit: String(node.unit || "").trim(),
    note: String(node.note || "").trim(),
    quantity,
    year,
    expired,
    status: normalizeStatus(node.status),
    usageYears: year ? Math.max(CURRENT_YEAR - year, 0) : null,
  });
}

function flattenAssets(organizations = []) {
  const result = [];

  organizations.forEach((enterprise) => {
    const enterpriseName = enterprise?.name_enterprise || "Chưa rõ xí nghiệp";
    (enterprise?.children || []).forEach((branch) => {
      const branchName = branch?.name_branch || "Chưa rõ cung";
      (branch?.children || []).forEach((system) => {
        const stationName = system?.name_system || "Chưa rõ ga";
        (system?.children || []).forEach((child) =>
          collectAssetsFromNode( child, enterpriseName, branchName, stationName, [child?.name].filter(Boolean), result),
        );
      });
    });
  });

  return result;
}

function mapAverageUsage(item) {
  return item.usageCount > 0 ? Number((item.usageSum / item.usageCount).toFixed(1)) : null;
}

function buildDashboardData(assets = []) {
  const totalRows = assets.length;
  const totalQuantity = assets.reduce((sum, asset) => sum + (asset.quantity || 0), 0);
  const brokenQuantity = assets.filter((asset) => asset.status === "Hỏng").reduce((sum, asset) => sum + (asset.quantity || 0), 0);
  const goodQuantity = assets.filter((asset) => asset.status === "Tốt").reduce((sum, asset) => sum + (asset.quantity || 0), 0);
  const normalQuantity = assets.filter((asset) => asset.status === "Bình thường").reduce((sum, asset) => sum + (asset.quantity || 0), 0);
  const expiredQuantity = assets.filter((asset) => asset.expired && asset.expired < CURRENT_YEAR).reduce((sum, asset) => sum + (asset.quantity || 0), 0);

  let usageSum = 0;
  let usageCount = 0;

  const enterpriseMap = new Map();
  const stationMap = new Map();

  assets.forEach((asset) => {
    if (typeof asset.usageYears === "number") {
      usageSum += asset.usageYears;
      usageCount += 1;
    }

    const enterpriseKey = asset.enterpriseName;
    if (!enterpriseMap.has(enterpriseKey)) {
      enterpriseMap.set(enterpriseKey, {
        enterpriseName: asset.enterpriseName,
        totalQuantity: 0,
        brokenQuantity: 0,
        goodQuantity: 0,
        normalQuantity: 0,
        expiredQuantity: 0,
        usageSum: 0,
        usageCount: 0,
      });
    }

    const enterprise = enterpriseMap.get(enterpriseKey);
    enterprise.totalQuantity += asset.quantity || 0;
    if (asset.status === "Hỏng") enterprise.brokenQuantity += asset.quantity || 0;
    if (asset.status === "Tốt") enterprise.goodQuantity += asset.quantity || 0;
    if (asset.status === "Bình thường") enterprise.normalQuantity += asset.quantity || 0;
    if (asset.expired && asset.expired < CURRENT_YEAR) enterprise.expiredQuantity += asset.quantity || 0;
    if (typeof asset.usageYears === "number") {
      enterprise.usageSum += asset.usageYears;
      enterprise.usageCount += 1;
    }

    const stationKey = `${asset.enterpriseName}__${asset.branchName}__${asset.stationName}`;
    if (!stationMap.has(stationKey)) {
      stationMap.set(stationKey, {
        enterpriseName: asset.enterpriseName,
        branchName: asset.branchName,
        stationName: asset.stationName,
        totalQuantity: 0,
        brokenQuantity: 0,
        goodQuantity: 0,
        normalQuantity: 0,
        expiredQuantity: 0,
        usageSum: 0,
        usageCount: 0,
        oldestYear: null,
      });
    }

    const station = stationMap.get(stationKey);
    station.totalQuantity += asset.quantity || 0;
    if (asset.status === "Hỏng") station.brokenQuantity += asset.quantity || 0;
    if (asset.status === "Tốt") station.goodQuantity += asset.quantity || 0;
    if (asset.status === "Bình thường") station.normalQuantity += asset.quantity || 0;
    if (asset.expired && asset.expired < CURRENT_YEAR) station.expiredQuantity += asset.quantity || 0;
    if (typeof asset.usageYears === "number") {
      station.usageSum += asset.usageYears;
      station.usageCount += 1;
    }
    if (asset.year) {
      station.oldestYear = station.oldestYear === null ? asset.year : Math.min(station.oldestYear, asset.year);
    }
  });

  const enterpriseSummary = Array.from(enterpriseMap.values())
    .map((item) => ({ ...item, averageUsageYears: mapAverageUsage(item) }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity || b.brokenQuantity - a.brokenQuantity);

  const stationSummary = Array.from(stationMap.values())
    .map((station) => ({ ...station, averageUsageYears: mapAverageUsage(station) }))
    .sort((a, b) => {
      if (b.brokenQuantity !== a.brokenQuantity) return b.brokenQuantity - a.brokenQuantity;
      return b.totalQuantity - a.totalQuantity;
    });

  const brokenAssets = assets
    .filter((asset) => asset.status === "Hỏng")
    .sort((a, b) => b.quantity - a.quantity || (b.usageYears || 0) - (a.usageYears || 0));

  const expiringAssets = assets
    .filter((asset) => asset.expired && asset.expired <= CURRENT_YEAR + 1)
    .sort((a, b) => (a.expired || 0) - (b.expired || 0));

  return {
    totalRows,
    totalQuantity,
    brokenQuantity,
    goodQuantity,
    normalQuantity,
    expiredQuantity,
    averageUsageYears: usageCount > 0 ? Number((usageSum / usageCount).toFixed(1)) : null,
    topBrokenStation: stationSummary[0] || null,
    enterpriseSummary,
    stationSummary,
    brokenAssets,
    expiringAssets,
  };
}

function formatYears(value) {
  if (typeof value !== "number") return "-";
  return `${value} năm`;
}

function SummaryCard({ title, value, subtitle, variant = "primary" }) {
  return (
    <Card className="mb-4">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="text-muted" style={{ fontSize: 13 }}>{title}</div>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
            <div className="text-muted mt-2" style={{ fontSize: 13 }}>{subtitle}</div>
          </div>
          <Badge bg={variant}>{title}</Badge>
        </div>
      </Card.Body>
    </Card>
  );
}

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const [organizations, setOrganizations] = useState([]);

  useEffect(() => {
    const syncOrganizations = async () => {
      try {
        setOrganizations(await loadBranchesData());
      } catch (error) {
        console.error(error);
      }
    };

    syncOrganizations();
    window.addEventListener(SYSTEMS_UPDATED_EVENT, syncOrganizations);

    return () => {
      window.removeEventListener(SYSTEMS_UPDATED_EVENT, syncOrganizations);
    };
  }, []);

  const visibleOrganizations = useMemo(
    () => getVisibleOrganizations(organizations, currentUser),
    [organizations, currentUser],
  );
  const assets = useMemo(() => flattenAssets(visibleOrganizations), [visibleOrganizations]);
  const dashboard = useMemo(() => buildDashboardData(assets), [assets]);
  const showEnterpriseColumn = visibleOrganizations.length > 1;
  const showBranchColumn = showEnterpriseColumn || visibleOrganizations.some((enterprise) => (enterprise.children || []).length > 1);
  const scopeLabel = currentUser?.role === "admin"
    ? "Toàn bộ xí nghiệp"
    : [currentUser?.enterprise, currentUser?.branch].filter(Boolean).join(" / ");

  return (
    <Container fluid>
      <Row>
        <Col xs="12">
          <Card className="mb-4">
            <Card.Header>
              <Card.Title as="h4">Dashboard tài sản TTTH</Card.Title>
              <p className="card-category mb-0">
                Phạm vi dữ liệu: <strong>{scopeLabel || "Toàn bộ xí nghiệp"}</strong>. Dashboard lấy dữ liệu từ API backend nên khi thêm tài sản ở danh sách, số liệu sẽ cập nhật theo.
              </p>
            </Card.Header>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col lg="3" md="6" sm="6">
          <SummaryCard title="Bản ghi tài sản" value={dashboard.totalRows} subtitle="Số dòng tài sản chi tiết đang có dữ liệu" variant="primary" />
        </Col>
        <Col lg="3" md="6" sm="6">
          <SummaryCard title="Tổng số lượng" value={dashboard.totalQuantity} subtitle="Tổng thiết bị cộng theo trường Số lượng" variant="info" />
        </Col>
        <Col lg="3" md="6" sm="6">
          <SummaryCard
            title="Thiết bị hư hỏng"
            value={dashboard.brokenQuantity}
            subtitle={dashboard.topBrokenStation && dashboard.topBrokenStation.brokenQuantity > 0 ? `${dashboard.topBrokenStation.stationName} đang nhiều hỏng nhất` : "Chưa có thiết bị hư hỏng"}
            variant="danger"
          />
        </Col>
        <Col lg="3" md="6" sm="6">
          <SummaryCard title="Tuổi sử dụng TB" value={formatYears(dashboard.averageUsageYears)} subtitle="Ước tính từ năm sản xuất" variant="success" />
        </Col>
      </Row>

      {assets.length === 0 && (
        <Row>
          <Col xs="12">
            <Alert variant="warning">Hiện chưa có dữ liệu tài sản chi tiết để tổng hợp trong phạm vi đang xem.</Alert>
          </Col>
        </Row>
      )}

      <Row>
        <Col lg="5" xs="12">
          <Card className="mb-4">
            <Card.Header>
              <Card.Title as="h4">Tổng hợp theo xí nghiệp</Card.Title>
              <p className="card-category mb-0">Tổng số lượng thiết bị ở xí nghiệp bằng tổng thiết bị ở các cung và ga trực thuộc.</p>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              <Table className="table-hover table-striped mb-0">
                <thead>
                  <tr>
                    <th>Xí nghiệp</th>
                    <th>Tổng SL</th>
                    <th>Hỏng</th>
                    <th>Tốt</th>
                    <th>Bình thường</th>
                    <th>Quá hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.enterpriseSummary.map((enterprise) => (
                    <tr key={enterprise.enterpriseName}>
                      <td>{enterprise.enterpriseName}</td>
                      <td>{enterprise.totalQuantity}</td>
                      <td>{enterprise.brokenQuantity}</td>
                      <td>{enterprise.goodQuantity}</td>
                      <td>{enterprise.normalQuantity}</td>
                      <td>{enterprise.expiredQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col lg="7" xs="12">
          <Card className="mb-4">
            <Card.Header>
              <Card.Title as="h4">Tổng hợp theo ga</Card.Title>
              <p className="card-category mb-0">Theo dõi ga nào có nhiều thiết bị hư hỏng, quá hạn hoặc đã sử dụng lâu.</p>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              <Table className="table-hover table-striped mb-0">
                <thead>
                  <tr>
                    {showEnterpriseColumn && <th>Xí nghiệp</th>}
                    {showBranchColumn && <th>Cung</th>}
                    <th>Ga</th>
                    <th>Tổng SL</th>
                    <th>Hỏng</th>
                    <th>Tốt</th>
                    <th>Bình thường</th>
                    <th>Quá hạn</th>
                    <th>Tuổi dùng TB</th>
                    <th>Năm SX cũ nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.stationSummary.map((station) => (
                    <tr key={`${station.enterpriseName}-${station.branchName}-${station.stationName}`}>
                      {showEnterpriseColumn && <td>{station.enterpriseName}</td>}
                      {showBranchColumn && <td>{station.branchName}</td>}
                      <td>{station.stationName}</td>
                      <td>{station.totalQuantity}</td>
                      <td>{station.brokenQuantity}</td>
                      <td>{station.goodQuantity}</td>
                      <td>{station.normalQuantity}</td>
                      <td>{station.expiredQuantity}</td>
                      <td>{formatYears(station.averageUsageYears)}</td>
                      <td>{station.oldestYear || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col lg="7" xs="12">
          <Card className="mb-4">
            <Card.Header>
              <Card.Title as="h4">Thiết bị hư hỏng</Card.Title>
              <p className="card-category mb-0">Danh sách cần ưu tiên kiểm tra, sửa chữa.</p>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              <Table className="table-hover table-striped mb-0">
                <thead>
                  <tr>
                    {showEnterpriseColumn && <th>Xí nghiệp</th>}
                    {showBranchColumn && <th>Cung</th>}
                    <th>Ga</th>
                    <th>Tên thiết bị</th>
                    <th>Mã</th>
                    <th>Đơn vị</th>
                    <th>Số lượng</th>
                    <th>Năm SX</th>
                    <th>Tuổi dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.brokenAssets.slice(0, 10).map((asset, idx) => (
                    <tr key={`${asset.enterpriseName}-${asset.branchName}-${asset.stationName}-${asset.id}-${idx}`}>
                      {showEnterpriseColumn && <td>{asset.enterpriseName}</td>}
                      {showBranchColumn && <td>{asset.branchName}</td>}
                      <td>{asset.stationName}</td>
                      <td>{asset.name || "-"}</td>
                      <td>{asset.code || "-"}</td>
                      <td>{asset.unit || "-"}</td>
                      <td>{asset.quantity}</td>
                      <td>{asset.year || "-"}</td>
                      <td>{formatYears(asset.usageYears)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col lg="5" xs="12">
          <Card className="mb-4">
            <Card.Header>
              <Card.Title as="h4">Thiết bị sắp / đã hết hạn</Card.Title>
              <p className="card-category mb-0">Bao gồm thiết bị hết hạn trong năm hiện tại hoặc năm kế tiếp.</p>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              <Table className="table-hover table-striped mb-0">
                <thead>
                  <tr>
                    <th>Thiết bị</th>
                    <th>Ga</th>
                    <th>Hạn</th>
                    <th>Số lượng</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.expiringAssets.slice(0, 10).map((asset, idx) => (
                    <tr key={`${asset.enterpriseName}-${asset.branchName}-${asset.stationName}-${asset.code}-${idx}`}>
                      <td>{asset.name || asset.code || "-"}</td>
                      <td>{asset.stationName}</td>
                      <td>{asset.expired || "-"}</td>
                      <td>{asset.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
