import React, { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Radio from "@mui/material/Radio";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";

const STATUS_OPTIONS = ["Tốt", "Bình thường", "Hỏng"];

function normalizeValue(value) {
  return String(value || "").trim();
}

function keepDigitsOnly(value) {
  return String(value || "").replace(/\D+/g, "");
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

function getSiblingItems(systems, context, stationIndexes = []) {
  if (!context) return [];

  if (context.mode === "shared-category") {
    return stationIndexes.flatMap((stationIndex) => {
      const system = systems[stationIndex];
      return Array.isArray(system?.children) ? system.children : [];
    });
  }

  if (typeof context.systemIndex !== "number") return [];

  const system = systems[context.systemIndex];
  const parentNode = getNodeByPath(system, context.parentPath || []);

  return Array.isArray(parentNode?.children) ? parentNode.children : [];
}

function collectCodesFromNode(node, result) {
  if (!node || typeof node !== "object") return;

  const code = normalizeValue(node.code);
  if (code) result.add(code);

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => collectCodesFromNode(child, result));
  }
}

function getCodeOptions(systems = []) {
  const codeSet = new Set();
  systems.forEach((system) => collectCodesFromNode(system, codeSet));
  return Array.from(codeSet).sort((a, b) => a.localeCompare(b, "vi"));
}

function getNextSequentialId(items = []) {
  const maxId = items.reduce((maxValue, item) => {
    const rawId = normalizeValue(item?.id);

    if (!/^\d+$/.test(rawId)) return maxValue;

    const numericId = Number(rawId);
    return Number.isFinite(numericId) ? Math.max(maxValue, numericId) : maxValue;
  }, 0);

  return String(maxId + 1);
}

