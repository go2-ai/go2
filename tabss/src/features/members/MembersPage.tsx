import { PersonAdd } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  TableCell,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
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
import { useGetMembersQuery } from "./membersApi";
import { MemberActionsMenu } from "./components/MemberActionsMenu";
import { MemberModal } from "./components/MemberModal";
import type { Member, MemberStatus } from "./types";

const STATUS_CONFIG: Record<
  MemberStatus,
  {
    label: string;
    color: "default" | "primary" | "success" | "warning" | "error";
  }
> = {
  not_invited: { label: "Not Invited", color: "default" },
  invited: { label: "Invited", color: "warning" },
  joined: { label: "Joined", color: "success" },
  archived: { label: "Archived", color: "error" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(dateStr),
  );
}

export function MembersPage() {
  const currentOrganization = useSelector(
    (state: RootState) => state.organizations.currentOrganization,
  );
  const orgId = currentOrganization ? String(currentOrganization.id) : "";
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const {
    data: members,
    isLoading,
    isError,
  } = useGetMembersQuery(orgId, { skip: !orgId });

  const handleAddMember = () => {
    setEditingMember(null);
    setModalOpen(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingMember(null);
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
            Members
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your organization's members and their access.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={handleAddMember}
          sx={{ borderRadius: 2 }}
        >
          Add Member
        </Button>
      </Stack>

      {/* Error state */}
      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load members. Please try again.
        </Alert>
      )}

      <TableRoot
        data={members ?? []}
        defaultRowsPerPage={10}
        defaultOrderBy="name"
        getRowId={(row) => row.id}
        variant="striped"
      >
        {({ selectedIds }) => (
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
                bgcolor:
                  selectedIds.length > 0
                    ? "action.selected"
                    : "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderBottom: 0,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
              }}
            >
              {selectedIds.length > 0 ? (
                <Typography variant="body2" color="primary" fontWeight={500}>
                  {selectedIds.length} member
                  {selectedIds.length !== 1 ? "s" : ""} selected
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {(members ?? []).length} member
                  {(members ?? []).length !== 1 ? "s" : ""} total
                </Typography>
              )}

              <TableGlobalSearch
                sx={{ minWidth: 240 }}
                placeholder="Search members..."
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
                    <TableSortHeader id="name">Member</TableSortHeader>
                    <TableSortHeader id="status">Status</TableSortHeader>
                    <TableSortHeader id="joined_at">Joined</TableSortHeader>
                    <TableSortHeader id="invited_at">Invited</TableSortHeader>
                    <TableCell align="center">Admin</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {({ visibleData }: { visibleData: Member[] }) =>
                    isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton
                              variant="rectangular"
                              height={36}
                              sx={{ borderRadius: 1 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Skeleton width={100} />
                          </TableCell>
                          <TableCell>
                            <Skeleton width={80} />
                          </TableCell>
                          <TableCell>
                            <Skeleton width={80} />
                          </TableCell>
                          <TableCell />
                          <TableCell />
                        </TableRow>
                      ))
                    ) : visibleData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                          <Typography color="text.secondary">
                            No members found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleData.map((member) => {
                        const statusCfg =
                          STATUS_CONFIG[member.status] ??
                          STATUS_CONFIG.not_invited;
                        return (
                          <TableRow key={member.id} hover>
                            {/* Member avatar + name + email */}
                            <TableCell>
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1.5}
                              >
                                <Avatar
                                  sx={{
                                    width: 36,
                                    height: 36,
                                    bgcolor: member.color || "primary.main",
                                    fontSize: 14,
                                    fontWeight: 700,
                                  }}
                                >
                                  {member.initial ||
                                    member.name?.charAt(0)?.toUpperCase()}
                                </Avatar>
                                <Box>
                                  <Typography
                                    variant="body2"
                                    fontWeight={500}
                                    noWrap
                                  >
                                    {member.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    noWrap
                                  >
                                    {member.email}
                                  </Typography>
                                </Box>
                              </Stack>
                            </TableCell>

                            {/* Status chip */}
                            <TableCell>
                              <Chip
                                label={statusCfg.label}
                                color={statusCfg.color}
                                size="small"
                                variant={
                                  member.status === "joined"
                                    ? "filled"
                                    : "outlined"
                                }
                              />
                            </TableCell>

                            <TableCell>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {formatDate(member.joined_at)}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {formatDate(member.invited_at)}
                              </Typography>
                            </TableCell>

                            {/* Admin badge */}
                            <TableCell align="center">
                              {member.org_admin && (
                                <Chip
                                  label="Admin"
                                  color="primary"
                                  size="small"
                                  variant="filled"
                                  sx={{ fontWeight: 600 }}
                                />
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell align="right">
                              <MemberActionsMenu
                                member={member}
                                orgId={orgId}
                                onEdit={handleEditMember}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )
                  }
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

      <MemberModal
        open={modalOpen}
        onClose={handleCloseModal}
        orgId={orgId}
        member={editingMember}
      />
    </Box>
  );
}
