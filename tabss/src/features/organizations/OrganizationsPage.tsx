import { Add } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  TableCell,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Table,
  TableBody,
  TableContainer,
  TableGlobalSearch,
  TableHead,
  TablePagination,
  TableRoot,
  TableRow,
  TableSortHeader,
} from "@/components/ui/DataTable";
import {
  useCreateTrialOrganizationMutation,
  useGetMyOrganizationsQuery,
} from "./organizationsApi";
import { setCurrentOrganization } from "./organizationsSlice";
import type { RootState } from "@/store";
import type { Organization } from "./types";

export function OrganizationsPage() {
  const dispatch = useDispatch();
  const currentOrganization = useSelector(
    (state: RootState) => state.organizations.currentOrganization,
  );
  const {
    data: organizations,
    isLoading,
    isError,
  } = useGetMyOrganizationsQuery();
  const [createOrg, { isLoading: isCreating }] =
    useCreateTrialOrganizationMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [nameError, setNameError] = useState("");

  const handleSelectOrg = (org: Organization) => {
    dispatch(setCurrentOrganization(org));
  };

  const handleOpen = () => {
    setOrgName("");
    setNameError("");
    setModalOpen(true);
  };

  const handleClose = () => setModalOpen(false);

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setNameError("Organization name is required.");
      return;
    }
    try {
      await createOrg({ name: orgName.trim() }).unwrap();
      handleClose();
    } catch {
      setNameError("Failed to create organization. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Page header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Organizations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            View and manage your organizations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ borderRadius: 2 }}
          onClick={handleOpen}
        >
          New Organization
        </Button>
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load organizations. Please try again.
        </Alert>
      )}

      <TableRoot
        variant="striped"
        data={organizations ?? []}
        getRowId={(row: Organization) => String(row.id)}
        defaultOrderBy="name"
        defaultRowsPerPage={10}
      >
        {() => (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {/* Toolbar */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 3,
                py: 1.5,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderBottom: 0,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {(organizations ?? []).length} organization
                {(organizations ?? []).length !== 1 ? "s" : ""} total
              </Typography>
              <TableGlobalSearch
                sx={{ minWidth: 240 }}
                placeholder="Search organizations…"
              />
            </Box>

            {/* Table */}
            <TableContainer
              sx={{
                flex: 1,
                overflow: "auto",
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              }}
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableSortHeader id="id">ID</TableSortHeader>
                    <TableSortHeader id="name">Name</TableSortHeader>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {({ visibleData: rows }: { visibleData: Organization[] }) => {
                    if (isLoading) {
                      return Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton width={40} />
                          </TableCell>
                          <TableCell>
                            <Skeleton width={220} />
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ));
                    }

                    if (rows.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                            <Typography color="text.secondary">
                              No organizations found.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return rows.map((org) => (
                      <TableRow
                        key={org.id}
                        hover
                        selected={currentOrganization?.id === org.id}
                        onClick={() => handleSelectOrg(org)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell
                          sx={{
                            width: 80,
                            color: "text.secondary",
                            fontFamily: "monospace",
                            fontSize: 13,
                          }}
                        >
                          {org.id}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {org.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ width: 60 }} />
                      </TableRow>
                    ));
                  }}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderTop: 0,
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
                bgcolor: "background.paper",
              }}
            >
              <TablePagination />
            </Box>
          </Box>
        )}
      </TableRoot>
      {/* New Organization Dialog */}
      <Dialog open={modalOpen} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>New Organization</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Organization name"
            value={orgName}
            onChange={(e) => {
              setOrgName(e.target.value);
              setNameError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            error={!!nameError}
            helperText={nameError}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
