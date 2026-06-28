import { Link } from "@tanstack/react-router";
import { store } from "@/store";
import { Box, Button, Typography } from "@mui/material";

export function NotFoundPage() {
  const { isAuthenticated } = store.getState().auth;

  if (!isAuthenticated) {
    window.location.href = "/app/login";
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        gap: 2,
      }}
    >
      <Typography
        variant="h1"
        fontSize={96}
        fontWeight={700}
        color="text.secondary"
      >
        404
      </Typography>
      <Typography variant="h5" color="text.secondary">
        Page not found
      </Typography>
      <Button variant="contained" component={Link} to="/organizations">
        Go to Dashboard
      </Button>
    </Box>
  );
}
