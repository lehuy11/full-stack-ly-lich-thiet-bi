import React, { useEffect, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";

import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

const STATUS_OPTIONS = ["Tốt", "Bình thường", "Hỏng"];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getNodeByPath(system, path = []) {
  let current = system;

  for (const idx of path) {
    const children = current?.children || [];
    current = children[idx];

    if (!current) return null;
  }

  return current;
}

function hasMeaningfulRowData(item) {
  if (!item || typeof item !== "object") return false;

  return ["id", "name", "code", "material", "unit", "number", "year", "expired", "note", "status"].some(
    (key) => String(item[key] || "").trim() !== "",
  );
}

function getMeaningfulChildrenCount(children = []) {
  return children.filter((child) => {
    if (Array.isArray(child?.children)) return true;
    return hasMeaningfulRowData(child);
  }).length;
}

function canRowReceiveDetail(rowData) {
  if (!Array.isArray(rowData?.children)) return false;
  if (rowData.children.length === 0) return true;

  return !rowData.children.some((child) => Array.isArray(child?.children));
}

function toQuantity(value) {
  const numeric = Number.parseInt(String(value || "0").replace(/\D+/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

export default function ChildrenDialog({
  open,
  onClose,
  systems = [],
  systemIndex,
  rootPath = [],
  rootTitle = "",
  onOpenAdd,
  onSaveDetails,
  onDeleteDetail,
  allowAddCategory = false,
  allowAddAsset = false,
  allowDeleteAsset = false,
}) {
  const [navStack, setNavStack] = useState([]);
  const [editableItems, setEditableItems] = useState([]);

  useEffect(() => {
    if (open && typeof systemIndex === "number") {
      setNavStack([
        {
          path: rootPath,
          title: rootTitle,
        },
      ]);
    } else {
      setNavStack([]);
    }
  }, [open, systemIndex, rootPath, rootTitle]);

  const currentEntry = navStack[navStack.length - 1] || null;
  const currentPath = currentEntry?.path || [];
  const currentTitle = currentEntry?.title || rootTitle;

  const currentNode = useMemo(() => {
    if (typeof systemIndex !== "number") return null;
    return getNodeByPath(systems[systemIndex], currentPath);
  }, [systems, systemIndex, currentPath]);

  const currentSystem = typeof systemIndex === "number" ? systems[systemIndex] : null;
  const currentItems = currentNode?.children || [];
  const hasNestedChildren = currentItems.some((item) => Array.isArray(item.children));
  const isDetailLevel = currentItems.length > 0 && !hasNestedChildren;

  useEffect(() => {
    if (isDetailLevel) {
      setEditableItems(deepClone(currentItems));
    } else {
      setEditableItems([]);
    }
  }, [isDetailLevel, currentItems]);

  const addMode = useMemo(() => {
    if (currentPath.length <= 1) return "single-category-with-template";
    if (hasNestedChildren) return "single-category-with-template";
    return "single-detail";
  }, [currentPath, hasNestedChildren]);

  const canShowTopAdd = addMode === "single-detail" ? allowAddAsset : allowAddCategory;
  const breadcrumbText = navStack.map((item) => item.title).join(" / ");
  const originalTotal = useMemo(
    () => (isDetailLevel ? currentItems.reduce((sum, item) => sum + toQuantity(item.number), 0) : 0),
    [isDetailLevel, currentItems],
  );
  const editedTotal = useMemo(
    () => editableItems.reduce((sum, item) => sum + toQuantity(item.number), 0),
    [editableItems],
  );
  const hasInvalidQuantity = useMemo(
    () => editableItems.some((item) => String(item.number || "").trim() !== "" && !/^\d+$/.test(String(item.number))),
    [editableItems],
  );
  const totalMismatch = isDetailLevel && editedTotal !== originalTotal;
  const hasChanges = isDetailLevel && JSON.stringify(editableItems) !== JSON.stringify(currentItems);

  const handleGoNext = (rowData, rowIndex) => {
    if (!rowData?.children || rowData.children.length === 0) return;

    setNavStack((prev) => [
      ...prev,
      {
        path: [...currentPath, rowIndex],
        title: rowData.name || "Chi tiết",
      },
    ]);
  };

  const handleBack = () => {
    setNavStack((prev) => prev.slice(0, -1));
  };

  const handleOpenAdd = () => {
    if (!onOpenAdd || typeof systemIndex !== "number" || !currentSystem) return;

    onOpenAdd({
      mode: addMode,
      systemIndex,
      enterpriseIndex: currentSystem.__enterpriseIndex,
      branchIndex: currentSystem.__branchIndex,
      parentPath: currentPath,
      title: currentTitle,
    });
  };

  const handleOpenAddDetailAtRow = (rowData, rowIndex) => {
    if (!onOpenAdd || typeof systemIndex !== "number" || !currentSystem) return;

    onOpenAdd({
      mode: "single-detail",
      systemIndex,
      enterpriseIndex: currentSystem.__enterpriseIndex,
      branchIndex: currentSystem.__branchIndex,
      parentPath: [...currentPath, rowIndex],
      title: `${currentTitle} - ${rowData?.name || "Chi tiết tài sản"}`,
    });
  };

  const handleEditField = (rowIndex, field, value) => {
    setEditableItems((prev) => prev.map((item, index) => {
      if (index !== rowIndex) return item;
      return {
        ...item,
        [field]: field === "number" ? String(value || "").replace(/\D+/g, "") : value,
      };
    }));
  };

  const handleSaveDetails = async () => {
    if (!onSaveDetails || !isDetailLevel || totalMismatch || hasInvalidQuantity) return;

    await onSaveDetails({
      enterpriseIndex: currentSystem.__enterpriseIndex,
      branchIndex: currentSystem.__branchIndex,
      systemIndex,
      parentPath: currentPath,
      items: editableItems,
      originalTotal,
      editedTotal,
    });
  };

  const handleDeleteDetail = async (rowData, rowIndex) => {
    if (!onDeleteDetail || !isDetailLevel) return;

    await onDeleteDetail({
      enterpriseIndex: currentSystem.__enterpriseIndex,
      branchIndex: currentSystem.__branchIndex,
      systemIndex,
      parentPath: currentPath,
      rowIndex,
      detail: rowData,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{currentTitle}</DialogTitle>

      <DialogContent dividers>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              {breadcrumbText}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {isDetailLevel && allowAddAsset && (
              <Button
                variant="outlined"
                onClick={() => setEditableItems(deepClone(currentItems))}
                disabled={!hasChanges}
              >
                Khôi phục
              </Button>
            )}
            {isDetailLevel && allowAddAsset && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveDetails}
                disabled={!hasChanges || totalMismatch || hasInvalidQuantity}
              >
                Lưu thay đổi
              </Button>
            )}
            {canShowTopAdd && (
              <Button variant="contained" color="success" onClick={handleOpenAdd}>
                {addMode === "single-detail" ? "Thêm chi tiết tài sản" : "Thêm nhóm thiết bị"}
              </Button>
            )}
          </Stack>
        </Stack>

        {isDetailLevel && (
          <Alert severity={totalMismatch || hasInvalidQuantity ? "warning" : "info"} sx={{ mb: 2 }}>
            Tổng số lượng ban đầu: <strong>{originalTotal}</strong>. Tổng số lượng sau chỉnh sửa: <strong>{editedTotal}</strong>.
            {totalMismatch ? " Bạn chỉ được lưu khi tổng sau chỉnh sửa bằng đúng tổng ban đầu." : " Bạn có thể đổi tình trạng và số lượng của từng dòng, miễn tổng cuối cùng không đổi."}
            {hasInvalidQuantity ? " Số lượng chỉ được nhập số nguyên không âm." : ""}
          </Alert>
        )}

        {isDetailLevel ? (
          <DataTable
            value={editableItems}
            emptyMessage="Không có dữ liệu"
            responsiveLayout="scroll"
          >
            <Column field="id" header="ID" />
            <Column field="name" header="Tên" />
            <Column field="code" header="Mã" />
            <Column field="material" header="Vật liệu" />
            <Column field="unit" header="Đơn vị" />
            <Column
              header="Số lượng"
              body={(rowData, options) => (
                allowAddAsset ? (
                  <TextField
                    size="small"
                    value={editableItems[options.rowIndex]?.number || ""}
                    onChange={(event) => handleEditField(options.rowIndex, "number", event.target.value)}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                    sx={{ minWidth: 90 }}
                  />
                ) : rowData.number
              )}
            />
            <Column field="year" header="Năm SX" />
            <Column field="expired" header="Hạn dùng" />
            <Column
              header="Tình trạng"
              body={(rowData, options) => (
                allowAddAsset ? (
                  <TextField
                    select
                    size="small"
                    value={editableItems[options.rowIndex]?.status || ""}
                    onChange={(event) => handleEditField(options.rowIndex, "status", event.target.value)}
                    sx={{ minWidth: 140 }}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : rowData.status
              )}
            />
            <Column field="note" header="Ghi chú" />
            {(allowDeleteAsset || allowAddAsset) && (
              <Column
                header="Hành động"
                body={(rowData, options) => (
                  <Stack direction="row" spacing={1}>
                    {allowDeleteAsset && (
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        onClick={() => handleDeleteDetail(rowData, options.rowIndex)}
                      >
                        <i className="fa fa-trash" />
                      </Button>
                    )}
                  </Stack>
                )}
              />
            )}
          </DataTable>
        ) : (
          <DataTable
            value={currentItems}
            emptyMessage="Không có dữ liệu"
            responsiveLayout="scroll"
          >
            <Column field="id" header="ID" />
            <Column field="name" header="Tên danh mục" />
            <Column
              header="Số mục con"
              body={(rowData) => getMeaningfulChildrenCount(rowData.children || [])}
            />
            <Column
              header="Hành động"
              body={(rowData, options) => {
                const childCount = getMeaningfulChildrenCount(rowData.children || []);
                const canGoNext = childCount > 0;
                const canAddDetailHere = allowAddAsset && canRowReceiveDetail(rowData);

                return (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleGoNext(rowData, options.rowIndex)}
                      disabled={!canGoNext}
                    >
                      <i className="fas fa-search" />
                    </Button>
                    {canAddDetailHere && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={() => handleOpenAddDetailAtRow(rowData, options.rowIndex)}
                      >
                        <i className="fa fa-plus" />
                      </Button>
                    )}
                  </Stack>
                );
              }}
            />
          </DataTable>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleBack} disabled={navStack.length <= 1}>
          <i className="fa fa-arrow-left" aria-hidden="true"></i>
        </Button>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