export default function AddItemDialog({
  open,
  onClose,
  onConfirm,
  context,
  systems = [],
}) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    material: "",
    number: "",
    year: "",
    expired: "",
    unit: "",
    note: "",
    status: "",
  });

  const [stationMode, setStationMode] = useState("all");
  const [selectedStations, setSelectedStations] = useState([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;

    setForm({
      name: "",
      code: "",
      material: "",
      number: "",
      year: "",
      expired: "",
      unit: "",
      note: "",
      status: "",
    });

    if (typeof context?.currentSystemIndex === "number") {
      setStationMode("selected");
      setSelectedStations([context.currentSystemIndex]);
    } else {
      setStationMode("all");
      setSelectedStations([]);
    }

    setSubmitAttempted(false);
  }, [open, context]);

  const showStationSelector = context?.mode === "shared-category";
  const showDetailFields = context?.mode === "single-detail";

  const dialogTitle = useMemo(() => {
    if (context?.mode === "shared-category") {
      return "Thêm mục mới cho nhiều ga";
    }

    if (context?.mode === "single-category-with-template") {
      return "Thêm nhóm thiết bị cho ga hiện tại";
    }

    if (context?.mode === "single-detail") {
      return "Thêm chi tiết tài sản";
    }

    return "Thêm mới";
  }, [context]);

  const targetStationIndexes = useMemo(() => {
    if (!showStationSelector) return [];

    return stationMode === "all"
      ? systems.map((_, idx) => idx)
      : selectedStations;
  }, [showStationSelector, stationMode, selectedStations, systems]);

  const siblingItems = useMemo(
    () => getSiblingItems(systems, context, targetStationIndexes),
    [systems, context, targetStationIndexes],
  );

  const nextAutoId = useMemo(
    () => getNextSequentialId(siblingItems),
    [siblingItems],
  );

  const codeOptions = useMemo(() => getCodeOptions(systems), [systems]);

  const errors = useMemo(() => {
    const nextErrors = {};

    const trimmedName = normalizeValue(form.name);
    const trimmedCode = normalizeValue(form.code);
    const trimmedMaterial = normalizeValue(form.material);
    const trimmedNumber = normalizeValue(form.number);
    const trimmedYear = normalizeValue(form.year);
    const trimmedExpired = normalizeValue(form.expired);
    const trimmedUnit = normalizeValue(form.unit);
    const trimmedStatus = normalizeValue(form.status);

    if (!trimmedName) {
      nextErrors.name = "Tên là bắt buộc.";
    }

    if (
      showStationSelector &&
      stationMode === "selected" &&
      targetStationIndexes.length === 0
    ) {
      nextErrors.selectedStations = "Chọn ít nhất 1 ga để thêm dữ liệu.";
    }

    if (showDetailFields) {
      if (!trimmedCode) nextErrors.code = "Mã code là bắt buộc.";
      if (!trimmedMaterial) nextErrors.material = "Vật liệu là bắt buộc.";
      if (!trimmedUnit) nextErrors.unit = "Đơn vị là bắt buộc.";

      if (!trimmedNumber) {
        nextErrors.number = "Số lượng là bắt buộc.";
      } else if (!/^\d+$/.test(trimmedNumber)) {
        nextErrors.number = "Số lượng chỉ được nhập số, không có dấu.";
      }

      if (!trimmedYear) {
        nextErrors.year = "Năm sản xuất là bắt buộc.";
      } else if (!/^\d+$/.test(trimmedYear)) {
        nextErrors.year = "Năm sản xuất chỉ được nhập số, không có dấu.";
      }

      if (!trimmedExpired) {
        nextErrors.expired = "Năm hết hạn là bắt buộc.";
      } else if (!/^\d+$/.test(trimmedExpired)) {
        nextErrors.expired = "Năm hết hạn chỉ được nhập số, không có dấu.";
      }

      if (!trimmedStatus) {
        nextErrors.status = "Trạng thái là bắt buộc.";
      } else if (!STATUS_OPTIONS.includes(trimmedStatus)) {
        nextErrors.status = "Trạng thái chỉ gồm: Tốt, Bình thường, Hỏng.";
      }
    }

    const hasDuplicateAutoId = siblingItems.some(
      (item) => normalizeValue(item?.id) === nextAutoId,
    );

    if (hasDuplicateAutoId) {
      nextErrors.id = `ID tự tăng ${nextAutoId} đang bị trùng trong danh sách.`;
    }

    return nextErrors;
  }, [
    form,
    showDetailFields,
    showStationSelector,
    siblingItems,
    stationMode,
    targetStationIndexes,
    nextAutoId,
  ]);

  const canSubmit = Object.keys(errors).length === 0;

  const handleChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleNumericChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: keepDigitsOnly(event.target.value),
    }));
  };

  const handleToggleStation = (checked, stationIndex) => {
    setSelectedStations((prev) =>
      checked
        ? [...prev, stationIndex]
        : prev.filter((idx) => idx !== stationIndex),
    );
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);

    if (!canSubmit) return;

    onConfirm({
      ...form,
      id: nextAutoId,
      name: normalizeValue(form.name),
      code: normalizeValue(form.code),
      material: normalizeValue(form.material),
      number: normalizeValue(form.number),
      year: normalizeValue(form.year),
      expired: normalizeValue(form.expired),
      unit: normalizeValue(form.unit),
      note: normalizeValue(form.note),
      status: normalizeValue(form.status),
      stationMode,
      selectedStations,
    });
  };

  const showError = (field) => submitAttempted && Boolean(errors[field]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{dialogTitle}</DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {showDetailFields
            ? "Nhập thông tin chi tiết tài sản. Trường Ghi chú có thể để trống."
            : ""}
        </Typography>

        {submitAttempted && !canSubmit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Vui lòng nhập đầy đủ và đúng định dạng trước khi thêm.
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            label="ID"
            value={nextAutoId}
            fullWidth
            InputProps={{ readOnly: true }}
            error={showError("id")}
            helperText={showError("id") ? errors.id : "ID tự tăng theo số thứ tự hiện có."}
          />

          <TextField
            label="Tên"
            value={form.name}
            onChange={handleChange("name")}
            fullWidth
            required
            error={showError("name")}
            helperText={showError("name") ? errors.name : " "}
          />

          {showDetailFields && (
            <>
              <Autocomplete
                freeSolo
                options={codeOptions}
                value={form.code}
                onInputChange={(_, newInputValue) => {
                  setForm((prev) => ({
                    ...prev,
                    code: newInputValue,
                  }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Mã code"
                    fullWidth
                    required
                    error={showError("code")}
                    helperText={showError("code") ? errors.code : "Hiện gợi ý các mã code đang có trong danh sách."}
                  />
                )}
              />

              <TextField
                label="Vật liệu"
                value={form.material}
                onChange={handleChange("material")}
                fullWidth
                required
                error={showError("material")}
                helperText={showError("material") ? errors.material : " "}
              />

              <TextField
                label="Đơn vị"
                value={form.unit}
                onChange={handleChange("unit")}
                fullWidth
                required
                error={showError("unit")}
                helperText={showError("unit") ? errors.unit : "Ví dụ: bộ, cái, chiếc, máy..."}
              />

              <TextField
                label="Số lượng"
                value={form.number}
                onChange={handleNumericChange("number")}
                fullWidth
                required
                error={showError("number")}
                helperText={showError("number") ? errors.number : "Chỉ nhập số, không có dấu."}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              />

              <TextField
                label="Năm sản xuất"
                value={form.year}
                onChange={handleNumericChange("year")}
                fullWidth
                required
                error={showError("year")}
                helperText={showError("year") ? errors.year : "Chỉ nhập số, không có dấu."}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              />

              <TextField
                label="Năm hết hạn"
                value={form.expired}
                onChange={handleNumericChange("expired")}
                fullWidth
                required
                error={showError("expired")}
                helperText={showError("expired") ? errors.expired : "Chỉ nhập số, không có dấu."}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              />

              <TextField
                label="Trạng thái"
                value={form.status}
                onChange={handleChange("status")}
                fullWidth
                required
                select
                error={showError("status")}
                helperText={showError("status") ? errors.status : "Chỉ có 3 lựa chọn: Tốt, Bình thường, Hỏng."}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Ghi chú"
                value={form.note}
                onChange={handleChange("note")}
                fullWidth
                multiline
                minRows={2}
                helperText="Không bắt buộc nhập."
              />
            </>
          )}
        </Stack>

        {showStationSelector && (
          <>
            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Phạm vi áp dụng
            </Typography>

            <FormControlLabel
              control={
                <Radio
                  checked={stationMode === "all"}
                  onChange={() => setStationMode("all")}
                />
              }
              label="Thêm cho tất cả ga"
            />

            <FormControlLabel
              control={
                <Radio
                  checked={stationMode === "selected"}
                  onChange={() => setStationMode("selected")}
                />
              }
              label="Chọn ga cần thêm"
            />

            {stationMode === "selected" && (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {systems.map((system, index) => (
                  <FormControlLabel
                    key={system.id || index}
                    control={
                      <Checkbox
                        checked={selectedStations.includes(index)}
                        onChange={(e) =>
                          handleToggleStation(e.target.checked, index)
                        }
                      />
                    }
                    label={system.name_system}
                  />
                ))}
              </Stack>
            )}

            {showError("selectedStations") && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {errors.selectedStations}
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Thêm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
