import React, { useEffect, useMemo, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

import ActionButtons from "../components/Button/ActionButtons";
import ChildrenDialog from "../components/modals/ChildrenDialog";
import AddItemDialog from "../components/modals/AddItemDialog";
import AppSnackbar from "../components/Feedback/AppSnackbar";
import { loadBranchesData, saveBranchesData } from "../utils/systemsStorage";
import { canAddAsset, canDeleteAsset, canManageStructure, getCurrentUser } from "../utils/auth";
import { logAssetCreated, logAssetDeleted } from "../utils/notificationsStorage";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptyDetail() {
  return {
    id: "",
    name: "",
    code: "",
    material: "",
    number: "",
    year: "",
    expired: "",
    unit: "",
    note: "",
    status: "",
  };
}

function addChildToPath(prevBranches, branchIndex, systemIndex, parentPath, newChild) {
  const next = deepClone(prevBranches);

  let current = next[branchIndex]?.children?.[systemIndex];
  if (!current) return next;

  current.children = current.children || [];

  for (const idx of parentPath) {
    current = current.children[idx];
    if (!current) return next;
    current.children = current.children || [];
  }

  current.children.push(newChild);
  return next;
}

function replaceChildrenAtPath(prevBranches, branchIndex, systemIndex, parentPath, nextChildren) {
  const next = deepClone(prevBranches);
  let current = next[branchIndex]?.children?.[systemIndex];
  if (!current) return next;

  for (const idx of parentPath) {
    current = current?.children?.[idx];
    if (!current) return next;
  }

  current.children = deepClone(nextChildren || []);
  return next;
}

function removeChildAtPath(prevBranches, branchIndex, systemIndex, parentPath, rowIndex) {
  const next = deepClone(prevBranches);
  let current = next[branchIndex]?.children?.[systemIndex];
  if (!current) return next;

  for (const idx of parentPath) {
    current = current?.children?.[idx];
    if (!current) return next;
  }

  current.children = Array.isArray(current.children)
    ? current.children.filter((_, index) => index !== rowIndex)
    : [];

  return next;
}

function buildAvailableBranches(branches, currentUser) {
  return (branches || []).flatMap((branch, branchIndex) => {
    if (
      currentUser?.role !== "admin" &&
      currentUser?.branch &&
      branch?.name_branch !== currentUser.branch
    ) {
      return [];
    }

    return [
      {
        ...deepClone(branch),
        __branchIndex: branchIndex,
      },
    ];
  });
}

function buildCurrentSystems(branch) {
  if (!branch) return [];

  return (branch.children || []).map((system, systemIndex) => ({
    ...deepClone(system),
    __branchIndex: branch.__branchIndex,
    __systemIndex: systemIndex,
    __branchName: branch.name_branch || "",
  }));
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

function toQuantity(value) {
  const quantity = Number.parseInt(String(value || "0").replace(/\D+/g, ""), 10);
  return Number.isFinite(quantity) ? quantity : 0;
}

export default function TableList() {
  const currentUser = getCurrentUser();
  const [branches, setBranches] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [selectedSystemId, setSelectedSystemId] = useState("");

  const [openChildren, setOpenChildren] = useState(false);
  const [childrenContext, setChildrenContext] = useState(null);

  const [openAdd, setOpenAdd] = useState(false);
  const [addContext, setAddContext] = useState(null);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

  const showToast = (message, severity = "success") => {
    setToast({ open: true, severity, message });
  };

  const availableBranches = useMemo(
    () => buildAvailableBranches(branches, currentUser),
    [branches, currentUser],
  );

  const selectedBranch = useMemo(() => {
    if (!availableBranches.length) return null;

    return (
      availableBranches.find((branch) => branch.name_branch === selectedBranchName) ||
      availableBranches[0]
    );
  }, [availableBranches, selectedBranchName]);

  const currentSystems = useMemo(
    () => buildCurrentSystems(selectedBranch),
    [selectedBranch],
  );

  const selectedSystem = useMemo(() => {
    if (!currentSystems.length) return null;

    return (
      currentSystems.find((system) => String(system.id) === String(selectedSystemId)) ||
      currentSystems[0]
    );
  }, [currentSystems, selectedSystemId]);

  useEffect(() => {
    const syncBranches = async () => {
      try {
        const nextBranches = await loadBranchesData();
        setBranches(nextBranches);
        setIsLoaded(true);
      } catch (error) {
        console.error(error);
      }
    };

    syncBranches();
    window.addEventListener("t3h-systems-updated", syncBranches);

    return () => {
      window.removeEventListener("t3h-systems-updated", syncBranches);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const persist = async () => {
      try {
        await saveBranchesData(branches);
      } catch (error) {
        console.error(error);
      }
    };

    persist();
  }, [branches, isLoaded]);

  useEffect(() => {
    if (!availableBranches.length) {
      setSelectedBranchName("");
      return;
    }

    if (!availableBranches.some((branch) => branch.name_branch === selectedBranchName)) {
      setSelectedBranchName(availableBranches[0].name_branch);
    }
  }, [availableBranches, selectedBranchName]);

  useEffect(() => {
    if (!currentSystems.length) {
      setSelectedSystemId("");
      return;
    }

    if (!currentSystems.some((system) => String(system.id) === String(selectedSystemId))) {
      setSelectedSystemId(String(currentSystems[0].id || ""));
    }
  }, [currentSystems, selectedSystemId]);

  const handleOpenChildren = (rowData, rowIndex) => {
    if (!selectedSystem) return;

    setChildrenContext({
      systemIndex: selectedSystem.__systemIndex,
      branchSystemIndex: currentSystems.findIndex(
        (item) => item.__systemIndex === selectedSystem.__systemIndex,
      ),
      rootPath: [rowIndex],
      rootTitle:
        currentUser?.role === "admin"
          ? `${selectedSystem.__branchName} - ${selectedSystem.name_system} - ${rowData.name}`
          : `${selectedSystem.name_system} - ${rowData.name}`,
    });

    setOpenChildren(true);
  };

  const handleOpenSharedAdd = () => {
    setAddContext({
      mode: "shared-category",
      currentSystemIndex: currentSystems.findIndex(
        (item) => item.__systemIndex === selectedSystem?.__systemIndex,
      ),
      branchIndex: selectedBranch?.__branchIndex,
      branchName: selectedBranch?.name_branch,
    });
    setOpenAdd(true);
  };

  const handleOpenAddFromDialog = (context) => {
    setAddContext(context);
    setOpenAdd(true);
  };

  const handleCloseAdd = () => {
    setOpenAdd(false);
    setAddContext(null);
  };

  const handleCloseChildren = () => {
    setOpenChildren(false);
    setChildrenContext(null);
  };

  const handleConfirmAdd = (payload) => {
    if (!addContext) return;

    if (addContext.mode === "shared-category") {
      const newNode = {
        id: payload.id,
        name: payload.name,
        children: [],
      };

      const targetVisibleIndexes =
        payload.stationMode === "all"
          ? currentSystems.map((_, idx) => idx)
          : payload.selectedStations || [];

      setBranches((prev) => {
        const next = deepClone(prev);

        targetVisibleIndexes.forEach((visibleIndex) => {
          const target = currentSystems[visibleIndex];
          if (!target) return;

          const systemNode = next[target.__branchIndex]?.children?.[target.__systemIndex];
          if (!systemNode) return;

          systemNode.children = systemNode.children || [];
          systemNode.children.push(deepClone(newNode));
        });

        return next;
      });

      handleCloseAdd();
      return;
    }

    if (addContext.mode === "single-category-with-template") {
      const newNode = {
        id: payload.id,
        name: payload.name,
        children: [createEmptyDetail()],
      };

      setBranches((prev) =>
        addChildToPath(
          prev,
          addContext.branchIndex,
          addContext.systemIndex,
          addContext.parentPath,
          newNode,
        ),
      );

      handleCloseAdd();
      return;
    }

    if (addContext.mode === "single-detail") {
      const newDetail = {
        id: payload.id,
        name: payload.name,
        code: payload.code,
        material: payload.material,
        number: payload.number,
        year: payload.year,
        expired: payload.expired,
        unit: payload.unit,
        note: payload.note,
        status: payload.status,
      };

      const branchName = branches?.[addContext.branchIndex]?.name_branch || selectedBranch?.name_branch || "";
      const stationNode = branches?.[addContext.branchIndex]?.children?.[addContext.systemIndex] || selectedSystem;
      const stationName = stationNode?.name_system || "";
      const parentNode = getNodeByPath(stationNode, addContext.parentPath || []);
      const categoryName = parentNode?.name || addContext.title || "";

      setBranches((prev) =>
        addChildToPath(
          prev,
          addContext.branchIndex,
          addContext.systemIndex,
          addContext.parentPath,
          newDetail,
        ),
      );

      void logAssetCreated({
        branchName,
        stationName,
        categoryName,
        assetName: payload.name,
        assetCode: payload.code,
        actorName: currentUser?.displayName || currentUser?.username || "Người dùng",
        actorUsername: currentUser?.username || "",
      });

      showToast(`Đã thêm chi tiết tài sản "${payload.name}".`, "success");
      handleCloseAdd();
    }
  };

  const handleSaveDetails = async ({ branchIndex, systemIndex, parentPath, items, originalTotal, editedTotal }) => {
    if (editedTotal !== originalTotal) {
      showToast("Không thể lưu vì tổng số lượng sau chỉnh sửa phải bằng tổng ban đầu.", "error");
      return;
    }

    setBranches((prev) => replaceChildrenAtPath(prev, branchIndex, systemIndex, parentPath, items));
    showToast("Đã cập nhật tình trạng và số lượng thiết bị.", "success");
  };

  const handleDeleteDetail = async ({ branchIndex, systemIndex, parentPath, rowIndex, detail }) => {
    const branchName = branches?.[branchIndex]?.name_branch || "";
    const stationNode = branches?.[branchIndex]?.children?.[systemIndex];
    const stationName = stationNode?.name_system || "";
    const parentNode = getNodeByPath(stationNode, parentPath || []);
    const categoryName = parentNode?.name || childrenContext?.rootTitle || "";

    setBranches((prev) => removeChildAtPath(prev, branchIndex, systemIndex, parentPath, rowIndex));

    try {
      await logAssetDeleted({
        branchName,
        stationName,
        categoryName,
        assetName: detail?.name,
        assetCode: detail?.code,
        actorName: currentUser?.displayName || currentUser?.username || "Người dùng",
        actorUsername: currentUser?.username || "",
      });
    } catch (error) {
      console.error(error);
    }

    showToast(`Đã xóa chi tiết tài sản "${detail?.name || ""}".`, "warning");
  };

  if (availableBranches.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">Chưa có ga nào trong phạm vi được phân quyền</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Box sx={{ width: "100%" }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ flex: 1 }}>
                <FormControl fullWidth sx={{ minWidth: 220 }}>
                  <InputLabel id="branch-select-label">Chọn cung</InputLabel>
                  <Select
                    labelId="branch-select-label"
                    value={selectedBranch?.name_branch || ""}
                    label="Chọn cung"
                    onChange={(event) => setSelectedBranchName(event.target.value)}
                    disabled={currentUser?.role !== "admin"}
                  >
                    {availableBranches.map((branch) => (
                      <MenuItem key={branch.id || branch.name_branch} value={branch.name_branch}>
                        {branch.name_branch}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ minWidth: 260 }}>
                  <InputLabel id="station-select-label">Chọn ga</InputLabel>
                  <Select
                    labelId="station-select-label"
                    value={selectedSystem ? String(selectedSystem.id) : ""}
                    label="Chọn ga"
                    onChange={(event) => setSelectedSystemId(event.target.value)}
                    disabled={!currentSystems.length}
                  >
                    {currentSystems.map((system) => (
                      <MenuItem key={system.id || system.name_system} value={String(system.id)}>
                        {system.name_system}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {canManageStructure(currentUser) && (
                <Button variant="contained" color="success" onClick={handleOpenSharedAdd}>
                  Thêm mục mới cho các ga trong cung
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        {selectedSystem ? (
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={2}
                sx={{ mb: 2 }}
              >
                <Box>
                  <Typography variant="h6">{selectedSystem.name_system}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSystem.__branchName}
                  </Typography>
                </Box>
              </Stack>

              <DataTable
                value={selectedSystem.children || []}
                emptyMessage="Không có dữ liệu"
                responsiveLayout="scroll"
              >
                <Column field="id" header="ID" />
                <Column field="name" header="Danh mục" />
                <Column
                  header="Hành động"
                  body={(rowData, options) => (
                    <ActionButtons
                      onView={() => handleOpenChildren(rowData, options.rowIndex)}
                    />
                  )}
                />
              </DataTable>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Typography variant="h6">Cung này chưa có ga để hiển thị</Typography>
            </CardContent>
          </Card>
        )}

        <ChildrenDialog
          open={openChildren}
          onClose={handleCloseChildren}
          systems={currentSystems}
          systemIndex={childrenContext?.branchSystemIndex}
          rootPath={childrenContext?.rootPath || []}
          rootTitle={childrenContext?.rootTitle || ""}
          onOpenAdd={handleOpenAddFromDialog}
          onSaveDetails={handleSaveDetails}
          onDeleteDetail={handleDeleteDetail}
          allowAddCategory={canManageStructure(currentUser)}
          allowAddAsset={canAddAsset(currentUser)}
          allowDeleteAsset={canDeleteAsset(currentUser)}
        />

        <AddItemDialog
          open={openAdd}
          onClose={handleCloseAdd}
          onConfirm={handleConfirmAdd}
          context={addContext}
          systems={currentSystems}
        />
      </Box>

      <AppSnackbar
        open={toast.open}
        severity={toast.severity}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
