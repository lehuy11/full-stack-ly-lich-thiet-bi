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

function addChildToPath(prevOrganizations, enterpriseIndex, branchIndex, systemIndex, parentPath, newChild) {
  const next = deepClone(prevOrganizations);
  let current = next[enterpriseIndex]?.children?.[branchIndex]?.children?.[systemIndex];
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

function replaceChildrenAtPath(prevOrganizations, enterpriseIndex, branchIndex, systemIndex, parentPath, nextChildren) {
  const next = deepClone(prevOrganizations);
  let current = next[enterpriseIndex]?.children?.[branchIndex]?.children?.[systemIndex];
  if (!current) return next;

  for (const idx of parentPath) {
    current = current?.children?.[idx];
    if (!current) return next;
  }

  current.children = deepClone(nextChildren || []);
  return next;
}

function removeChildAtPath(prevOrganizations, enterpriseIndex, branchIndex, systemIndex, parentPath, rowIndex) {
  const next = deepClone(prevOrganizations);
  let current = next[enterpriseIndex]?.children?.[branchIndex]?.children?.[systemIndex];
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

function buildVisibleEnterprises(organizations, currentUser) {
  return (organizations || []).flatMap((enterprise, enterpriseIndex) => {
    if (
      currentUser?.role !== "admin" &&
      currentUser?.enterprise &&
      enterprise?.name_enterprise !== currentUser.enterprise
    ) {
      return [];
    }

    const visibleBranches = (enterprise.children || []).filter((branch) => {
      if (currentUser?.role === "admin") return true;
      if (!currentUser?.branch) return true;
      return branch?.name_branch === currentUser.branch;
    });

    if (!visibleBranches.length) return [];

    return [{
      ...deepClone(enterprise),
      children: visibleBranches,
      __enterpriseIndex: enterpriseIndex,
    }];
  });
}

function buildCurrentBranches(enterprise) {
  if (!enterprise) return [];

  return (enterprise.children || []).map((branch, branchIndex) => ({
    ...deepClone(branch),
    __enterpriseIndex: enterprise.__enterpriseIndex,
    __branchIndex: branchIndex,
    __enterpriseName: enterprise.name_enterprise || "",
  }));
}

function buildCurrentSystems(branch) {
  if (!branch) return [];

  return (branch.children || []).map((system, systemIndex) => ({
    ...deepClone(system),
    __enterpriseIndex: branch.__enterpriseIndex,
    __branchIndex: branch.__branchIndex,
    __systemIndex: systemIndex,
    __branchName: branch.name_branch || "",
    __enterpriseName: branch.__enterpriseName || "",
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

export default function TableList() {
  const currentUser = getCurrentUser();
  const [organizations, setOrganizations] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedEnterpriseName, setSelectedEnterpriseName] = useState("");
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

  const visibleEnterprises = useMemo(
    () => buildVisibleEnterprises(organizations, currentUser),
    [organizations, currentUser],
  );

  const selectedEnterprise = useMemo(() => {
    if (!visibleEnterprises.length) return null;
    return visibleEnterprises.find((item) => item.name_enterprise === selectedEnterpriseName) || visibleEnterprises[0];
  }, [visibleEnterprises, selectedEnterpriseName]);

  const currentBranches = useMemo(
    () => buildCurrentBranches(selectedEnterprise),
    [selectedEnterprise],
  );

  const selectedBranch = useMemo(() => {
    if (!currentBranches.length) return null;
    return currentBranches.find((item) => item.name_branch === selectedBranchName) || currentBranches[0];
  }, [currentBranches, selectedBranchName]);

  const currentSystems = useMemo(
    () => buildCurrentSystems(selectedBranch),
    [selectedBranch],
  );

  const selectedSystem = useMemo(() => {
    if (!currentSystems.length) return null;
    return currentSystems.find((item) => String(item.id) === String(selectedSystemId)) || currentSystems[0];
  }, [currentSystems, selectedSystemId]);

  useEffect(() => {
    const syncOrganizations = async () => {
      try {
        const nextOrganizations = await loadBranchesData();
        setOrganizations(nextOrganizations);
        setIsLoaded(true);
      } catch (error) {
        console.error(error);
      }
    };

    syncOrganizations();
    window.addEventListener("t3h-systems-updated", syncOrganizations);
    return () => {
      window.removeEventListener("t3h-systems-updated", syncOrganizations);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const persist = async () => {
      try {
        await saveBranchesData(organizations);
      } catch (error) {
        console.error(error);
      }
    };
    persist();
  }, [organizations, isLoaded]);

  useEffect(() => {
    if (!visibleEnterprises.length) {
      setSelectedEnterpriseName("");
      return;
    }
    if (!visibleEnterprises.some((item) => item.name_enterprise === selectedEnterpriseName)) {
      setSelectedEnterpriseName(visibleEnterprises[0].name_enterprise);
    }
  }, [visibleEnterprises, selectedEnterpriseName]);

  useEffect(() => {
    if (!currentBranches.length) {
      setSelectedBranchName("");
      return;
    }
    if (!currentBranches.some((item) => item.name_branch === selectedBranchName)) {
      setSelectedBranchName(currentBranches[0].name_branch);
    }
  }, [currentBranches, selectedBranchName]);

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
      enterpriseIndex: selectedSystem.__enterpriseIndex,
      branchIndex: selectedSystem.__branchIndex,
      systemIndex: selectedSystem.__systemIndex,
      branchSystemIndex: currentSystems.findIndex((item) => item.__systemIndex === selectedSystem.__systemIndex),
      rootPath: [rowIndex],
      rootTitle:
        currentUser?.role === "admin"
          ? `${selectedSystem.__enterpriseName} - ${selectedSystem.__branchName} - ${selectedSystem.name_system} - ${rowData.name}`
          : `${selectedSystem.__branchName} - ${selectedSystem.name_system} - ${rowData.name}`,
    });

    setOpenChildren(true);
  };

  const handleOpenSharedAdd = () => {
    setAddContext({
      mode: "shared-category",
      currentSystemIndex: currentSystems.findIndex((item) => item.__systemIndex === selectedSystem?.__systemIndex),
      enterpriseIndex: selectedBranch?.__enterpriseIndex,
      branchIndex: selectedBranch?.__branchIndex,
      enterpriseName: selectedEnterprise?.name_enterprise,
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
      const newNode = { id: payload.id, name: payload.name, children: [] };
      const targetVisibleIndexes = payload.stationMode === "all" ? currentSystems.map((_, idx) => idx) : payload.selectedStations || [];

      setOrganizations((prev) => {
        const next = deepClone(prev);
        targetVisibleIndexes.forEach((visibleIndex) => {
          const target = currentSystems[visibleIndex];
          if (!target) return;
          const systemNode = next[target.__enterpriseIndex]?.children?.[target.__branchIndex]?.children?.[target.__systemIndex];
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
      const newNode = { id: payload.id, name: payload.name, children: [createEmptyDetail()] };

      setOrganizations((prev) =>
        addChildToPath(prev, addContext.enterpriseIndex, addContext.branchIndex, addContext.systemIndex, addContext.parentPath, newNode),
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

      const enterpriseName = organizations?.[addContext.enterpriseIndex]?.name_enterprise || selectedEnterprise?.name_enterprise || "";
      const branchName = organizations?.[addContext.enterpriseIndex]?.children?.[addContext.branchIndex]?.name_branch || selectedBranch?.name_branch || "";
      const stationNode = organizations?.[addContext.enterpriseIndex]?.children?.[addContext.branchIndex]?.children?.[addContext.systemIndex] || selectedSystem;
      const stationName = stationNode?.name_system || "";
      const parentNode = getNodeByPath(stationNode, addContext.parentPath || []);
      const categoryName = parentNode?.name || addContext.title || "";

      setOrganizations((prev) =>
        addChildToPath(prev, addContext.enterpriseIndex, addContext.branchIndex, addContext.systemIndex, addContext.parentPath, newDetail),
      );

      void logAssetCreated({
        branchName: `${enterpriseName} / ${branchName}`,
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

  const handleSaveDetails = async ({ enterpriseIndex, branchIndex, systemIndex, parentPath, items, originalTotal, editedTotal }) => {
    if (editedTotal !== originalTotal) {
      showToast("Không thể lưu vì tổng số lượng sau chỉnh sửa phải bằng tổng ban đầu.", "error");
      return;
    }

    setOrganizations((prev) => replaceChildrenAtPath(prev, enterpriseIndex, branchIndex, systemIndex, parentPath, items));
    showToast("Đã cập nhật tình trạng và số lượng thiết bị.", "success");
  };

  const handleDeleteDetail = async ({ enterpriseIndex, branchIndex, systemIndex, parentPath, rowIndex, detail }) => {
    const enterpriseName = organizations?.[enterpriseIndex]?.name_enterprise || "";
    const branchName = organizations?.[enterpriseIndex]?.children?.[branchIndex]?.name_branch || "";
    const stationNode = organizations?.[enterpriseIndex]?.children?.[branchIndex]?.children?.[systemIndex];
    const stationName = stationNode?.name_system || "";
    const parentNode = getNodeByPath(stationNode, parentPath || []);
    const categoryName = parentNode?.name || childrenContext?.rootTitle || "";

    setOrganizations((prev) => removeChildAtPath(prev, enterpriseIndex, branchIndex, systemIndex, parentPath, rowIndex));

    try {
      await logAssetDeleted({
        branchName: `${enterpriseName} / ${branchName}`,
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

  if (visibleEnterprises.length === 0) {
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
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ flex: 1 }}>
                <FormControl fullWidth sx={{ minWidth: 220 }}>
                  <InputLabel id="enterprise-select-label">Chọn xí nghiệp</InputLabel>
                  <Select
                    labelId="enterprise-select-label"
                    value={selectedEnterprise?.name_enterprise || ""}
                    label="Chọn xí nghiệp"
                    onChange={(event) => setSelectedEnterpriseName(event.target.value)}
                    disabled={currentUser?.role !== "admin"}
                  >
                    {visibleEnterprises.map((enterprise) => (
                      <MenuItem key={enterprise.id || enterprise.name_enterprise} value={enterprise.name_enterprise}>
                        {enterprise.name_enterprise}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ minWidth: 220 }}>
                  <InputLabel id="branch-select-label">Chọn cung</InputLabel>
                  <Select
                    labelId="branch-select-label"
                    value={selectedBranch?.name_branch || ""}
                    label="Chọn cung"
                    onChange={(event) => setSelectedBranchName(event.target.value)}
                    disabled={!currentBranches.length || currentUser?.role !== "admin"}
                  >
                    {currentBranches.map((branch) => (
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
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">{selectedSystem.name_system}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSystem.__enterpriseName} / {selectedSystem.__branchName}
                  </Typography>
                </Box>
              </Stack>

              <DataTable value={selectedSystem.children || []} emptyMessage="Không có dữ liệu" responsiveLayout="scroll">
                <Column field="id" header="ID" />
                <Column field="name" header="Danh mục" />
                <Column header="Hành động" body={(rowData, options) => (<ActionButtons onView={() => handleOpenChildren(rowData, options.rowIndex)} />)} />
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

        <AddItemDialog open={openAdd} onClose={handleCloseAdd} onConfirm={handleConfirmAdd} context={addContext} systems={currentSystems} />
      </Box>

      <AppSnackbar open={toast.open} severity={toast.severity} message={toast.message} onClose={() => setToast((prev) => ({ ...prev, open: false }))} />
    </>
  );
}
