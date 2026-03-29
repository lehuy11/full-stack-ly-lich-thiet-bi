import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

export default function ActionButtons({ onView, onDelete }) {
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Button
        size="small"
        variant="contained"
        sx={{ minWidth: 40, height: 40 }}
        onClick={onView}
        aria-label="Xem chi tiết"
      >
        <i className="fas fa-search" />
      </Button>

      {typeof onDelete === "function" && (
        <Button
          size="small"
          color="error"
          variant="contained"
          sx={{ minWidth: 40, height: 40 }}
          onClick={onDelete}
          aria-label="Xóa"
        >
          <i className="fa fa-trash" />
        </Button>
      )}
    </Box>
  );
}
