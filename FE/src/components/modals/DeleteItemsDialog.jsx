import React, { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";

export default function DeleteItemsDialog({
  open,
  onClose,
  title,
  items = [],
  onConfirm,
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
    }
  }, [open]);

  const handleToggle = (checked, id) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((itemId) => itemId !== id)
    );
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    onConfirm(selectedIds);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Xóa mục con</DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>Vị trí:</strong> {title}
        </Typography>

        {items.length === 0 ? (
          <Typography>Không có dữ liệu để xóa.</Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((item) => (
              <FormControlLabel
                key={`${item.id}-${item.name}`}
                control={
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onChange={(e) => handleToggle(e.target.checked, item.id)}
                  />
                }
                label={`${item.id} - ${item.name}`}
              />
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleSubmit}
          disabled={selectedIds.length === 0}
        >
          Xóa đã chọn
        </Button>
      </DialogActions>
    </Dialog>
  );
}